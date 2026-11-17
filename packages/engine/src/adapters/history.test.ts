// End-to-end runs against the unverified 2022 to 2025 transcriptions.
import { describe, it, expect } from 'vitest';
import * as R2022 from '../../../rates/obcctc-2022-07-01';
import * as R2024 from '../../../rates/obcctc-2024-07-01';
import * as C2014 from '../../../rates/ctr-2014-04-03';
import * as C2018 from '../../../rates/ctr-2018-06-01';
import { OBCCTC_SCHEDULES } from './obcctc';
import { IO_TRIP, OPTIONS, cents, driver, entry, expectClean, gapCodes, line, offDock, onDock, only, period, run, tripLine } from '../testing/builders';

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
  // Changed 2026-11-16 (DECISIONS 106): the trip schedules are now transcribed, so the remaining gap is the fuel surcharge alone.
  it('prices a 2016 trip but still cannot give a verdict: no fuel surcharge figure exists for that month', () => {
    const io = driver({ classPeriods: [{ class: 'IO_TRIP', from: '2014-04-03', to: null }], trips: [offDock('T1', '2016-03-07', 'A', 'B')], payPeriods: [period({ from: '2016-03-06', to: '2016-03-19', payDate: '2016-03-25' })] });
    const p = only([io]);
    expect(p.verdict).toBe('insufficient_data');
    expect(gapCodes(p)).toEqual(['FUEL_PCT_NOT_PUBLISHED']);
  });
});

describe('pre-repeal Regulation trip schedules (unverified)', () => {
  // SYNTHETIC: a 0% surcharge for three months, so that trip pricing can be seen end to end. No such figures are in packages/rates.
  const zeroFuel = { ...OBCCTC_SCHEDULES, fuelSupplement: { ...OBCCTC_SCHEDULES.fuelSupplement, months: {
    ...OBCCTC_SCHEDULES.fuelSupplement.months,
    '2016-03': { referenceCentsPerLitre: null, pct: 0 }, '2016-08': { referenceCentsPerLitre: null, pct: 0 }, '2018-08': { referenceCentsPerLitre: null, pct: 0 },
  } } };
  const SINCE_2014 = [{ class: 'IO_TRIP' as const, from: '2014-04-03', to: null }];
  const mar2016 = { from: '2016-03-06', to: '2016-03-19', payDate: '2016-03-25' };
  const aug2016 = { from: '2016-08-07', to: '2016-08-20', payDate: '2016-08-26' };
  const aug2018 = { from: '2018-08-05', to: '2018-08-18', payDate: '2018-08-24' };
  const paid = (trip: ReturnType<typeof offDock>, when: typeof mar2016, cents: number) =>
    only([driver({ classPeriods: SINCE_2014, trips: [trip], payPeriods: [period({ ...when, lines: [tripLine('L1', trip.tripId, cents)] })] })], OPTIONS, zeroFuel);

  it('prices Abbotsford to Annacis Island in 2016 at $130.00, and finds $125.00 short by $5.00', () => {
    expectClean(paid(offDock('T1', '2016-03-07', 'A', 'B'), mar2016, C2014.OFF_DOCK.A.B));
    const short = paid(offDock('T1', '2016-03-07', 'A', 'B'), mar2016, 12_500);
    expect([short.verdict, cents(short.aggregate)]).toEqual(['shortfall_aggregate', -500]);
  });
  it('pays 1.5x for two containers off-dock: $195.00', () => {
    expectClean(paid(offDock('T1', '2016-03-07', 'A', 'B', 'two'), mar2016, 19_500));
    expect(cents(paid(offDock('T1', '2016-03-07', 'A', 'B', 'two'), mar2016, 19_499).aggregate)).toBe(-1);
  });
  it('reads the table by origin then destination while it is lopsided: Cloverdale to Langley City is $110.00, the return $100.00', () => {
    expect(cents(paid(offDock('T1', '2016-03-07', 'F', 'K'), mar2016, 10_000).aggregate)).toBe(-1_000);
    expectClean(paid(offDock('T1', '2016-03-07', 'K', 'F'), mar2016, 10_000));
  });
  it('switches to the amended rows on July 20, 2016: Cloverdale to Langley City becomes $100.00', () => {
    const p = paid(offDock('T1', '2016-08-08', 'F', 'K'), aug2016, 10_000);
    expectClean(p);
    expect(run([driver({ classPeriods: SINCE_2014, trips: [offDock('T1', '2016-08-08', 'F', 'K')], payPeriods: [period({ ...aug2016, lines: [tripLine('L1', 'T1', 10_000)] })] })], OPTIONS, zeroFuel)
      .provenance.schedules.map(x => x.id)).toContain('ctr-2014-04-03+off-dock-2016-07-20');
  });
  it('prices on-dock Delta to Deltaport at $112.00 in 2016 and $114.90 from June 2018', () => {
    expectClean(paid(onDock('T1', '2016-03-07', 'H', 'deltaport'), mar2016, C2014.ON_DOCK.H.deltaport));
    expectClean(paid(onDock('T1', '2018-08-06', 'H', 'deltaport'), aug2018, C2018.ON_DOCK.H.deltaport));
    expect(cents(paid(onDock('T1', '2018-08-06', 'H', 'deltaport'), aug2018, C2014.ON_DOCK.H.deltaport).aggregate)).toBe(11_200 - 11_490);
  });
  it('owes no positioning movement rate before July 2019, and marks both PMR rules not applicable instead of passed', () => {
    const p = paid(offDock('T1', '2016-03-07', 'A', 'B'), mar2016, 13_000);
    expect(p.findings).toEqual([]);
    expect(p.evaluations.filter(e => e.ruleId.startsWith('PMR_')).map(e => e.status)).toEqual(['not_applicable', 'not_applicable']);
  });
  it('still evaluates the PMR rules where the rate exists', () => {
    const p = only([driver({ classPeriods: IO_TRIP, trips: [offDock('T1', '2022-08-08', 'Q', 'S')], payPeriods: [period({ from: '2022-08-07', to: '2022-08-20', payDate: '2022-08-26', lines: [tripLine('L1', 'T1', 12_000), line('L3', 'fuel', 5_760)] })] })]);
    expect(p.evaluations.find(e => e.ruleId === 'PMR_NOT_ITEMISED')?.status).toBe('triggered');
  });
  it('raises a gap where the source table is an image: off-dock from June 2018, and every trip in June 2019', () => {
    expect(gapCodes(paid(offDock('T1', '2018-08-06', 'A', 'B'), aug2018, 0))).toEqual(['SCHEDULE_COMPONENT_ABSENT']);
    const june = only([driver({ classPeriods: SINCE_2014, trips: [onDock('T1', '2019-06-10', 'H', 'deltaport')], payPeriods: [period({ from: '2019-06-09', to: '2019-06-22', payDate: '2019-06-28' })] })]);
    expect(gapCodes(june)).toContain('SCHEDULE_COMPONENT_ABSENT');
  });
  it('raises a gap for two containers on-dock, and for an area the Regulation never had', () => {
    expect(gapCodes(paid(onDock('T1', '2016-03-07', 'H', 'deltaport', 'two'), mar2016, 0))).toEqual(['ON_DOCK_MULTI_CONTAINER_UNDEFINED']);
    expect(gapCodes(paid(offDock('T1', '2016-03-07', 'A', 'Z'), mar2016, 0))).toEqual(['ZONE_NOT_IN_SCHEDULE']);
  });
});
