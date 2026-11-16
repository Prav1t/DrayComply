// Integrity tests for the OBCCTC 2026-07-01 rate schedule.
// These guard the seed data, not the engine. Run them after any rate entry.
import { describe, it, expect } from 'vitest';
import {
  ZONES, ON_DOCK, OFF_DOCK, HOURLY, HOURLY_TIER_THRESHOLD_HOURS,
  OVERTIME, POSITIONING_MOVEMENT, MULTI_CONTAINER,
  FUEL_SURCHARGE, FUEL_SURCHARGE_PUBLISHED,
  type ZoneLetter, type Ratio,
} from './obcctc-2026-07-01';

const L = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] as ZoneLetter[];

describe('zones', () => {
  it('has 26 areas numbered 1 to 26', () => {
    expect(ZONES).toHaveLength(26);                    // Appendix II lists 26
    ZONES.forEach((z, i) => expect(z.item).toBe(i + 1));
  });
  it('maps each area to a unique letter A to Z', () => {
    expect(new Set(ZONES.map(z => z.letter)).size).toBe(26);
  });
  it('gives every area a description', () => {
    ZONES.forEach(z => expect(z.description.length).toBeGreaterThan(5));
  });
});

describe('off-dock matrix', () => {
  it('covers every origin and destination pair', () => {
    L.forEach(a => expect(Object.keys(OFF_DOCK[a])).toHaveLength(26));
  });
  it('charges $121.00 for a trip within the same area', () => {
    L.forEach(a => expect(OFF_DOCK[a][a]).toBe(12_100));
  });
  it('is symmetric: the rate does not depend on direction', () => {
    // A single mistyped digit almost always breaks this. Keep it.
    L.forEach(a => L.forEach(b => expect(OFF_DOCK[a][b]).toBe(OFF_DOCK[b][a])));
  });
  it('holds whole dollars expressed as integer cents', () => {
    L.forEach(a => L.forEach(b => {
      expect(Number.isInteger(OFF_DOCK[a][b])).toBe(true);
      expect(OFF_DOCK[a][b] % 100).toBe(0);
    }));
  });
  it('uses the published banded rate vocabulary', () => {
    // Appendix III draws from a fixed set of band values; a stray value is a typo.
    const bands = new Set([121,134,139,145,152,158,163,169,175,180,188,193,198,204,211,216,224,229,234]);
    L.forEach(a => L.forEach(b => expect(bands.has(OFF_DOCK[a][b] / 100)).toBe(true)));
  });
});

describe('on-dock table', () => {
  it('covers all 26 areas across three terminals', () => {
    expect(Object.keys(ON_DOCK)).toHaveLength(26);
  });
  it('matches spot values read from Appendix I', () => {
    expect(ON_DOCK.A.centermVanterm).toBe(27_756);     // Abbotsford East
    expect(ON_DOCK.E.deltaport).toBe(30_457);          // Chilliwack, highest
    expect(ON_DOCK.H.deltaport).toBe(13_547);          // Delta, lowest
    expect(ON_DOCK.Z.fraserSurreyDocks).toBe(18_968);  // West Vancouver
  });
});

describe('hourly rates', () => {
  it('pays the higher tier at or above 2,340 hours', () => {
    expect(HOURLY.DEO.under2340).toBeLessThan(HOURLY.DEO.atOrOver2340);
    expect(HOURLY.IO_HOURLY.under2340).toBeLessThan(HOURLY.IO_HOURLY.atOrOver2340);
  });
  it('pays IEOs the same as company drivers', () => {
    expect(HOURLY.IEO).toEqual(HOURLY.DEO);            // the order sets them equal
  });
  it('matches the published July 1, 2026 minimums', () => {
    expect(HOURLY.DEO.under2340).toBe(3_456);
    expect(HOURLY.DEO.atOrOver2340).toBe(3_603);
    expect(HOURLY.IO_HOURLY.under2340).toBe(7_304);
    expect(HOURLY.IO_HOURLY.atOrOver2340).toBe(7_505);
  });
});

describe('fuel surcharge', () => {
  it('derives every published monthly percentage from the formula', () => {
    // (A - 1.05) / 0.05 * 2%. If this fails, a reference price or pct is mistyped.
    Object.entries(FUEL_SURCHARGE_PUBLISHED).forEach(([month, v]) => {
      const steps = Math.floor(
        (v.referenceCentsPerLitre - FUEL_SURCHARGE.thresholdCentsPerLitre) /
        FUEL_SURCHARGE.stepCentsPerLitre,
      );
      expect({ month, pct: steps * FUEL_SURCHARGE.pctPerStep }).toEqual({ month, pct: v.pct });
    });
  });
  it('excludes the positioning movement rate from the surcharge base', () => {
    expect(FUEL_SURCHARGE.excludesPositioningMovementRate).toBe(true);
  });
});

describe('exact numbers only', () => {
  const isExact = (r: Ratio) => Number.isInteger(r.num) && Number.isInteger(r.den) && r.den > 0;
  it('stores every multiplier as an integer ratio, never a float', () => {
    expect(isExact(OVERTIME.multiplier)).toBe(true);
    expect(isExact(POSITIONING_MOVEMENT.twoContainerMultiplier)).toBe(true);
    expect(isExact(MULTI_CONTAINER.offDockTwoContainerTripMultiplier)).toBe(true);
  });
  it('encodes 1.5x as 3/2', () => {
    expect(OVERTIME.multiplier).toEqual({ num: 3, den: 2 });
    expect(MULTI_CONTAINER.offDockTwoContainerTripMultiplier).toEqual({ num: 3, den: 2 });
  });
  it('states the tier threshold as data, as written in the order', () => {
    expect(HOURLY_TIER_THRESHOLD_HOURS).toBe(2340);
  });
  it('carries no on-dock two-container multiplier', () => {
    // The order states none. Its absence is deliberate: the engine must raise a gap.
    expect(Object.keys(MULTI_CONTAINER)).toEqual(['offDockTwoContainerTripMultiplier']);
  });
});
