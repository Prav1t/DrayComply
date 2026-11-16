import type { Cents, ContainerCount, IsoDate, Minutes, Reported, RoundingMode, YearMonth } from './primitives';

export type ClassPeriod =
  | { readonly class: 'DEO' | 'IO_HOURLY' | 'IO_TRIP'; readonly from: IsoDate; readonly to: IsoDate | null }
  | { readonly class: 'IEO'; readonly employingIoDriverId: string; readonly from: IsoDate; readonly to: IsoDate | null };

// seq orders entries within one work date.
export interface HourlyEntry {
  readonly entryId: string;
  readonly workDate: IsoDate;
  readonly seq: number;
  readonly minutes: Minutes;
}

export type TripMove =
  | { readonly kind: 'on_dock'; readonly zone: Reported<string>; readonly terminal: Reported<string> }
  | { readonly kind: 'off_dock'; readonly origin: Reported<string>; readonly destination: Reported<string> };

export interface TripRecord {
  readonly tripId: string;
  readonly workDate: IsoDate;
  readonly move: TripMove;
  readonly containers: Reported<ContainerCount>;
}

// One availability window; entryIds and tripIds are the work performed inside it.
export interface CalloutRecord {
  readonly calloutId: string;
  readonly workDate: IsoDate;
  readonly entryIds: readonly string[];
  readonly tripIds: readonly string[];
}

export type CalloutInput =
  | { readonly kind: 'flagged'; readonly records: readonly CalloutRecord[] }
  | { readonly kind: 'not_flagged' };

// Hours worked for other licensees during the run. They move the tier, and are never paid here.
export type OtherLicenseeHours =
  | { readonly kind: 'reported'; readonly entries: readonly { readonly workDate: IsoDate; readonly minutes: Minutes }[] }
  | { readonly kind: 'not_reported' };

export type FuelBasis =
  | { readonly kind: 'published' }
  | { readonly kind: 'io_discounted'; readonly centsPerLitreByMonth: Readonly<Record<YearMonth, number>> }
  | { readonly kind: 'not_reported' };

export type TripLink =
  | { readonly kind: 'trip'; readonly tripId: string }
  | { readonly kind: 'unlinked' };

// The dates of work a payment says it is for. It must fall inside exactly one pay period.
export type StatedWorkPeriod =
  | { readonly kind: 'stated'; readonly from: IsoDate; readonly to: IsoDate }
  | { readonly kind: 'not_stated' };

export type PayLine =
  | { readonly lineId: string; readonly kind: 'hourly' | 'overtime' | 'pmr' | 'fuel' | 'wait_time' | 'callout' | 'other'; readonly cents: Cents; readonly workPeriod: StatedWorkPeriod }
  | { readonly lineId: string; readonly kind: 'trip_rate'; readonly cents: Cents; readonly workPeriod: StatedWorkPeriod; readonly link: TripLink };

export interface DeductionLine {
  readonly deductionId: string;
  readonly category: string;
  readonly cents: Cents;
}

// A work period and the statement issued for it. Lines count toward the work period each one
// states, which may be an earlier period. The period is open while asOf is before payDate.
export interface PayPeriod {
  readonly payPeriodId: string;
  readonly from: IsoDate;
  readonly to: IsoDate;
  readonly payDate: IsoDate;
  readonly payer: 'licensee' | 'employing_io';
  readonly waitTimeReceived: Reported<Cents>;
  readonly lines: readonly PayLine[];
  readonly deductions: readonly DeductionLine[];
}

export interface DriverInput {
  readonly driverId: string;
  readonly classPeriods: readonly ClassPeriod[];
  readonly openingCumulativeMinutes: Reported<Minutes>;  // any licensee, before the first entry supplied
  readonly hourlyCoverageFrom: Reported<IsoDate>;        // entries are complete from this date
  readonly otherLicenseeHours: OtherLicenseeHours;       // optional: absence is a scope note, not a gap
  readonly fuelBasis: FuelBasis;
  readonly hourlyEntries: readonly HourlyEntry[];
  readonly trips: readonly TripRecord[];
  readonly callouts: CalloutInput;
  readonly payPeriods: readonly PayPeriod[];
}

export interface InputProvenance {
  readonly sources: readonly { readonly name: string; readonly digest: string }[];
}

export interface ComplianceInput {
  readonly licenseeId: string;
  readonly provenance: InputProvenance;
  readonly drivers: readonly DriverInput[];
}

// A legal interpretation supplied by the caller, never a regulated value. citations may be empty.
export interface DeductionPolicy {
  readonly id: string;
  readonly categories: Readonly<Record<string, 'allowed' | 'disallowed'>>;
  readonly citations: Readonly<Record<string, string>>;   // category -> what the ruling rests on
}

// No field has a default; every run states all three.
export interface RunOptions {
  readonly asOf: IsoDate;
  readonly rounding: RoundingMode;
  readonly deductionPolicy: DeductionPolicy;
}
