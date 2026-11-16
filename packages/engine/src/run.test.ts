// The scenarios the engine exists for. Expected amounts are worked by hand in the comments.
import { describe, it, expect } from 'vitest';
import { runCompliance } from './run';
import { ENGINE_VERSION } from './version';
import { OBCCTC_SCHEDULES } from './adapters/obcctc';
import { HOURLY, HOURLY_2025_07_01, HOURLY_TIER_THRESHOLD_HOURS, OFF_DOCK, POSITIONING_MOVEMENT } from '../../rates/obcctc-2026-07-01';
import {
  IO_HOURLY, IO_TRIP, NOT_REPORTED, OPTIONS, SYNTHETIC_SCHEDULES, amountOf, cents, driver, entry, expectClean, firstDriver,
  gapCodes, input, line, offDock, only, period, reported, ruleIds, run, statusOf, tripLine,
} from './testing/builders';

const HOUR = 60;
const QS = OFF_DOCK.Q.S;                    // Pitt Meadows to Tri Cities South, $139.00
const PMR = POSITIONING_MOVEMENT.cents;     // $25.00
const JULY_FUEL = 6_394;                    // 46% of 13900, PMR excluded

describe('a pay period straddling July 1, 2026', () => {
  const straddle = { from: '2026-06-28', to: '2026-07-11' };
  const hours = [entry('JUN', '2026-06-30', HOUR), entry('JUL', '2026-07-01', HOUR)];

  it('prices each hour of an hourly I/O under the order in force that day', () => {
    // $71.54 under the 2025 order + $73.04 under the 2026 order; fuel 54% of 7154 + 46% of 7304 = 7223.00
    const owed = HOURLY_2025_07_01.IO_HOURLY.under2340 + HOURLY.IO_HOURLY.under2340;
    const p = only([driver({ classPeriods: IO_HOURLY, hourlyEntries: hours, payPeriods: [period({ ...straddle, lines: [line('L1', 'hourly', owed), line('L2', 'fuel', 7_223)] })] })]);
    expectClean(p);
    expect(cents(p.aggregate)).toBe(0);
    expect(p.scheduleIds).toEqual(['obcctc-2025-07-01', 'obcctc-2026-07-01', 'obcctc-fuel-surcharge-published']);
  });
  it('detects pay at the old rate for the July hour', () => {
    const paid = 2 * HOURLY_2025_07_01.IO_HOURLY.under2340;
    const p = only([driver({ classPeriods: IO_HOURLY, hourlyEntries: hours, payPeriods: [period({ ...straddle, lines: [line('L1', 'hourly', paid), line('L2', 'fuel', 7_223)] })] })]);
    expect(p.verdict).toBe('shortfall_aggregate');
    expect(cents(p.aggregate)).toBe(HOURLY_2025_07_01.IO_HOURLY.under2340 - HOURLY.IO_HOURLY.under2340);   // -150
  });
  it('gives insufficient_data for a June trip: no trip table before July 1 is loaded', () => {
    const p = only([driver({ classPeriods: IO_TRIP, trips: [offDock('T1', '2026-06-30', 'Q', 'S')], payPeriods: [period({ ...straddle, lines: [tripLine('L1', 'T1', QS)] })] })]);
    expect(p.verdict).toBe('insufficient_data');
    expect(gapCodes(p)).toEqual(['SCHEDULE_COMPONENT_ABSENT']);
    expect(p.aggregate.kind).toBe('not_computable');
  });
  it('gives insufficient_data for a company driver when the earlier order holds no overtime rules', () => {
    // The premise as it stood before the 2025 order was transcribed: a prior schedule with hourly rates only.
    const hourlyOnly = { ...OBCCTC_SCHEDULES, schedules: OBCCTC_SCHEDULES.schedules.map(s => (s.id === 'obcctc-2025-07-01' ? { ...s, overtime: { kind: 'absent' as const } } : s)) };
    const p = only([driver({ hourlyEntries: hours, payPeriods: [period(straddle)] })], OPTIONS, hourlyOnly);
    expect(p.verdict).toBe('insufficient_data');
    // The July entry shares a week with the unpriced June entry, so it is a gap too.
    expect(gapCodes(p)).toEqual(['OVERTIME_WEEK_INCOMPLETE', 'SCHEDULE_COMPONENT_ABSENT']);
  });
  it('carries weekly overtime across a schedule change inside the week (synthetic schedules)', () => {
    // Synthetic: 8h day, 40h week, 2x overtime, tier step of +100 after 10 hours; rate 1000 until Tue Jul 2, 2030, then 2000.
    // Mon 8h at 1000; Tue 2h at 1000 then 6h at 1100; Wed-Fri 24h at 2100; Sat 4h weekly overtime at 2 x 2100.
    const days = ['2030-07-01', '2030-07-02', '2030-07-03', '2030-07-04', '2030-07-05'];
    const d = driver({
      hourlyEntries: [...days.map((date, i) => entry(`E${i}`, date, 8 * HOUR)), entry('SAT', '2030-07-06', 4 * HOUR)],
      payPeriods: [period({ from: '2030-06-30', to: '2030-07-06', payDate: '2030-07-12', lines: [line('L1', 'hourly', 8_000 + 2_000 + 6_600 + 50_400 + 16_800)] })],
    });
    const p = only([d], { ...OPTIONS, asOf: '2030-08-01' }, SYNTHETIC_SCHEDULES);
    expectClean(p);
    expect(cents(p.aggregate)).toBe(0);
    expect(p.scheduleIds).toEqual(['synthetic-a', 'synthetic-b']);
  });
});

describe('a driver crossing 2,340 hours mid-period', () => {
  const crossing = (paid: number, rounding = OPTIONS.rounding) => only([driver({
    openingCumulativeMinutes: reported(HOURLY_TIER_THRESHOLD_HOURS * HOUR - 30),
    hourlyEntries: [entry('E1', '2026-07-06', HOUR)],
    payPeriods: [period({ lines: [line('L1', 'hourly', paid)] })],
  })], { ...OPTIONS, rounding });

  it('owes 30 minutes at each tier: 1728 + 1801.5 = 3529.5 cents, rounded once to 3530', () => {
    const p = crossing(3_530);
    expectClean(p);
    expect(p.aggregate).toEqual({ kind: 'computed', cents: 0, exact: { num: '1', den: '2' }, roundingOnly: false });
  });
  it('labels a half-cent difference rounding-only, not an underpayment', () => {
    const p = crossing(3_529);
    expect(p.verdict).toBe('no_shortfall_detected');
    expect(p.aggregate).toEqual({ kind: 'computed', cents: -1, exact: { num: '-1', den: '2' }, roundingOnly: true });
    expect(p.findings.map(f => f.nature)).toEqual(['rounding_only', 'rounding_only', 'rounding_only']);   // base, aggregate, hourly
    expect(statusOf(p, 'AGGREGATE_SHORTFALL')).toBe('not_triggered');
  });
  it('reports a real underpayment once the difference reaches a whole cent', () => {
    const p = crossing(3_528);
    expect(p.verdict).toBe('shortfall_aggregate');
    expect(cents(p.aggregate)).toBe(-2);
  });
  it('follows the rounding mode the run states', () => {
    expect(cents(crossing(3_529, 'down').aggregate)).toBe(0);
  });
});

describe('weekly overtime and the first-nine-hours rule', () => {
  const week = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'].map((date, i) => entry(`E${i}`, date, 11 * HOUR));
  const straight = 55 * HOURLY.DEO.under2340;         // 190,080
  const dailyPremium = 10 * HOURLY.DEO.under2340 / 2;  // 17,280

  it('owes daily overtime only for five 11-hour days: 45 counted hours is not over 45', () => {
    expectClean(only([driver({ hourlyEntries: week, payPeriods: [period({ lines: [line('L1', 'hourly', straight), line('L2', 'overtime', dailyPremium)] })] })]));
  });
  it('would be short by the daily premium, and by no weekly premium, if only straight time is paid', () => {
    const p = only([driver({ hourlyEntries: week, payPeriods: [period({ lines: [line('L1', 'hourly', straight)] })] })]);
    expect(ruleIds(p)).toEqual(['AGGREGATE_SHORTFALL', 'BASE_SHORTFALL_SEGREGATED', 'OVERTIME_DAILY_UNDERPAID']);
    expect(amountOf(p, 'OVERTIME_DAILY_UNDERPAID')).toBe(dailyPremium);
    expect(cents(p.aggregate)).toBe(-dailyPremium);   // double-counting would add 10h of weekly premium here
  });
});

describe('fuel surcharge and the positioning movement rate', () => {
  const trip = (fuelPaid: number) => only([driver({
    classPeriods: IO_TRIP, trips: [offDock('T1', '2026-07-06', 'Q', 'S')],
    payPeriods: [period({ lines: [tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L3', 'fuel', fuelPaid)] })],
  })]);

  it('computes fuel on the trip rate alone: 46% of 13900 = 6394', () => {
    const p = trip(JULY_FUEL);
    expectClean(p);
    expect(cents(p.buckets.fuel)).toBe(0);
  });
  it('does not put the PMR in the base: 46% of 16400 would be 7544', () => {
    expect(cents(trip(7_544).buckets.fuel)).toBe(7_544 - JULY_FUEL);   // a surplus of 1150, not zero
  });
  it('finds fuel paid one cent under the amount owed', () => {
    const p = trip(JULY_FUEL - 1);
    expect(ruleIds(p)).toContain('FUEL_SURCHARGE_BELOW_MINIMUM');
    expect(cents(p.buckets.fuel)).toBe(-1);
  });
});

describe('trips and payments that do not match', () => {
  const base = { classPeriods: IO_TRIP, trips: [offDock('T1', '2026-07-06', 'Q', 'S')] };

  it('reports a trip with no linked payment as a finding once the period is paid', () => {
    const p = only([driver({ ...base, payPeriods: [period({ lines: [line('L2', 'pmr', PMR), line('L3', 'fuel', JULY_FUEL)] })] })]);
    expect(amountOf(p, 'TRIP_NO_MATCHING_PAYMENT')).toBe(QS);
    expect(p.verdict).toBe('shortfall_aggregate');
    expect(cents(p.strictPerTrip)).toBe(-QS);
  });
  it('marks the same trip pending while its pay period is still open', () => {
    const p = only([driver({ ...base, payPeriods: [period()] })], { ...OPTIONS, asOf: '2026-07-20' });   // pay date is July 24
    expect(p.findings.map(f => [f.ruleId, f.nature])).toEqual([['TRIP_NO_MATCHING_PAYMENT', 'pending']]);
    expect(p.verdict).toBe('insufficient_data');
    expect(gapCodes(p)).toEqual(['PAY_PERIOD_OPEN']);
    expect(statusOf(p, 'TRIP_NO_MATCHING_PAYMENT')).toBe('not_evaluated');
  });
  it('treats a trip payment with no trip record as a gap: work the engine cannot price', () => {
    const lines = [tripLine('L1', 'T1', QS), tripLine('L9', 'GHOST', 15_000), line('L2', 'pmr', PMR), line('L3', 'fuel', JULY_FUEL)];
    const p = only([driver({ ...base, payPeriods: [period({ lines })] })]);
    expect(p.verdict).toBe('insufficient_data');
    expect(p.gaps.map(g => [g.code, g.recordIds])).toEqual([['PAYMENT_WITHOUT_TRIP', ['L9']]]);
  });
  it('treats an unlinked trip payment the same way', () => {
    const lines = [{ ...tripLine('L1', 'T1', QS), link: { kind: 'unlinked' as const } }];
    expect(gapCodes(only([driver({ ...base, payPeriods: [period({ lines })] })]))).toEqual(['PAYMENT_WITHOUT_TRIP']);
  });
});

describe('zero wait time versus missing wait time', () => {
  const d = (waitTimeReceived: ReturnType<typeof period>['waitTimeReceived']) => driver({
    hourlyEntries: [entry('E1', '2026-07-06', HOUR)],
    payPeriods: [period({ waitTimeReceived, lines: [line('L1', 'hourly', HOURLY.DEO.under2340)] })],
  });
  it('passes when the licensee reports receiving nothing', () => {
    expectClean(only([d(reported(0))]));
  });
  it('gives insufficient_data when receipts were not reported at all', () => {
    const p = only([d(NOT_REPORTED)]);
    expect(p.verdict).toBe('insufficient_data');
    expect(gapCodes(p)).toEqual(['WAIT_TIME_NOT_REPORTED']);
    expect(statusOf(p, 'WAIT_TIME_NOT_PASSED_THROUGH')).toBe('not_evaluated');
  });
});

describe('aggregate and segregated verdicts that disagree', () => {
  // Owed: trip 13900 + PMR 2500, fuel 6394, wait time received 5000 = 27794.
  // Paid: trip 12000, PMR 2500, fuel 6394, wait time 8000 = 28894.
  const p = only([driver({
    classPeriods: IO_TRIP, trips: [offDock('T1', '2026-07-06', 'Q', 'S')],
    payPeriods: [period({ waitTimeReceived: reported(5_000), lines: [tripLine('L1', 'T1', 12_000), line('L2', 'pmr', PMR), line('L3', 'fuel', JULY_FUEL), line('L4', 'wait_time', 8_000)] })],
  })]);

  it('reports both numbers and the range, and collapses neither', () => {
    expect(p.verdict).toBe('shortfall_segregated_only');
    expect(cents(p.aggregate)).toBe(1_100);      // surplus wait time masks the trip rate
    expect(cents(p.segregated)).toBe(-1_900);    // base alone is short
    expect(p.range).toEqual({ kind: 'computed', lowCents: -1_900, highCents: 1_100 });
    expect([cents(p.buckets.base), cents(p.buckets.waitTime), cents(p.buckets.fuel)]).toEqual([-1_900, 3_000, 0]);
  });
  it('lists the per-trip finding beside the comparison and reports strict per-trip as a third number', () => {
    expect(ruleIds(p)).toEqual(['BASE_SHORTFALL_SEGREGATED', 'TRIP_RATE_BELOW_MINIMUM']);
    expect(cents(p.strictPerTrip)).toBe(-1_900);
    expect(statusOf(p, 'AGGREGATE_SHORTFALL')).toBe('not_triggered');
  });
  it('words the outcome as a calculation, never as compliance', () => {
    expect(p.statement).toContain('under the rules as encoded, for the data provided');
    expect(p.statement.toLowerCase()).not.toContain('compliant');
  });
});

describe('a date with no schedule', () => {
  const d = driver({
    classPeriods: [{ class: 'DEO', from: '2014-04-03', to: null }],
    hourlyEntries: [entry('E1', '2018-03-05', HOUR)],
    payPeriods: [period({ from: '2018-03-04', to: '2018-03-17', payDate: '2018-03-23', lines: [line('L1', 'hourly', 99_999)] })],
  });
  it('gives insufficient_data and never falls back to the nearest schedule', () => {
    const p = only([d]);
    expect(p.verdict).toBe('insufficient_data');
    expect(gapCodes(p)).toEqual(['NO_SCHEDULE_FOR_DATE']);
    expect(p.scheduleIds).toEqual([]);
    expect([p.aggregate.kind, p.segregated.kind]).toEqual(['not_computable', 'not_computable']);
  });
  it('makes the whole driver insufficient_data even when another period is clean', () => {
    const clean = period({ payPeriodId: 'P2', lines: [line('L2', 'hourly', HOURLY.DEO.under2340)] });
    const both = driver({ ...d, hourlyEntries: [...d.hourlyEntries, entry('E2', '2026-07-06', HOUR)], payPeriods: [...d.payPeriods, clean] });
    const result = firstDriver(run([both]));
    expect(result.periods.map(x => x.verdict)).toEqual(['insufficient_data', 'no_shortfall_detected']);
    expect(result.verdict).toBe('insufficient_data');
  });
});

describe('reproducibility and purity', () => {
  const d = driver({ hourlyEntries: [entry('E1', '2026-07-06', HOUR)], payPeriods: [period({ lines: [line('L1', 'hourly', HOURLY.DEO.under2340)] })] });

  it('carries everything needed to recompute the result', () => {
    expect(run([d]).provenance).toEqual({
      engineVersion: ENGINE_VERSION, scheduleIds: ['obcctc-2026-07-01'],
      schedules: [{ id: 'obcctc-2026-07-01', status: 'verified', verifiedBy: null }], unverifiedSchedulesUsed: false,
      rounding: 'half_up', asOf: '2026-11-14',
      deductionPolicyId: 'synthetic-test-policy', licenseeId: 'L1', input: { sources: [{ name: 'test', digest: 'sha256:test' }] },
    });
  });
  it('gives the same result for the same input, and the result survives JSON', () => {
    const a = run([d]);
    expect(run([d])).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
  it('does not mutate its input', () => {
    const frozen = JSON.stringify(input([d]));
    run([d]);
    expect(JSON.stringify(input([d]))).toBe(frozen);
  });
  it('rejects malformed input outright instead of repairing it', () => {
    const bad = driver({ hourlyEntries: [entry('E1', '2026-02-30', 60.5)], payPeriods: [period(), period()] });
    const result = runCompliance(input([bad]), OBCCTC_SCHEDULES, OPTIONS);
    expect(result.kind).toBe('invalid_input');
    expect(result.kind === 'invalid_input' && result.errors.length).toBe(4);   // date, minutes, overlap, duplicate id
  });
});
