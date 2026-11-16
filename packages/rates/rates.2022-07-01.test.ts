// Integrity tests for the UNVERIFIED transcription of the April 1, 2020 order as amended July 1, 2022.
import { describe, it, expect } from 'vitest';
import {
  SCHEDULE_META, ZONES, ON_DOCK, OFF_DOCK, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, OVERTIME_FROM_2023_05_01,
  CALLOUT, POSITIONING_MOVEMENT, MULTI_CONTAINER, FUEL_SURCHARGE, type ZoneLetter,
} from './obcctc-2022-07-01';
import * as NEXT from './obcctc-2023-07-01';
import * as Y2026 from './obcctc-2026-07-01';

const L = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] as ZoneLetter[];

describe('status', () => {
  it('is marked unverified with no sign-off', () => {
    expect([SCHEDULE_META.status, SCHEDULE_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('covers July 1, 2022 to June 30, 2023 only, not the order\'s first two years', () => {
    expect([SCHEDULE_META.effectiveFrom, SCHEDULE_META.effectiveTo]).toEqual(['2022-07-01', '2023-06-30']);
    expect(NEXT.SCHEDULE_META.effectiveFrom).toBe('2023-07-01');
  });
});

describe('zones', () => {
  it('uses the same 26 names and letters as the verified 2026 schedule', () => {
    expect(ZONES).toEqual(Y2026.ZONES.map(z => ({ item: z.item, name: z.name, letter: z.letter })));
  });
});

describe('off-dock matrix', () => {
  it('covers every origin and destination pair', () => {
    L.forEach(a => expect(Object.keys(OFF_DOCK[a])).toHaveLength(26));
  });
  it('charges $105.00 for a trip within the same area', () => {
    L.forEach(a => expect(OFF_DOCK[a][a]).toBe(10_500));
  });
  it('is symmetric: the rate does not depend on direction', () => {
    // A single mistyped digit almost always breaks this. Keep it.
    L.forEach(a => L.forEach(b => expect({ a, b, cents: OFF_DOCK[a][b] }).toEqual({ a, b, cents: OFF_DOCK[b][a] })));
  });
  it('holds whole dollars expressed as integer cents', () => {
    L.forEach(a => L.forEach(b => expect(OFF_DOCK[a][b] % 100).toBe(0)));
  });
  it('uses one band per 2026 band: the two tables must rank every pair the same way', () => {
    // The 2026 table is this one after uniform percentage increases, so the band mapping is one-to-one.
    const map = new Map<number, number>();
    L.forEach(a => L.forEach(b => {
      const mine = OFF_DOCK[a][b];
      const later = Y2026.OFF_DOCK[a][b];
      expect({ a, b, later: map.get(mine) ?? later }).toEqual({ a, b, later });
      map.set(mine, later);
    }));
    expect(new Set(map.values()).size).toBe(map.size);
  });
});

describe('on-dock table', () => {
  it('covers all 26 areas across three terminals', () => {
    expect(Object.keys(ON_DOCK)).toEqual(L);
    L.forEach(a => expect(Object.keys(ON_DOCK[a])).toEqual(['centermVanterm', 'deltaport', 'fraserSurreyDocks']));
  });
  it('maps onto the 2026 table one-to-one: equal rates here are equal rates there', () => {
    const map = new Map<number, number>();
    const terminals = ['centermVanterm', 'deltaport', 'fraserSurreyDocks'] as const;
    L.forEach(a => terminals.forEach(t => {
      const mine = ON_DOCK[a][t];
      const later = Y2026.ON_DOCK[a][t];
      expect({ a, t, later: map.get(mine) ?? later }).toEqual({ a, t, later });
      map.set(mine, later);
    }));
    expect(new Set(map.values()).size).toBe(map.size);
  });
  it('is lower than 2026 everywhere, by a steady ratio', () => {
    L.forEach(a => {
      const ratio = Math.round(Y2026.ON_DOCK[a].deltaport * 1000 / ON_DOCK[a].deltaport);
      expect(ratio).toBeGreaterThanOrEqual(1154);   // 15.4% to 15.7% across four annual increases
      expect(ratio).toBeLessThanOrEqual(1157);
    });
  });
});

describe('hourly rates and callout', () => {
  it('sits below the 2023 order on every figure', () => {
    expect(HOURLY.DEO.underThreshold).toBeLessThan(NEXT.HOURLY.DEO.underThreshold);
    expect(HOURLY.DEO.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.underThreshold);
    expect(HOURLY.IO_HOURLY.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.atOrOverThreshold);
    expect(CALLOUT.ioFloorCents).toBeLessThan(NEXT.CALLOUT.ioFloorCents);
  });
  it('sets the IEO minimum equal to the DEO rate and states the threshold as data', () => {
    expect(HOURLY.IEO).toEqual(HOURLY.DEO);
    expect(HOURLY_TIER_THRESHOLD_HOURS).toBe(2340);
  });
});

describe('overtime', () => {
  it('has no rule in the order itself', () => {
    expect(OVERTIME).toBeNull();
  });
  it('takes the separate overtime order from May 1, 2023, on the same terms as later orders', () => {
    expect(OVERTIME_FROM_2023_05_01.effectiveFrom).toBe('2023-05-01');
    const { multiplier, dailyThresholdHours, weeklyThresholdHours, weekStartsOn, onlyFirstNineHoursCountWeekly } = OVERTIME_FROM_2023_05_01;
    expect({ multiplier, dailyThresholdHours, weeklyThresholdHours, weekStartsOn, onlyFirstNineHoursCountWeekly }).toEqual(NEXT.OVERTIME);
  });
});

describe('other rules', () => {
  it('matches the 2023 order on PMR, multi-container and fuel', () => {
    expect(POSITIONING_MOVEMENT).toEqual(NEXT.POSITIONING_MOVEMENT);
    expect(MULTI_CONTAINER).toEqual(NEXT.MULTI_CONTAINER);
    expect(FUEL_SURCHARGE).toEqual(NEXT.FUEL_SURCHARGE);
  });
});
