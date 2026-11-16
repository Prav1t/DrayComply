import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectFile } from './inspect';
import { bytes, sampleFiles } from './testing/sample';

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
