import { assemble } from './assemble';
import { parseCsv } from './csv';
import { mapTable } from './map';
import { sha256Hex } from './sha256';
import { parseTemplate } from './template';
import { parseXlsx } from './xlsx';
import { TABLE_KINDS, type Grid, type IngestResult, type ManifestEntry, type Reject, type Row, type SourceFile, type TableKind } from './types';

// Files and a template in; engine input, a reject list and a file manifest out. No file is read from disk here.
export function ingest(files: readonly SourceFile[], template: unknown, licenseeId: string): IngestResult {
  const parsed = parseTemplate(template);
  if (parsed.kind === 'invalid') return { kind: 'template_invalid', errors: parsed.errors };
  const t = parsed.template;

  const errors: string[] = [];
  const names = files.map(f => f.name);
  names.filter((n, i) => names.indexOf(n) !== i).forEach(n => errors.push(`two files are both named ${n}`));
  const workbooks = new Map<string, ReadonlyMap<string, Grid>>();
  const rows = new Map<TableKind, readonly Row[]>();
  const rejects: Reject[] = [];
  const dataRows = new Map<TableKind, number>();

  for (const table of TABLE_KINDS) {
    const mapping = t.tables[table];
    if (mapping.kind === 'none') continue;
    const file = files.find(f => f.name === mapping.file);
    if (file === undefined) { errors.push(`${table}: file ${mapping.file} was not supplied`); continue; }
    let grid: Grid | undefined;
    if (file.format === 'csv') {
      const csv = parseCsv(file.bytes, mapping.delimiter);
      if (csv.kind === 'error') { errors.push(`${file.name}: ${csv.message}`); continue; }
      grid = csv.grid;
    } else {
      let sheets = workbooks.get(file.name);
      if (sheets === undefined) {
        const book = parseXlsx(file.bytes);
        if (book.kind === 'error') { errors.push(`${file.name}: ${book.message}`); continue; }
        sheets = book.sheets;
        workbooks.set(file.name, sheets);
      }
      if (mapping.sheet === null) { errors.push(`${table}: ${file.name} is a workbook, so the template must name a sheet`); continue; }
      grid = sheets.get(mapping.sheet);
      if (grid === undefined) { errors.push(`${table}: ${file.name} has no sheet named ${mapping.sheet}`); continue; }
    }
    const mapped = mapTable(table, mapping, grid);
    errors.push(...mapped.errors);
    rows.set(table, mapped.rows);
    rejects.push(...mapped.rejects);
    dataRows.set(table, mapped.dataRows);
  }
  if (errors.length > 0) return { kind: 'file_invalid', errors };

  const hashed = files.map(f => ({ file: f, sha256: sha256Hex(f.bytes) }));
  const of = (k: TableKind): readonly Row[] => rows.get(k) ?? [];
  const assembled = assemble(
    { drivers: of('drivers'), payPeriods: of('payPeriods'), hours: of('hours'), trips: of('trips'), payments: of('payments'),
      deductions: of('deductions'), callouts: of('callouts'), otherLicenseeHours: of('otherLicenseeHours'), fuelPrices: of('fuelPrices') },
    rejects, licenseeId,
    { sources: [...hashed.map(h => ({ name: h.file.name, digest: `sha256:${h.sha256}` })), { name: `template:${t.id}@v${t.version}`, digest: `sha256:${sha256Hex(new TextEncoder().encode(JSON.stringify(t)))}` }] },
  );

  const manifest: ManifestEntry[] = hashed.map(h => ({
    name: h.file.name, format: h.file.format, sha256: h.sha256, bytes: h.file.bytes.length,
    tables: TABLE_KINDS.flatMap(table => {
      const m = t.tables[table];
      return m.kind === 'mapped' && m.file === h.file.name ? [{ table, dataRows: dataRows.get(table) ?? 0, acceptedRows: assembled.acceptedRows.get(table) ?? 0 }] : [];
    }),
  }));
  const rejectedRows = new Set(assembled.rejects.map(x => `${x.table}|${x.file}|${x.rowNumber}`)).size;
  const statement = rejectedRows === 0
    ? 'Every row was read. No value was inferred or defaulted.'
    : `${rejectedRows} row(s) were rejected and ${assembled.withheldDrivers.length} driver(s) withheld from the run. ${assembled.unattributedRejects} rejected row(s) could not be tied to a known driver and may belong to any driver. No value was inferred or defaulted.`;

  return {
    kind: 'completed', input: assembled.input, rejects: assembled.rejects, withheldDrivers: assembled.withheldDrivers,
    unattributedRejects: assembled.unattributedRejects, manifest, templateId: t.id, statement,
  };
}
