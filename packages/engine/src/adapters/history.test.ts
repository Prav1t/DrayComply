// End-to-end runs against the unverified 2022 to 2025 transcriptions.
import { describe, it, expect } from 'vitest';
import * as R2022 from '../../../rates/obcctc-2022-07-01';
import * as R2024 from '../../../rates/obcctc-2024-07-01';
import { IO_TRIP, OPTIONS, driver, entry, expectClean, gapCodes, line, offDock, only, period, run, tripLine } from '../testing/builders';

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
    expect(gapCodes(deo('2023-04-03', '2023-04-02', '2023-04-15', 10 * rate))).toEqual(['SCHEDULE_COMPONENT_ABSENT']);
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
  it('raises a gap for company driver hours: the order has no overtime rule', () => {
    const p = only([driver({ hourlyEntries: [entry('E1', '2021-03-01', HOUR)], payPeriods: [period({ from: '2021-02-28', to: '2021-03-13', payDate: '2021-03-19' })] })]);
    expect(gapCodes(p)).toEqual(['SCHEDULE_COMPONENT_ABSENT']);
  });
});
