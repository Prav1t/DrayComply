import type { Cents, HourlyClass, IsoDate, Ratio, YearMonth } from './primitives';
import type { Weekday } from '../math/dates';

// absent: nobody has transcribed it, so it is unknown. not_in_force: the order is known to contain no such rule.
export type Component<T> =
  | { readonly kind: 'present'; readonly value: T }
  | { readonly kind: 'not_in_force' }
  | { readonly kind: 'absent' };

export interface TierRates { readonly underThreshold: Cents; readonly atOrOverThreshold: Cents }

export interface HourlyRules {
  readonly tierThresholdHours: number;
  readonly rates: Readonly<Record<HourlyClass, TierRates>>;
}

// Weekly total counts only hours up to the daily threshold; the adapter rejects any other rule.
export interface OvertimeRules {
  readonly multiplier: Ratio;
  readonly dailyThresholdHours: number;
  readonly weeklyThresholdHours: number;
  readonly weekStartsOn: Weekday;
}

export interface EmployeeCalloutRules { readonly multiplierOfHourly: number }
export interface IoCalloutRules { readonly floorCents: Cents }

export type RateTable = Readonly<Record<string, Readonly<Record<string, Cents>>>>;

export interface OnDockRules { readonly table: RateTable }                                   // [zone][terminal]
export interface OffDockRules { readonly table: RateTable; readonly twoContainerMultiplier: Ratio } // [origin][destination]
export interface PmrRules { readonly cents: Cents; readonly twoContainerMultiplier: Ratio }

export interface FuelFormulaRules {
  readonly thresholdCentsPerLitre: number;
  readonly stepCentsPerLitre: number;
  readonly pctPerStep: number;
  readonly roundReferenceDownToCents: number;
}

export type ScheduleStatus = 'verified' | 'unverified-transcription';

export interface RegulatedSchedule {
  readonly id: string;
  readonly status: ScheduleStatus;
  readonly verifiedBy: string | null;
  readonly effectiveFrom: IsoDate;
  readonly effectiveTo: IsoDate | null;
  readonly hourly: Component<HourlyRules>;
  readonly overtime: Component<OvertimeRules>;
  readonly calloutEmployee: Component<EmployeeCalloutRules>;
  readonly calloutIo: Component<IoCalloutRules>;
  readonly onDock: Component<OnDockRules>;
  readonly offDock: Component<OffDockRules>;
  readonly pmr: Component<PmrRules>;
  readonly fuelFormula: Component<FuelFormulaRules>;
}

export interface FuelPublishedMonth { readonly referenceCentsPerLitre: number; readonly pct: number }

// Months the primary series lacks. A null reference price cannot price a discounted basis.
export interface FuelSupplement {
  readonly seriesId: string;
  readonly status: ScheduleStatus;
  readonly months: Readonly<Record<YearMonth, { readonly referenceCentsPerLitre: number | null; readonly pct: number }>>;
}

export interface ScheduleSet {
  readonly schedules: readonly RegulatedSchedule[];
  readonly fuelPublishedSeriesId: string;
  readonly fuelPublishedStatus: ScheduleStatus;
  readonly fuelPublished: Readonly<Record<YearMonth, FuelPublishedMonth>>;
  readonly fuelSupplement: FuelSupplement;   // consulted only for months the primary series lacks
}
