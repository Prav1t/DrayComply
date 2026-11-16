// Test helpers only. Nothing here is imported by engine source.
import { expect } from 'vitest';
import type { ContainerCount, Reported } from '../types/primitives';
import type { ComplianceInput, DriverInput, PayLine, PayPeriod, RunOptions, StatedWorkPeriod, TripRecord } from '../types/input';
import type { RegulatedSchedule, ScheduleSet } from '../types/schedule';
import type { DriverResult, PeriodResult, RunResult } from '../types/result';
import { runCompliance } from '../run';
import { OBCCTC_SCHEDULES } from '../adapters/obcctc';

export const reported = <T>(value: T): Reported<T> => ({ kind: 'reported', value });
export const NOT_REPORTED = { kind: 'not_reported' } as const;

// SYNTHETIC deduction policy. The real allowed/disallowed list is not in project knowledge.
export const OPTIONS: RunOptions = {
  asOf: '2026-11-14',
  rounding: 'half_up',
  deductionPolicy: { id: 'synthetic-test-policy', categories: { test_allowed: 'allowed', test_disallowed: 'disallowed' }, citations: {} },
};

export function driver(overrides: Partial<DriverInput> = {}): DriverInput {
  return {
    driverId: 'D1',
    classPeriods: [{ class: 'DEO', from: '2020-01-01', to: null }],
    openingCumulativeMinutes: reported(0),
    hourlyCoverageFrom: reported('2020-01-01'),
    otherLicenseeHours: { kind: 'reported', entries: [] },
    fuelBasis: { kind: 'published' },
    hourlyEntries: [],
    trips: [],
    callouts: { kind: 'flagged', records: [] },
    payPeriods: [],
    ...overrides,
  };
}

// Marker: a line built without an explicit work period states the period() it is placed in.
const OWN_PERIOD: StatedWorkPeriod = { kind: 'stated', from: '0000-00-00', to: '0000-00-00' };
export const workFor = (from: string, to: string): StatedWorkPeriod => ({ kind: 'stated', from, to });

// Default period: Sunday 2026-07-05 to Saturday 2026-07-18, already paid.
export function period(overrides: Partial<PayPeriod> = {}): PayPeriod {
  const p: PayPeriod = {
    payPeriodId: 'P1', from: '2026-07-05', to: '2026-07-18', payDate: '2026-07-24', payer: 'licensee',
    waitTimeReceived: reported(0), lines: [], deductions: [],
    ...overrides,
  };
  return { ...p, lines: p.lines.map(l => (l.workPeriod === OWN_PERIOD ? { ...l, workPeriod: workFor(p.from, p.to) } : l)) };
}

export const line = (lineId: string, kind: Exclude<PayLine['kind'], 'trip_rate'>, cents: number, workPeriod: StatedWorkPeriod = OWN_PERIOD): PayLine =>
  ({ lineId, kind, cents, workPeriod });
export const tripLine = (lineId: string, tripId: string, cents: number, workPeriod: StatedWorkPeriod = OWN_PERIOD): PayLine =>
  ({ lineId, kind: 'trip_rate', cents, workPeriod, link: { kind: 'trip', tripId } });
export const entry = (entryId: string, workDate: string, minutes: number, seq = 0) => ({ entryId, workDate, seq, minutes });

export const offDock = (tripId: string, workDate: string, origin: string, destination: string, containers: ContainerCount = 'one'): TripRecord =>
  ({ tripId, workDate, move: { kind: 'off_dock', origin: reported(origin), destination: reported(destination) }, containers: reported(containers) });
export const onDock = (tripId: string, workDate: string, zone: string, terminal: string, containers: ContainerCount = 'one'): TripRecord =>
  ({ tripId, workDate, move: { kind: 'on_dock', zone: reported(zone), terminal: reported(terminal) }, containers: reported(containers) });

export const IO_TRIP = [{ class: 'IO_TRIP', from: '2020-01-01', to: null }] as const;
export const IO_HOURLY = [{ class: 'IO_HOURLY', from: '2020-01-01', to: null }] as const;

export function input(drivers: readonly DriverInput[]): ComplianceInput {
  return { licenseeId: 'L1', provenance: { sources: [{ name: 'test', digest: 'sha256:test' }] }, drivers };
}

type Completed = Extract<RunResult, { kind: 'completed' }>;

export function run(drivers: readonly DriverInput[], options: RunOptions = OPTIONS, schedules: ScheduleSet = OBCCTC_SCHEDULES): Completed {
  const result = runCompliance(input(drivers), schedules, options);
  if (result.kind !== 'completed') throw new Error(`invalid input: ${result.errors.join('; ')}`);
  return result;
}

export function firstDriver(result: Completed): DriverResult {
  const d = result.drivers[0];
  if (d === undefined) throw new Error('no driver in result');
  return d;
}

// The single pay period of the single driver.
export function only(drivers: readonly DriverInput[], options: RunOptions = OPTIONS, schedules: ScheduleSet = OBCCTC_SCHEDULES): PeriodResult {
  const p = firstDriver(run(drivers, options, schedules)).periods[0];
  if (p === undefined) throw new Error('no pay period in result');
  return p;
}

export const ruleIds = (p: PeriodResult): string[] => [...new Set(p.findings.map(f => f.ruleId))].sort();
export const gapCodes = (p: PeriodResult): string[] => [...new Set(p.gaps.map(g => g.code))].sort();
export const cents = (d: PeriodResult['aggregate']): number | null => (d.kind === 'computed' ? d.cents : null);
export const amountOf = (p: PeriodResult, ruleId: string): number | null => p.findings.find(f => f.ruleId === ruleId)?.amountCents ?? null;
export const statusOf = (p: PeriodResult, ruleId: string): string | null => p.evaluations.find(e => e.ruleId === ruleId)?.status ?? null;

export function expectClean(p: PeriodResult): void {
  expect({ verdict: p.verdict, gaps: gapCodes(p), findings: ruleIds(p) }).toEqual({ verdict: 'no_shortfall_detected', gaps: [], findings: [] });
}

// SYNTHETIC schedules with deliberately unreal values, to prove the regulation is data.
const synthetic = (id: string, effectiveFrom: string, effectiveTo: string | null, rate: number): RegulatedSchedule => ({
  id, status: 'unverified-transcription', verifiedBy: null, effectiveFrom, effectiveTo,
  hourly: { kind: 'present', value: { tierThresholdHours: 10, rates: {
    DEO: { underThreshold: rate, atOrOverThreshold: rate + 100 },
    IEO: { underThreshold: rate, atOrOverThreshold: rate + 100 },
    IO_HOURLY: { underThreshold: rate * 2, atOrOverThreshold: rate * 2 + 100 },
  } } },
  overtime: { kind: 'present', value: { multiplier: { num: 2, den: 1 }, dailyThresholdHours: 8, weeklyThresholdHours: 40, weekStartsOn: 'sunday' } },
  calloutEmployee: { kind: 'present', value: { multiplierOfHourly: 3 } },
  calloutIo: { kind: 'present', value: { floorCents: 11_111 } },
  onDock: { kind: 'present', value: { table: { A: { t1: 5_000 } } } },
  offDock: { kind: 'present', value: { table: { A: { A: 3_333, B: 4_001 }, B: { A: 4_001, B: 3_333 } }, twoContainerMultiplier: { num: 3, den: 2 } } },
  pmr: { kind: 'present', value: { cents: 777, twoContainerMultiplier: { num: 3, den: 2 } } },
  fuelFormula: { kind: 'present', value: { thresholdCentsPerLitre: 100, stepCentsPerLitre: 10, pctPerStep: 5, roundReferenceDownToCents: 10 } },
});

// The boundary falls on Wednesday 2030-07-03, mid-week.
export const SYNTHETIC_SCHEDULES: ScheduleSet = {
  schedules: [synthetic('synthetic-a', '2030-01-01', '2030-07-02', 1_000), synthetic('synthetic-b', '2030-07-03', null, 2_000)],
  fuelPublishedSeriesId: 'synthetic-fuel',
  fuelPublishedStatus: 'unverified-transcription',
  fuelPublished: { '2030-07': { referenceCentsPerLitre: 150, pct: 25 } },
  fuelSupplement: { seriesId: 'synthetic-fuel-supplement', status: 'unverified-transcription', months: {} },
};
