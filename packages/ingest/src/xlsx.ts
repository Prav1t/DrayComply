import { unzipSync, strFromU8 } from 'fflate';
import type { Cell, Grid } from './types';

export type XlsxResult =
  | { readonly kind: 'ok'; readonly sheets: ReadonlyMap<string, Grid> }
  | { readonly kind: 'error'; readonly message: string };

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(xml: string): string {
  return xml.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? whole;
  });
}

const attr = (tag: string, name: string): string | null => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

// All <t> runs inside one string item, joined: rich text is several runs.
const textRuns = (xml: string): string => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map(m => decode(m[1] ?? '')).join('');

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? '';
  return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

function readSheet(xml: string, shared: readonly string[], date1904: boolean): Grid {
  const rows: Cell[][] = [];
  for (const rowMatch of xml.matchAll(/<row\s([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowIndex = Number(attr(` ${rowMatch[1] ?? ''}`, 'r') ?? rows.length + 1) - 1;
    while (rows.length <= rowIndex) rows.push([]);
    const cells = rows[rowIndex] ?? [];
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = ` ${cellMatch[1] ?? ''}`;
      const body = cellMatch[2] ?? '';
      const col = columnIndex(attr(tag, 'r') ?? '');
      if (col < 0) continue;
      const type = attr(tag, 't') ?? 'n';
      const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
      // Numbers are kept as the decimal text the file stores; they never pass through a float.
      const cell: Cell =
        type === 's' ? { kind: 'text', text: shared[Number(v)] ?? '' }
        : type === 'inlineStr' ? { kind: 'text', text: textRuns(body) }
        : type === 'e' ? { kind: 'error', code: decode(v) }
        : type === 'b' ? { kind: 'text', text: v === '1' ? 'TRUE' : 'FALSE' }
        : { kind: 'text', text: decode(v) };
      while (cells.length < col) cells.push({ kind: 'text', text: '' });
      cells[col] = cell;
    }
  }
  return { rows, date1904 };
}

// Reads every worksheet. No styles are read, so a date cell arrives as its serial number.
export function parseXlsx(bytes: Uint8Array): XlsxResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { kind: 'error', message: 'the file is not a readable .xlsx workbook' };
  }
  const read = (path: string): string | null => {
    const entry = files[path];
    return entry === undefined ? null : strFromU8(entry);
  };
  const workbook = read('xl/workbook.xml');
  const rels = read('xl/_rels/workbook.xml.rels');
  if (workbook === null || rels === null) return { kind: 'error', message: 'the workbook has no sheet list' };

  const sharedXml = read('xl/sharedStrings.xml') ?? '';
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map(m => textRuns(m[1] ?? ''));
  const date1904 = /<workbookPr\s[^>]*date1904="(1|true)"/.test(workbook);
  const targets = new Map<string, string>();
  for (const rel of rels.matchAll(/<Relationship\s([^>]*)\/>/g)) {
    const tag = ` ${rel[1] ?? ''}`;
    const id = attr(tag, 'Id');
    const target = attr(tag, 'Target');
    if (id !== null && target !== null) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  const sheets = new Map<string, Grid>();
  for (const sheet of workbook.matchAll(/<sheet\s([^>]*)\/>/g)) {
    const tag = ` ${sheet[1] ?? ''}`;
    const name = attr(tag, 'name');
    const xml = read(targets.get(attr(tag, 'r:id') ?? '') ?? '');
    if (name === null || xml === null) return { kind: 'error', message: 'a worksheet listed in the workbook is missing' };
    sheets.set(decode(name), readSheet(xml, shared, date1904));
  }
  return { kind: 'ok', sheets };
}
