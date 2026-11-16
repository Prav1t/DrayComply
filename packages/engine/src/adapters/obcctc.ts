// The only engine file that imports packages/rates. It reshapes; it never restates a value.
import * as R2026 from '../../../rates/obcctc-2026-07-01';
import * as R2025 from '../../../rates/obcctc-2025-07-01';
import * as R2024 from '../../../rates/obcctc-2024-07-01';
import * as R2023 from '../../../rates/obcctc-2023-07-01';
import * as R2022 from '../../../rates/obcctc-2022-07-01';
import * as R2020 from '../../../rates/obcctc-2020-04-01';
import { FUEL_SUPPLEMENT_META, FUEL_SURCHARGE_PUBLISHED_SUPPLEMENT } from '../../../rates/obcctc-fuel-published-supplement';
import { DEDUCTION_CATEGORIES, DEDUCTION_POLICY_META, DEDUCTION_SOURCES } from '../../../rates/deduction-policy';
import type { DeductionPolicy } from '../types/input';
import type { Ratio } from '../types/primitives';
import type { Component, OvertimeRules, RateTable, RegulatedSchedule, ScheduleSet, ScheduleStatus, TierRates } from '../types/schedule';
import { WEEKDAYS, addDays, type Weekday } from '../math/dates';
import { isExactRatio } from '../math/ratio';

function exact(r: Ratio, name: string): Ratio {
  if (!isExactRatio(r)) throw new RangeError(`${name} is not an exact integer ratio`);
  return r;
}

function weekday(name: string): Weekday {
  const found = WEEKDAYS.find(d => d === name);
  if (found === undefined) throw new RangeError(`unknown week start: ${name}`);
  return found;
}

interface OvertimeSource {
  readonly multiplier: Ratio; readonly dailyThresholdHours: number; readonly weeklyThresholdHours: number;
  readonly weekStartsOn: string; readonly onlyFirstNineHoursCountWeekly: boolean;
}

// The engine implements the first-nine-hours weekly rule only; anything else is refused.
function overtime(o: OvertimeSource | 'no_rule_in_order' | null): Component<OvertimeRules> {
  if (o === null) return { kind: 'absent' };
  if (o === 'no_rule_in_order') return { kind: 'not_in_force' };
  if (!o.onlyFirstNineHoursCountWeekly) throw new RangeError('unsupported weekly overtime counting rule');
  return { kind: 'present', value: {
    multiplier: exact(o.multiplier, 'OVERTIME.multiplier'), dailyThresholdHours: o.dailyThresholdHours,
    weeklyThresholdHours: o.weeklyThresholdHours, weekStartsOn: weekday(o.weekStartsOn),
  } };
}

// Shape shared by the 2022 to 2025 files. A null table is an appendix nobody has transcribed.
interface OrderFile {
  readonly SCHEDULE_META: { readonly id: string; readonly effectiveFrom: string; readonly effectiveTo: string | null; readonly status: ScheduleStatus; readonly verifiedBy: string | null };
  readonly HOURLY_TIER_THRESHOLD_HOURS: number;
  readonly HOURLY: { readonly DEO: TierRates; readonly IEO: TierRates; readonly IO_HOURLY: TierRates };
  readonly OVERTIME: OvertimeSource | 'no_rule_in_order' | null;
  readonly CALLOUT: { readonly deoIeoMultiplierOfHourly: number; readonly ioFloorCents: number };
  readonly ON_DOCK: RateTable | null;
  readonly OFF_DOCK: RateTable | null;
  readonly POSITIONING_MOVEMENT: { readonly cents: number; readonly twoContainerMultiplier: Ratio; readonly mustAppearSeparatelyOnPayStatement: boolean };
  readonly MULTI_CONTAINER: { readonly offDockTwoContainerTripMultiplier: Ratio };
  readonly FUEL_SURCHARGE: { readonly thresholdCentsPerLitre: number; readonly stepCentsPerLitre: number; readonly pctPerStep: number; readonly roundReferenceDownToCents: number; readonly excludesPositioningMovementRate: boolean };
}

function fromOrder(f: OrderFile): RegulatedSchedule {
  if (!f.FUEL_SURCHARGE.excludesPositioningMovementRate) throw new RangeError('unsupported fuel surcharge base');
  if (!f.POSITIONING_MOVEMENT.mustAppearSeparatelyOnPayStatement) throw new RangeError('unsupported PMR itemisation rule');
  return {
    id: f.SCHEDULE_META.id, status: f.SCHEDULE_META.status, verifiedBy: f.SCHEDULE_META.verifiedBy,
    effectiveFrom: f.SCHEDULE_META.effectiveFrom, effectiveTo: f.SCHEDULE_META.effectiveTo,
    hourly: { kind: 'present', value: { tierThresholdHours: f.HOURLY_TIER_THRESHOLD_HOURS, rates: f.HOURLY } },
    overtime: overtime(f.OVERTIME),
    calloutEmployee: { kind: 'present', value: { multiplierOfHourly: f.CALLOUT.deoIeoMultiplierOfHourly } },
    calloutIo: { kind: 'present', value: { floorCents: f.CALLOUT.ioFloorCents } },
    onDock: f.ON_DOCK === null ? { kind: 'absent' } : { kind: 'present', value: { table: f.ON_DOCK } },
    offDock: f.OFF_DOCK === null ? { kind: 'absent' } : { kind: 'present', value: {
      table: f.OFF_DOCK, twoContainerMultiplier: exact(f.MULTI_CONTAINER.offDockTwoContainerTripMultiplier, 'MULTI_CONTAINER.offDockTwoContainerTripMultiplier'),
    } },
    pmr: { kind: 'present', value: { cents: f.POSITIONING_MOVEMENT.cents, twoContainerMultiplier: exact(f.POSITIONING_MOVEMENT.twoContainerMultiplier, 'POSITIONING_MOVEMENT.twoContainerMultiplier') } },
    fuelFormula: { kind: 'present', value: {
      thresholdCentsPerLitre: f.FUEL_SURCHARGE.thresholdCentsPerLitre, stepCentsPerLitre: f.FUEL_SURCHARGE.stepCentsPerLitre,
      pctPerStep: f.FUEL_SURCHARGE.pctPerStep, roundReferenceDownToCents: f.FUEL_SURCHARGE.roundReferenceDownToCents,
    } },
  };
}

const tiers = (t: { readonly under2340: number; readonly atOrOver2340: number }): TierRates =>
  ({ underThreshold: t.under2340, atOrOverThreshold: t.atOrOver2340 });

// Project instructions name the 2026 schedule as verified. SCHEDULE_META.verifiedBy is still null: see NEEDS_HUMAN.md.
export const OBCCTC_2026_07_01: RegulatedSchedule = {
  ...fromOrder({
    ...R2026,
    SCHEDULE_META: { ...R2026.SCHEDULE_META, status: 'verified' },
    HOURLY: { DEO: tiers(R2026.HOURLY.DEO), IEO: tiers(R2026.HOURLY.IEO), IO_HOURLY: tiers(R2026.HOURLY.IO_HOURLY) },
  }),
};

export const OBCCTC_2025_07_01: RegulatedSchedule = fromOrder(R2025);
export const OBCCTC_2024_07_01: RegulatedSchedule = fromOrder(R2024);
export const OBCCTC_2023_07_01: RegulatedSchedule = fromOrder(R2023);
export const OBCCTC_2020_04_01: RegulatedSchedule = fromOrder(R2020);

// The 2022 order has no overtime rule until the separate order of April 28, 2023 takes effect on May 1, 2023.
const base2022 = fromOrder(R2022);
const overtimeStart = R2022.OVERTIME_FROM_2023_05_01.effectiveFrom;
export const OBCCTC_2022_07_01: RegulatedSchedule = { ...base2022, effectiveTo: addDays(overtimeStart, -1) };
export const OBCCTC_2022_07_01_WITH_OVERTIME: RegulatedSchedule = {
  ...base2022, id: `${base2022.id}+overtime-${overtimeStart}`, effectiveFrom: overtimeStart, overtime: overtime(R2022.OVERTIME_FROM_2023_05_01),
};

// Every schedule in packages/rates, oldest first. Dates outside them resolve to nothing.
export const OBCCTC_SCHEDULES: ScheduleSet = {
  schedules: [OBCCTC_2020_04_01, OBCCTC_2022_07_01, OBCCTC_2022_07_01_WITH_OVERTIME, OBCCTC_2023_07_01, OBCCTC_2024_07_01, OBCCTC_2025_07_01, OBCCTC_2026_07_01],
  fuelPublishedSeriesId: 'obcctc-fuel-surcharge-published',
  fuelPublishedStatus: 'verified',
  fuelPublished: R2026.FUEL_SURCHARGE_PUBLISHED,
  fuelSupplement: { seriesId: FUEL_SUPPLEMENT_META.id, status: FUEL_SUPPLEMENT_META.status, months: FUEL_SURCHARGE_PUBLISHED_SUPPLEMENT },
};

// The drafted deduction policy, in the engine's shape. It is an interpretation; the run's scope note says so.
// Conditional categories are left out on purpose: the engine then raises a gap instead of choosing a side.
const decided = Object.entries(DEDUCTION_CATEGORIES).flatMap(([name, c]) => (c.ruling === 'conditional' ? [] : [{ name, ruling: c.ruling, basis: c.basis }]));
export const DEDUCTION_POLICY: DeductionPolicy = {
  id: DEDUCTION_POLICY_META.id,
  categories: Object.fromEntries(decided.map(c => [c.name, c.ruling])),
  citations: Object.fromEntries(decided.map(c => [c.name, c.basis.map(key => DEDUCTION_SOURCES[key].cite).join('; ')])),
};
