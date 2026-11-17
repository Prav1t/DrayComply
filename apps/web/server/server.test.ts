// Unit tests for the server helpers that need no database.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { ingest } from '../../../packages/ingest/src/index';
import { canonicalJson, hashPassword, newToken, sha256Hex, verifyPassword } from './crypto';
import { checkFile } from './files';
import { runRequest, driverFields, wholeNumber } from './forms';
import { log, setLogSinkForTests } from './log';
import { ROSTER_TABLES, rosterFiles, type RosterDriver } from './roster';

describe('passwords and tokens', () => {
  it('verifies the right password and no other, with a fresh salt each time', async () => {
    const [a, b] = [await hashPassword('correct horse battery staple'), await hashPassword('correct horse battery staple')];
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct horse battery staple', a)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', a)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
  it('makes 256-bit tokens', () => {
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(newToken());
  });
  it('hashes equal JSON values equally whatever the key order', () => {
    expect(canonicalJson({ b: 1, a: [{ d: null, c: 'x' }] })).toBe('{"a":[{"c":"x","d":null}],"b":1}');
    expect(sha256Hex(canonicalJson({ a: 1, b: 2 }))).toBe(sha256Hex(canonicalJson({ b: 2, a: 1 })));
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('file checks', () => {
  const text = (s: string): Uint8Array => new TextEncoder().encode(s);
  it('accepts CSV and a real XLSX archive, and keeps only the base name', () => {
    expect(checkFile('C:\\exports\\July Payroll.csv', text('a,b\n1,2'))).toMatchObject({ name: 'July Payroll.csv', format: 'csv' });
    expect(checkFile('book.XLSX', zipSync({ 'xl/workbook.xml': strToU8('<workbook/>') })).format).toBe('xlsx');
  });
  it('refuses other types, wrong contents, empty files and text that is not UTF-8', () => {
    const message = (name: string, bytes: Uint8Array): string => { try { checkFile(name, bytes); return 'accepted'; } catch (e) { return e instanceof Error ? e.message : ''; } };
    expect(message('run.sh', text('x'))).toContain('only .csv and .xlsx');
    expect(message('a.csv', new Uint8Array())).toContain('empty');
    expect(message('a.xlsx', text('PK but not really'))).toContain('not an Excel');
    expect(message('a.csv', new Uint8Array([0x4e, 0x6f, 0xeb, 0x6c]))).toContain('not UTF-8');
    expect(message('a<b>.csv', text('x'))).toContain('cannot be used');
    expect(message(`${'n'.repeat(130)}.csv`, text('x'))).toContain('too long');
  });
  it('refuses a workbook that declares more than the unpacked limit', () => {
    // 201 entries of 1 MB of zeros compress to almost nothing but declare 201 MB.
    const big = new Uint8Array(1024 * 1024);
    const bomb = zipSync(Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`xl/s${i}.xml`, big])), { level: 9 });
    expect(bomb.length).toBeLessThan(10 * 1024 * 1024);
    expect(() => checkFile('bomb.xlsx', bomb)).toThrow('too large once unpacked');
  });
});

describe('request parsing', () => {
  it('keeps a blank as null and never coerces a non-number', () => {
    expect(driverFields({ externalId: 'D1', openingCumulativeMinutes: '', fuelBasis: '', calloutsFlagged: '' })).toEqual({
      externalId: 'D1', displayName: null, openingCumulativeMinutes: null, hourlyCoverageFrom: null, fuelBasis: null, calloutsFlagged: null, otherLicenseeHoursReported: null,
    });
    expect(wholeNumber({ n: '120' }, 'n')).toBe(120);
    expect(() => wholeNumber({ n: '12.5' }, 'n')).toThrow('whole number');
    expect(() => wholeNumber({ n: 'abc' }, 'n')).toThrow('whole number');
  });
  it('reads a run request, and refuses half a period range', () => {
    const base = { datasetId: '11111111-1111-4111-8111-111111111111', templateId: '22222222-2222-4222-8222-222222222222', asOf: '2026-11-16' };
    expect(runRequest(base)).toMatchObject({ periods: { kind: 'all' }, drivers: { kind: 'all' } });
    expect(runRequest({ ...base, periodFrom: '2026-07-01', periodTo: '2026-07-31', driverIds: 'D1, IO1' })).toMatchObject({ periods: { kind: 'range', from: '2026-07-01', to: '2026-07-31' }, drivers: { kind: 'only', driverIds: ['D1', 'IO1'] } });
    expect(() => runRequest({ ...base, periodFrom: '2026-07-01' })).toThrow('both ends');
    expect(() => runRequest({ ...base, datasetId: 'x' })).toThrow('Choose a data set');
  });
});

describe('logging', () => {
  it('writes only allowed fields, so a stray value cannot reach the logs', () => {
    const lines: string[] = [];
    setLogSinkForTests(l => lines.push(l));
    log('info', { event: 'request', status: 200, email: 'driver@example.test', amount: 29376, body: { a: 1 }, route: 'GET /api/x' });
    setLogSinkForTests(null);
    const out = JSON.parse(lines[0] ?? '{}');
    expect(Object.keys(out).sort()).toEqual(['at', 'event', 'level', 'route', 'status']);
  });
});

describe('roster files', () => {
  const NONE = { kind: 'none' } as const;
  const template = { id: 'r', name: 'r', version: 1, tables: { ...ROSTER_TABLES, payPeriods: NONE, hours: NONE, trips: NONE, payments: NONE, deductions: NONE, callouts: NONE, fuelPrices: NONE } };
  const roster: RosterDriver[] = [
    { externalId: 'IO, "Quoted"', openingCumulativeMinutes: null, hourlyCoverageFrom: null, fuelBasis: 'published', calloutsFlagged: null, otherLicenseeHoursReported: null,
      classPeriods: [{ class: 'IO_TRIP', employingIoExternalId: null, from: '2021-03-01', to: null }], otherHours: [] },
    { externalId: 'D1', openingCumulativeMinutes: 120_000, hourlyCoverageFrom: '2024-01-01', fuelBasis: null, calloutsFlagged: true, otherLicenseeHoursReported: true,
      classPeriods: [{ class: 'DEO', employingIoExternalId: null, from: '2024-06-01', to: null }, { class: 'IEO', employingIoExternalId: 'IO, "Quoted"', from: '2023-01-01', to: '2024-05-31' }],
      otherHours: [{ workDate: '2026-07-07', minutes: 90 }] },
    { externalId: 'NOCLASS', openingCumulativeMinutes: null, hourlyCoverageFrom: null, fuelBasis: null, calloutsFlagged: null, otherLicenseeHoursReported: null, classPeriods: [], otherHours: [] },
  ];

  it('round-trips through packages/ingest: what the roster says is what the engine is given', () => {
    const { files, withoutClass } = rosterFiles(roster);
    const result = ingest(files, template, 'L1');
    if (result.kind !== 'completed') throw new Error(result.errors.join('; '));
    expect(result.rejects).toEqual([]);
    expect(withoutClass).toEqual(['NOCLASS']);
    const d1 = result.input.drivers.find(d => d.driverId === 'D1');
    expect(d1?.classPeriods).toEqual([
      { class: 'IEO', employingIoDriverId: 'IO, "Quoted"', from: '2023-01-01', to: '2024-05-31' },
      { class: 'DEO', from: '2024-06-01', to: null },
    ]);
    expect(d1?.openingCumulativeMinutes).toEqual({ kind: 'reported', value: 120_000 });
    expect(d1?.otherLicenseeHours).toEqual({ kind: 'reported', entries: [{ workDate: '2026-07-07', minutes: 90 }] });
    expect(d1?.fuelBasis).toEqual({ kind: 'not_reported' });
    const io = result.input.drivers.find(d => d.driverId === 'IO, "Quoted"');
    expect(io?.openingCumulativeMinutes).toEqual({ kind: 'not_reported' });   // null stays unreported; never zero
    expect(io?.callouts).toEqual({ kind: 'not_flagged' });
  });
  it('gives the same bytes for the same roster in any order', () => {
    const a = rosterFiles(roster).files.map(f => sha256Hex(f.bytes));
    const b = rosterFiles([...roster].reverse()).files.map(f => sha256Hex(f.bytes));
    expect(a).toEqual(b);
  });
});

describe('wording', () => {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
    if (n === 'node_modules' || n === '.next' || n === 'test-results' || n === 'playwright-report') return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  it('no screen, component or server message ever says "compliant"', () => {
    const offenders = walk(ROOT).filter(f => /\.(tsx?|css)$/.test(f) && !/\.(test|itest|spec)\.ts$/.test(f) && !f.includes('/e2e/'))
      .filter(f => /compliant/i.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('the clean-result wording is exactly the required sentence', () => {
    const labels = readFileSync(join(ROOT, 'lib', 'labels.ts'), 'utf8');
    expect(labels).toContain("no_shortfall_detected: 'No shortfall detected under the rules as encoded, for the data provided.'");
  });
});
