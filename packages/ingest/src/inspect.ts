import { parseCsv } from './csv';
import { parseXlsx } from './xlsx';
import type { Grid, SourceFile } from './types';

export type Inspection =
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ok';
      readonly sheets: readonly string[];                              // empty for CSV
      readonly headers: readonly string[];                             // empty until a sheet is chosen for a workbook
      readonly distinct: Readonly<Record<string, readonly string[]>>;  // header -> first distinct non-blank values, in file order
      readonly dataRows: number;
    };

const DISTINCT_LIMIT = 40;

// Looks at a file so a person can build a template: sheet names, column headers and the values each column holds.
// It reports what is there. It never suggests what a column means.
export function inspectFile(file: SourceFile, sheet: string | null, headerRow: number, delimiter: ',' | ';' | '\t'): Inspection {
  let grid: Grid | undefined;
  let sheets: readonly string[] = [];
  if (file.format === 'csv') {
    const csv = parseCsv(file.bytes, delimiter);
    if (csv.kind === 'error') return csv;
    grid = csv.grid;
  } else {
    const book = parseXlsx(file.bytes);
    if (book.kind === 'error') return book;
    sheets = [...book.sheets.keys()];
    if (sheet === null || sheet === '') return { kind: 'ok', sheets, headers: [], distinct: {}, dataRows: 0 };
    grid = book.sheets.get(sheet);
    if (grid === undefined) return { kind: 'error', message: `no sheet named ${sheet}` };
  }
  const show = (c: Grid['rows'][number][number] | undefined): string => (c === undefined ? '' : c.kind === 'text' ? c.text.trim() : c.code);
  const header = grid.rows[headerRow - 1];
  if (header === undefined) return { kind: 'error', message: `no row ${headerRow} to use as the header` };
  const headers = header.map(show);
  const data = grid.rows.slice(headerRow).filter(r => r.some(c => show(c) !== ''));
  const distinct = new Map<string, string[]>();
  headers.forEach((h, i) => {
    if (h === '' || distinct.has(h)) return;
    const seen: string[] = [];
    for (const row of data) {
      const v = show(row[i]);
      if (v !== '' && !seen.includes(v)) seen.push(v);
      if (seen.length >= DISTINCT_LIMIT) break;
    }
    distinct.set(h, seen);
  });
  return { kind: 'ok', sheets, headers: headers.filter(h => h !== ''), distinct: Object.fromEntries(distinct), dataRows: data.length };
}
