// Integrity tests for the UNVERIFIED transcription of the pre-repeal Regulation, services 2018-06-01 to 2019-05-31.
import { describe, it, expect } from 'vitest';
import { SCHEDULE_META, HOURLY, HOURLY_TIER_THRESHOLD_HOURS, OVERTIME, IO_CALLOUT_FLOOR_CENTS, ON_DOCK, OFF_DOCK, EMPLOYEE_CALLOUT, FUEL_SURCHARGE } from './ctr-2018-06-01';
import * as NEXT from './ctr-2019-06-01';

describe('status and dates', () => {
  it('is marked unverified with no sign-off', () => {
    expect([SCHEDULE_META.status, SCHEDULE_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('ends the day before the next period begins', () => {
    expect([SCHEDULE_META.effectiveFrom, SCHEDULE_META.effectiveTo]).toEqual(['2018-06-01', '2019-05-31']);
    expect('2019-06-01').toBe('2019-06-01');
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
    expect(IO_CALLOUT_FLOOR_CENTS).toBeLessThanOrEqual(NEXT.IO_CALLOUT_FLOOR_CENTS);
  });
  it('keeps the tier step for company drivers and independent operators within a few cents of each other', () => {
    // The step up at 2,340 hours is $1.15 to $1.20 for both classes in every period of the regulation.
    const steps = [HOURLY.DEO.atOrOverThreshold - HOURLY.DEO.underThreshold, HOURLY.IO_HOURLY.atOrOverThreshold - HOURLY.IO_HOURLY.underThreshold];
    steps.forEach(s => { expect(s).toBeGreaterThanOrEqual(115); expect(s).toBeLessThanOrEqual(120); });
  });
  it('pays an independent operator exactly $25.65 more per hour than a company driver on both tiers, as the 2018 increase kept it', () => {
    // $51.43 - $25.78 and $52.61 - $26.96. A mistyped digit in any of the four breaks this.
    expect([HOURLY.IO_HOURLY.underThreshold - HOURLY.DEO.underThreshold, HOURLY.IO_HOURLY.atOrOverThreshold - HOURLY.DEO.atOrOverThreshold]).toEqual([2_565, 2_565]);
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
