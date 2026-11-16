import { describe, it, expect } from 'vitest';
import { resolveComponent, scheduleFor } from './resolve';
import { addDays } from '../math/dates';
import { OBCCTC_SCHEDULES, OBCCTC_2026_07_01 } from '../adapters/obcctc';
import { HOURLY, HOURLY_2025_07_01, SCHEDULE_META } from '../../../rates/obcctc-2026-07-01';

const hourlyOn = (date: string) => resolveComponent(OBCCTC_SCHEDULES, date, 'hourly', s => s.hourly);

describe('schedule resolution', () => {
  it('switches orders exactly at July 1, 2026', () => {
    expect(scheduleFor(OBCCTC_SCHEDULES, '2026-06-30')?.id).toBe('obcctc-2025-07-01');
    expect(scheduleFor(OBCCTC_SCHEDULES, '2026-07-01')?.id).toBe(SCHEDULE_META.id);
  });
  it('resolves each side of the boundary to its own hourly rate', () => {
    const june = hourlyOn('2026-06-30');
    const july = hourlyOn('2026-07-01');
    expect(june.kind === 'resolved' && june.value.rates.DEO.underThreshold).toBe(HOURLY_2025_07_01.DEO.under2340);
    expect(july.kind === 'resolved' && july.value.rates.DEO.underThreshold).toBe(HOURLY.DEO.under2340);
  });
  it('returns a gap, never the nearest schedule, for a date before any schedule', () => {
    const earliest = OBCCTC_SCHEDULES.schedules.map(s => s.effectiveFrom).sort()[0] ?? '';
    expect(scheduleFor(OBCCTC_SCHEDULES, addDays(earliest, -1))).toBeNull();   // the day before the oldest schedule loaded
    expect(hourlyOn('2018-03-05')).toMatchObject({ kind: 'gap', code: 'NO_SCHEDULE_FOR_DATE' });
  });
  it('returns a gap for a component the prior order does not hold', () => {
    const offDock = resolveComponent(OBCCTC_SCHEDULES, '2026-06-30', 'off-dock trip rate', s => s.offDock);
    expect(offDock).toMatchObject({ kind: 'gap', code: 'SCHEDULE_COMPONENT_ABSENT' });
  });
  it('resolves a far-future date to the open-ended current order', () => {
    expect(scheduleFor(OBCCTC_SCHEDULES, '2031-01-01')).toBe(OBCCTC_2026_07_01);   // until a later order is loaded
  });
});
