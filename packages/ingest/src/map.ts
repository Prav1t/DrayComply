import { parseField } from './fields';
import { SPECS } from './specs';
import type { Cell, Grid, Reject, Row, TableKind, TableMapping, Value } from './types';

export interface MappedTable {
  readonly rows: readonly Row[];
  readonly rejects: readonly Reject[];
  readonly dataRows: number;
  readonly errors: readonly string[];   // problems with the table as a whole, such as a missing column
}

const EMPTY: Cell = { kind: 'text', text: '' };
const shown = (c: Cell): string => (c.kind === 'text' ? c.text : c.code);

// Applies one table mapping to one grid. A row with any unreadable field is rejected whole, with every reason.
export function mapTable(table: TableKind, mapping: Extract<TableMapping, { kind: 'mapped' }>, grid: Grid): MappedTable {
  const header = grid.rows[mapping.headerRow - 1];
  if (header === undefined) return { rows: [], rejects: [], dataRows: 0, errors: [`${table}: ${mapping.file} has no row ${mapping.headerRow} to use as the header`] };
  const titles = header.map(c => shown(c).trim());
  const errors: string[] = [];
  const columns = new Map<string, number>();
  for (const [name, m] of Object.entries(mapping.fields)) {
    if (m.source.kind !== 'column') continue;
    const wanted = m.source.header;
    const hits = titles.flatMap((t, i) => (t === wanted ? [i] : []));
    if (hits.length === 0) errors.push(`${table}.${name}: column "${wanted}" is not in ${mapping.file}`);
    else if (hits.length > 1) errors.push(`${table}.${name}: column "${wanted}" appears ${hits.length} times in ${mapping.file}`);
    else columns.set(name, hits[0] ?? 0);
  }
  if (errors.length > 0) return { rows: [], rejects: [], dataRows: 0, errors };

  const rows: Row[] = [];
  const rejects: Reject[] = [];
  let dataRows = 0;
  grid.rows.slice(mapping.headerRow).forEach((cells, offset) => {
    if (cells.every(c => c.kind === 'text' && c.text.trim() === '')) return;   // a wholly empty line is not a record
    dataRows += 1;
    const rowNumber = mapping.headerRow + offset + 1;
    const values = new Map<string, Value>();
    const failed: { field: string; raw: string; reason: string }[] = [];
    for (const [name, m] of Object.entries(mapping.fields)) {
      const spec = SPECS[table][name];
      if (spec === undefined) continue;
      const cell: Cell = m.source.kind === 'column' ? cells[columns.get(name) ?? -1] ?? EMPTY
        : m.source.kind === 'constant' ? { kind: 'text', text: m.source.value }
        : EMPTY;
      const parsed = parseField(cell, m.format, spec.blank, m.blank === 'accept', grid.date1904);
      if (parsed.kind === 'reject') failed.push({ field: name, raw: shown(cell), reason: parsed.reason });
      else values.set(name, parsed.value);
    }
    if (failed.length === 0) { rows.push({ table, file: mapping.file, rowNumber, values: Object.fromEntries(values) }); return; }
    const id = values.get('driverId');
    const driverId = id !== undefined && id.kind === 'text' ? id.value : null;
    failed.forEach(x => rejects.push({ table, file: mapping.file, rowNumber, field: x.field, driverId, raw: x.raw, reason: x.reason }));
  });
  return { rows, rejects, dataRows, errors };
}
