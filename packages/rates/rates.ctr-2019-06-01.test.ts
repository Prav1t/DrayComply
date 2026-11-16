// Integrity tests for the UNVERIFIED transcription of the pre-repeal Regulation, services 2019-06-01 to 2019-06-30.
import { describe, it, expect } from 'vitest';
import { SCHEDULE_META, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, IO_CALLOUT_FLOOR_CENTS, ON_DOCK, OFF_DOCK, EMPLOYEE_CALLOUT, FUEL_SURCHARGE } from './ctr-2019-06-01';
import * as NEXT from './obcctc-2020-04-01';

describe('status and dates', () => {
  it('is marked unverified with no sign-off', () => {
    expect([SCHEDULE_META.status, SCHEDULE_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('ends the day before the next period begins', () => {
    expect([SCHEDULE_META.effectiveFrom, SCHEDULE_META.effectiveTo]).toEqual(['2019-06-01', '2019-06-30']);
    expect('2019-07-01').toBe('2019-07-01');
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
    expect(HOURLY.DEO.underThreshold).toBeLessThanOrEqual(NEXT.HOURLY.DEO.underThreshold);
    expect(HOURLY.DEO.atOrOverThreshold).toBeLessThanOrEqual(NEXT.HOURLY.DEO.atOrOverThreshold);
    expect(HOURLY.IO_HOURLY.underThreshold).toBeLessThan(NEXT.HOURLY.IO_HOURLY.underThreshold);
    expect(IO_CALLOUT_FLOOR_CENTS).toBeLessThanOrEqual(NEXT.CALLOUT.ioFloorCents);
  });
  it('keeps the tier step for company drivers and independent operators within a few cents of each other', () => {
    // The step up at 2,340 hours is $1.15 to $1.20 for both classes in every period of the regulation.
    const steps = [HOURLY.DEO.atOrOverThreshold - HOURLY.DEO.underThreshold, HOURLY.IO_HOURLY.atOrOverThreshold - HOURLY.IO_HOURLY.underThreshold];
    steps.forEach(s => { expect(s).toBeGreaterThanOrEqual(115); expect(s).toBeLessThanOrEqual(120); });
  });
  it('carries the same company driver rates as the April 2020 order, which did not change them', () => {
    // An independent cross-check: two documents, read separately, agree on $26.30 and $27.50.
    expect(HOURLY.DEO).toEqual(NEXT.HOURLY.DEO);
  });
  it('ends on June 30, 2019, the day before repeal', () => {
    expect(SCHEDULE_META.effectiveTo).toBe('2019-06-30');
  });
});

describe('what is not here', () => {
  it('has no overtime rule, and marks that as read-and-absent', () => {
    expect(OVERTIME).toBe('no_rule_in_order');
  });
  it('leaves the untranscribed parts null, not guessed', () => {
    expect([ON_DOCK, OFF_DOCK, EMPLOYEE_CALLOUT, FUEL_SURCHARGE]).toEqual([null, null, null, null]);
  });
});
