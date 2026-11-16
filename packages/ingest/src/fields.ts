import Decimal from 'decimal.js';
import type { BlankMeaning, Cell, FieldFormat, Value } from './types';

export type Parsed =
  | { readonly kind: 'value'; readonly value: Value }
  | { readonly kind: 'reject'; readonly reason: string };

const ok = (value: Value): Parsed => ({ kind: 'value', value });
const no = (reason: string): Parsed => ({ kind: 'reject', reason });

// Storage noise only: 139.10000000000001 is 139.1. A real third decimal (139.105) survives and is refused.
const NOISE_PLACES = 9;

function decimal(text: string): Decimal | null {
  if (!/^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) return null;
  const d = new Decimal(text);
  return d.isFinite() ? d.toDecimalPlaces(NOISE_PLACES) : null;
}

function wholeNumber(d: Decimal, what: string): Parsed | number {
  if (!d.isInteger()) return no(`${what} is not a whole number`);
  if (d.isNegative()) return no(`${what} is negative`);
  if (d.greaterThan(Number.MAX_SAFE_INTEGER)) return no(`${what} is too large`);
  return d.toNumber();
}

function money(text: string, unit: 'dollars' | 'cents'): Parsed {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (/^\(.*\)$/.test(cleaned)) return no('amount is negative (in brackets); negative amounts are not accepted');
  const d = decimal(cleaned);
  if (d === null) return no('amount is not a number');
  const cents = unit === 'dollars' ? d.times(100) : d;
  if (!cents.isInteger()) return no(unit === 'dollars' ? 'amount has more than two decimal places; it is not rounded for you' : 'amount in cents is not a whole number');
  const n = wholeNumber(cents, 'amount');
  return typeof n === 'number' ? ok({ kind: 'cents', value: n }) : n;
}

function duration(text: string, unit: 'hours' | 'minutes' | 'hh:mm'): Parsed {
  if (unit === 'hh:mm') {
    const m = /^(\d+):([0-5]\d)$/.exec(text);
    if (m === null) return no('duration is not in h:mm form');
    return ok({ kind: 'minutes', value: Number(m[1]) * 60 + Number(m[2]) });
  }
  const d = decimal(text);
  if (d === null) return no('duration is not a number');
  const minutes = unit === 'hours' ? d.times(60).toDecimalPlaces(6) : d;
  if (!minutes.isInteger()) return no('duration is not a whole number of minutes; it is not rounded for you');
  const n = wholeNumber(minutes, 'duration');
  return typeof n === 'number' ? ok({ kind: 'minutes', value: n }) : n;
}

const pad = (n: number, width: number): string => n.toString().padStart(width, '0');

function realDate(y: number, m: number, d: number): string | null {
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (y < 1900 || back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

const MS_PER_DAY = 86_400_000;

function date(text: string, format: Extract<FieldFormat, { kind: 'date' }>['format'], date1904: boolean): Parsed {
  if (format === 'excel_serial') {
    const d = decimal(text);
    if (d === null || d.isNegative()) return no('date is not a spreadsheet date number');
    if (!d.isInteger()) return no('date carries a time of day; a date alone is needed');
    // 1900 system: serial 1 is 1900-01-01 and serial 60 is a day that never existed, so the base is 1899-12-30 after it.
    if (!date1904 && d.lessThan(61)) return no('date number is before March 1900 and cannot be read reliably');
    const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    return ok({ kind: 'date', value: new Date(base + d.toNumber() * MS_PER_DAY).toISOString().slice(0, 10) });
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const parts =
    format === 'YYYY-MM-DD' && iso !== null ? [iso[1], iso[2], iso[3]]
    : format === 'MM/DD/YYYY' && slashed !== null ? [slashed[3], slashed[1], slashed[2]]
    : format === 'DD/MM/YYYY' && slashed !== null ? [slashed[3], slashed[2], slashed[1]]
    : null;
  if (parts === null) return no(`date is not in ${format} form`);
  const value = realDate(Number(parts[0]), Number(parts[1]), Number(parts[2]));
  return value === null ? no('date is not a real calendar date') : ok({ kind: 'date', value });
}

// One cell to one typed value. Outer whitespace is trimmed; nothing else is repaired.
export function parseField(cell: Cell, format: FieldFormat, blank: BlankMeaning, acceptBlank: boolean, date1904: boolean): Parsed {
  if (cell.kind === 'error') return no(`cell holds a spreadsheet error (${cell.code})`);
  const text = cell.text.trim();
  if (text === '') {
    if (blank === 'never') return no('value is missing');
    return acceptBlank ? ok({ kind: 'blank' }) : no('value is missing, and the template does not accept a blank here');
  }
  switch (format.kind) {
    case 'text': return ok({ kind: 'text', value: Object.hasOwn(format.map, text) ? format.map[text] ?? text : text });
    case 'enum': {
      const mapped = Object.hasOwn(format.values, text) ? format.values[text] : undefined;
      return mapped === undefined ? no('value is not one the template maps') : ok({ kind: 'text', value: mapped });
    }
    case 'money': return money(text, format.unit);
    case 'duration': return duration(text, format.unit);
    case 'date': return date(text, format.format, date1904);
    case 'integer': {
      const d = decimal(text);
      if (d === null) return no('value is not a number');
      const n = wholeNumber(d, 'value');
      return typeof n === 'number' ? ok({ kind: 'integer', value: n }) : n;
    }
    case 'list': return ok({ kind: 'list', value: text.split(format.separator).map(s => s.trim()).filter(s => s !== '') });
  }
}
