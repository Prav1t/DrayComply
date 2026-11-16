// Guards the non-negotiable constraints by reading the engine's own source.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const isTestCode = (f: string) => f.endsWith('.test.ts') || f.includes('/testing/');
const sources = walk(SRC).filter(f => f.endsWith('.ts') && !isTestCode(f)).map(f => ({ file: relative(SRC, f), text: readFileSync(f, 'utf8') }));
const core = sources.filter(s => !s.file.startsWith('adapters/'));

// Drop comments, strings and template text so only code is scanned.
const code = (text: string) => text
  .replace(/\/\/.*$/gm, '')
  .replace(/`(?:[^`\\]|\\.)*`/g, m => (m.match(/\$\{[^}]*\}/g) ?? []).join(' '))
  .replace(/'(?:[^'\\]|\\.)*'/g, "''");

describe('engine purity', () => {
  it('finds the source files it is meant to guard', () => {
    expect(sources.length).toBeGreaterThan(20);
  });
  it('imports nothing but its own relative modules', () => {
    for (const s of core) {
      const specifiers = [...s.text.matchAll(/from\s+'([^']+)'/g)].map(m => m[1] ?? '');
      expect({ file: s.file, external: specifiers.filter(x => !x.startsWith('.')) }).toEqual({ file: s.file, external: [] });
    }
  });
  it('lets only the adapter import packages/rates', () => {
    const importers = sources.filter(s => s.text.includes('/rates/')).map(s => s.file);
    expect(importers).toEqual(['adapters/obcctc.ts']);
  });
  it('reads no clock, environment, randomness, file or network', () => {
    const banned = [/Date\.now/, /new Date\(\s*\)/, /process\./, /Math\.random/, /\bfetch\(/, /\brequire\(/, /\bimport\(/, /performance\./];
    for (const s of sources) {
      expect({ file: s.file, hits: banned.filter(b => b.test(code(s.text))).map(String) }).toEqual({ file: s.file, hits: [] });
    }
  });
  it('does no floating-point money maths', () => {
    const banned = [/parseFloat/, /toFixed/, /Math\.round/, /Math\.floor/, /Math\.ceil/, /\d\.\d/];
    for (const s of core) {
      expect({ file: s.file, hits: banned.filter(b => b.test(code(s.text))).map(String) }).toEqual({ file: s.file, hits: [] });
    }
  });
  it('holds no numeric literal other than 0 and 1 outside the unit and date helpers', () => {
    const exempt = new Set(['math/units.ts', 'math/dates.ts']);
    for (const s of core.filter(x => !exempt.has(x.file))) {
      const literals = [...code(s.text).matchAll(/(?<![\w.$])\d[\d_]*n?\b/g)].map(m => m[0]).filter(n => !['0', '1', '0n', '1n'].includes(n));
      expect({ file: s.file, literals }).toEqual({ file: s.file, literals: [] });
    }
  });
  it('uses no any, no non-null assertion and no cast in engine source', () => {
    const banned = [/:\s*any\b/, /<any>/, /\bas\s+(?!const\b)[A-Za-z{]/, /\w!\./, /\w!\)/, /\w!;/, /@ts-/];
    for (const s of sources.filter(x => !x.file.startsWith('adapters/'))) {
      expect({ file: s.file, hits: banned.filter(b => b.test(code(s.text))).map(String) }).toEqual({ file: s.file, hits: [] });
    }
  });
});
