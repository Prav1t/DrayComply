import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectFile, previewTable } from './inspect';
import { parseTableMapping } from './template';
import { SAMPLE_CSV, SAMPLE_TABLES, bytes, sampleFiles } from './testing/sample';
import type { TableMapping } from './types';

const file = (name: string) => sampleFiles().find(f => f.name === name) ?? { name, format: 'csv' as const, bytes: bytes('') };

describe('inspecting a file for the template builder', () => {
  it('lists the headers and the distinct values in each column, in file order', () => {
    const r = inspectFile(file('payments.csv'), null, 1, ',');
    expect(r.kind === 'ok' && r.headers).toEqual(['Driver', 'Period', 'Type', 'Amount', 'Work From', 'Work To', 'Trip']);
    expect(r.kind === 'ok' && r.distinct.Type).toEqual(['Regular', 'Trip', 'PMR', 'Fuel', 'Wait']);
    expect(r.kind === 'ok' && [r.distinct.Trip, r.dataRows]).toEqual([['T1'], 5]);   // blanks are not values
  });
  it('lists a workbook\'s sheets first, then its headers once a sheet is chosen', () => {
    const book = { name: 'payments.xlsx', format: 'xlsx' as const, bytes: new Uint8Array(readFileSync(fileURLToPath(new URL('../samples/payments.xlsx', import.meta.url)))) };
    expect(inspectFile(book, null, 1, ',')).toEqual({ kind: 'ok', sheets: ['Payments'], headers: [], distinct: {}, dataRows: 0 });
    const chosen = inspectFile(book, 'Payments', 1, ',');
    expect(chosen.kind === 'ok' && [chosen.headers.length, chosen.distinct.Amount]).toEqual([7, ['293.76', '139']]);
  });
  it('reports a missing header row, a missing sheet and an unreadable file', () => {
    expect(inspectFile(file('hours.csv'), null, 9, ',')).toEqual({ kind: 'error', message: 'no row 9 to use as the header' });
    expect(inspectFile({ name: 'x.xlsx', format: 'xlsx', bytes: bytes('nope') }, null, 1, ',').kind).toBe('error');
  });
});

describe('previewing a table through its mapping', () => {
  const payments = SAMPLE_TABLES.payments as Extract<TableMapping, { kind: 'mapped' }>;
  it('shows each row as ingest will read it: cents, dates, mapped kinds and blanks', () => {
    const r = previewTable(file('payments.csv'), 'payments', payments, 3);
    expect(r.kind === 'ok' && [r.dataRows, r.rejectedRows, r.rows.length]).toEqual([5, 0, 3]);
    expect(r.kind === 'ok' && r.rows[0]).toEqual({ rowNumber: 2, status: 'read', problems: [], cells: {
      driverId: 'D1', payPeriodId: 'P1', lineId: '(blank)', kind: 'hourly', amount: '$293.76', workFrom: '2026-07-05', workTo: '2026-07-18', tripId: '(blank)' } });
  });
  it('always shows rejected rows, with every reason, even past the limit', () => {
    const bad = { name: 'payments.csv', format: 'csv' as const, bytes: bytes(`${SAMPLE_CSV['payments.csv'] ?? ''}\nIO1,P1,Gas,12.345,2026-07-05,2026-07-18,`) };
    const r = previewTable(bad, 'payments', payments, 2);
    expect(r.kind === 'ok' && r.rows.map(x => [x.rowNumber, x.status])).toEqual([[2, 'read'], [7, 'rejected']]);
    expect(r.kind === 'ok' && r.rows[1]?.problems).toEqual(['kind: value is not one the template maps ("Gas")', 'amount: amount has more than two decimal places; it is not rounded for you ("12.345")']);
  });
  it('reports a mapped column that is not in the file', () => {
    expect(previewTable(file('hours.csv'), 'payments', payments, 3)).toMatchObject({ kind: 'error' });
  });
});

describe('checking one table mapping on its own', () => {
  it('accepts a complete table and names what an incomplete one lacks', () => {
    const errors: string[] = [];
    expect(parseTableMapping('payments', SAMPLE_TABLES.payments, errors)).toEqual(SAMPLE_TABLES.payments);
    const { amount: _dropped, ...fields } = (SAMPLE_TABLES.payments as Extract<TableMapping, { kind: 'mapped' }>).fields;
    expect(parseTableMapping('payments', { ...SAMPLE_TABLES.payments, fields }, errors)).toBeNull();
    expect(errors).toEqual(['payments.amount: not mapped']);
  });
});
