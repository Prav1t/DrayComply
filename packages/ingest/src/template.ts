// Mapping templates are plain JSON, so they can be saved and reused. This file reads one back and checks it.
import { SPECS } from './specs';
import { TABLE_KINDS, type ColumnSource, type FieldFormat, type FieldMapping, type MappingTemplate, type TableMapping } from './types';

export type TemplateResult =
  | { readonly kind: 'ok'; readonly template: MappingTemplate }
  | { readonly kind: 'invalid'; readonly errors: readonly string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringMap = (v: unknown): v is Record<string, string> => isObj(v) && Object.values(v).every(x => typeof x === 'string');
const DATE_FORMATS = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'excel_serial'] as const;

function source(v: unknown): ColumnSource | null {
  if (!isObj(v)) return null;
  if (v.kind === 'column' && typeof v.header === 'string' && v.header !== '') return { kind: 'column', header: v.header };
  if (v.kind === 'constant' && typeof v.value === 'string') return { kind: 'constant', value: v.value };
  if (v.kind === 'not_provided') return { kind: 'not_provided' };
  return null;
}

function format(v: unknown): FieldFormat | null {
  if (!isObj(v)) return null;
  switch (v.kind) {
    case 'text': return isStringMap(v.map) ? { kind: 'text', map: v.map } : null;
    case 'enum': return isStringMap(v.values) ? { kind: 'enum', values: v.values } : null;
    case 'date': { const found = DATE_FORMATS.find(d => d === v.format); return found === undefined ? null : { kind: 'date', format: found }; }
    case 'money': return v.unit === 'dollars' || v.unit === 'cents' ? { kind: 'money', unit: v.unit } : null;
    case 'duration': return v.unit === 'hours' || v.unit === 'minutes' || v.unit === 'hh:mm' ? { kind: 'duration', unit: v.unit } : null;
    case 'integer': return { kind: 'integer' };
    case 'list': return typeof v.separator === 'string' && v.separator !== '' ? { kind: 'list', separator: v.separator } : null;
    default: return null;
  }
}

// Every table and every field must be declared. A template cannot stay silent about anything.
export function parseTemplate(v: unknown): TemplateResult {
  const errors: string[] = [];
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.name !== 'string' || typeof v.version !== 'number' || !isObj(v.tables)) {
    return { kind: 'invalid', errors: ['template needs id, name, version and tables'] };
  }
  const tables = new Map<string, TableMapping>();
  for (const table of TABLE_KINDS) {
    const raw = v.tables[table];
    if (!isObj(raw)) { errors.push(`${table}: not declared. Map it, or declare it as none.`); continue; }
    if (raw.kind === 'none') { tables.set(table, { kind: 'none' }); continue; }
    const delimiter = raw.delimiter === ',' || raw.delimiter === ';' || raw.delimiter === '\t' ? raw.delimiter : null;
    if (raw.kind !== 'mapped' || typeof raw.file !== 'string' || !(typeof raw.sheet === 'string' || raw.sheet === null)
      || typeof raw.headerRow !== 'number' || !Number.isInteger(raw.headerRow) || raw.headerRow < 1 || delimiter === null || !isObj(raw.fields)) {
      errors.push(`${table}: needs kind, file, sheet, headerRow (1 or more), delimiter and fields`);
      continue;
    }
    const spec = SPECS[table];
    const fields = new Map<string, FieldMapping>();
    Object.keys(raw.fields).filter(name => !Object.hasOwn(spec, name)).forEach(name => errors.push(`${table}.${name}: not a field of this table`));
    for (const [name, fieldSpec] of Object.entries(spec)) {
      const at = `${table}.${name}`;
      const m = raw.fields[name];
      if (!isObj(m)) { errors.push(`${at}: not mapped`); continue; }
      const src = source(m.source);
      const fmt = format(m.format);
      const blank = m.blank === 'accept' || m.blank === 'reject' ? m.blank : null;
      if (src === null || fmt === null || blank === null) { errors.push(`${at}: needs a valid source, format and blank`); continue; }
      if (fmt.kind !== fieldSpec.type) errors.push(`${at}: format is ${fmt.kind} but the field is ${fieldSpec.type}`);
      if (fieldSpec.blank === 'never' && (blank === 'accept' || src.kind === 'not_provided')) errors.push(`${at}: this field can never be blank`);
      if (src.kind === 'not_provided' && blank === 'reject') errors.push(`${at}: not provided, yet blanks are rejected; every row would fail`);
      if (fmt.kind === 'enum') {
        Object.entries(fmt.values).filter(([, to]) => !fieldSpec.enumValues.includes(to))
          .forEach(([from, to]) => errors.push(`${at}: "${from}" maps to "${to}", which is not one of ${fieldSpec.enumValues.join(', ')}`));
      }
      fields.set(name, { source: src, format: fmt, blank });
    }
    tables.set(table, { kind: 'mapped', file: raw.file, sheet: raw.sheet, headerRow: raw.headerRow, delimiter, fields: Object.fromEntries(fields) });
  }
  if (errors.length > 0) return { kind: 'invalid', errors };
  const get = (t: (typeof TABLE_KINDS)[number]): TableMapping => tables.get(t) ?? { kind: 'none' };
  return { kind: 'ok', template: { id: v.id, name: v.name, version: v.version, tables: {
    drivers: get('drivers'), payPeriods: get('payPeriods'), hours: get('hours'), trips: get('trips'), payments: get('payments'),
    deductions: get('deductions'), callouts: get('callouts'), otherLicenseeHours: get('otherLicenseeHours'), fuelPrices: get('fuelPrices'),
  } } };
}

export const serializeTemplate = (t: MappingTemplate): string => JSON.stringify(t, null, 2);
