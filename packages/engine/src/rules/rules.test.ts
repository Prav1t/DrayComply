// Every rule in the catalogue: one case that triggers it, one that does not.
import { describe, it, expect } from 'vitest';
import { GAPS, RULES, RULE_IDS } from './catalogue';
import { OBCCTC_SCHEDULES } from '../adapters/obcctc';
import type { DriverInput, PayLine, PayPeriod } from '../types/input';
import { CALLOUT, HOURLY, OFF_DOCK, ON_DOCK, POSITIONING_MOVEMENT } from '../../../rates/obcctc-2026-07-01';
import {
  IO_HOURLY, IO_TRIP, NOT_REPORTED, OPTIONS, amountOf, cents, driver, entry, expectClean, firstDriver, gapCodes, line, offDock,
  onDock, only, period, reported, ruleIds, run, statusOf, tripLine,
} from '../testing/builders';

const HOUR = 60;
const MON = '2026-07-06';
const RATE = HOURLY.DEO.under2340;
const QS = OFF_DOCK.Q.S;
const PMR = POSITIONING_MOVEMENT.cents;
const JULY_PCT = 46;
const fuelOn = (base: number): number => Math.floor((base * JULY_PCT + 50) / 100);   // half-up, as OPTIONS.rounding

const hourlyDriver = (minutes: number, lines: readonly PayLine[], extra: Partial<PayPeriod> = {}) =>
  driver({ hourlyEntries: [entry('E1', MON, minutes)], payPeriods: [period({ lines, ...extra })] });
const tripDriver = (lines: readonly PayLine[], extra: Partial<DriverInput> = {}) =>
  driver({ classPeriods: IO_TRIP, trips: [offDock('T1', MON, 'Q', 'S')], payPeriods: [period({ lines })], ...extra });

describe('catalogue', () => {
  it('lists each rule id and gap code once', () => {
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    expect(Object.keys(RULES)).toEqual(Object.values(RULES));
    expect(Object.keys(GAPS)).toEqual(Object.values(GAPS));
  });
  it('reports a status for every rule on every period', () => {
    const p = only([hourlyDriver(HOUR, [line('L1', 'hourly', RATE)])]);
    expect(p.evaluations.map(e => e.ruleId)).toEqual(RULE_IDS);
  });
});

describe('HOURLY_BELOW_MINIMUM', () => {
  it('triggers when pay is under hours times the tier rate', () => {
    const p = only([hourlyDriver(HOUR, [line('L1', 'hourly', 3_000)])]);
    expect(amountOf(p, 'HOURLY_BELOW_MINIMUM')).toBe(RATE - 3_000);
    expect(p.verdict).toBe('shortfall_aggregate');
  });
  it('does not trigger at exactly the minimum', () => {
    expectClean(only([hourlyDriver(HOUR, [line('L1', 'hourly', RATE)])]));
  });
});

describe('OVERTIME_DAILY_UNDERPAID', () => {
  // 10 hours: 10 x 3456 straight + 1 hour of premium at half the rate = 34560 + 1728
  it('triggers when the tenth hour is paid at straight time', () => {
    const p = only([hourlyDriver(10 * HOUR, [line('L1', 'hourly', 10 * RATE)])]);
    expect(amountOf(p, 'OVERTIME_DAILY_UNDERPAID')).toBe(RATE / 2);
    expect(ruleIds(p)).not.toContain('HOURLY_BELOW_MINIMUM');
  });
  it('does not trigger when the premium is paid', () => {
    expectClean(only([hourlyDriver(10 * HOUR, [line('L1', 'hourly', 10 * RATE), line('L2', 'overtime', RATE / 2)])]));
  });
  it('does not trigger at exactly nine hours', () => {
    expectClean(only([hourlyDriver(9 * HOUR, [line('L1', 'hourly', 9 * RATE)])]));
  });
});

describe('OVERTIME_WEEKLY_UNDERPAID', () => {
  // Six 8-hour days: 48 counted hours, 3 of them weekly overtime.
  const days = ['2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'];
  const six = (lines: readonly PayLine[]) => driver({ hourlyEntries: days.map((d, i) => entry(`E${i}`, d, 8 * HOUR)), payPeriods: [period({ lines })] });
  it('triggers when hours past 45 are paid at straight time', () => {
    const p = only([six([line('L1', 'hourly', 48 * RATE)])]);
    expect(amountOf(p, 'OVERTIME_WEEKLY_UNDERPAID')).toBe(3 * RATE / 2);
    expect(ruleIds(p)).not.toContain('OVERTIME_DAILY_UNDERPAID');
  });
  it('does not trigger when the weekly premium is paid', () => {
    expectClean(only([six([line('L1', 'hourly', 48 * RATE), line('L2', 'overtime', 3 * RATE / 2)])]));
  });
});

describe('CALLOUT_BELOW_MINIMUM', () => {
  const callouts = { kind: 'flagged' as const, records: [{ calloutId: 'C1', workDate: MON, entryIds: ['E1'], tripIds: [] }] };
  const floor = CALLOUT.deoIeoMultiplierOfHourly * RATE;   // 4 x $34.56
  it('triggers when a company driver called out for one hour is paid one hour', () => {
    const p = only([{ ...hourlyDriver(HOUR, [line('L1', 'hourly', RATE)]), callouts }]);
    expect(amountOf(p, 'CALLOUT_BELOW_MINIMUM')).toBe(floor - RATE);
    expect(cents(p.aggregate)).toBe(RATE - floor);
  });
  it('does not trigger when pay for the window reaches four times the hourly rate', () => {
    expectClean(only([{ ...hourlyDriver(HOUR, [line('L1', 'hourly', RATE), line('L2', 'callout', floor - RATE)]), callouts }]));
  });
  it('is a floor, not an addition: five hours of work already exceeds it', () => {
    expectClean(only([{ ...hourlyDriver(5 * HOUR, [line('L1', 'hourly', 5 * RATE)]), callouts }]));
  });
  it('guarantees an I/O $348 or the trip rate, whichever is greater, and fuel applies to the top-up', () => {
    const io = { kind: 'flagged' as const, records: [{ calloutId: 'C1', workDate: MON, entryIds: [], tripIds: ['T1'] }] };
    const topUp = CALLOUT.ioFloorCents - QS;
    const paid = [tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L4', 'fuel', fuelOn(CALLOUT.ioFloorCents))];
    expectClean(only([tripDriver([...paid, line('L3', 'callout', topUp)], { callouts: io })]));
    const short = only([tripDriver(paid, { callouts: io })]);
    expect(amountOf(short, 'CALLOUT_BELOW_MINIMUM')).toBe(topUp);
  });
  it('is reported not evaluated, never passed, when callout days are not flagged', () => {
    const p = only([{ ...hourlyDriver(HOUR, [line('L1', 'hourly', RATE)]), callouts: { kind: 'not_flagged' as const } }]);
    expect(statusOf(p, 'CALLOUT_BELOW_MINIMUM')).toBe('not_evaluated');
    expect(p.verdict).toBe('no_shortfall_detected');
  });
  it('is evaluated and not triggered when flagged with no callouts', () => {
    expect(statusOf(only([hourlyDriver(HOUR, [line('L1', 'hourly', RATE)])]), 'CALLOUT_BELOW_MINIMUM')).toBe('not_triggered');
  });
});

describe('TRIP_RATE_BELOW_MINIMUM and TRIP_NO_MATCHING_PAYMENT', () => {
  const rest = [line('L2', 'pmr', PMR), line('L3', 'fuel', fuelOn(QS))];
  it('triggers when the linked payment is under the table rate', () => {
    const p = only([tripDriver([tripLine('L1', 'T1', QS - 100), ...rest])]);
    expect(amountOf(p, 'TRIP_RATE_BELOW_MINIMUM')).toBe(100);
  });
  it('does not trigger at the table rate', () => {
    expectClean(only([tripDriver([tripLine('L1', 'T1', QS), ...rest])]));
  });
  it('triggers no-matching-payment when nothing links to the trip', () => {
    expect(amountOf(only([tripDriver(rest)]), 'TRIP_NO_MATCHING_PAYMENT')).toBe(QS);
  });
  it('does not net an overpaid trip against an underpaid one in the per-trip findings', () => {
    const d = driver({
      classPeriods: IO_TRIP, trips: [offDock('T1', MON, 'Q', 'S'), offDock('T2', MON, 'Q', 'S')],
      payPeriods: [period({ lines: [tripLine('L1', 'T1', QS - 500), tripLine('L2', 'T2', QS + 500), line('L3', 'pmr', 2 * PMR), line('L4', 'fuel', fuelOn(2 * QS))] })],
    });
    const p = only([d]);
    expect(p.verdict).toBe('no_shortfall_detected');    // the period nets to zero
    expect(amountOf(p, 'TRIP_RATE_BELOW_MINIMUM')).toBe(500);
    expect(cents(p.strictPerTrip)).toBe(-500);          // the third number does not net
  });
});

describe('trip pricing', () => {
  const priced = (trip: ReturnType<typeof offDock>, tripCents: number, pmrCents: number) =>
    only([driver({ classPeriods: IO_TRIP, trips: [trip], payPeriods: [period({ lines: [tripLine('L1', trip.tripId, tripCents), line('L2', 'pmr', pmrCents), line('L3', 'fuel', fuelOn(tripCents))] })] })]);
  it('looks up an on-dock trip by area and terminal', () => {
    expectClean(priced(onDock('T1', MON, 'H', 'deltaport'), ON_DOCK.H.deltaport, PMR));
  });
  it('pays 1.5x the off-dock rate and 1.5x the PMR for two containers', () => {
    expectClean(priced(offDock('T1', MON, 'Q', 'S', 'two'), QS * 3 / 2, PMR * 3 / 2));
  });
  it('raises a gap for a two-container on-dock trip: the order states no rate', () => {
    const p = priced(onDock('T1', MON, 'H', 'deltaport', 'two'), ON_DOCK.H.deltaport, PMR * 3 / 2);
    expect(gapCodes(p)).toEqual(['ON_DOCK_MULTI_CONTAINER_UNDEFINED']);
    expect(p.verdict).toBe('insufficient_data');
    expect(ruleIds(p)).not.toContain('PMR_BELOW_MINIMUM');   // the PMR's own 1.5x still priced
  });
  it('raises gaps for an unknown area, an unknown terminal and unreported fields', () => {
    expect(gapCodes(priced(offDock('T1', MON, 'Q', 'ZZ'), QS, PMR))).toEqual(['ZONE_NOT_IN_SCHEDULE']);
    expect(gapCodes(priced(onDock('T1', MON, 'H', 'roberts_bank'), QS, PMR))).toEqual(['TERMINAL_NOT_IN_SCHEDULE']);
    const blank = { tripId: 'T1', workDate: MON, move: { kind: 'on_dock' as const, zone: NOT_REPORTED, terminal: NOT_REPORTED }, containers: NOT_REPORTED };
    expect(gapCodes(priced(blank, QS, PMR))).toEqual(['CONTAINER_COUNT_MISSING', 'TERMINAL_MISSING', 'ZONE_MISSING']);
  });
  it('raises a gap for trips recorded against an hourly driver', () => {
    const p = only([driver({ trips: [offDock('T1', MON, 'Q', 'S')], payPeriods: [period()] })]);
    expect(gapCodes(p)).toEqual(['CLASS_WORK_MISMATCH']);
  });
});

describe('PMR_BELOW_MINIMUM and PMR_NOT_ITEMISED', () => {
  it('triggers below-minimum when the itemised PMR is under $25 per trip', () => {
    const p = only([tripDriver([tripLine('L1', 'T1', QS), line('L2', 'pmr', 2_000), line('L3', 'fuel', fuelOn(QS))])]);
    expect(amountOf(p, 'PMR_BELOW_MINIMUM')).toBe(PMR - 2_000);
  });
  it('triggers not-itemised as a record-keeping finding even when the money is all there', () => {
    const p = only([tripDriver([tripLine('L1', 'T1', QS + PMR), line('L3', 'fuel', fuelOn(QS))])]);
    expect(p.findings.map(f => [f.ruleId, f.nature, f.amountCents])).toEqual([['PMR_NOT_ITEMISED', 'record_keeping', 0]]);
    expect(p.verdict).toBe('no_shortfall_detected');
    expect(statusOf(p, 'PMR_NOT_ITEMISED')).toBe('triggered');
  });
  it('triggers neither when the PMR is itemised in full', () => {
    expectClean(only([tripDriver([tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L3', 'fuel', fuelOn(QS))])]));
  });
});

describe('FUEL_SURCHARGE_BELOW_MINIMUM', () => {
  const lines = (fuel: number) => [tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L3', 'fuel', fuel)];
  it('triggers when fuel paid is under the published percentage of the base', () => {
    const p = only([tripDriver(lines(0))]);
    expect(amountOf(p, 'FUEL_SURCHARGE_BELOW_MINIMUM')).toBe(fuelOn(QS));
  });
  it('is ring-fenced: an overpaid trip rate does not cover missing fuel in the segregated view', () => {
    const p = only([tripDriver([tripLine('L1', 'T1', QS + fuelOn(QS)), line('L2', 'pmr', PMR)])]);
    expect(p.verdict).toBe('shortfall_segregated_only');
    expect([cents(p.aggregate), cents(p.segregated)]).toEqual([0, -fuelOn(QS)]);
  });
  it('owes no fuel surcharge to a company driver', () => {
    expect(cents(only([hourlyDriver(HOUR, [line('L1', 'hourly', RATE)])]).buckets.fuel)).toBe(0);
  });
  it('owes an hourly I/O fuel on hourly minimum compensation', () => {
    const io = HOURLY.IO_HOURLY.under2340;
    const d = driver({ classPeriods: IO_HOURLY, hourlyEntries: [entry('E1', MON, HOUR)], payPeriods: [period({ lines: [line('L1', 'hourly', io), line('L2', 'fuel', fuelOn(io))] })] });
    expectClean(only([d]));   // 46% of 7304 = 3359.84, rounded once to 3360
  });
  it('uses the lower of the published price and the operator\'s discounted price', () => {
    // $1.87 rounds down to $1.85: 16 steps above $1.05, 32% of 13900 = 4448.
    const discounted = (price: number) => ({ fuelBasis: { kind: 'io_discounted' as const, centsPerLitreByMonth: { '2026-07': price } } });
    expectClean(only([tripDriver(lines(4_448), discounted(187))]));
    expectClean(only([tripDriver(lines(fuelOn(QS)), discounted(300))]));   // above published $2.20, so 46% stands
  });
  it('raises gaps for an unreported basis, a missing discounted month and an unpublished month', () => {
    expect(gapCodes(only([tripDriver(lines(0), { fuelBasis: NOT_REPORTED })]))).toEqual(['FUEL_BASIS_MISSING']);
    expect(gapCodes(only([tripDriver(lines(0), { fuelBasis: { kind: 'io_discounted', centsPerLitreByMonth: {} } })]))).toEqual(['FUEL_BASIS_MISSING']);
    // December 2026 is blank on the OBCCTC page. (November was the unpublished month until the supplement added it.)
    const dec = driver({ classPeriods: IO_TRIP, trips: [offDock('T1', '2026-12-02', 'Q', 'S')], payPeriods: [period({ from: '2026-12-01', to: '2026-12-14', payDate: '2026-12-13' })] });
    expect(gapCodes(only([dec], { ...OPTIONS, asOf: '2026-12-31' }))).toContain('FUEL_PCT_NOT_PUBLISHED');
  });
});

describe('FUEL_PUBLISHED_FORMULA_MISMATCH', () => {
  const d = tripDriver([tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L3', 'fuel', 5_560)]);
  it('triggers as a validation finding when a published percentage disagrees with the formula, and still uses the published figure', () => {
    const tampered = { ...OBCCTC_SCHEDULES, fuelPublished: { '2026-07': { referenceCentsPerLitre: 220, pct: 40 } } };   // formula gives 46; 40% of 13900 = 5560
    const p = only([d], OPTIONS, tampered);
    expect(p.findings.map(f => [f.ruleId, f.nature])).toEqual([['FUEL_PUBLISHED_FORMULA_MISMATCH', 'validation']]);
    expect(cents(p.buckets.fuel)).toBe(0);
  });
  it('does not trigger on the real published series', () => {
    const p = only([tripDriver([tripLine('L1', 'T1', QS), line('L2', 'pmr', PMR), line('L3', 'fuel', fuelOn(QS))])]);
    expect(statusOf(p, 'FUEL_PUBLISHED_FORMULA_MISMATCH')).toBe('not_triggered');
  });
});

describe('WAIT_TIME_NOT_PASSED_THROUGH', () => {
  const d = (paid: number) => hourlyDriver(HOUR, [line('L1', 'hourly', RATE), line('L2', 'wait_time', paid)], { waitTimeReceived: reported(5_000) });
  it('triggers when less reaches the driver than the licensee received', () => {
    const p = only([d(4_000)]);
    expect(amountOf(p, 'WAIT_TIME_NOT_PASSED_THROUGH')).toBe(1_000);
  });
  it('does not trigger when all of it is passed through', () => {
    expectClean(only([d(5_000)]));
  });
});

describe('DISALLOWED_DEDUCTION', () => {
  const d = (category: string) => hourlyDriver(HOUR, [line('L1', 'hourly', RATE)], { deductions: [{ deductionId: 'X1', category, cents: 500 }] });
  it('triggers on a category the policy disallows, and the deduction reduces base pay', () => {
    const p = only([d('test_disallowed')]);
    expect(amountOf(p, 'DISALLOWED_DEDUCTION')).toBe(500);
    expect(cents(p.buckets.base)).toBe(-500);
  });
  it('does not trigger on an allowed category', () => {
    expectClean(only([d('test_allowed')]));
  });
  it('raises a gap, never an assumption, for a category the policy does not list', () => {
    expect(gapCodes(only([d('mystery_fee')]))).toEqual(['DEDUCTION_CATEGORY_UNKNOWN']);
  });
});

describe('BASE_SHORTFALL_SEGREGATED and AGGREGATE_SHORTFALL', () => {
  it('trigger together when total pay is short', () => {
    expect(ruleIds(only([hourlyDriver(HOUR, [line('L1', 'hourly', RATE - 1)])]))).toEqual(['AGGREGATE_SHORTFALL', 'BASE_SHORTFALL_SEGREGATED', 'HOURLY_BELOW_MINIMUM']);
  });
  it('credits an "other" payment such as bobtail toward base', () => {
    const p = only([hourlyDriver(HOUR, [line('L1', 'hourly', RATE - 500), line('L2', 'other', 500)])]);
    expect(p.verdict).toBe('no_shortfall_detected');
    expect(ruleIds(p)).toEqual(['HOURLY_BELOW_MINIMUM']);   // the hourly line alone is still listed, without netting
  });
});

describe('IEO_OFFSET_APPLIED (reserved) and its gap', () => {
  const ieo = (payer: 'licensee' | 'employing_io') => driver({
    driverId: 'IEO1', classPeriods: [{ class: 'IEO', employingIoDriverId: 'IO1', from: '2020-01-01', to: null }],
    hourlyEntries: [entry('E1', MON, HOUR)], payPeriods: [period({ payer, lines: [line('L1', 'hourly', RATE)] })],
  });
  const io = driver({ driverId: 'IO1', classPeriods: IO_TRIP, payPeriods: [period({ payPeriodId: 'P2' })] });

  it('raises a gap on both the IEO and the employing I/O when the licensee paid the IEO directly', () => {
    const result = run([ieo('licensee'), io]);
    expect(result.drivers.map(d => d.verdict)).toEqual(['insufficient_data', 'insufficient_data']);
    expect(result.drivers[1]?.gaps.map(g => [g.code, g.recordIds])).toEqual([['IEO_OFFSET_NOT_EVALUATED', ['IEO1']]]);
  });
  it('evaluates the IEO normally when the employing I/O paid them', () => {
    const result = run([ieo('employing_io'), io]);
    expect(result.drivers.map(d => d.verdict)).toEqual(['no_shortfall_detected', 'no_shortfall_detected']);
  });
  it('is never reported as passed', () => {
    expect(statusOf(only([ieo('employing_io')]), 'IEO_OFFSET_APPLIED')).toBe('not_evaluated');
  });
});

describe('remaining gaps', () => {
  it('raises CLASS_UNKNOWN_FOR_DATE when no class period covers the work date', () => {
    const d = driver({ classPeriods: [{ class: 'DEO', from: '2026-08-01', to: null }], hourlyEntries: [entry('E1', MON, HOUR)], payPeriods: [period()] });
    expect(gapCodes(only([d]))).toEqual(['CLASS_UNKNOWN_FOR_DATE']);
  });
  it('uses the class in force on each date when the class changes mid-period', () => {
    const d = driver({
      classPeriods: [{ class: 'DEO', from: '2020-01-01', to: '2026-07-06' }, { class: 'IO_HOURLY', from: '2026-07-07', to: null }],
      hourlyEntries: [entry('E1', MON, HOUR), entry('E2', '2026-07-07', HOUR)],
      payPeriods: [period({ lines: [line('L1', 'hourly', RATE + HOURLY.IO_HOURLY.under2340), line('L2', 'fuel', fuelOn(HOURLY.IO_HOURLY.under2340))] })],
    });
    expectClean(only([d]));
  });
  it('raises CUMULATIVE_HOURS_UNKNOWN for hourly work after trip work, which carries no hours', () => {
    const d = driver({
      classPeriods: [{ class: 'IO_TRIP', from: '2020-01-01', to: '2026-07-06' }, { class: 'IO_HOURLY', from: '2026-07-07', to: null }],
      trips: [offDock('T1', MON, 'Q', 'S')], hourlyEntries: [entry('E1', '2026-07-07', HOUR)], payPeriods: [period()],
    });
    expect(gapCodes(only([d]))).toContain('CUMULATIVE_HOURS_UNKNOWN');
  });
  it('raises NO_PAY_PERIOD_FOR_WORK at driver level for work outside every pay period', () => {
    const result = firstDriver(run([driver({ hourlyEntries: [entry('E1', '2026-08-03', HOUR)], payPeriods: [period()] })]));
    expect(result.gaps.map(g => g.code)).toEqual(['NO_PAY_PERIOD_FOR_WORK']);
    expect(result.verdict).toBe('insufficient_data');
  });
  it('gives insufficient_data, not a clean result, for a driver with no pay periods', () => {
    expect(firstDriver(run([driver()])).verdict).toBe('insufficient_data');
  });
});
