// Integrity tests for the UNVERIFIED 2025-07-01 transcription. They guard the seed data, not the engine.
import { describe, it, expect } from 'vitest';
import { SCHEDULE_META, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, CALLOUT, POSITIONING_MOVEMENT, MULTI_CONTAINER, FUEL_SURCHARGE, ON_DOCK, OFF_DOCK } from './obcctc-2025-07-01';
import * as NEXT from './obcctc-2026-07-01';

describe('status', () => {
  it('is marked unverified with no sign-off', () => {
    expect([SCHEDULE_META.status, SCHEDULE_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('runs from July 1, 2025 to the day before the 2026 order', () => {
    expect([SCHEDULE_META.effectiveFrom, SCHEDULE_META.effectiveTo]).toEqual(['2025-07-01', '2026-06-30']);
    expect(NEXT.SCHEDULE_META.effectiveFrom).toBe('2026-07-01');
  });
});

describe('hourly rates', () => {
  it('agrees with the 2025 figures recorded independently in the verified 2026 file', () => {
    // Two separate transcriptions of the same order. A mismatch means one of them is wrong.
    expect([HOURLY.DEO.underThreshold, HOURLY.DEO.atOrOverThreshold]).toEqual([NEXT.HOURLY_2025_07_01.DEO.under2340, NEXT.HOURLY_2025_07_01.DEO.atOrOver2340]);
    expect([HOURLY.IO_HOURLY.underThreshold, HOURLY.IO_HOURLY.atOrOverThreshold]).toEqual([NEXT.HOURLY_2025_07_01.IO_HOURLY.under2340, NEXT.HOURLY_2025_07_01.IO_HOURLY.atOrOver2340]);
    expect(CALLOUT.ioFloorCents).toBe(NEXT.HOURLY_2025_07_01.calloutIoFloorCents);
  });
  it('pays IEOs the same as company drivers and the higher tier more than the lower', () => {
    expect(HOURLY.IEO).toEqual(HOURLY.DEO);
    expect(HOURLY.DEO.underThreshold).toBeLessThan(HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(HOURLY.IO_HOURLY.atOrOverThreshold);
  });
  it('sits below the 2026 rates on every figure', () => {
    expect(HOURLY.DEO.underThreshold).toBeLessThan(NEXT.HOURLY.DEO.under2340);
    expect(HOURLY.IO_HOURLY.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.atOrOver2340);
    expect(CALLOUT.ioFloorCents).toBeLessThan(NEXT.CALLOUT.ioFloorCents);
  });
  it('states the tier threshold as data', () => {
    expect(HOURLY_TIER_THRESHOLD_HOURS).toBe(2340);
  });
});

describe('rules carried in the order text', () => {
  it('matches the 2026 overtime, PMR, multi-container and fuel rules, which the fetched text states identically', () => {
    expect(OVERTIME).toEqual(NEXT.OVERTIME);
    expect({ ...POSITIONING_MOVEMENT }).toEqual({ ...NEXT.POSITIONING_MOVEMENT });
    expect(MULTI_CONTAINER).toEqual(NEXT.MULTI_CONTAINER);
    expect(FUEL_SURCHARGE).toEqual(NEXT.FUEL_SURCHARGE);
  });
  it('carries no on-dock two-container multiplier', () => {
    expect(Object.keys(MULTI_CONTAINER)).toEqual(['offDockTwoContainerTripMultiplier']);
  });
});

describe('trip tables', () => {
  it('are null, not guessed: the appendices are images nobody has transcribed', () => {
    expect([ON_DOCK, OFF_DOCK]).toEqual([null, null]);
  });
});
