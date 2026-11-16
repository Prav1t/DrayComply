// End to end: sample exports through ingest and into the engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ingest } from './ingest';
import { parseTemplate, serializeTemplate } from './template';
import { sha256Hex } from './sha256';
import { DEDUCTIONS_TABLE, SAMPLE_CSV, SAMPLE_TABLES, bytes, sampleFiles, sampleTemplate } from './testing/sample';
import type { IngestResult, TableMapping } from './types';
import { parseComplianceInput, runCompliance } from '../../engine/src/index';
import { DEDUCTION_POLICY, OBCCTC_SCHEDULES } from '../../engine/src/adapters/obcctc';

type Completed = Extract<IngestResult, { kind: 'completed' }>;
const done = (r: IngestResult): Completed => {
  if (r.kind !== 'completed') throw new Error(`${r.kind}: ${r.errors.join('; ')}`);
  return r;
};
const OPTIONS = { asOf: '2026-11-16', rounding: 'half_up' as const, deductionPolicy: DEDUCTION_POLICY };
const run = (r: Completed) => {
  const result = runCompliance(r.input, OBCCTC_SCHEDULES, OPTIONS);
  if (result.kind !== 'completed') throw new Error(result.errors.join('; '));
  return result;
};
const replaceLine = (file: string, find: string, replacement: string): Record<string, string> => ({ [file]: (SAMPLE_CSV[file] ?? '').replace(find, replacement) });
const reasons = (r: Completed): string[] => r.rejects.map(x => `${x.table} row ${x.rowNumber} ${x.field ?? '-'}: ${x.reason}`);

describe('clean sample', () => {
  const r = done(ingest(sampleFiles(), sampleTemplate(), 'L1'));

  it('reads every row and rejects none', () => {
    expect(r.rejects).toEqual([]);
    expect(r.withheldDrivers).toEqual([]);
    expect(r.statement).toBe('Every row was read. No value was inferred or defaulted.');
    expect(r.manifest.map(m => [m.name, m.tables.map(t => [t.table, t.dataRows, t.acceptedRows])])).toEqual([
      ['drivers.csv', [['drivers', 2, 2]]], ['periods.csv', [['payPeriods', 2, 2]]], ['hours.csv', [['hours', 1, 1]]],
      ['trips.csv', [['trips', 1, 1]]], ['payments.csv', [['payments', 5, 5]]],
    ]);
  });
  it('produces input the engine\'s own boundary parser accepts unchanged', () => {
    const parsed = parseComplianceInput(JSON.parse(JSON.stringify(r.input)));
    expect(parsed.kind === 'ok' && parsed.value).toEqual(r.input);
  });
  it('runs through the engine with no shortfall for either driver', () => {
    // D1: 8.5 h x $34.56 = $293.76. IO1: trip $139.00, PMR $25.00, fuel 46% = $63.94, wait time $50.00 passed through.
    expect(run(r).drivers.map(d => [d.driverId, d.verdict, d.recordsVerdict])).toEqual([
      ['D1', 'no_shortfall_detected', 'no_records_finding_detected'], ['IO1', 'no_shortfall_detected', 'no_records_finding_detected'],
    ]);
  });
  it('hashes every file and the template into the run\'s provenance', () => {
    const drivers = r.manifest.find(m => m.name === 'drivers.csv');
    expect(drivers?.sha256).toBe(sha256Hex(bytes(SAMPLE_CSV['drivers.csv'] ?? '')));
    expect(r.input.provenance.sources.map(s => s.name)).toEqual(['drivers.csv', 'periods.csv', 'hours.csv', 'trips.csv', 'payments.csv', 'template:sample-template@v1']);
    expect(run(r).provenance.input).toEqual(r.input.provenance);
  });
  it('is deterministic', () => {
    expect(done(ingest(sampleFiles(), sampleTemplate(), 'L1'))).toEqual(r);
  });
  it('carries each payment\'s stated work period and trip link', () => {
    const lines = r.input.drivers.find(d => d.driverId === 'IO1')?.payPeriods[0]?.lines ?? [];
    expect(lines[0]).toEqual({ lineId: 'payments:payments.csv#3', kind: 'trip_rate', cents: 13_900, workPeriod: { kind: 'stated', from: '2026-07-05', to: '2026-07-18' }, link: { kind: 'trip', tripId: 'T1' } });
  });
});

describe('never inferring a missing value', () => {
  it('passes a blank wait time through as not reported, never as zero', () => {
    const r = done(ingest(sampleFiles(replaceLine('periods.csv', 'licensee,50.00', 'licensee,')), sampleTemplate(), 'L1'));
    expect(r.input.drivers.find(d => d.driverId === 'IO1')?.payPeriods[0]?.waitTimeReceived).toEqual({ kind: 'not_reported' });
    expect(run(r).drivers.find(d => d.driverId === 'IO1')?.periods[0]?.gaps.map(g => g.code)).toEqual(['WAIT_TIME_NOT_REPORTED']);
  });
  it('passes a blank destination and container count through as not reported', () => {
    const r = done(ingest(sampleFiles(replaceLine('trips.csv', 'Q,S,1', 'Q,,')), sampleTemplate(), 'L1'));
    const trip = r.input.drivers.find(d => d.driverId === 'IO1')?.trips[0];
    expect([trip?.containers, trip?.move]).toEqual([{ kind: 'not_reported' }, { kind: 'off_dock', origin: { kind: 'reported', value: 'Q' }, destination: { kind: 'not_reported' } }]);
  });
  it('passes payments with no work dates through as not stated, and the engine counts them nowhere', () => {
    const r = done(ingest(sampleFiles(replaceLine('payments.csv', '"$293.76",2026-07-05,2026-07-18,', '"$293.76",,,')), sampleTemplate(), 'L1'));
    expect(r.rejects).toEqual([]);
    expect(run(r).drivers.find(d => d.driverId === 'D1')?.periods[0]?.gaps.map(g => g.code)).toEqual(['PAYMENT_WORK_PERIOD_NOT_STATED']);
  });
  it('rejects a payment with only one end of its work period', () => {
    const r = done(ingest(sampleFiles(replaceLine('payments.csv', '"$293.76",2026-07-05,2026-07-18,', '"$293.76",2026-07-05,,')), sampleTemplate(), 'L1'));
    expect(reasons(r)).toEqual(['payments row 2 workTo: only one end of the work period is given; give both, or neither']);
  });
  it('leaves a missing opening balance not reported, so the engine cannot pick a tier', () => {
    const r = done(ingest(sampleFiles(replaceLine('drivers.csv', ',,0,2020-01-01', ',,,2020-01-01')), sampleTemplate(), 'L1'));
    expect(r.input.drivers.find(d => d.driverId === 'D1')?.openingCumulativeMinutes).toEqual({ kind: 'not_reported' });
    expect(run(r).drivers.find(d => d.driverId === 'D1')?.verdict).toBe('insufficient_data');
  });
  it('rejects the row when the template does not accept a blank there', () => {
    const strict = { ...SAMPLE_TABLES.payPeriods } as Extract<TableMapping, { kind: 'mapped' }>;
    const wait = strict.fields.waitTimeReceived;
    const tables = { payPeriods: { ...strict, fields: { ...strict.fields, ...(wait === undefined ? {} : { waitTimeReceived: { ...wait, blank: 'reject' as const } }) } } };
    const r = done(ingest(sampleFiles(replaceLine('periods.csv', 'licensee,50.00', 'licensee,')), sampleTemplate(tables), 'L1'));
    expect(reasons(r)[0]).toBe('payPeriods row 3 waitTimeReceived: value is missing, and the template does not accept a blank here');
  });
});

describe('reject list and withheld drivers', () => {
  const bad = done(ingest(sampleFiles(replaceLine('payments.csv', 'IO1,P1,Fuel,63.94', 'IO1,P1,Fuel,63.945')), sampleTemplate(), 'L1'));

  it('gives the file, row, field, raw value and reason for a rejected row', () => {
    expect(bad.rejects).toEqual([{ table: 'payments', file: 'payments.csv', rowNumber: 5, field: 'amount', driverId: 'IO1', raw: '63.945', reason: 'amount has more than two decimal places; it is not rounded for you' }]);
  });
  it('withholds that driver entirely, so the engine never judges partial records', () => {
    expect(bad.withheldDrivers).toEqual([{ driverId: 'IO1', rejectedRows: 1 }]);
    expect(bad.input.drivers.map(d => d.driverId)).toEqual(['D1']);
    expect(bad.statement).toContain('1 row(s) were rejected and 1 driver(s) withheld');
  });
  it('reports every unreadable field of a row, not just the first', () => {
    const r = done(ingest(sampleFiles(replaceLine('payments.csv', 'IO1,P1,Fuel,63.94,2026-07-05', 'IO1,P1,Gas,abc,07/05/2026')), sampleTemplate(), 'L1'));
    expect(r.rejects.map(x => x.field)).toEqual(['kind', 'amount', 'workFrom']);
    expect(r.withheldDrivers).toEqual([{ driverId: 'IO1', rejectedRows: 1 }]);
  });
  it('counts a row for an unknown driver as unattributed: it could belong to anyone', () => {
    const r = done(ingest(sampleFiles({ 'hours.csv': `${SAMPLE_CSV['hours.csv'] ?? ''}\nD9,2026-07-07,4` }), sampleTemplate(), 'L1'));
    expect(reasons(r)).toEqual(['hours row 3 driverId: driver is not in the drivers table']);
    expect([r.unattributedRejects, r.withheldDrivers, r.input.drivers.length]).toEqual([1, [], 2]);
    expect(r.statement).toContain('1 rejected row(s) could not be tied to a known driver');
  });
  it('rejects a payment on a pay period the driver does not have', () => {
    const r = done(ingest(sampleFiles(replaceLine('payments.csv', 'IO1,P1,PMR', 'IO1,P7,PMR')), sampleTemplate(), 'L1'));
    expect(reasons(r)).toEqual(['payments row 4 payPeriodId: pay period is not in the payPeriods table for this driver']);
  });
  it('rejects a second record that reuses an identifier', () => {
    const r = done(ingest(sampleFiles({ 'trips.csv': `${SAMPLE_CSV['trips.csv'] ?? ''}\nIO1,T1,2026-07-07,Off-Dock,,,Q,S,1` }), sampleTemplate(), 'L1'));
    expect(reasons(r)).toEqual(['trips row 3 tripId: identifier "T1" is already used by another record of this driver']);
  });
  it('rejects an IEO row with no employing I/O, and driver rows that disagree with each other', () => {
    const r = done(ingest(sampleFiles({ 'drivers.csv': `${SAMPLE_CSV['drivers.csv'] ?? ''}\nR1,Relief,2020-01-01,,,0,2020-01-01,,no,\nD1,Company,2019-01-01,2019-12-31,,5,2020-01-01,,yes,yes` }), sampleTemplate(), 'L1'));
    expect(reasons(r)).toEqual([
      'drivers row 4 employingIoDriverId: an IEO row needs the driver id of the employing I/O',
      'drivers row 5 openingCumulativeHours: value differs from an earlier row for the same driver',
    ]);
  });
  it('skips wholly empty lines without counting or rejecting them', () => {
    const r = done(ingest(sampleFiles({ 'hours.csv': 'Driver,Date,Hours\n,,\nD1,2026-07-06,8.5\n\n' }), sampleTemplate(), 'L1'));
    expect([r.rejects.length, r.manifest.find(m => m.name === 'hours.csv')?.tables[0]?.dataRows]).toEqual([0, 1]);
  });
});

describe('deductions', () => {
  const files = (rows: string) => [...sampleFiles(), { name: 'deductions.csv', format: 'csv' as const, bytes: bytes(`Driver,Period,Reason,Amount\n${rows}`) }];
  const template = sampleTemplate({ deductions: DEDUCTIONS_TABLE });

  it('maps the licensee\'s own label to a policy category, and the engine reports the prohibited deduction', () => {
    const result = run(done(ingest(files('D1,P1,Chassis Rent,40.00'), template, 'L1')));
    const finding = result.drivers.find(d => d.driverId === 'D1')?.periods[0]?.findings.find(f => f.ruleId === 'DISALLOWED_DEDUCTION');
    expect([finding?.amountCents, finding?.nature]).toEqual([4_000, 'prohibited_deduction']);
  });
  it('passes an unmapped label through untouched, so the engine raises a gap instead of a guess', () => {
    const r = done(ingest(files('D1,P1,Uniform Fee,12.00'), template, 'L1'));
    expect(r.input.drivers.find(d => d.driverId === 'D1')?.payPeriods[0]?.deductions[0]?.category).toBe('Uniform Fee');
    expect(run(r).drivers.find(d => d.driverId === 'D1')?.periods[0]?.gaps.map(g => g.code)).toEqual(['DEDUCTION_CATEGORY_UNKNOWN']);
  });
});

describe('templates', () => {
  const errorsOf = (t: unknown): readonly string[] => { const r = parseTemplate(t); return r.kind === 'invalid' ? r.errors : []; };
  const drivers = SAMPLE_TABLES.drivers as Extract<TableMapping, { kind: 'mapped' }>;
  const withField = (name: string, mapping: unknown) => sampleTemplate({ drivers: { ...drivers, fields: { ...drivers.fields, [name]: mapping } } as TableMapping });

  it('round-trips through JSON, so it can be saved and reused', () => {
    const first = parseTemplate(sampleTemplate());
    expect(first.kind === 'ok' && parseTemplate(JSON.parse(serializeTemplate(first.template)))).toEqual(first);
  });
  it('refuses a template that is silent about a table: say mapped, or say none', () => {
    const { fuelPrices: _omitted, ...rest } = SAMPLE_TABLES;
    expect(errorsOf({ id: 't', name: 't', version: 1, tables: rest })).toEqual(['fuelPrices: not declared. Map it, or declare it as none.']);
  });
  it('refuses a template that leaves a field unmapped', () => {
    const { classTo: _omitted, ...fields } = drivers.fields;
    expect(errorsOf(sampleTemplate({ drivers: { ...drivers, fields } }))).toEqual(['drivers.classTo: not mapped']);
  });
  it('refuses to accept blanks, or to omit the column, for a field that can never be blank', () => {
    expect(errorsOf(withField('driverId', { source: { kind: 'column', header: 'Driver' }, format: { kind: 'text', map: {} }, blank: 'accept' }))).toEqual(['drivers.driverId: this field can never be blank']);
    expect(errorsOf(withField('class', { source: { kind: 'not_provided' }, format: { kind: 'enum', values: {} }, blank: 'accept' }))).toEqual(['drivers.class: this field can never be blank']);
  });
  it('refuses a format of the wrong type, an enum target that does not exist, and a field the table does not have', () => {
    expect(errorsOf(withField('classFrom', { source: { kind: 'column', header: 'From' }, format: { kind: 'text', map: {} }, blank: 'reject' }))).toEqual(['drivers.classFrom: format is text but the field is date']);
    expect(errorsOf(withField('class', { source: { kind: 'column', header: 'Type' }, format: { kind: 'enum', values: { Company: 'EMPLOYEE' } }, blank: 'reject' }))[0]).toContain('"Company" maps to "EMPLOYEE"');
    expect(errorsOf(withField('nickname', { source: { kind: 'column', header: 'Nick' }, format: { kind: 'text', map: {} }, blank: 'reject' }))).toEqual(['drivers.nickname: not a field of this table']);
  });
  it('stops the whole ingest when the template is invalid', () => {
    expect(ingest(sampleFiles(), { id: 't' }, 'L1').kind).toBe('template_invalid');
  });
});

describe('files that do not fit the template', () => {
  const errorsOf = (r: IngestResult): readonly string[] => (r.kind === 'file_invalid' ? r.errors : []);
  it('stops when a mapped column is missing, naming it', () => {
    const r = ingest(sampleFiles({ 'hours.csv': 'Driver,Date,Hrs\nD1,2026-07-06,8.5' }), sampleTemplate(), 'L1');
    expect(errorsOf(r)).toEqual(['hours.duration: column "Hours" is not in hours.csv']);
  });
  it('stops when a column header appears twice: it will not pick one', () => {
    const r = ingest(sampleFiles({ 'hours.csv': 'Driver,Date,Hours,Hours\nD1,2026-07-06,8.5,9' }), sampleTemplate(), 'L1');
    expect(errorsOf(r)).toEqual(['hours.duration: column "Hours" appears 2 times in hours.csv']);
  });
  it('stops when a file the template names was not supplied', () => {
    expect(errorsOf(ingest(sampleFiles().filter(f => f.name !== 'trips.csv'), sampleTemplate(), 'L1'))).toEqual(['trips: file trips.csv was not supplied']);
  });
});

describe('xlsx source', () => {
  const real = new Uint8Array(readFileSync(fileURLToPath(new URL('../samples/payments.xlsx', import.meta.url))));
  const payments = SAMPLE_TABLES.payments as Extract<TableMapping, { kind: 'mapped' }>;
  const serial = { kind: 'date' as const, format: 'excel_serial' as const };
  const from = payments.fields.workFrom;
  const to = payments.fields.workTo;
  const fields = { ...payments.fields, ...(from === undefined || to === undefined ? {} : { workFrom: { ...from, format: serial }, workTo: { ...to, format: serial } }) };
  const template = (sheet: string | null) => sampleTemplate({ payments: { ...payments, file: 'payments.xlsx', sheet, fields } });
  const files = [...sampleFiles().filter(f => f.name !== 'payments.csv'), { name: 'payments.xlsx', format: 'xlsx' as const, bytes: real }];

  it('reads payments from a real workbook, with amounts exact and date numbers converted', () => {
    const r = done(ingest(files, template('Payments'), 'L1'));
    expect(r.rejects).toEqual([]);
    expect(r.input.drivers.find(d => d.driverId === 'D1')?.payPeriods[0]?.lines).toEqual([
      { lineId: 'payments:payments.xlsx#2', kind: 'hourly', cents: 29_376, workPeriod: { kind: 'stated', from: '2026-07-05', to: '2026-07-18' } },
    ]);
  });
  it('stops when the template names no sheet, or a sheet the workbook lacks', () => {
    expect(ingest(files, template(null), 'L1')).toEqual({ kind: 'file_invalid', errors: ['payments: payments.xlsx is a workbook, so the template must name a sheet'] });
    expect(ingest(files, template('Sheet9'), 'L1')).toEqual({ kind: 'file_invalid', errors: ['payments: payments.xlsx has no sheet named Sheet9'] });
  });
});
