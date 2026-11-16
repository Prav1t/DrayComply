import { describe, it, expect } from 'vitest';
import {
  OBCCTC_2022_07_01, OBCCTC_2022_07_01_WITH_OVERTIME, OBCCTC_2023_07_01, OBCCTC_2024_07_01, OBCCTC_2025_07_01, OBCCTC_2026_07_01, OBCCTC_SCHEDULES,
} from './obcctc';
import { addDays } from '../math/dates';
import type { Component } from '../types/schedule';
import {
  CALLOUT, FUEL_SURCHARGE_PUBLISHED, HOURLY, HOURLY_2025_07_01, HOURLY_TIER_THRESHOLD_HOURS, MULTI_CONTAINER,
  OFF_DOCK, ON_DOCK, OVERTIME, POSITIONING_MOVEMENT,
} from '../../../rates/obcctc-2026-07-01';

const value = <T>(c: Component<T>): T => {
  if (c.kind !== 'present') throw new Error(`component is ${c.kind}`);
  return c.value;
};

describe('OBCCTC adapter', () => {
  it('passes the 2026 tables through by reference, not by copy', () => {
    expect(value(OBCCTC_2026_07_01.onDock).table).toBe(ON_DOCK);
    expect(value(OBCCTC_2026_07_01.offDock).table).toBe(OFF_DOCK);
    expect(OBCCTC_SCHEDULES.fuelPublished).toBe(FUEL_SURCHARGE_PUBLISHED);
  });
  it('carries every 2026 scalar from the rates file', () => {
    expect(value(OBCCTC_2026_07_01.hourly)).toEqual({
      tierThresholdHours: HOURLY_TIER_THRESHOLD_HOURS,
      rates: {
        DEO: { underThreshold: HOURLY.DEO.under2340, atOrOverThreshold: HOURLY.DEO.atOrOver2340 },
        IEO: { underThreshold: HOURLY.IEO.under2340, atOrOverThreshold: HOURLY.IEO.atOrOver2340 },
        IO_HOURLY: { underThreshold: HOURLY.IO_HOURLY.under2340, atOrOverThreshold: HOURLY.IO_HOURLY.atOrOver2340 },
      },
    });
    expect(value(OBCCTC_2026_07_01.overtime).multiplier).toEqual(OVERTIME.multiplier);
    expect(value(OBCCTC_2026_07_01.calloutIo).floorCents).toBe(CALLOUT.ioFloorCents);
    expect(value(OBCCTC_2026_07_01.calloutEmployee).multiplierOfHourly).toBe(CALLOUT.deoIeoMultiplierOfHourly);
    expect(value(OBCCTC_2026_07_01.pmr).cents).toBe(POSITIONING_MOVEMENT.cents);
    expect(value(OBCCTC_2026_07_01.offDock).twoContainerMultiplier).toEqual(MULTI_CONTAINER.offDockTwoContainerTripMultiplier);
  });
  it('holds no on-dock multi-container rule, because the order states none', () => {
    expect(Object.keys(value(OBCCTC_2026_07_01.onDock))).toEqual(['table']);
  });
  it('ends the prior order the day before the 2026 order starts', () => {
    expect(OBCCTC_2025_07_01.effectiveTo).toBe('2026-06-30');
  });
  it('marks what a prior order file does not hold as absent, with no borrowed values', () => {
    // Updated 2026-11-16: the 2025 order's scalars are now transcribed, so only its image-only trip tables are absent.
    expect(value(OBCCTC_2025_07_01.hourly).rates.IO_HOURLY.underThreshold).toBe(HOURLY_2025_07_01.IO_HOURLY.under2340);
    expect(value(OBCCTC_2025_07_01.calloutIo).floorCents).toBe(HOURLY_2025_07_01.calloutIoFloorCents);
    [OBCCTC_2025_07_01, OBCCTC_2024_07_01, OBCCTC_2023_07_01].forEach(s => {
      expect([s.id, s.onDock.kind, s.offDock.kind]).toEqual([s.id, 'absent', 'absent']);
      expect(s.status).toBe('unverified-transcription');
    });
  });
  it('marks only the 2026 schedule as verified', () => {
    expect(OBCCTC_SCHEDULES.schedules.filter(s => s.status === 'verified').map(s => s.id)).toEqual(['obcctc-2026-07-01']);
  });
  it('covers April 1, 2020 onward with no gap and no overlap between schedules', () => {
    const s = OBCCTC_SCHEDULES.schedules;
    s.slice(1).forEach((next, i) => expect([next.id, next.effectiveFrom]).toEqual([next.id, addDays(s[i]?.effectiveTo ?? '', 1)]));
    expect(s[0]?.effectiveFrom).toBe('2020-04-01');   // was 2022-07-01 until the April 2020 order was transcribed
  });
  it('gives the 2022 order no overtime rule until the overtime order takes effect on May 1, 2023', () => {
    expect(OBCCTC_2022_07_01.overtime.kind).toBe('not_in_force');   // known to have none, as opposed to not transcribed
    expect([OBCCTC_2022_07_01.effectiveTo, OBCCTC_2022_07_01_WITH_OVERTIME.effectiveFrom]).toEqual(['2023-04-30', '2023-05-01']);
    expect(value(OBCCTC_2022_07_01_WITH_OVERTIME.overtime).dailyThresholdHours).toBe(9);
    expect(value(OBCCTC_2022_07_01_WITH_OVERTIME.offDock).table).toBe(value(OBCCTC_2022_07_01.offDock).table);
  });
});
