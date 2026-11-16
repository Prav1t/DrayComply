// The template builder's form state, and its conversion to and from a mapping template. Pure.
// Nothing here guesses a mapping: an untouched field stays unmapped and the template parser reports it.
import { SPECS, TABLE_KINDS, type FieldFormat, type FieldMapping, type MappingTemplate, type TableKind, type TableMapping } from '../../../packages/ingest/src/index';

export interface FieldDraft {
  readonly source: '' | 'column' | 'constant' | 'not_provided';
  readonly header: string;
  readonly constant: string;
  readonly dateFormat: string;                        // must be chosen; a date's meaning depends on it
  readonly moneyUnit: 'dollars' | 'cents';
  readonly durationUnit: 'hours' | 'minutes' | 'hh:mm';
  readonly separator: string;
  readonly valueMap: Readonly<Record<string, string>>; // raw value -> mapped value
  readonly acceptBlank: boolean;
}

export interface TableDraft {
  readonly use: 'unset' | 'none' | 'mapped';
  readonly file: string;
  readonly sheet: string;
  readonly headerRow: number;
  readonly delimiter: ',' | ';' | '\t';
  readonly fields: Readonly<Record<string, FieldDraft>>;
}

export interface Draft { readonly id: string; readonly name: string; readonly version: number; readonly tables: Readonly<Record<TableKind, TableDraft>> }

export const EMPTY_FIELD: FieldDraft = { source: '', header: '', constant: '', dateFormat: '', moneyUnit: 'dollars', durationUnit: 'hours', separator: ';', valueMap: {}, acceptBlank: false };

const emptyTable = (table: TableKind): TableDraft =>
  ({ use: 'unset', file: '', sheet: '', headerRow: 1, delimiter: ',', fields: Object.fromEntries(Object.keys(SPECS[table]).map(name => [name, EMPTY_FIELD])) });

const tables = (make: (t: TableKind) => TableDraft): Record<TableKind, TableDraft> => ({
  drivers: make('drivers'), payPeriods: make('payPeriods'), hours: make('hours'), trips: make('trips'), payments: make('payments'),
  deductions: make('deductions'), callouts: make('callouts'), otherLicenseeHours: make('otherLicenseeHours'), fuelPrices: make('fuelPrices'),
});

export const emptyDraft = (): Draft => ({ id: '', name: '', version: 1, tables: tables(emptyTable) });

function format(table: TableKind, name: string, f: FieldDraft): unknown {
  const type = SPECS[table][name]?.type;
  switch (type) {
    case 'text': return { kind: 'text', map: f.valueMap };
    case 'enum': return { kind: 'enum', values: f.valueMap };
    case 'date': return { kind: 'date', format: f.dateFormat };
    case 'money': return { kind: 'money', unit: f.moneyUnit };
    case 'duration': return { kind: 'duration', unit: f.durationUnit };
    case 'integer': return { kind: 'integer' };
    case 'list': return { kind: 'list', separator: f.separator };
    default: return null;
  }
}

// The result goes through parseTemplate, which names everything still missing. Unset tables and fields are left out on purpose.
export function draftToTemplate(d: Draft): unknown {
  const out = new Map<string, unknown>();
  for (const table of TABLE_KINDS) {
    const t = d.tables[table];
    if (t.use === 'unset') continue;
    if (t.use === 'none') { out.set(table, { kind: 'none' }); continue; }
    const fields = Object.entries(t.fields).filter(([, f]) => f.source !== '').map(([name, f]) => [name, {
      source: f.source === 'column' ? { kind: 'column', header: f.header } : f.source === 'constant' ? { kind: 'constant', value: f.constant } : { kind: 'not_provided' },
      format: format(table, name, f),
      blank: f.acceptBlank || f.source === 'not_provided' ? 'accept' : 'reject',
    }]);
    out.set(table, { kind: 'mapped', file: t.file, sheet: t.sheet === '' ? null : t.sheet, headerRow: t.headerRow, delimiter: t.delimiter, fields: Object.fromEntries(fields) });
  }
  return { id: d.id.trim(), name: d.name.trim(), version: d.version, tables: Object.fromEntries(out) };
}

function fieldDraft(m: FieldMapping): FieldDraft {
  const fmt: FieldFormat = m.format;
  return {
    ...EMPTY_FIELD,
    source: m.source.kind,
    header: m.source.kind === 'column' ? m.source.header : '',
    constant: m.source.kind === 'constant' ? m.source.value : '',
    dateFormat: fmt.kind === 'date' ? fmt.format : '',
    moneyUnit: fmt.kind === 'money' ? fmt.unit : 'dollars',
    durationUnit: fmt.kind === 'duration' ? fmt.unit : 'hours',
    separator: fmt.kind === 'list' ? fmt.separator : ';',
    valueMap: fmt.kind === 'text' ? fmt.map : fmt.kind === 'enum' ? fmt.values : {},
    acceptBlank: m.blank === 'accept',
  };
}

// Loads a saved template back into the form so it can be edited.
export function templateToDraft(t: MappingTemplate): Draft {
  const one = (table: TableKind): TableDraft => {
    const m: TableMapping = t.tables[table];
    if (m.kind === 'none') return { ...emptyTable(table), use: 'none' };
    return {
      use: 'mapped', file: m.file, sheet: m.sheet ?? '', headerRow: m.headerRow, delimiter: m.delimiter,
      fields: Object.fromEntries(Object.keys(SPECS[table]).map(name => { const f = m.fields[name]; return [name, f === undefined ? EMPTY_FIELD : fieldDraft(f)]; })),
    };
  };
  return { id: t.id, name: t.name, version: t.version, tables: tables(one) };
}
