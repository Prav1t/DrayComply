'use client';

import { useMemo, useState } from 'react';
import { SPECS, TABLE_KINDS, inspectFile, parseTemplate, serializeTemplate, type FieldSpec, type Inspection, type SourceFile, type TableKind } from '../../../packages/ingest/src/index';
import { DEDUCTION_CATEGORIES } from '../../../packages/rates/deduction-policy';
import { EMPTY_FIELD, draftToTemplate, emptyDraft, templateToDraft, type Draft, type FieldDraft, type TableDraft } from '../lib/builder';

const TABLE_LABELS: Readonly<Record<TableKind, string>> = {
  drivers: 'Drivers and class periods', payPeriods: 'Pay periods', hours: 'Hours worked', trips: 'Trips', payments: 'Payments',
  deductions: 'Deductions', callouts: 'Callout days', otherLicenseeHours: 'Hours for other licensees', fuelPrices: 'Discounted fuel prices',
};
const DATE_FORMATS = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'excel_serial'];
const BLANK_TEXT: Readonly<Record<FieldSpec['blank'], string>> = {
  never: '', not_reported: 'Blank means not reported', null: 'Blank means none', generated: 'Blank gets a generated value', empty_list: 'Blank means none',
};

interface Props {
  readonly files: readonly SourceFile[];
  readonly initial: unknown;                                         // a loaded template to edit, or null
  readonly onUse: (template: unknown, name: string) => void;
}

export function TemplateBuilder({ files, initial, onUse }: Props) {
  const [draft, setDraft] = useState<Draft>(() => {
    const parsed = initial === null ? null : parseTemplate(initial);
    return parsed !== null && parsed.kind === 'ok' ? templateToDraft(parsed.template) : emptyDraft();
  });
  const template = useMemo(() => draftToTemplate(draft), [draft]);
  const checked = useMemo(() => parseTemplate(template), [template]);
  const problems = [
    ...(draft.id.trim() === '' || draft.name.trim() === '' ? ['Give the template an id and a name.'] : []),
    ...(checked.kind === 'invalid' ? checked.errors : []),
  ];

  const setTable = (table: TableKind, patch: Partial<TableDraft>): void =>
    setDraft(d => ({ ...d, tables: { ...d.tables, [table]: { ...d.tables[table], ...patch } } }));
  const setField = (table: TableKind, name: string, patch: Partial<FieldDraft>): void =>
    setDraft(d => {
      const t = d.tables[table];
      return { ...d, tables: { ...d.tables, [table]: { ...t, fields: { ...t.fields, [name]: { ...(t.fields[name] ?? EMPTY_FIELD), ...patch } } } } };
    });
  const download = (): void => {
    if (checked.kind !== 'ok') return;
    const url = URL.createObjectURL(new Blob([serializeTemplate(checked.template)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${checked.template.id}.template.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="builder">
      <div className="row">
        <label>Template id<input type="text" value={draft.id} onChange={e => setDraft(d => ({ ...d, id: e.target.value }))} /></label>
        <label>Template name<input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label>
      </div>
      <p className="muted">Declare every table: map it to a file, or state that there are no records of that kind. Nothing is filled in for you.</p>

      {TABLE_KINDS.map(table => (
        <TableEditor key={table} table={table} label={TABLE_LABELS[table]} draft={draft.tables[table]} files={files}
          onTable={patch => setTable(table, patch)} onField={(name, patch) => setField(table, name, patch)} />
      ))}

      {problems.length > 0 ? (
        <div className="banner warn">
          <b>{problems.length} thing(s) still to settle before this template can be used.</b>
          <ul className="plain">{problems.slice(0, 12).map(p => <li key={p}>{p}</li>)}{problems.length > 12 && <li>and {problems.length - 12} more</li>}</ul>
        </div>
      ) : <div className="banner note">The template is complete.</div>}
      <div className="row">
        <button type="button" disabled={problems.length > 0} onClick={() => onUse(template, `${draft.name.trim()} (built here)`)}>Use this template</button>
        <button type="button" className="secondary" disabled={problems.length > 0} onClick={download}>Save template (JSON)</button>
      </div>
    </div>
  );
}

interface TableProps {
  readonly table: TableKind;
  readonly label: string;
  readonly draft: TableDraft;
  readonly files: readonly SourceFile[];
  readonly onTable: (patch: Partial<TableDraft>) => void;
  readonly onField: (name: string, patch: Partial<FieldDraft>) => void;
}

function TableEditor({ table, label, draft, files, onTable, onField }: TableProps) {
  const file = files.find(f => f.name === draft.file);
  const seen: Inspection | null = useMemo(
    () => (draft.use === 'mapped' && file !== undefined ? inspectFile(file, draft.sheet === '' ? null : draft.sheet, draft.headerRow, draft.delimiter) : null),
    [draft.use, draft.sheet, draft.headerRow, draft.delimiter, file],
  );
  const headers = seen !== null && seen.kind === 'ok' ? seen.headers : [];
  const state = draft.use === 'unset' ? 'not declared' : draft.use === 'none' ? 'no records' : draft.file === '' ? 'choose a file' : draft.file;

  return (
    <details className="table-editor" open={draft.use === 'mapped'}>
      <summary><b>{label}</b> <span className="muted">({state})</span></summary>
      <div className="row">
        <label>This table
          <select value={draft.use} onChange={e => { const v = e.target.value; if (v === 'unset' || v === 'none' || v === 'mapped') onTable({ use: v }); }}>
            <option value="unset">Not declared yet</option><option value="mapped">Comes from a file</option><option value="none">There are no records of this kind</option>
          </select>
        </label>
        {draft.use === 'mapped' && (
          <>
            <label>File
              <select value={draft.file} onChange={e => onTable({ file: e.target.value, sheet: '' })}>
                <option value="">Choose</option>{files.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            </label>
            {file !== undefined && file.format === 'xlsx' && seen !== null && seen.kind === 'ok' && (
              <label>Sheet
                <select value={draft.sheet} onChange={e => onTable({ sheet: e.target.value })}>
                  <option value="">Choose</option>{seen.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
            <label>Header row<input type="text" inputMode="numeric" value={draft.headerRow} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1) onTable({ headerRow: n }); }} style={{ minWidth: 70, width: 70 }} /></label>
            {file !== undefined && file.format === 'csv' && (
              <label>Separator
                <select value={draft.delimiter} onChange={e => { const v = e.target.value; if (v === ',' || v === ';' || v === '\t') onTable({ delimiter: v }); }}>
                  <option value=",">Comma</option><option value=";">Semicolon</option><option value={'\t'}>Tab</option>
                </select>
              </label>
            )}
          </>
        )}
      </div>
      {seen !== null && seen.kind === 'error' && <div className="banner bad">{seen.message}</div>}
      {seen !== null && seen.kind === 'ok' && headers.length > 0 && <p className="muted">{seen.dataRows} data row(s), {headers.length} column(s).</p>}

      {draft.use === 'mapped' && headers.length > 0 && (
        <div className="scroll">
          <table>
            <thead><tr><th>Field</th><th>Comes from</th><th>Read as</th><th>Blank cells</th></tr></thead>
            <tbody>
              {Object.entries(SPECS[table]).map(([name, spec]) => (
                <FieldRow key={name} table={table} name={name} spec={spec} draft={draft.fields[name] ?? EMPTY_FIELD} headers={headers}
                  values={seen !== null && seen.kind === 'ok' ? seen.distinct : {}} onChange={patch => onField(name, patch)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

interface FieldProps {
  readonly table: TableKind;
  readonly name: string;
  readonly spec: FieldSpec;
  readonly draft: FieldDraft;
  readonly headers: readonly string[];
  readonly values: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (patch: Partial<FieldDraft>) => void;
}

function FieldRow({ table, name, spec, draft, headers, values, onChange }: FieldProps) {
  const raw = draft.source === 'column' ? values[draft.header] ?? [] : draft.source === 'constant' && draft.constant !== '' ? [draft.constant] : [];
  const setMapped = (from: string, to: string): void => {
    const { [from]: _dropped, ...rest } = draft.valueMap;
    onChange({ valueMap: to === '' ? rest : { ...rest, [from]: to } });
  };
  const listId = `${table}-${name}-options`;
  return (
    <tr>
      <td><b>{name}</b><br /><span className="muted">{spec.help}</span></td>
      <td>
        <select value={draft.source} onChange={e => { const v = e.target.value; if (v === '' || v === 'column' || v === 'constant' || v === 'not_provided') onChange({ source: v }); }}>
          <option value="">Not mapped yet</option><option value="column">A column</option><option value="constant">The same value on every row</option>
          {spec.blank !== 'never' && <option value="not_provided">Not in this file</option>}
        </select>
        {draft.source === 'column' && (
          <select value={draft.header} onChange={e => onChange({ header: e.target.value })}>
            <option value="">Choose a column</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        )}
        {draft.source === 'constant' && <input type="text" value={draft.constant} onChange={e => onChange({ constant: e.target.value })} />}
      </td>
      <td>
        {spec.type === 'date' && draft.source !== 'not_provided' && (
          <select value={draft.dateFormat} onChange={e => onChange({ dateFormat: e.target.value })}>
            <option value="">Choose the date format</option>{DATE_FORMATS.map(f => <option key={f} value={f}>{f === 'excel_serial' ? 'Spreadsheet date number' : f}</option>)}
          </select>
        )}
        {spec.type === 'money' && (
          <select value={draft.moneyUnit} onChange={e => { const v = e.target.value; if (v === 'dollars' || v === 'cents') onChange({ moneyUnit: v }); }}>
            <option value="dollars">Dollars (12.34)</option><option value="cents">Whole cents (1234)</option>
          </select>
        )}
        {spec.type === 'duration' && (
          <select value={draft.durationUnit} onChange={e => { const v = e.target.value; if (v === 'hours' || v === 'minutes' || v === 'hh:mm') onChange({ durationUnit: v }); }}>
            <option value="hours">Decimal hours (8.5)</option><option value="minutes">Minutes (510)</option><option value="hh:mm">Hours and minutes (8:30)</option>
          </select>
        )}
        {spec.type === 'list' && <label>Separator<input type="text" value={draft.separator} onChange={e => onChange({ separator: e.target.value })} style={{ minWidth: 50, width: 50 }} /></label>}
        {spec.type === 'integer' && <span className="muted">Whole number</span>}
        {spec.type === 'enum' && raw.length > 0 && (
          <div>
            {raw.map(v => (
              <div key={v} className="map-row"><code>{v}</code> means
                <select value={draft.valueMap[v] ?? ''} onChange={e => setMapped(v, e.target.value)}>
                  <option value="">Not mapped (row is rejected)</option>{spec.enumValues.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        {spec.type === 'text' && name !== 'driverId' && !name.endsWith('Id') && raw.length > 0 && (
          <details>
            <summary>Rename values (optional)</summary>
            {name === 'category' && <datalist id={listId}>{Object.keys(DEDUCTION_CATEGORIES).map(c => <option key={c} value={c} />)}</datalist>}
            {raw.map(v => (
              <div key={v} className="map-row"><code>{v}</code> becomes
                <input type="text" list={name === 'category' ? listId : undefined} value={draft.valueMap[v] ?? ''} placeholder="unchanged" onChange={e => setMapped(v, e.target.value.trim())} />
              </div>
            ))}
            {name === 'category' && <p className="muted">A label left unchanged is unknown to the deduction policy, and that driver&apos;s result will be insufficient data.</p>}
          </details>
        )}
      </td>
      <td>
        {spec.blank === 'never' ? <span className="muted">Never allowed</span> : draft.source === 'not_provided' ? <span className="muted">{BLANK_TEXT[spec.blank]}</span> : (
          <label className="check"><input type="checkbox" checked={draft.acceptBlank} onChange={e => onChange({ acceptBlank: e.target.checked })} />{BLANK_TEXT[spec.blank]}</label>
        )}
      </td>
    </tr>
  );
}
