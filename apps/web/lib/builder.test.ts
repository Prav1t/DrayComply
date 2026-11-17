import { describe, it, expect } from 'vitest';
import { EMPTY_FIELD, draftToTemplate, emptyDraft, templateToDraft, type Draft } from './builder';
import { parseTemplate } from '../../../packages/ingest/src/index';
import { sampleTemplate } from '../../../packages/ingest/src/testing/sample';

const errors = (d: Draft): readonly string[] => { const r = parseTemplate(draftToTemplate(d)); return r.kind === 'invalid' ? r.errors : []; };
const sample = () => { const r = parseTemplate(sampleTemplate()); if (r.kind !== 'ok') throw new Error('sample'); return r.template; };

describe('template builder state', () => {
  it('starts with nothing declared, and the parser says so for every table', () => {
    expect(errors({ ...emptyDraft(), id: 't', name: 't' })).toHaveLength(9);
    expect(errors({ ...emptyDraft(), id: 't', name: 't' })[0]).toBe('drivers: not declared. Map it, or declare it as none.');
  });
  it('never pre-maps a field: a mapped table with untouched fields reports each one', () => {
    const d = emptyDraft();
    const draft: Draft = { ...d, id: 't', name: 't', tables: { ...d.tables, hours: { ...d.tables.hours, use: 'mapped', file: 'hours.csv' } } };
    expect(errors(draft).filter(e => e.startsWith('hours.'))).toEqual(['hours.driverId: not mapped', 'hours.entryId: not mapped', 'hours.workDate: not mapped', 'hours.duration: not mapped', 'hours.seq: not mapped']);
  });
  it('refuses a date column until a date format is chosen', () => {
    const d = templateToDraft(sample());
    const workDate = d.tables.hours.fields.workDate ?? EMPTY_FIELD;
    const draft: Draft = { ...d, tables: { ...d.tables, hours: { ...d.tables.hours, fields: { ...d.tables.hours.fields, workDate: { ...workDate, dateFormat: '' } } } } };
    expect(errors(draft)).toEqual(['hours.workDate: needs a valid source, format and blank']);
  });
  it('refuses a money or time column until its unit is chosen: no unit is ever preselected', () => {
    expect([EMPTY_FIELD.moneyUnit, EMPTY_FIELD.durationUnit, EMPTY_FIELD.separator]).toEqual(['', '', '']);
    const d = templateToDraft(sample());
    const set = (table: 'hours' | 'payments', field: string, patch: Partial<typeof EMPTY_FIELD>): Draft =>
      ({ ...d, tables: { ...d.tables, [table]: { ...d.tables[table], fields: { ...d.tables[table].fields, [field]: { ...(d.tables[table].fields[field] ?? EMPTY_FIELD), ...patch } } } } });
    expect(errors(set('hours', 'duration', { durationUnit: '' }))).toEqual(['hours.duration: needs a valid source, format and blank']);
    expect(errors(set('payments', 'amount', { moneyUnit: '' }))).toEqual(['payments.amount: needs a valid source, format and blank']);
    expect(errors(set('hours', 'duration', { durationUnit: 'minutes' }))).toEqual([]);
  });
  it('lets a date field be declared "not in this file" without asking for a format it would never use', () => {
    const d = templateToDraft(sample());
    const classTo = { ...EMPTY_FIELD, source: 'not_provided' as const };
    const draft: Draft = { ...d, tables: { ...d.tables, drivers: { ...d.tables.drivers, fields: { ...d.tables.drivers.fields, classTo } } } };
    expect(errors(draft)).toEqual([]);
  });
  it('round-trips a saved template through the form unchanged', () => {
    const t = sample();
    expect(parseTemplate(draftToTemplate(templateToDraft(t)))).toEqual({ kind: 'ok', template: t });
  });
  it('declares a table as none only when the user says so', () => {
    const d = templateToDraft(sample());
    expect(d.tables.deductions.use).toBe('none');
    expect(emptyDraft().tables.deductions.use).toBe('unset');
  });
});

describe('one table at a time', () => {
  it('gives a declared table in template form and nothing for an undeclared one', async () => {
    const { draftTable } = await import('./builder');
    const d = templateToDraft(sample());
    expect(draftTable(d, 'deductions')).toEqual({ kind: 'none' });
    expect(draftTable(emptyDraft(), 'drivers')).toBeUndefined();
    expect(draftTable(d, 'hours')).toMatchObject({ kind: 'mapped', file: 'hours.csv', sheet: null, headerRow: 1 });
  });
});
