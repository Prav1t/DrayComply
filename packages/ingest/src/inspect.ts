import { parseCsv } from './csv';
import { parseXlsx } from './xlsx';
import { mapTable } from './map';
import type { Grid, SourceFile, TableKind, TableMapping, Value } from './types';

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

export interface PreviewRow {
  readonly rowNumber: number;
  readonly status: 'read' | 'rejected';
  readonly cells: Readonly<Record<string, string>>;     // field -> how it was read, as text
  readonly problems: readonly string[];                 // why the row was rejected, one per field
}

export type Preview =
  | { readonly kind: 'error'; readonly errors: readonly string[] }
  | { readonly kind: 'ok'; readonly rows: readonly PreviewRow[]; readonly dataRows: number; readonly rejectedRows: number };

const shownValue = (v: Value): string => {
  switch (v.kind) {
    case 'text': case 'date': return v.value;
    case 'cents': return `$${Math.trunc(v.value / 100)}.${(v.value % 100).toString().padStart(2, '0')}`;
    case 'minutes': return `${Math.trunc(v.value / 60)} h ${(v.value % 60).toString().padStart(2, '0')} min`;
    case 'integer': return v.value.toString();
    case 'list': return v.value.length === 0 ? '(none)' : v.value.join(', ');
    case 'blank': return '(blank)';
  }
};

// Reads one table through its mapping exactly as ingest would, so a person can see the result before running anything.
export function previewTable(file: SourceFile, table: TableKind, mapping: Extract<TableMapping, { kind: 'mapped' }>, limit: number): Preview {
  let grid: Grid | undefined;
  if (file.format === 'csv') {
    const csv = parseCsv(file.bytes, mapping.delimiter);
    if (csv.kind === 'error') return { kind: 'error', errors: [csv.message] };
    grid = csv.grid;
  } else {
    const book = parseXlsx(file.bytes);
    if (book.kind === 'error') return { kind: 'error', errors: [book.message] };
    grid = mapping.sheet === null ? undefined : book.sheets.get(mapping.sheet);
    if (grid === undefined) return { kind: 'error', errors: ['choose a sheet'] };
  }
  const mapped = mapTable(table, mapping, grid);
  if (mapped.errors.length > 0) return { kind: 'error', errors: mapped.errors };
  const rejected = new Map<number, string[]>();
  mapped.rejects.forEach(r => rejected.set(r.rowNumber, [...(rejected.get(r.rowNumber) ?? []), `${r.field ?? 'row'}: ${r.reason}${r.raw === '' ? '' : ` ("${r.raw}")`}`]));
  const rows: PreviewRow[] = [
    ...mapped.rows.map(r => ({ rowNumber: r.rowNumber, status: 'read' as const, cells: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, shownValue(v)])), problems: [] })),
    ...[...rejected.entries()].map(([rowNumber, problems]) => ({ rowNumber, status: 'rejected' as const, cells: {}, problems })),
  ].sort((a, b) => a.rowNumber - b.rowNumber);
  // Rejected rows are always shown; read rows fill what is left of the limit.
  const bad = rows.filter(r => r.status === 'rejected').slice(0, limit);
  const good = rows.filter(r => r.status === 'read').slice(0, Math.max(0, limit - bad.length));
  return { kind: 'ok', rows: [...bad, ...good].sort((a, b) => a.rowNumber - b.rowNumber), dataRows: mapped.dataRows, rejectedRows: rejected.size };
}
