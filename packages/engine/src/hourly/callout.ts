import type { DriverInput } from '../types/input';
import type { ScheduleSet } from '../types/schedule';
import type { CalloutItem, GapDraft, HourlyItem, TripItem } from '../types/internal';
import { GAPS } from '../rules/catalogue';
import { classAt } from '../classify/class-at';
import { resolveComponent } from '../schedule/resolve';
import { MINUTES_PER_HOUR } from '../math/units';
import { ZERO, add, fromInt, isPositive, sub, type Frac } from '../math/ratio';
import { cumulativeBefore, hourlyOwed } from './owed';
import { tierRate } from './tier';

export interface CalloutOutcome {
  readonly items: readonly CalloutItem[];
  readonly gaps: readonly GapDraft[];
}

// The callout amount is a floor on pay for the window, not an addition to it.
export function computeCallouts(
  driver: DriverInput,
  schedules: ScheduleSet,
  hourly: readonly HourlyItem[],
  trips: readonly TripItem[],
): CalloutOutcome {
  if (driver.callouts.kind === 'not_flagged') return { items: [], gaps: [] };
  const items: CalloutItem[] = [];
  const gaps: GapDraft[] = [];

  for (const c of driver.callouts.records) {
    const gap = (code: GapDraft['code'], detail: string): void => {
      gaps.push({ code, workDate: c.workDate, recordIds: [c.calloutId], detail });
    };
    const period = classAt(driver.classPeriods, c.workDate);
    if (period === null) { gap(GAPS.CLASS_UNKNOWN_FOR_DATE, `No driver class is recorded for ${c.workDate}.`); continue; }

    const linkedHourly = hourly.filter(i => c.entryIds.includes(i.entryId));
    const linkedTrips = trips.filter(t => c.tripIds.includes(t.tripId));
    const tripBases = linkedTrips.map(t => t.base);
    // Linked work that raised its own gap leaves the window unpriced.
    if (linkedHourly.length < c.entryIds.length || linkedTrips.length < c.tripIds.length || tripBases.some(b => b === null)) continue;
    const workOwed = tripBases.reduce<Frac>((t, b) => (b === null ? t : add(t, b)), linkedHourly.reduce<Frac>((t, i) => add(t, hourlyOwed(i)), ZERO));

    let floor: Frac;
    let scheduleId: string;
    if (period.class === 'DEO' || period.class === 'IEO') {
      const rules = resolveComponent(schedules, c.workDate, 'employee callout', s => s.calloutEmployee);
      if (rules.kind === 'gap') { gap(rules.code, rules.detail); continue; }
      const first = linkedHourly[0];
      let rate: number;
      if (first !== undefined) {
        rate = first.firstRateCents;
      } else {
        // No work in the window: take the tier as of the start of the day.
        const hourlyRules = resolveComponent(schedules, c.workDate, 'hourly', s => s.hourly);
        if (hourlyRules.kind === 'gap') { gap(hourlyRules.code, hourlyRules.detail); continue; }
        const before = cumulativeBefore(driver, c.workDate);
        if (before === null) { gap(GAPS.OPENING_HOURS_MISSING, 'Cumulative hours were not reported, so the callout rate tier is unknown.'); continue; }
        rate = tierRate(before, hourlyRules.value.tierThresholdHours * MINUTES_PER_HOUR, hourlyRules.value.rates[period.class]);
      }
      floor = fromInt(rate * rules.value.multiplierOfHourly);
      scheduleId = rules.scheduleId;
    } else {
      const rules = resolveComponent(schedules, c.workDate, 'independent operator callout', s => s.calloutIo);
      if (rules.kind === 'gap') { gap(rules.code, rules.detail); continue; }
      floor = fromInt(rules.value.floorCents);
      scheduleId = rules.scheduleId;
    }

    const shortBy = sub(floor, workOwed);
    items.push({
      calloutId: c.calloutId,
      workDate: c.workDate,
      driverClass: period.class,
      scheduleId,
      floor,
      workOwed,
      topUp: isPositive(shortBy) ? shortBy : ZERO,
    });
  }
  return { items, gaps };
}
