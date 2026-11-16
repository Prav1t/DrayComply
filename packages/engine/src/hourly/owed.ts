import type { IsoDate, Minutes } from '../types/primitives';
import type { DriverInput, HourlyEntry } from '../types/input';
import type { ScheduleSet } from '../types/schedule';
import type { GapDraft, HourlyItem } from '../types/internal';
import { GAPS } from '../rules/catalogue';
import { classAt } from '../classify/class-at';
import { resolveComponent, resolveOptionalComponent } from '../schedule/resolve';
import { dayNumber, weekStartDay } from '../math/dates';
import { MINUTES_PER_HOUR } from '../math/units';
import { ZERO, add, divInt, fromInt, mulRatio, sub, type Frac } from '../math/ratio';
import { minutesToTierBoundary, tierRate } from './tier';
import { INITIAL_OVERTIME_STATE, advance, enterDay, minutesToOvertimeBoundary, overtimeKind } from './overtime';

export interface HourlyOutcome {
  readonly items: readonly HourlyItem[];
  readonly gaps: readonly GapDraft[];
  readonly pricedWithNoOvertimeRule: boolean;   // some employee hours fell where the order has no overtime rule
}

const byDateThenSeq = (a: HourlyEntry, b: HourlyEntry): number =>
  a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : a.seq - b.seq;

const isNumber = (x: number | null): x is number => x !== null;

export function computeHourly(driver: DriverInput, schedules: ScheduleSet): HourlyOutcome {
  const entries = [...driver.hourlyEntries].sort(byDateThenSeq);
  const earliestTrip = driver.trips.reduce<IsoDate | null>((m, t) => (m === null || t.workDate < m ? t.workDate : m), null);
  const items: HourlyItem[] = [];
  const gaps: GapDraft[] = [];
  const unpricedOvertimeDays: number[] = [];   // overtime-eligible days the engine could not count
  let cumulative: Minutes | null = driver.openingCumulativeMinutes.kind === 'reported' ? driver.openingCumulativeMinutes.value : null;
  let state = INITIAL_OVERTIME_STATE;
  const others = driver.otherLicenseeHours.kind === 'reported'
    ? [...driver.otherLicenseeHours.entries].sort((a, b) => (a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : 0))
    : [];
  let nextOther = 0;
  let pricedWithNoOvertimeRule = false;

  for (const e of entries) {
    // Hours for other licensees move the tier. Same-day hours count first, so the step up is never late.
    for (let o = others[nextOther]; o !== undefined && o.workDate <= e.workDate; o = others[nextOther]) {
      if (cumulative !== null) cumulative += o.minutes;
      nextOther += 1;
    }
    const before = cumulative;
    if (cumulative !== null) cumulative += e.minutes;   // hours count toward the tier whatever else is missing
    const gap = (code: GapDraft['code'], detail: string): void => {
      gaps.push({ code, workDate: e.workDate, recordIds: [e.entryId], detail });
    };

    const period = classAt(driver.classPeriods, e.workDate);
    if (period === null) {
      unpricedOvertimeDays.push(dayNumber(e.workDate));
      gap(GAPS.CLASS_UNKNOWN_FOR_DATE, `No driver class is recorded for ${e.workDate}.`);
      continue;
    }
    if (period.class === 'IO_TRIP') {
      gap(GAPS.CLASS_WORK_MISMATCH, `Hourly entry dated ${e.workDate} falls in a period where the driver is paid by the trip.`);
      continue;
    }
    const overtimeEligible = period.class === 'DEO' || period.class === 'IEO';
    const unpriced = (): void => { if (overtimeEligible) unpricedOvertimeDays.push(dayNumber(e.workDate)); };

    if (before === null) {
      unpriced();
      gap(GAPS.OPENING_HOURS_MISSING, 'Cumulative hours before the first entry were not reported, so the rate tier is unknown.');
      continue;
    }
    if (earliestTrip !== null && earliestTrip < e.workDate) {
      unpriced();
      gap(GAPS.CUMULATIVE_HOURS_UNKNOWN, `Trips from ${earliestTrip} carry no hours, so cumulative hours as of ${e.workDate} are unknown.`);
      continue;
    }
    const hourly = resolveComponent(schedules, e.workDate, 'hourly', s => s.hourly);
    if (hourly.kind === 'gap') { unpriced(); gap(hourly.code, hourly.detail); continue; }

    const overtime = overtimeEligible ? resolveOptionalComponent(schedules, e.workDate, 'overtime', s => s.overtime) : null;
    if (overtime !== null && overtime.kind === 'gap') { unpriced(); gap(overtime.code, overtime.detail); continue; }
    // No overtime rule in the order: straight time only. The day cannot count toward a later rule's weekly total.
    if (overtime !== null && overtime.kind === 'not_in_force') { pricedWithNoOvertimeRule = true; unpriced(); }
    const rules = overtime !== null && overtime.kind === 'resolved' ? overtime.value : null;

    if (rules !== null) {
      const weekKey = weekStartDay(e.workDate, rules.weekStartsOn);
      const today = dayNumber(e.workDate);
      const coverage = driver.hourlyCoverageFrom;
      if (coverage.kind === 'not_reported' || dayNumber(coverage.value) > weekKey) {
        unpriced();
        gap(GAPS.OVERTIME_WEEK_INCOMPLETE, `Hours for the week containing ${e.workDate} are not confirmed complete from its first day.`);
        continue;
      }
      if (unpricedOvertimeDays.some(d => d >= weekKey && d <= today)) {
        unpriced();
        gap(GAPS.OVERTIME_WEEK_INCOMPLETE, `An earlier entry in the week containing ${e.workDate} could not be counted toward overtime.`);
        continue;
      }
      state = enterDay(state, e.workDate, weekKey);
    }

    const thresholdMinutes = hourly.value.tierThresholdHours * MINUTES_PER_HOUR;
    const rates = hourly.value.rates[period.class];
    const dailyMinutes = rules === null ? 0 : rules.dailyThresholdHours * MINUTES_PER_HOUR;
    const weeklyMinutes = rules === null ? 0 : rules.weeklyThresholdHours * MINUTES_PER_HOUR;
    let position = before;
    let remaining = e.minutes;
    let straight: Frac = ZERO;
    let dailyPremium: Frac = ZERO;
    let weeklyPremium: Frac = ZERO;

    // Cut the entry wherever the tier or the overtime kind changes.
    while (remaining > 0) {
      const rate = tierRate(position, thresholdMinutes, rates);
      const kind = rules === null ? 'none' : overtimeKind(state, dailyMinutes, weeklyMinutes);
      const chunk = Math.min(...[
        remaining,
        minutesToTierBoundary(position, thresholdMinutes),
        rules === null ? null : minutesToOvertimeBoundary(state, dailyMinutes, weeklyMinutes),
      ].filter(isNumber));
      const pay = divInt(fromInt(chunk * rate), MINUTES_PER_HOUR);
      straight = add(straight, pay);
      if (rules !== null && kind !== 'none') {
        const premium = sub(mulRatio(pay, rules.multiplier), pay);
        if (kind === 'daily') dailyPremium = add(dailyPremium, premium);
        else weeklyPremium = add(weeklyPremium, premium);
      }
      if (rules !== null) state = advance(state, chunk, kind);
      position += chunk;
      remaining -= chunk;
    }

    items.push({
      entryId: e.entryId,
      workDate: e.workDate,
      driverClass: period.class,
      scheduleId: hourly.scheduleId,
      minutes: e.minutes,
      firstRateCents: tierRate(before, thresholdMinutes, rates),
      straight,
      dailyPremium,
      weeklyPremium,
    });
  }
  return { items, gaps, pricedWithNoOvertimeRule };
}

// Minutes performed before a date; null when the opening balance is missing.
export function cumulativeBefore(driver: DriverInput, date: IsoDate): Minutes | null {
  if (driver.openingCumulativeMinutes.kind === 'not_reported') return null;
  const elsewhere = driver.otherLicenseeHours.kind === 'reported' ? driver.otherLicenseeHours.entries.filter(o => o.workDate <= date) : [];
  return [...driver.hourlyEntries.filter(e => e.workDate < date), ...elsewhere]
    .reduce((total, e) => total + e.minutes, driver.openingCumulativeMinutes.value);
}

export const hourlyOwed = (i: HourlyItem): Frac => add(add(i.straight, i.dailyPremium), i.weeklyPremium);
