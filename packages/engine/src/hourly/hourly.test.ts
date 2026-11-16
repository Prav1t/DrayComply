import { describe, it, expect } from 'vitest';
import { computeHourly, hourlyOwed } from './owed';
import { minutesToTierBoundary, tierRate } from './tier';
import { INITIAL_OVERTIME_STATE, advance, enterDay, minutesToOvertimeBoundary, overtimeKind } from './overtime';
import { OBCCTC_SCHEDULES } from '../adapters/obcctc';
import { HOURLY, HOURLY_TIER_THRESHOLD_HOURS } from '../../../rates/obcctc-2026-07-01';
import { driver, entry, NOT_REPORTED, reported } from '../testing/builders';
import { roundFrac, sum, toExact } from '../math/ratio';

const THRESHOLD = HOURLY_TIER_THRESHOLD_HOURS * 60;
const rates = { underThreshold: HOURLY.DEO.under2340, atOrOverThreshold: HOURLY.DEO.atOrOver2340 };
const HOUR = 60;
const MON = '2026-07-06';   // Monday

describe('tier', () => {
  it('pays the lower rate below the threshold and the higher at or above it', () => {
    expect(tierRate(THRESHOLD - 1, THRESHOLD, rates)).toBe(HOURLY.DEO.under2340);
    expect(tierRate(THRESHOLD, THRESHOLD, rates)).toBe(HOURLY.DEO.atOrOver2340);   // "more than (or equal to)"
  });
  it('reports the minutes left at the lower tier', () => {
    expect(minutesToTierBoundary(THRESHOLD - 30, THRESHOLD)).toBe(30);
    expect(minutesToTierBoundary(THRESHOLD, THRESHOLD)).toBeNull();
  });
});

describe('overtime state', () => {
  const DAILY = 9 * HOUR;
  const WEEKLY = 45 * HOUR;
  it('keeps daily overtime minutes out of the weekly count', () => {
    let s = enterDay(INITIAL_OVERTIME_STATE, MON, 1);
    s = advance(s, DAILY, 'none');
    s = advance(s, 2 * HOUR, 'daily');
    expect(s).toMatchObject({ dayMinutes: 11 * HOUR, weekCountedMinutes: DAILY });
  });
  it('resets the day but not the week on a new day in the same week', () => {
    const s = enterDay(advance(enterDay(INITIAL_OVERTIME_STATE, MON, 1), DAILY, 'none'), '2026-07-07', 1);
    expect(s).toMatchObject({ dayMinutes: 0, weekCountedMinutes: DAILY });
  });
  it('resets both on a new week', () => {
    const s = enterDay(advance(enterDay(INITIAL_OVERTIME_STATE, MON, 1), DAILY, 'none'), '2026-07-13', 2);
    expect(s).toMatchObject({ dayMinutes: 0, weekCountedMinutes: 0 });
  });
  it('names the next minute and the distance to the next change', () => {
    const fresh = enterDay(INITIAL_OVERTIME_STATE, MON, 1);
    expect(overtimeKind(fresh, DAILY, WEEKLY)).toBe('none');
    expect(minutesToOvertimeBoundary(fresh, DAILY, WEEKLY)).toBe(DAILY);
    const late = { ...fresh, weekCountedMinutes: WEEKLY - HOUR };
    expect(minutesToOvertimeBoundary(late, DAILY, WEEKLY)).toBe(HOUR);              // weekly boundary comes first
    expect(overtimeKind({ ...fresh, weekCountedMinutes: WEEKLY }, DAILY, WEEKLY)).toBe('weekly');
    expect(overtimeKind({ ...fresh, dayMinutes: DAILY, weekCountedMinutes: WEEKLY }, DAILY, WEEKLY)).toBe('daily');
  });
});

describe('hourly amounts owed', () => {
  const total = (d: ReturnType<typeof driver>) => sum(computeHourly(d, OBCCTC_SCHEDULES).items.map(hourlyOwed));

  it('splits the entry that crosses 2,340 hours at the threshold minute', () => {
    const d = driver({ openingCumulativeMinutes: reported(THRESHOLD - 30), hourlyEntries: [entry('E1', MON, 60)] });
    // 30 min at $34.56 + 30 min at $36.03 = 1728 + 1801.5 cents
    expect(toExact(total(d))).toEqual({ num: '7059', den: '2' });
  });
  it('pays the whole entry at the higher rate once the threshold is already met', () => {
    const d = driver({ openingCumulativeMinutes: reported(THRESHOLD), hourlyEntries: [entry('E1', MON, 60)] });
    expect(roundFrac(total(d), 'half_up')).toBe(HOURLY.DEO.atOrOver2340);
  });
  it('carries the balance forward entry by entry', () => {
    const d = driver({ openingCumulativeMinutes: reported(THRESHOLD - 60), hourlyEntries: [entry('E1', MON, 60), entry('E2', '2026-07-07', 60)] });
    expect(roundFrac(total(d), 'half_up')).toBe(HOURLY.DEO.under2340 + HOURLY.DEO.atOrOver2340);
  });
  it('counts only the first nine hours of each day toward the weekly 45', () => {
    const days = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'];
    const d = driver({ hourlyEntries: days.map((date, i) => entry(`E${i}`, date, 11 * HOUR)) });
    const items = computeHourly(d, OBCCTC_SCHEDULES).items;
    // 5 x 9 = 45 counted hours: exactly at the threshold, so no weekly overtime.
    expect(roundFrac(sum(items.map(i => i.weeklyPremium)), 'half_up')).toBe(0);
    expect(roundFrac(sum(items.map(i => i.dailyPremium)), 'half_up')).toBe(10 * HOURLY.DEO.under2340 / 2);
  });
  it('pays weekly overtime on hours past 45 counted hours', () => {
    const days = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'];
    const d = driver({ hourlyEntries: [...days.map((date, i) => entry(`E${i}`, date, 11 * HOUR)), entry('SAT', '2026-07-11', 5 * HOUR)] });
    const items = computeHourly(d, OBCCTC_SCHEDULES).items;
    expect(roundFrac(sum(items.map(i => i.weeklyPremium)), 'half_up')).toBe(5 * HOURLY.DEO.under2340 / 2);
  });
  it('orders two entries on one day by seq, so the later one carries the overtime', () => {
    const d = driver({ hourlyEntries: [entry('LATE', MON, 3 * HOUR, 2), entry('EARLY', MON, 8 * HOUR, 1)] });
    const late = computeHourly(d, OBCCTC_SCHEDULES).items.find(i => i.entryId === 'LATE');
    expect(late && roundFrac(late.dailyPremium, 'half_up')).toBe(2 * HOURLY.DEO.under2340 / 2);   // hours 10 and 11
  });
  it('pays an independent operator no overtime', () => {
    const d = driver({ classPeriods: [{ class: 'IO_HOURLY', from: '2020-01-01', to: null }], hourlyEntries: [entry('E1', MON, 12 * HOUR)] });
    expect(roundFrac(total(d), 'half_up')).toBe(12 * HOURLY.IO_HOURLY.under2340);
  });
  it('raises a gap, not a default tier, when the opening balance is missing', () => {
    const d = driver({ openingCumulativeMinutes: NOT_REPORTED, hourlyEntries: [entry('E1', MON, 60)] });
    const out = computeHourly(d, OBCCTC_SCHEDULES);
    expect(out.items).toHaveLength(0);
    expect(out.gaps.map(g => g.code)).toEqual(['OPENING_HOURS_MISSING']);
  });
  it('raises a gap when the week is not confirmed complete from its first day', () => {
    const d = driver({ hourlyCoverageFrom: reported('2026-07-06'), hourlyEntries: [entry('E1', MON, 60)] });   // week began Sunday the 5th
    expect(computeHourly(d, OBCCTC_SCHEDULES).gaps.map(g => g.code)).toEqual(['OVERTIME_WEEK_INCOMPLETE']);
  });
});
