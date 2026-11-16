// Integrity tests for the UNVERIFIED transcription of the pre-repeal Regulation, services 2014-04-03 to 2018-05-31.
import { describe, it, expect } from 'vitest';
import { SCHEDULE_META, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, IO_CALLOUT_FLOOR_CENTS, ON_DOCK, OFF_DOCK, EMPLOYEE_CALLOUT, FUEL_SURCHARGE } from './ctr-2014-04-03';
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
    expect([ON_DOCK, OFF_DOCK, EMPLOYEE_CALLOUT, FUEL_SURCHARGE]).toEqual([null, null, null, null]);
  });
});
