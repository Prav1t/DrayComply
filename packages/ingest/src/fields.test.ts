import { describe, it, expect } from 'vitest';
import { parseField } from './fields';
import type { BlankMeaning, FieldFormat } from './types';

const read = (text: string, format: FieldFormat, blank: BlankMeaning = 'never', accept = false, date1904 = false) => {
  const r = parseField({ kind: 'text', text }, format, blank, accept, date1904);
  return r.kind === 'value' ? ('value' in r.value ? r.value.value : 'BLANK') : `REJECT: ${r.reason}`;
};
const DOLLARS: FieldFormat = { kind: 'money', unit: 'dollars' };
const HOURS: FieldFormat = { kind: 'duration', unit: 'hours' };

describe('money', () => {
  it('turns dollars into integer cents, ignoring the dollar sign and thousands commas', () => {
    expect(read('139.00', DOLLARS)).toBe(13_900);
    expect(read('$1,234.50', DOLLARS)).toBe(123_450);
    expect(read('  34.56 ', DOLLARS)).toBe(3_456);
    expect(read('139', DOLLARS)).toBe(13_900);
    expect(read('0.07', DOLLARS)).toBe(7);
  });
  it('gets 0.1 + 0.2 style values right, where a float would not', () => {
    expect(read('0.29', DOLLARS)).toBe(29);            // 0.29 * 100 is 28.999999999999996 in floating point
    expect(read('1.15', DOLLARS)).toBe(115);
    expect(read('4.35', DOLLARS)).toBe(435);
  });
  it('accepts spreadsheet storage noise but refuses a real third decimal', () => {
    expect(read('139.10000000000002', DOLLARS)).toBe(13_910);
    expect(read('139.105', DOLLARS)).toMatch(/more than two decimal places/);
    expect(read('139.1049', DOLLARS)).toMatch(/more than two decimal places/);
  });
  it('refuses negatives, bracketed negatives and non-numbers', () => {
    expect(read('-5.00', DOLLARS)).toMatch(/negative/);
    expect(read('(5.00)', DOLLARS)).toMatch(/negative/);
    expect(read('n/a', DOLLARS)).toMatch(/not a number/);
    expect(read('12.3.4', DOLLARS)).toMatch(/not a number/);
  });
  it('reads a cents column as whole cents only', () => {
    expect(read('13900', { kind: 'money', unit: 'cents' })).toBe(13_900);
    expect(read('139.5', { kind: 'money', unit: 'cents' })).toMatch(/not a whole number/);
  });
});

describe('duration', () => {
  it('turns decimal hours into whole minutes', () => {
    expect(read('8.5', HOURS)).toBe(510);
    expect(read('0.25', HOURS)).toBe(15);
    expect(read('11', HOURS)).toBe(660);
  });
  it('refuses hours that are not a whole number of minutes, and never rounds them', () => {
    expect(read('8.33', HOURS)).toMatch(/not a whole number of minutes/);
  });
  it('reads minutes and h:mm when the template says so', () => {
    expect(read('510', { kind: 'duration', unit: 'minutes' })).toBe(510);
    expect(read('8:30', { kind: 'duration', unit: 'hh:mm' })).toBe(510);
    expect(read('8:75', { kind: 'duration', unit: 'hh:mm' })).toMatch(/h:mm/);
  });
});

describe('dates', () => {
  it('reads only the format the template names', () => {
    expect(read('2026-07-06', { kind: 'date', format: 'YYYY-MM-DD' })).toBe('2026-07-06');
    expect(read('07/06/2026', { kind: 'date', format: 'MM/DD/YYYY' })).toBe('2026-07-06');
    expect(read('07/06/2026', { kind: 'date', format: 'DD/MM/YYYY' })).toBe('2026-06-07');   // same text, other meaning: the template decides
    expect(read('07/06/2026', { kind: 'date', format: 'YYYY-MM-DD' })).toMatch(/not in YYYY-MM-DD form/);
  });
  it('refuses a date that does not exist', () => {
    expect(read('2026-02-30', { kind: 'date', format: 'YYYY-MM-DD' })).toMatch(/not a real calendar date/);
    expect(read('13/01/2026', { kind: 'date', format: 'MM/DD/YYYY' })).toMatch(/not a real calendar date/);
  });
  it('reads spreadsheet date numbers in both date systems', () => {
    expect(read('46209', { kind: 'date', format: 'excel_serial' })).toBe('2026-07-06');
    expect(read('45658', { kind: 'date', format: 'excel_serial' })).toBe('2025-01-01');
    expect(read('44747', { kind: 'date', format: 'excel_serial' }, 'never', false, true)).toBe('2026-07-06');   // 1904 system: 1462 days fewer
  });
  it('refuses a date number with a time of day attached', () => {
    expect(read('46209.5', { kind: 'date', format: 'excel_serial' })).toMatch(/time of day/);
  });
});

describe('text, enums, integers and lists', () => {
  it('maps a known label and passes an unknown one through unchanged', () => {
    const format: FieldFormat = { kind: 'text', map: { 'Chassis Rent': 'chassis_rental' } };
    expect(read('Chassis Rent', format)).toBe('chassis_rental');
    expect(read('Mystery Fee', format)).toBe('Mystery Fee');   // the engine then raises a gap for it
  });
  it('rejects an enum value the template does not map, instead of guessing', () => {
    const format: FieldFormat = { kind: 'enum', values: { Company: 'DEO' } };
    expect(read('Company', format)).toBe('DEO');
    expect(read('company', format)).toMatch(/not one the template maps/);
  });
  it('reads whole numbers and separated lists', () => {
    expect(read('3', { kind: 'integer' })).toBe(3);
    expect(read('3.5', { kind: 'integer' })).toMatch(/not a whole number/);
    expect(read('E1; E2 ;', { kind: 'list', separator: ';' })).toEqual(['E1', 'E2']);
  });
});

describe('blanks and errors', () => {
  it('rejects an empty cell where a value is always needed', () => {
    expect(read('   ', DOLLARS)).toBe('REJECT: value is missing');
  });
  it('accepts an empty cell only when the field allows it and the template opts in', () => {
    expect(read('', DOLLARS, 'not_reported', true)).toBe('BLANK');
    expect(read('', DOLLARS, 'not_reported', false)).toMatch(/does not accept a blank/);
  });
  it('never turns a blank amount into zero', () => {
    expect(read('', DOLLARS, 'not_reported', true)).not.toBe(0);
  });
  it('rejects a spreadsheet error cell', () => {
    expect(parseField({ kind: 'error', code: '#REF!' }, DOLLARS, 'never', false, false)).toEqual({ kind: 'reject', reason: 'cell holds a spreadsheet error (#REF!)' });
  });
});
