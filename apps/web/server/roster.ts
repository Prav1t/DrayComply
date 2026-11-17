// The driver roster as two files in a fixed layout, read by packages/ingest like any other export.
// A run snapshots these files, so the roster a run used can always be read back and hashed.
import type { FieldFormat, FieldMapping, SourceFile, TableMapping } from '../../../packages/ingest/src/index';

export interface RosterDriver {
  readonly externalId: string;
  readonly openingCumulativeMinutes: number | null;
  readonly hourlyCoverageFrom: string | null;
  readonly fuelBasis: 'published' | 'io_discounted' | null;
  readonly calloutsFlagged: boolean | null;
  readonly otherLicenseeHoursReported: boolean | null;
  readonly classPeriods: readonly { readonly class: string; readonly employingIoExternalId: string | null; readonly from: string; readonly to: string | null }[];
  readonly otherHours: readonly { readonly workDate: string; readonly minutes: number }[];
}

export const ROSTER_DRIVERS_FILE = 'draycomply-roster-drivers.csv';
export const ROSTER_OTHER_HOURS_FILE = 'draycomply-roster-other-hours.csv';

const col = (header: string, format: FieldFormat, blank: 'accept' | 'reject' = 'reject'): FieldMapping => ({ source: { kind: 'column', header }, format, blank });
const TEXT: FieldFormat = { kind: 'text', map: {} };
const ISO: FieldFormat = { kind: 'date', format: 'YYYY-MM-DD' };
const MINUTES: FieldFormat = { kind: 'duration', unit: 'minutes' };
const YES_NO: FieldFormat = { kind: 'enum', values: { yes: 'yes', no: 'no' } };
const same = (values: readonly string[]): FieldFormat => ({ kind: 'enum', values: Object.fromEntries(values.map(v => [v, v])) });

export const ROSTER_TABLES: { readonly drivers: TableMapping; readonly otherLicenseeHours: TableMapping } = {
  drivers: {
    kind: 'mapped', file: ROSTER_DRIVERS_FILE, sheet: null, headerRow: 1, delimiter: ',',
    fields: {
      driverId: col('driver_id', TEXT),
      class: col('class', same(['DEO', 'IEO', 'IO_HOURLY', 'IO_TRIP'])),
      classFrom: col('class_from', ISO),
      classTo: col('class_to', ISO, 'accept'),
      employingIoDriverId: col('employing_io_driver_id', TEXT, 'accept'),
      openingCumulativeHours: col('opening_cumulative_minutes', MINUTES, 'accept'),
      hourlyCoverageFrom: col('hourly_coverage_from', ISO, 'accept'),
      fuelBasis: col('fuel_basis', same(['published', 'io_discounted']), 'accept'),
      calloutsFlagged: col('callouts_flagged', YES_NO, 'accept'),
      otherLicenseeHoursReported: col('other_licensee_hours_reported', YES_NO, 'accept'),
    },
  },
  otherLicenseeHours: {
    kind: 'mapped', file: ROSTER_OTHER_HOURS_FILE, sheet: null, headerRow: 1, delimiter: ',',
    fields: { driverId: col('driver_id', TEXT), workDate: col('work_date', ISO), duration: col('minutes', MINUTES) },
  },
};

const cell = (v: string | number | null): string => {
  if (v === null) return '';   // a null stays an empty cell; ingest reads it as not reported
  const s = String(v);
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
};
const yesNo = (v: boolean | null): string | null => (v === null ? null : v ? 'yes' : 'no');
const csv = (rows: readonly (readonly (string | number | null)[])[]): Uint8Array => new TextEncoder().encode(rows.map(r => r.map(cell).join(',')).join('\n') + '\n');

export interface RosterFiles { readonly files: readonly SourceFile[]; readonly withoutClass: readonly string[] }

// Deterministic: drivers and rows are sorted, so the same roster always gives the same bytes.
export function rosterFiles(drivers: readonly RosterDriver[]): RosterFiles {
  const sorted = [...drivers].sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
  const driverRows: (string | number | null)[][] = [['driver_id', 'class', 'class_from', 'class_to', 'employing_io_driver_id', 'opening_cumulative_minutes', 'hourly_coverage_from', 'fuel_basis', 'callouts_flagged', 'other_licensee_hours_reported']];
  const hourRows: (string | number | null)[][] = [['driver_id', 'work_date', 'minutes']];
  for (const d of sorted) {
    for (const p of [...d.classPeriods].sort((a, b) => (a.from < b.from ? -1 : 1))) {
      driverRows.push([d.externalId, p.class, p.from, p.to, p.employingIoExternalId, d.openingCumulativeMinutes, d.hourlyCoverageFrom, d.fuelBasis, yesNo(d.calloutsFlagged), yesNo(d.otherLicenseeHoursReported)]);
    }
    for (const h of [...d.otherHours].sort((a, b) => (a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : a.minutes - b.minutes))) hourRows.push([d.externalId, h.workDate, h.minutes]);
  }
  return {
    files: [
      { name: ROSTER_DRIVERS_FILE, format: 'csv', bytes: csv(driverRows) },
      { name: ROSTER_OTHER_HOURS_FILE, format: 'csv', bytes: csv(hourRows) },
    ],
    // A driver with no class period cannot be written: class is never assumed.
    withoutClass: sorted.filter(d => d.classPeriods.length === 0).map(d => d.externalId),
  };
}
