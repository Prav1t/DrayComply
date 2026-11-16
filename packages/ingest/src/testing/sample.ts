// A small, complete sample: five CSV exports and the template that maps them. Used by tests and as a starting point.
import type { FieldFormat, FieldMapping, SourceFile, TableMapping } from '../types';

const col = (header: string, format: FieldFormat, blank: 'accept' | 'reject' = 'reject'): FieldMapping => ({ source: { kind: 'column', header }, format, blank });
const none = (format: FieldFormat): FieldMapping => ({ source: { kind: 'not_provided' }, format, blank: 'accept' });
const TEXT: FieldFormat = { kind: 'text', map: {} };
const ISO: FieldFormat = { kind: 'date', format: 'YYYY-MM-DD' };
const DOLLARS: FieldFormat = { kind: 'money', unit: 'dollars' };
const HOURS: FieldFormat = { kind: 'duration', unit: 'hours' };
const YES_NO: FieldFormat = { kind: 'enum', values: { yes: 'yes', no: 'no' } };
const mapped = (file: string, fields: Record<string, FieldMapping>): TableMapping => ({ kind: 'mapped', file, sheet: null, headerRow: 1, delimiter: ',', fields });

export const SAMPLE_TABLES: Record<string, TableMapping> = {
  drivers: mapped('drivers.csv', {
    driverId: col('Driver', TEXT),
    class: col('Type', { kind: 'enum', values: { Company: 'DEO', 'Owner Operator Trip': 'IO_TRIP', 'Owner Operator Hourly': 'IO_HOURLY', Relief: 'IEO' } }),
    classFrom: col('From', ISO),
    classTo: col('To', ISO, 'accept'),
    employingIoDriverId: col('Employer IO', TEXT, 'accept'),
    openingCumulativeHours: col('Opening Hours', HOURS, 'accept'),
    hourlyCoverageFrom: col('Hours Complete From', ISO, 'accept'),
    fuelBasis: col('Fuel', { kind: 'enum', values: { published: 'published', discounted: 'io_discounted' } }, 'accept'),
    calloutsFlagged: col('Callouts', YES_NO, 'accept'),
    otherLicenseeHoursReported: col('Other Hours', YES_NO, 'accept'),
  }),
  payPeriods: mapped('periods.csv', {
    driverId: col('Driver', TEXT), payPeriodId: col('Period', TEXT), from: col('Start', ISO), to: col('End', ISO), payDate: col('Paid On', ISO),
    payer: col('Payer', { kind: 'enum', values: { licensee: 'licensee', io: 'employing_io' } }),
    waitTimeReceived: col('Wait Time', DOLLARS, 'accept'),
  }),
  hours: mapped('hours.csv', {
    driverId: col('Driver', TEXT), entryId: none(TEXT), workDate: col('Date', ISO), duration: col('Hours', HOURS), seq: none({ kind: 'integer' }),
  }),
  trips: mapped('trips.csv', {
    driverId: col('Driver', TEXT), tripId: col('Trip', TEXT), workDate: col('Date', ISO),
    moveKind: col('Kind', { kind: 'enum', values: { 'On-Dock': 'on_dock', 'Off-Dock': 'off_dock' } }),
    zone: col('Zone', TEXT, 'accept'),
    terminal: col('Terminal', { kind: 'text', map: { Deltaport: 'deltaport', 'Centerm/Vanterm': 'centermVanterm', FSD: 'fraserSurreyDocks' } }, 'accept'),
    origin: col('From Zone', TEXT, 'accept'), destination: col('To Zone', TEXT, 'accept'),
    containers: col('Containers', { kind: 'enum', values: { 1: 'one', 2: 'two' } }, 'accept'),
  }),
  payments: mapped('payments.csv', {
    driverId: col('Driver', TEXT), payPeriodId: col('Period', TEXT), lineId: none(TEXT),
    kind: col('Type', { kind: 'enum', values: { Regular: 'hourly', OT: 'overtime', Trip: 'trip_rate', PMR: 'pmr', Fuel: 'fuel', Wait: 'wait_time', Callout: 'callout', Bobtail: 'other' } }),
    amount: col('Amount', DOLLARS), workFrom: col('Work From', ISO, 'accept'), workTo: col('Work To', ISO, 'accept'), tripId: col('Trip', TEXT, 'accept'),
  }),
  deductions: { kind: 'none' },
  callouts: { kind: 'none' },
  otherLicenseeHours: { kind: 'none' },
  fuelPrices: { kind: 'none' },
};

export const sampleTemplate = (tables: Record<string, TableMapping> = {}): unknown =>
  ({ id: 'sample-template', name: 'Sample CSV exports', version: 1, tables: { ...SAMPLE_TABLES, ...tables } });

export const DEDUCTIONS_TABLE: TableMapping = mapped('deductions.csv', {
  driverId: col('Driver', TEXT), payPeriodId: col('Period', TEXT), deductionId: none(TEXT),
  category: col('Reason', { kind: 'text', map: { 'Chassis Rent': 'chassis_rental', 'Income Tax': 'statutory_income_tax' } }),
  amount: col('Amount', DOLLARS),
});

export const SAMPLE_CSV: Record<string, string> = {
  'drivers.csv': [
    'Driver,Type,From,To,Employer IO,Opening Hours,Hours Complete From,Fuel,Callouts,Other Hours',
    'D1,Company,2020-01-01,,,0,2020-01-01,,yes,yes',
    'IO1,Owner Operator Trip,2020-01-01,,,,,published,yes,',
  ].join('\n'),
  'periods.csv': [
    'Driver,Period,Start,End,Paid On,Payer,Wait Time',
    'D1,P1,2026-07-05,2026-07-18,2026-07-24,licensee,0.00',
    'IO1,P1,2026-07-05,2026-07-18,2026-07-24,licensee,50.00',
  ].join('\n'),
  'hours.csv': ['Driver,Date,Hours', 'D1,2026-07-06,8.5'].join('\n'),
  'trips.csv': ['Driver,Trip,Date,Kind,Zone,Terminal,From Zone,To Zone,Containers', 'IO1,T1,2026-07-06,Off-Dock,,,Q,S,1'].join('\n'),
  'payments.csv': [
    'Driver,Period,Type,Amount,Work From,Work To,Trip',
    'D1,P1,Regular,"$293.76",2026-07-05,2026-07-18,',
    'IO1,P1,Trip,139.00,2026-07-05,2026-07-18,T1',
    'IO1,P1,PMR,25.00,2026-07-05,2026-07-18,',
    'IO1,P1,Fuel,63.94,2026-07-05,2026-07-18,',
    'IO1,P1,Wait,50.00,2026-07-05,2026-07-18,',
  ].join('\n'),
};

export const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

// The sample files, with any of them replaced.
export const sampleFiles = (replace: Record<string, string> = {}): SourceFile[] =>
  Object.entries({ ...SAMPLE_CSV, ...replace }).map(([name, text]) => ({ name, format: 'csv' as const, bytes: bytes(text) }));
