// End-to-end runs against the unverified 2022 to 2025 transcriptions.
import { describe, it, expect } from 'vitest';
import * as R2022 from '../../../rates/obcctc-2022-07-01';
import * as R2024 from '../../../rates/obcctc-2024-07-01';
import { OBCCTC_SCHEDULES } from './obcctc';
import { IO_TRIP, OPTIONS, cents, driver, entry, expectClean, gapCodes, line, offDock, only, period, run, tripLine } from '../testing/builders';

const HOUR = 60;
const aug2022 = { from: '2022-08-07', to: '2022-08-20', payDate: '2022-08-26' };

describe('2022 order (unverified)', () => {
  const QS = R2022.OFF_DOCK.Q.S;   // $120.00
  const trip = (fuel: number) => driver({
    classPeriods: IO_TRIP, trips: [offDock('T1', '2022-08-08', 'Q', 'S')],
    payPeriods: [period({ ...aug2022, lines: [tripLine('L1', 'T1', QS), line('L2', 'pmr', R2022.POSITIONING_MOVEMENT.cents), line('L3', 'fuel', fuel)] })],
  });
  it('prices an off-dock trip from its own table, with the August 2022 surcharge from the supplement: 48% of 12000 = 5760', () => {
    expectClean(only([trip(5_760)]));
  });
  it('flags the run as using unverified rates, naming both the schedule and the fuel supplement', () => {
    const r = run([trip(5_760)]);
    expect(r.provenance.unverifiedSchedulesUsed).toBe(true);
    expect(r.provenance.schedules).toEqual([
      { id: 'obcctc-2022-07-01', status: 'unverified-transcription', verifiedBy: null },
      { id: 'obcctc-fuel-surcharge-published-supplement', status: 'unverified-transcription', verifiedBy: null },
    ]);
  });
  it('cannot price a discounted fuel basis in 2022: the page publishes no reference price', () => {
    const d = { ...trip(0), fuelBasis: { kind: 'io_discounted' as const, centsPerLitreByMonth: { '2022-08': 150 } } };
    expect(gapCodes(only([d]))).toEqual(['FUEL_PCT_NOT_PUBLISHED']);
  });
  it('has no overtime rule in April 2023, and applies the overtime order from May 1, 2023', () => {
    const deo = (date: string, from: string, to: string, paid: number) => only([driver({
      hourlyEntries: [entry('E1', date, 10 * HOUR)],
      payPeriods: [period({ from, to, payDate: '2023-06-30', lines: [line('L1', 'hourly', paid)] })],
    })]);
    const rate = R2022.HOURLY.DEO.underThreshold;
    // Changed 2026-11-16 (DECISIONS 90): April 2023 used to be a gap. The order is known to have no overtime rule, so ten hours are owed at straight time.
    expectClean(deo('2023-04-03', '2023-04-02', '2023-04-15', 10 * rate));
    expect(cents(deo('2023-04-03', '2023-04-02', '2023-04-15', 10 * rate - 1).aggregate)).toBe(-1);
    expectClean(deo('2023-05-08', '2023-05-07', '2023-05-20', 10 * rate + rate / 2));   // one hour of premium
  });
  it('gives insufficient_data the day before the oldest schedule starts: nothing is loaded for March 31, 2020', () => {
    // Was June 30, 2022 until the April 2020 order was transcribed. Independent operator: no overtime rule needed.
    const p = only([driver({ classPeriods: [{ class: 'IO_HOURLY', from: '2019-01-01', to: null }], hourlyEntries: [entry('E1', '2020-03-31', HOUR)], payPeriods: [period({ from: '2020-03-22', to: '2020-03-31', payDate: '2020-04-08' })] })]);
    expect(gapCodes(p)).toEqual(['NO_SCHEDULE_FOR_DATE']);
  });
});

describe('2024 order (unverified)', () => {
  const aug2024 = { from: '2024-08-04', to: '2024-08-17', payDate: '2024-08-23' };
  it('prices company driver hours and daily overtime', () => {
    const rate = R2024.HOURLY.DEO.underThreshold;
    expectClean(only([driver({ hourlyEntries: [entry('E1', '2024-08-05', 10 * HOUR)], payPeriods: [period({ ...aug2024, lines: [line('L1', 'hourly', 10 * rate + rate / 2)] })] })]));
  });
  it('raises a gap for a trip: its trip tables are images nobody has transcribed', () => {
    const p = only([driver({ classPeriods: IO_TRIP, trips: [offDock('T1', '2024-08-05', 'Q', 'S')], payPeriods: [period(aug2024)] })], OPTIONS);
    expect(gapCodes(p)).toEqual(['SCHEDULE_COMPONENT_ABSENT']);
    expect(p.verdict).toBe('insufficient_data');
  });
});

describe('April 2020 order (unverified)', () => {
  const R = { io: 5_771, floor: 30_000 };   // figures as transcribed; the rates suite guards them
  it('prices an hourly independent operator in April 2020 with the 6% surcharge from the bulletin: 6% of 5771 = 346.26', () => {
    const d = driver({
      classPeriods: [{ class: 'IO_HOURLY', from: '2019-01-01', to: null }], hourlyEntries: [entry('E1', '2020-04-06', HOUR)],
      payPeriods: [period({ from: '2020-04-05', to: '2020-04-18', payDate: '2020-04-24', lines: [line('L1', 'hourly', R.io), line('L2', 'fuel', 346)] })],
    });
    expectClean(only([d]));
  });
  it('raises a gap for a month of 2020 with no surcharge found', () => {
    const d = driver({
      classPeriods: [{ class: 'IO_HOURLY', from: '2019-01-01', to: null }], hourlyEntries: [entry('E1', '2020-05-04', HOUR)],
      payPeriods: [period({ from: '2020-05-03', to: '2020-05-16', payDate: '2020-05-22' })],
    });
    expect(gapCodes(only([d]))).toEqual(['FUEL_PCT_NOT_PUBLISHED']);
  });
  it('prices company driver hours at straight time and says in the scope that no overtime rule was in force', () => {
    // Changed 2026-11-16 (DECISIONS 90): this used to be a gap.
    const d = driver({ hourlyEntries: [entry('E1', '2021-03-01', 12 * HOUR)], payPeriods: [period({ from: '2021-02-28', to: '2021-03-13', payDate: '2021-03-19', lines: [line('L1', 'hourly', 12 * 2_630)] })] });
    const r = run([d]);
    expect(r.drivers[0]?.verdict).toBe('no_shortfall_detected');
    expect(r.drivers[0]?.scope.map(n => n.code)).toEqual(['NO_OVERTIME_RULE_IN_FORCE']);
    expect(r.scope.find(n => n.code === 'NO_OVERTIME_RULE_IN_FORCE')?.sentence).toMatch(/employment standards law is not evaluated.*understated/);
  });
  it('adds no such scope note once an overtime rule exists', () => {
    const d = driver({ hourlyEntries: [entry('E1', '2026-07-06', HOUR)], payPeriods: [period({ lines: [line('L1', 'hourly', 3_456)] })] });
    expect(run([d]).drivers[0]?.scope).toEqual([]);
  });
  it('raises a gap in the one week that straddles May 1, 2023: Sunday April 30 has no rule, so the weekly count cannot start', () => {
    const d = driver({
      hourlyEntries: [entry('SUN', '2023-04-30', 8 * HOUR), entry('MON', '2023-05-01', 8 * HOUR)],
      payPeriods: [period({ from: '2023-04-30', to: '2023-05-13', payDate: '2023-05-19' })],
    });
    expect(gapCodes(only([d]))).toEqual(['OVERTIME_WEEK_INCOMPLETE']);
  });
  it('still treats an untranscribed overtime component as a gap, never as "no rule"', () => {
    const untranscribed = { ...OBCCTC_SCHEDULES, schedules: OBCCTC_SCHEDULES.schedules.map(s => (s.id === 'obcctc-2020-04-01' ? { ...s, overtime: { kind: 'absent' as const } } : s)) };
    const p = only([driver({ hourlyEntries: [entry('E1', '2021-03-01', HOUR)], payPeriods: [period({ from: '2021-02-28', to: '2021-03-13', payDate: '2021-03-19' })] })], OPTIONS, untranscribed);
    expect(gapCodes(p)).toEqual(['SCHEDULE_COMPONENT_ABSENT']);
  });
});

describe('pre-repeal Regulation, 2014 to 2019 (unverified)', () => {
  const deo = (date: string, from: string, to: string, paid: number) => driver({
    classPeriods: [{ class: 'DEO', from: '2010-01-01', to: null }], hourlyEntries: [entry('E1', date, 10 * HOUR)],
    payPeriods: [period({ from, to, payDate: to, lines: [line('L1', 'hourly', paid)] })],
  });
  it('prices a company driver in 2016 at $25.13, in late 2018 at $25.78, and in June 2019 at $26.30', () => {
    expectClean(only([deo('2016-03-07', '2016-03-06', '2016-03-19', 25_130)]));
    expectClean(only([deo('2018-09-10', '2018-09-09', '2018-09-22', 25_780)]));
    expectClean(only([deo('2019-06-10', '2019-06-09', '2019-06-22', 26_300)]));
  });
  it('finds 2016 pay at $24.00 an hour short by $11.30 over ten hours', () => {
    const p = only([deo('2016-03-07', '2016-03-06', '2016-03-19', 24_000)]);
    expect([p.verdict, cents(p.aggregate)]).toEqual(['shortfall_aggregate', -1_130]);
  });
  it('steps up on June 1, 2018 exactly', () => {
    expect(cents(only([deo('2018-05-31', '2018-05-27', '2018-06-09', 25_130)]).aggregate)).toBe(0);
    expect(cents(only([deo('2018-06-01', '2018-05-27', '2018-06-09', 25_130)]).aggregate)).toBe(25_130 - 25_780);
  });
  it('says the rates are unverified and that no overtime rule was in force', () => {
    const r = run([deo('2016-03-07', '2016-03-06', '2016-03-19', 25_130)]);
    expect(r.provenance.schedules).toEqual([{ id: 'ctr-2014-04-03', status: 'unverified-transcription', verifiedBy: null }]);
    expect(r.scope.map(n => n.code)).toEqual(['IEO_OFFSET_NOT_IMPLEMENTED', 'UNVERIFIED_SCHEDULE_USED', 'NO_OVERTIME_RULE_IN_FORCE']);
  });
  it('gives insufficient_data before April 3, 2014 and in the hole from July 2019 to March 2020', () => {
    expect(gapCodes(only([deo('2014-04-02', '2014-03-30', '2014-04-12', 0)]))).toEqual(['NO_SCHEDULE_FOR_DATE']);
    expect(gapCodes(only([deo('2019-09-09', '2019-09-08', '2019-09-21', 0)]))).toEqual(['NO_SCHEDULE_FOR_DATE']);
  });
  it('cannot price an hourly independent operator in those years: no fuel surcharge figures exist for them', () => {
    const io = driver({ classPeriods: [{ class: 'IO_HOURLY', from: '2014-04-03', to: null }], hourlyEntries: [entry('E1', '2016-03-07', HOUR)], payPeriods: [period({ from: '2016-03-06', to: '2016-03-19', payDate: '2016-03-25' })] });
    expect(gapCodes(only([io]))).toEqual(['FUEL_PCT_NOT_PUBLISHED']);
  });
  it('raises a gap for a trip: the regulation\'s trip schedules are not transcribed', () => {
    const io = driver({ classPeriods: [{ class: 'IO_TRIP', from: '2014-04-03', to: null }], trips: [offDock('T1', '2016-03-07', 'A', 'B')], payPeriods: [period({ from: '2016-03-06', to: '2016-03-19', payDate: '2016-03-25' })] });
    expect(only([io]).verdict).toBe('insufficient_data');
  });
});
