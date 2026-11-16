// Integrity tests for the UNVERIFIED 2024-07-01 transcription. They guard the seed data, not the engine.
import { describe, it, expect } from 'vitest';
import { SCHEDULE_META, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, CALLOUT, POSITIONING_MOVEMENT, MULTI_CONTAINER, FUEL_SURCHARGE, ON_DOCK, OFF_DOCK } from './obcctc-2024-07-01';
import * as NEXT from './obcctc-2025-07-01';

describe('status', () => {
  it('is marked unverified with no sign-off', () => {
    expect([SCHEDULE_META.status, SCHEDULE_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('runs from July 1, 2024 to the day before the next order', () => {
    expect([SCHEDULE_META.effectiveFrom, SCHEDULE_META.effectiveTo]).toEqual(['2024-07-01', '2025-06-30']);
    expect(NEXT.SCHEDULE_META.effectiveFrom).toBe('2025-07-01');
  });
});

describe('hourly rates', () => {
  it('pays IEOs the same as company drivers and the higher tier more than the lower', () => {
    expect(HOURLY.IEO).toEqual(HOURLY.DEO);
    expect(HOURLY.DEO.underThreshold).toBeLessThan(HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(HOURLY.IO_HOURLY.atOrOverThreshold);
  });
  it('sits below the following order on every figure', () => {
    // Rates have risen every year; a figure at or above next year's is almost certainly a typo.
    expect(HOURLY.DEO.underThreshold).toBeLessThan(NEXT.HOURLY.DEO.underThreshold);
    expect(HOURLY.DEO.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.underThreshold);
    expect(HOURLY.IO_HOURLY.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.atOrOverThreshold);
    expect(CALLOUT.ioFloorCents).toBeLessThan(NEXT.CALLOUT.ioFloorCents);
  });
  it('rises by between 1% and 10% to the following order', () => {
    const pct = (a: number, b: number) => Math.round((b - a) * 1000 / a) / 10;
    [pct(HOURLY.DEO.underThreshold, NEXT.HOURLY.DEO.underThreshold), pct(HOURLY.IO_HOURLY.underThreshold, NEXT.HOURLY.IO_HOURLY.underThreshold)]
      .forEach(p => { expect(p).toBeGreaterThan(1); expect(p).toBeLessThan(10); });
  });
  it('holds whole cents and states the tier threshold as data', () => {
    Object.values(HOURLY).forEach(t => expect(Number.isInteger(t.underThreshold) && Number.isInteger(t.atOrOverThreshold)).toBe(true));
    expect(HOURLY_TIER_THRESHOLD_HOURS).toBe(2340);
    expect(CALLOUT.ioFloorCents % 100).toBe(0);   // the callout floor is a whole-dollar figure
  });
});

describe('rules carried in the order text', () => {
  it('matches the following order on overtime, PMR, multi-container and fuel, which the fetched text states identically', () => {
    expect(OVERTIME).toEqual(NEXT.OVERTIME);
    expect(POSITIONING_MOVEMENT).toEqual(NEXT.POSITIONING_MOVEMENT);
    expect(MULTI_CONTAINER).toEqual(NEXT.MULTI_CONTAINER);
    expect(FUEL_SURCHARGE).toEqual(NEXT.FUEL_SURCHARGE);
  });
  it('stores every multiplier as an integer ratio', () => {
    [OVERTIME.multiplier, POSITIONING_MOVEMENT.twoContainerMultiplier, MULTI_CONTAINER.offDockTwoContainerTripMultiplier]
      .forEach(r => expect([r.num, r.den]).toEqual([3, 2]));
  });
});

describe('trip tables', () => {
  it('are null, not guessed: the appendices are images nobody has transcribed', () => {
    expect([ON_DOCK, OFF_DOCK]).toEqual([null, null]);
  });
});
