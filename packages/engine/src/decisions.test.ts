// Decisions of 2026-11-16 (see DECISIONS.md). One block per decision.
import { describe, it, expect } from 'vitest';
import { parseComplianceInput, parseRunOptions } from './boundary/parse';
import { HOURLY, HOURLY_2025_07_01, HOURLY_TIER_THRESHOLD_HOURS, OFF_DOCK, POSITIONING_MOVEMENT } from '../../rates/obcctc-2026-07-01';
import {
  IO_HOURLY, IO_TRIP, NOT_REPORTED, OPTIONS, amountOf, cents, driver, entry, expectClean, firstDriver, gapCodes, input, line,
  offDock, only, period, reported, ruleIds, run, tripLine, workFor,
} from './testing/builders';

const HOUR = 60;
const MON = '2026-07-06';
const RATE = HOURLY.DEO.under2340;
const QS = OFF_DOCK.Q.S;
const PMR = POSITIONING_MOVEMENT.cents;
const FUEL = 6_394;   // 46% of 13900
const P2 = { payPeriodId: 'P2', from: '2026-07-19', to: '2026-08-01', payDate: '2026-08-07' };

describe('segregated view is the sum of the bucket shortfalls', () => {
  const p = only([driver({
    classPeriods: IO_TRIP, trips: [offDock('T1', MON, 'Q', 'S')],
    payPeriods: [period({ lines: [tripLine('L1', 'T1', QS - 1_000), line('L2', 'pmr', PMR), line('L3', 'fuel', FUEL - 394), line('L4', 'wait_time', 5_000)] })],
  })]);
  it('adds a base shortfall and a fuel shortfall instead of reporting the worse one', () => {
    expect([cents(p.buckets.base), cents(p.buckets.waitTime), cents(p.buckets.fuel)]).toEqual([-1_000, 5_000, -394]);
    expect(cents(p.segregated)).toBe(-1_394);
  });
  it('lets no surplus bucket reduce it, while the aggregate view nets everything', () => {
    expect(cents(p.aggregate)).toBe(3_606);
    expect(p.verdict).toBe('shortfall_segregated_only');
    expect(p.range).toEqual({ kind: 'computed', lowCents: -1_394, highCents: 3_606 });
  });
  it('equals the aggregate figure when every bucket is short or level', () => {
    const q = only([driver({
      classPeriods: IO_TRIP, trips: [offDock('T1', MON, 'Q', 'S')],
      payPeriods: [period({ lines: [tripLine('L1', 'T1', QS - 1_000), line('L2', 'pmr', PMR), line('L3', 'fuel', FUEL - 394)] })],
    })]);
    expect([cents(q.aggregate), cents(q.segregated)]).toEqual([-1_394, -1_394]);
    expect(q.verdict).toBe('shortfall_aggregate');
  });
});

describe('payments count toward the work period they state', () => {
  const trips = { classPeriods: IO_TRIP, trips: [offDock('T1', MON, 'Q', 'S')] };
  const july5to18 = workFor('2026-07-05', '2026-07-18');

  it('credits a late payment on the next statement to the period it was earned in', () => {
    const late = [tripLine('L1', 'T1', QS, july5to18), line('L2', 'pmr', PMR, july5to18), line('L3', 'fuel', FUEL, july5to18)];
    const result = firstDriver(run([driver({ ...trips, payPeriods: [period(), period({ ...P2, lines: late })] })]));
    expect(result.periods.map(p => [p.payPeriodId, p.verdict, cents(p.aggregate)])).toEqual([
      ['P1', 'no_shortfall_detected', 0], ['P2', 'no_shortfall_detected', 0],
    ]);
  });
  it('accepts a line that states a single work date inside the period', () => {
    const day = workFor(MON, MON);
    expectClean(only([driver({ ...trips, payPeriods: [period({ lines: [tripLine('L1', 'T1', QS, day), line('L2', 'pmr', PMR, day), line('L3', 'fuel', FUEL, day)] })] })]));
  });
  it('raises a gap, and counts the money nowhere, when a payment states no work period', () => {
    const lines = [tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L3', 'fuel', FUEL, NOT_STATED)];
    const p = only([driver({ ...trips, payPeriods: [period({ lines })] })]);
    expect(p.gaps.map(g => [g.code, g.recordIds])).toEqual([['PAYMENT_WORK_PERIOD_NOT_STATED', ['L3']]]);
    expect(p.verdict).toBe('insufficient_data');
  });
  it('raises a gap when the stated dates span two pay periods', () => {
    const spanning = workFor('2026-07-10', '2026-07-25');
    const result = firstDriver(run([driver({ ...trips, payPeriods: [period({ lines: [tripLine('L1', 'T1', QS, spanning)] }), period(P2)] })]));
    expect(gapCodes(result.periods[0] ?? only([]))).toContain('PAYMENT_WORK_PERIOD_UNMATCHED');
  });
});
const NOT_STATED = { kind: 'not_stated' } as const;

describe('hours worked for other licensees during the run', () => {
  const base = { openingCumulativeMinutes: reported(HOURLY_TIER_THRESHOLD_HOURS * HOUR - HOUR), hourlyEntries: [entry('E1', MON, HOUR)] };
  const paid = (c: number) => [period({ lines: [line('L1', 'hourly', c)] })];

  it('move the tier: an hour elsewhere the same day puts this hour at the higher rate', () => {
    const elsewhere = { kind: 'reported' as const, entries: [{ workDate: MON, minutes: HOUR }] };
    const low = only([driver({ ...base, otherLicenseeHours: elsewhere, payPeriods: paid(RATE) })]);
    expect(cents(low.aggregate)).toBe(RATE - HOURLY.DEO.atOrOver2340);
    expectClean(only([driver({ ...base, otherLicenseeHours: elsewhere, payPeriods: paid(HOURLY.DEO.atOrOver2340) })]));
  });
  it('are never themselves owed by this licensee', () => {
    const elsewhere = { kind: 'reported' as const, entries: [{ workDate: '2026-07-07', minutes: 40 * HOUR }] };   // after the entry
    expectClean(only([driver({ ...base, otherLicenseeHours: elsewhere, payPeriods: paid(RATE) })]));
  });
  it('when absent, leave the verdict alone and put the limit in the scope statement', () => {
    const result = run([driver({ ...base, otherLicenseeHours: NOT_REPORTED, payPeriods: paid(RATE) })]);
    expect(firstDriver(result).verdict).toBe('no_shortfall_detected');
    expect(firstDriver(result).scope.map(n => n.code)).toEqual(['OTHER_LICENSEE_HOURS_NOT_REPORTED']);
    expect(result.scope.find(n => n.code === 'OTHER_LICENSEE_HOURS_NOT_REPORTED')?.sentence).toMatch(/applied late.*understated/);
  });
  it('when reported as none, add no scope note', () => {
    expect(firstDriver(run([driver({ ...base, payPeriods: paid(RATE) })])).scope).toEqual([]);
  });
});

describe('item findings are informational when the period shows no shortfall', () => {
  const two = (t2: number) => only([driver({
    classPeriods: IO_TRIP, trips: [offDock('T1', MON, 'Q', 'S'), offDock('T2', MON, 'Q', 'S')],
    payPeriods: [period({ lines: [tripLine('L1', 'T1', QS - 500), tripLine('L2', 'T2', t2), line('L3', 'pmr', 2 * PMR), line('L4', 'fuel', 2 * FUEL)] })],
  })]);
  it('downgrades the underpaid trip when another trip covers it', () => {
    const p = two(QS + 500);
    expect(p.verdict).toBe('no_shortfall_detected');
    expect(p.findings.map(f => [f.ruleId, f.nature, f.amountCents])).toEqual([['TRIP_RATE_BELOW_MINIMUM', 'informational', 500]]);
    expect(p.findings[0]?.sentence).toContain('listed for information');
  });
  it('keeps it an item shortfall when the period is short', () => {
    const p = two(QS);
    expect(p.verdict).toBe('shortfall_aggregate');
    expect(p.findings.find(f => f.ruleId === 'TRIP_RATE_BELOW_MINIMUM')?.nature).toBe('item_shortfall');
  });
  it('never downgrades a prohibited deduction', () => {
    const p = only([driver({
      hourlyEntries: [entry('E1', MON, HOUR)],
      payPeriods: [period({ lines: [line('L1', 'hourly', RATE + 500)], deductions: [{ deductionId: 'X1', category: 'test_disallowed', cents: 500 }] })],
    })]);
    expect(p.verdict).toBe('no_shortfall_detected');
    expect(p.findings.map(f => [f.ruleId, f.nature])).toEqual([['DISALLOWED_DEDUCTION', 'prohibited_deduction']]);
  });
});

describe('overtime attribution convention', () => {
  it('says in the finding that unpaid premium is attributed daily first, then weekly', () => {
    const p = only([driver({ hourlyEntries: [entry('E1', MON, 10 * HOUR)], payPeriods: [period({ lines: [line('L1', 'hourly', 10 * RATE)] })] })]);
    expect(p.findings.find(f => f.ruleId === 'OVERTIME_DAILY_UNDERPAID')?.sentence).toContain('daily overtime first, then weekly, by engine convention');
  });
});

describe('recordsVerdict sits beside the payment verdict', () => {
  const trips = { classPeriods: IO_TRIP, trips: [offDock('T1', MON, 'Q', 'S')] };
  it('reports a records finding while the payment verdict shows no shortfall', () => {
    const result = firstDriver(run([driver({ ...trips, payPeriods: [period({ lines: [tripLine('L1', 'T1', QS + PMR), line('L3', 'fuel', FUEL)] })] })]));
    expect([result.verdict, result.recordsVerdict]).toEqual(['no_shortfall_detected', 'records_finding']);
    expect(ruleIds(result.periods[0] ?? only([]))).toEqual(['PMR_NOT_ITEMISED']);
  });
  it('reports none when the PMR is its own line', () => {
    const p = only([driver({ ...trips, payPeriods: [period({ lines: [tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L3', 'fuel', FUEL)] })] })]);
    expect(p.recordsVerdict).toBe('no_records_finding_detected');
  });
  it('is not_evaluated, never clean, while the pay period is open', () => {
    const p = only([driver({ ...trips, payPeriods: [period()] })], { ...OPTIONS, asOf: '2026-07-20' });
    expect(p.recordsVerdict).toBe('not_evaluated');
  });
});

describe('carryover is a second figure, never the default', () => {
  const twoPeriods = (first: number, second: number, extra = {}) => firstDriver(run([driver({
    hourlyEntries: [entry('E1', MON, HOUR), entry('E2', '2026-07-20', HOUR)],
    payPeriods: [period({ lines: [line('L1', 'hourly', first)], ...extra }), period({ ...P2, lines: [line('L2', 'hourly', second)] })],
  })]));

  it('carries an earlier surplus forward without changing the verdict', () => {
    const r = twoPeriods(RATE + 500, RATE - 300);
    expect(r.periods.map(p => [p.verdict, cents(p.aggregate), cents(p.aggregateWithCarryover)])).toEqual([
      ['no_shortfall_detected', 500, 500], ['shortfall_aggregate', -300, 200],
    ]);
  });
  it('never carries a later surplus back to an earlier shortfall', () => {
    const r = twoPeriods(RATE - 300, RATE + 500);
    expect(r.periods.map(p => [cents(p.aggregate), cents(p.aggregateWithCarryover)])).toEqual([[-300, -300], [500, 500]]);
  });
  it('is not computable after a period with a gap, because that period\'s surplus is unknown', () => {
    const r = twoPeriods(RATE, RATE, { waitTimeReceived: NOT_REPORTED });
    expect(r.periods.map(p => [p.aggregate.kind, p.aggregateWithCarryover.kind])).toEqual([
      ['not_computable', 'not_computable'], ['computed', 'not_computable'],
    ]);
  });
});

describe('unverified schedules are accepted and marked', () => {
  const june = run([driver({
    classPeriods: IO_HOURLY, hourlyEntries: [entry('E1', '2026-06-15', HOUR)],
    payPeriods: [period({ from: '2026-06-14', to: '2026-06-27', payDate: '2026-07-03', lines: [line('L1', 'hourly', HOURLY_2025_07_01.IO_HOURLY.under2340), line('L2', 'fuel', 3_863)] })],
  })]);
  it('flags the run in provenance and in the scope statement', () => {
    expect(june.provenance.unverifiedSchedulesUsed).toBe(true);
    expect(june.provenance.schedules.find(s => s.id === 'obcctc-2025-07-01')?.status).toBe('unverified-transcription');
    expect(june.scope.find(n => n.code === 'UNVERIFIED_SCHEDULE_USED')?.sentence).toContain('obcctc-2025-07-01');
  });
  it('does not flag a run that used only the verified schedule', () => {
    const july = run([driver({ hourlyEntries: [entry('E1', MON, HOUR)], payPeriods: [period({ lines: [line('L1', 'hourly', RATE)] })] })]);
    expect(july.provenance.unverifiedSchedulesUsed).toBe(false);
    expect(july.scope.map(n => n.code)).toEqual(['IEO_OFFSET_NOT_IMPLEMENTED']);
  });
});

describe('boundary parser', () => {
  const good = JSON.parse(JSON.stringify(input([driver({ hourlyEntries: [entry('E1', MON, HOUR)], payPeriods: [period({ lines: [line('L1', 'hourly', RATE)] })] })])));
  it('returns typed input for well-formed JSON', () => {
    const parsed = parseComplianceInput(good);
    expect(parsed.kind === 'ok' && parsed.value).toEqual(good);
  });
  it('refuses a decimal amount with the path to it, and never rounds it', () => {
    const bad = JSON.parse(JSON.stringify(good));
    bad.drivers[0].payPeriods[0].lines[0].cents = 34.56;
    expect(parseComplianceInput(bad)).toEqual({ kind: 'invalid', errors: ['input.drivers[0].payPeriods[0].lines[0].cents: expected an integer'] });
  });
  it('refuses a payment line with no workPeriod field: absence is not "not stated"', () => {
    const bad = JSON.parse(JSON.stringify(good));
    delete bad.drivers[0].payPeriods[0].lines[0].workPeriod;
    expect(parseComplianceInput(bad).kind).toBe('invalid');
  });
  it('refuses a driver with no otherLicenseeHours field: the caller must say reported or not', () => {
    const bad = JSON.parse(JSON.stringify(good));
    delete bad.drivers[0].otherLicenseeHours;
    expect(parseComplianceInput(bad).kind).toBe('invalid');
  });
  it('refuses options with no rounding mode: there is no default', () => {
    expect(parseRunOptions({ asOf: '2026-11-14', deductionPolicy: { id: 'x', categories: {}, citations: {} } }).kind).toBe('invalid');
    expect(parseRunOptions(JSON.parse(JSON.stringify(OPTIONS)))).toEqual({ kind: 'ok', value: OPTIONS });
  });
  it('refuses a non-object', () => {
    expect(parseComplianceInput('nope').kind).toBe('invalid');
  });
});

describe('deductions are an interpretation, and say so', () => {
  it('adds a scope note whenever a deduction was classified', () => {
    const r = run([driver({ hourlyEntries: [entry('E1', MON, HOUR)], payPeriods: [period({ lines: [line('L1', 'hourly', RATE)], deductions: [{ deductionId: 'X1', category: 'test_allowed', cents: 100 }] })] })]);
    expect(r.scope.map(n => n.code)).toContain('DEDUCTION_POLICY_IS_INTERPRETATION');
    expect(amountOf(firstDriver(r).periods[0] ?? only([]), 'DISALLOWED_DEDUCTION')).toBeNull();
  });
});
