// Integrity tests for the UNVERIFIED transcription of the pre-repeal Regulation, services 2014-04-03 to 2018-05-31.
import { describe, it, expect } from 'vitest';
import { SCHEDULE_META, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, IO_CALLOUT_FLOOR_CENTS, ON_DOCK, OFF_DOCK, OFF_DOCK_FROM_2016_07_20, ZONES, ZONE_H_FROM_2016_07_20, MULTI_CONTAINER, POSITIONING_MOVEMENT, EMPLOYEE_CALLOUT, FUEL_SURCHARGE, type ZoneLetter } from './ctr-2014-04-03';
import * as NEXT from './ctr-2018-06-01';

describe('status and dates', () => {
  it('is marked unverified with no sign-off', () => {
    expect([SCHEDULE_META.status, SCHEDULE_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('ends the day before the next period begins', () => {
    expect([SCHEDULE_META.effectiveFrom, SCHEDULE_META.effectiveTo]).toEqual(['2014-04-03', '2018-05-31']);
    expect('2018-06-01').toBe('2018-06-01');
  });
});

describe('hourly rates', () => {
  it('pays the higher tier more, sets the IEO amount equal to the DEO amount, and states the threshold as data', () => {
    expect(HOURLY.DEO.underThreshold).toBeLessThan(HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(HOURLY.IO_HOURLY.atOrOverThreshold);
    expect(HOURLY.IEO).toEqual(HOURLY.DEO);
    expect(HOURLY_TIER_THRESHOLD_HOURS).toBe(2340);
  });
  it('does not exceed the next period on any figure', () => {
    expect(HOURLY.DEO.underThreshold).toBeLessThan(NEXT.HOURLY.DEO.underThreshold);
    expect(HOURLY.DEO.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.underThreshold);
    expect(IO_CALLOUT_FLOOR_CENTS).toBeLessThanOrEqual(NEXT.IO_CALLOUT_FLOOR_CENTS);
  });
  it('keeps the tier step for company drivers and independent operators within a few cents of each other', () => {
    // The step up at 2,340 hours is $1.15 to $1.20 for both classes in every period of the regulation.
    const steps = [HOURLY.DEO.atOrOverThreshold - HOURLY.DEO.underThreshold, HOURLY.IO_HOURLY.atOrOverThreshold - HOURLY.IO_HOURLY.underThreshold];
    steps.forEach(s => { expect(s).toBeGreaterThanOrEqual(115); expect(s).toBeLessThanOrEqual(120); });
  });
  it('matches the figures the regulation states for services before June 1, 2018', () => {
    expect([HOURLY.DEO.underThreshold, HOURLY.DEO.atOrOverThreshold, HOURLY.IO_HOURLY.underThreshold, HOURLY.IO_HOURLY.atOrOverThreshold]).toEqual([2_513, 2_628, 5_013, 5_128]);
    expect(IO_CALLOUT_FLOOR_CENTS).toBe(20_000);
  });
  it('starts on April 3, 2014, the date section 19 reaches back to', () => {
    expect(SCHEDULE_META.effectiveFrom).toBe('2014-04-03');
  });
});

describe('what is not here', () => {
  it('has no overtime rule, and marks that as read-and-absent', () => {
    expect(OVERTIME).toBe('no_rule_in_order');
  });
  it('leaves the untranscribed parts null, not guessed', () => {
    // Changed 2026-11-16 (DECISIONS 106): the trip schedules that are text in the source are now transcribed.
    expect([EMPLOYEE_CALLOUT, FUEL_SURCHARGE]).toEqual([null, null]);
  });
});

const L = [...'ABCDEFGHIJKLMNOPQRSTUVWXY'] as ZoneLetter[];
const T = ['centermVanterm', 'deltaport', 'fraserSurreyDocks'] as const;

describe('areas', () => {
  it('lists 25 areas lettered A to Y in item order, with item 8 renamed on July 20, 2016', () => {
    expect(ZONES.map(z => z.letter)).toEqual(L);
    expect(ZONES.map(z => z.item)).toEqual(L.map((_, i) => i + 1));
    expect([ZONES[7]?.name, ZONE_H_FROM_2016_07_20.name, ZONE_H_FROM_2016_07_20.effectiveFrom]).toEqual(['Delta North', 'City of Delta', '2016-07-20']);
  });
});

describe('off-dock table from July 20, 2016', () => {
  const table = OFF_DOCK_FROM_2016_07_20.table;
  it('is symmetric and charges $100.00 within an area', () => {
    L.forEach(a => L.forEach(b => expect({ a, b, cents: table[a][b] }).toEqual({ a, b, cents: table[b][a] })));
    L.forEach(a => expect(table[a][a]).toBe(10_000));
  });
  it('holds only whole multiples of $5.00 from $100.00 to $155.00, and $100.00 off the diagonal only between Cloverdale and Langley City', () => {
    const offDiagonalMinimums: string[] = [];
    L.forEach(a => L.forEach(b => {
      const cents = table[a][b];
      expect(cents % 500).toBe(0);
      expect(cents).toBeGreaterThanOrEqual(10_000);
      expect(cents).toBeLessThanOrEqual(15_500);
      if (a !== b && cents === 10_000) offDiagonalMinimums.push(a + b);
    }));
    expect(offDiagonalMinimums).toEqual(['FK', 'KF']);
  });
  it('has a fixed total, so a mistyped cell that keeps symmetry still fails', () => {
    // Sum of all 625 cells as transcribed on 2026-11-16 from two separate reads of the page.
    expect(L.reduce((sum, a) => sum + L.reduce((row, b) => row + table[a][b], 0), 0)).toBe(7_614_000);
  });
});

describe('off-dock table as first enacted', () => {
  it('differs from the July 2016 table in exactly two cells, both in column K', () => {
    const changed = L.flatMap(a => L.filter(b => OFF_DOCK[a][b] !== OFF_DOCK_FROM_2016_07_20.table[a][b]).map(b => [a + b, OFF_DOCK[a][b], OFF_DOCK_FROM_2016_07_20.table[a][b]]));
    expect(changed).toEqual([['FK', 11_000, 10_000], ['IK', 10_000, 11_000]]);
  });
  it('is asymmetric in exactly those two pairs, as printed: the amendment is what made the table symmetric', () => {
    const lopsided = L.flatMap(a => L.filter(b => a < b && OFF_DOCK[a][b] !== OFF_DOCK[b][a]).map(b => a + b));
    expect(lopsided).toEqual(['FK', 'IK']);
  });
});

describe('on-dock table', () => {
  it('holds only whole multiples of $5.60, the unit every figure in Schedule 2 is built from', () => {
    L.forEach(a => T.forEach(t => expect({ a, t, rem: ON_DOCK[a][t] % 560 }).toEqual({ a, t, rem: 0 })));
  });
  it('maps onto the June 2018 table one value to one value, each 2.5% to 2.7% higher', () => {
    const next = NEXT.ON_DOCK;
    const map = new Map<number, Set<number>>();
    L.forEach(a => T.forEach(t => map.set(ON_DOCK[a][t], (map.get(ON_DOCK[a][t]) ?? new Set<number>()).add(next[a][t]))));
    map.forEach((to, from) => {
      expect({ from, values: to.size }).toEqual({ from, values: 1 });
      to.forEach(v => { expect(v * 1000).toBeGreaterThanOrEqual(from * 1025); expect(v * 1000).toBeLessThanOrEqual(from * 1027); });
    });
  });
});

describe('other trip rules', () => {
  it('pays 1.5x for two containers off-dock and has no positioning movement rate', () => {
    expect(MULTI_CONTAINER.offDockTwoContainerTripMultiplier).toEqual({ num: 3, den: 2 });
    expect(POSITIONING_MOVEMENT).toBe('no_rule_in_order');
  });
});
