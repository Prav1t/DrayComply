import type { Cents, DriverClass, HourlyClass, IsoDate, Minutes } from './primitives';
import type { GapCode } from '../rules/catalogue';
import type { Frac } from '../math/ratio';

// A gap before it is attached to a driver and pay period.
export interface GapDraft {
  readonly code: GapCode;
  readonly workDate: IsoDate | null;
  readonly recordIds: readonly string[];
  readonly detail: string;
}

export interface HourlyItem {
  readonly entryId: string;
  readonly workDate: IsoDate;
  readonly driverClass: HourlyClass;
  readonly scheduleId: string;
  readonly minutes: Minutes;
  readonly firstRateCents: Cents;      // rate applying to the entry's first minute
  readonly straight: Frac;             // every minute at 1x
  readonly dailyPremium: Frac;         // extra over 1x for daily overtime minutes
  readonly weeklyPremium: Frac;        // extra over 1x for weekly overtime minutes
}

// A null amount means a gap was raised for it.
export interface TripItem {
  readonly tripId: string;
  readonly workDate: IsoDate;
  readonly scheduleIds: readonly string[];
  readonly description: string;
  readonly base: Frac | null;
  readonly pmr: Frac | null;
}

export interface CalloutItem {
  readonly calloutId: string;
  readonly workDate: IsoDate;
  readonly driverClass: DriverClass;
  readonly scheduleId: string;
  readonly floor: Frac;
  readonly workOwed: Frac;
  readonly topUp: Frac;                // floor minus work owed, never negative
}
