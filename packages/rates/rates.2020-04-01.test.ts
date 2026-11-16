// Integrity tests for the UNVERIFIED transcription of the April 1, 2020 order (January 13, 2022 version).
import { describe, it, expect } from 'vitest';
import { SCHEDULE_META, ON_DOCK, OFF_DOCK, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, CALLOUT, POSITIONING_MOVEMENT, MULTI_CONTAINER, FUEL_SURCHARGE, type ZoneLetter } from './obcctc-2020-04-01';
import * as NEXT from './obcctc-2022-07-01';

const L = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] as ZoneLetter[];

describe('status', () => {
  it('is marked unverified with no sign-off', () => {
    expect([SCHEDULE_META.status, SCHEDULE_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('runs from April 1, 2020 to the day before the July 1, 2022 amendment', () => {
    expect([SCHEDULE_META.effectiveFrom, SCHEDULE_META.effectiveTo]).toEqual(['2020-04-01', '2022-06-30']);
    expect(NEXT.SCHEDULE_META.effectiveFrom).toBe('2022-07-01');
  });
});

describe('trip tables', () => {
  it('match the July 2022 file cell for cell: two separate readings of two PDFs of the same order', () => {
    // The July 2022 amendment changed hourly rates only. A single mistyped cell in either file breaks this.
    expect(ON_DOCK).toEqual(NEXT.ON_DOCK);
    expect(OFF_DOCK).toEqual(NEXT.OFF_DOCK);
  });
  it('is symmetric and charges $105.00 within an area', () => {
    L.forEach(a => L.forEach(b => expect({ a, b, cents: OFF_DOCK[a][b] }).toEqual({ a, b, cents: OFF_DOCK[b][a] })));
    L.forEach(a => expect(OFF_DOCK[a][a]).toBe(10_500));
  });
});

describe('hourly rates and callout', () => {
  it('sits below the July 2022 amendment on every hourly figure', () => {
    expect(HOURLY.DEO.underThreshold).toBeLessThan(NEXT.HOURLY.DEO.underThreshold);
    expect(HOURLY.DEO.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.underThreshold);
    expect(HOURLY.IO_HOURLY.atOrOverThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.atOrOverThreshold);
  });
  it('keeps the same tier gap for company drivers as every later order: the higher tier is 4% to 5% above the lower', () => {
    const pct = Math.round(HOURLY.DEO.atOrOverThreshold * 1000 / HOURLY.DEO.underThreshold);
    expect(pct).toBeGreaterThanOrEqual(1040);
    expect(pct).toBeLessThanOrEqual(1050);
  });
  it('sets the IEO minimum equal to the DEO rate, with the same callout terms as July 2022', () => {
    expect(HOURLY.IEO).toEqual(HOURLY.DEO);
    expect(CALLOUT).toEqual(NEXT.CALLOUT);
    expect(HOURLY_TIER_THRESHOLD_HOURS).toBe(2340);
  });
});

describe('other rules', () => {
  it('has no overtime rule, and the same PMR, multi-container and fuel rules as July 2022', () => {
    expect(OVERTIME).toBeNull();
    expect(POSITIONING_MOVEMENT).toEqual(NEXT.POSITIONING_MOVEMENT);
    expect(MULTI_CONTAINER).toEqual(NEXT.MULTI_CONTAINER);
    expect(FUEL_SURCHARGE).toEqual(NEXT.FUEL_SURCHARGE);
  });
});
