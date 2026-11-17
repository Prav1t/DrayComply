// Reporting a range of pay periods without changing what was calculated.
import { describe, it, expect } from 'vitest';
import { HOURLY } from '../../rates/obcctc-2026-07-01';
import { restrictPeriods } from './scope';
import { driver, entry, input, line, period, run } from './testing/builders';

const RATE = HOURLY.DEO.under2340;
const underpaid = period({ payPeriodId: 'P1', lines: [line('L1', 'hourly', 8 * RATE - 500)] });
const paid = period({ payPeriodId: 'P2', from: '2026-07-19', to: '2026-08-01', payDate: '2026-08-07', lines: [line('L2', 'hourly', 8 * RATE)] });
const d1 = driver({ hourlyEntries: [entry('E1', '2026-07-06', 480), entry('E2', '2026-07-20', 480)], payPeriods: [underpaid, paid] });
const d2 = driver({ driverId: 'D2', hourlyEntries: [entry('E3', '2026-07-06', 480)], payPeriods: [period({ lines: [line('L3', 'hourly', 8 * RATE)] })] });
const full = run([d1, d2]);
const data = input([d1, d2]);

describe('restrictPeriods', () => {
  it('returns the run untouched when every period is selected', () => {
    expect(restrictPeriods(full, data, { kind: 'all' })).toBe(full);
  });
  it('keeps only periods wholly inside the range and rolls the driver verdict up again', () => {
    expect(full.drivers[0]?.verdict).toBe('shortfall_aggregate');
    const august = restrictPeriods(full, data, { kind: 'range', from: '2026-07-19', to: '2026-08-01' });
    expect(august.drivers.map(d => [d.driverId, d.verdict, d.periods.map(p => p.payPeriodId)])).toEqual([['D1', 'no_shortfall_detected', ['P2']]]);
  });
  it('still shows a shortfall when the short period is the one selected', () => {
    const july = restrictPeriods(full, data, { kind: 'range', from: '2026-07-05', to: '2026-07-18' });
    expect(july.drivers.map(d => [d.driverId, d.verdict])).toEqual([['D1', 'shortfall_aggregate'], ['D2', 'no_shortfall_detected']]);
  });
  it('leaves out a period that is only partly inside the range, and says so', () => {
    const partly = restrictPeriods(full, data, { kind: 'range', from: '2026-07-10', to: '2026-08-01' });
    expect(partly.drivers.flatMap(d => d.periods.map(p => p.payPeriodId))).toEqual(['P2']);
    const note = partly.scope.find(n => n.code === 'PERIOD_SELECTION')?.sentence ?? '';
    expect(note).toContain('2 other pay period(s) were calculated but are not reported, 2 of them partly inside the range');
    expect(note).toContain('1 driver(s) had no pay period wholly inside the range');
  });
  it('does not change any figure of a period it keeps, nor the provenance', () => {
    const august = restrictPeriods(full, data, { kind: 'range', from: '2026-07-19', to: '2026-08-01' });
    expect(august.drivers[0]?.periods[0]).toEqual(full.drivers[0]?.periods[1]);
    expect(august.provenance).toEqual(full.provenance);
  });
  it('keeps a driver-level gap in force after the restriction', () => {
    const stray = driver({ hourlyEntries: [entry('E1', '2026-07-20', 480), entry('E9', '2026-09-01', 60)], payPeriods: [paid] });
    const r = restrictPeriods(run([stray]), input([stray]), { kind: 'range', from: '2026-07-19', to: '2026-08-01' });
    expect(r.drivers[0]?.verdict).toBe('insufficient_data');
  });
});
