import { describe, it, expect } from 'vitest';
import { addDays, dayNumber, inRange, isIsoDate, weekStartDay, yearMonthOf } from './dates';

describe('dates', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-07-01')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);             // no such day
    expect(isIsoDate('2026-7-1')).toBe(false);
    expect(isIsoDate('July 1, 2026')).toBe(false);
  });
  it('puts Wednesday July 1, 2026 in the week starting Sunday June 28', () => {
    expect(weekStartDay('2026-07-01', 'sunday')).toBe(dayNumber('2026-06-28'));
  });
  it('treats a Sunday as the first day of its own week and a Saturday as the last', () => {
    expect(weekStartDay('2026-07-05', 'sunday')).toBe(dayNumber('2026-07-05'));
    expect(weekStartDay('2026-07-04', 'sunday')).toBe(dayNumber('2026-06-28'));
  });
  it('honours a different week start when the schedule says so', () => {
    expect(weekStartDay('2026-07-05', 'monday')).toBe(dayNumber('2026-06-29'));
  });
  it('steps across a month end', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
  });
  it('takes the month of a date', () => {
    expect(yearMonthOf('2026-07-31')).toBe('2026-07');
  });
  it('treats range ends as inclusive and null as open-ended', () => {
    expect(inRange('2026-06-30', '2025-07-01', '2026-06-30')).toBe(true);
    expect(inRange('2026-07-01', '2025-07-01', '2026-06-30')).toBe(false);
    expect(inRange('2099-01-01', '2026-07-01', null)).toBe(true);
  });
});
