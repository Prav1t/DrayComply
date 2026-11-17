import type { ComplianceInput, DriverInput, RunOptions } from './types/input';
import type { ScheduleSet } from './types/schedule';
import type { GapDraft } from './types/internal';
import type { DriverResult, Gap, PeriodResult, Provenance, RecordsVerdict, RunResult, ScopeNote, Verdict } from './types/result';
import { GAPS, SCOPE } from './rules/catalogue';
import { ENGINE_VERSION } from './version';
import { validateRun } from './validate';
import { computeHourly } from './hourly/owed';
import { computeCallouts } from './hourly/callout';
import { computeTrips } from './trip/owed';
import { matchTripPayments } from './trip/match';
import { attributePayments } from './assemble/attribute';
import { evaluatePeriod } from './assemble/result';
import { deltaFromExact } from './compare/aggregate';
import { inRange } from './math/dates';
import { ZERO, add, fromExact, isPositive, type Frac } from './math/ratio';

// Worst first. A gap anywhere outranks every other outcome for the driver.
const SEVERITY: readonly Verdict[] = ['insufficient_data', 'shortfall_aggregate', 'shortfall_segregated_only', 'no_shortfall_detected'];
const RECORDS_SEVERITY: readonly RecordsVerdict[] = ['records_finding', 'not_evaluated', 'no_records_finding_detected'];

export function rollUp(periods: readonly PeriodResult[], driverGaps: readonly Gap[]): Verdict {
  if (driverGaps.length > 0 || periods.length === 0) return 'insufficient_data';
  return SEVERITY.find(v => periods.some(p => p.verdict === v)) ?? 'insufficient_data';
}

export const rollUpRecords = (periods: readonly PeriodResult[]): RecordsVerdict =>
  RECORDS_SEVERITY.find(v => periods.some(p => p.recordsVerdict === v)) ?? 'not_evaluated';

// Second figure only: a surplus carries forward to later periods; a shortfall never carries.
// It never changes a verdict. One period that cannot be computed leaves every later carry unknown.
function withCarryover(driver: DriverInput, periods: readonly PeriodResult[], options: RunOptions): PeriodResult[] {
  const startOf = (id: string): string => driver.payPeriods.find(p => p.payPeriodId === id)?.from ?? '';
  const ordered = [...periods].sort((a, b) => (startOf(a.payPeriodId) < startOf(b.payPeriodId) ? -1 : 1));
  const carried = new Map<string, PeriodResult>();
  let carry: Frac | null = ZERO;
  for (const p of ordered) {
    if (p.aggregate.kind !== 'computed' || carry === null) { carry = null; carried.set(p.payPeriodId, p); continue; }
    const exact: Frac = add(fromExact(p.aggregate.exact), carry);
    carried.set(p.payPeriodId, { ...p, aggregateWithCarryover: deltaFromExact(exact, options.rounding) });
    carry = isPositive(exact) ? exact : ZERO;
  }
  return periods.map(p => carried.get(p.payPeriodId) ?? p);
}

interface DriverOutcome {
  readonly result: DriverResult;
  readonly ieoOffsetIoDriverIds: readonly string[];
}

function evaluateDriver(driver: DriverInput, schedules: ScheduleSet, options: RunOptions): DriverOutcome {
  const hourly = computeHourly(driver, schedules);
  const trips = computeTrips(driver, schedules);
  const callouts = computeCallouts(driver, schedules, hourly.items, trips.items);
  const covered = (date: string): boolean => driver.payPeriods.some(p => inRange(date, p.from, p.to));

  // Work outside every pay period cannot be compared with anything.
  const calloutRecords = driver.callouts.kind === 'flagged' ? driver.callouts.records : [];
  const uncovered: GapDraft[] = [
    ...driver.hourlyEntries.map(e => ({ id: e.entryId, date: e.workDate })),
    ...driver.trips.map(t => ({ id: t.tripId, date: t.workDate })),
    ...calloutRecords.map(c => ({ id: c.calloutId, date: c.workDate })),
  ].filter(w => !covered(w.date)).map(w => ({
    code: GAPS.NO_PAY_PERIOD_FOR_WORK, workDate: null, recordIds: [w.id], detail: `Work dated ${w.date} falls in no pay period supplied.`,
  }));

  const drafts = [...hourly.gaps, ...trips.gaps, ...callouts.gaps];
  const ctx = {
    driver, schedules, options, hourly: hourly.items, trips: trips.items, callouts: callouts.items, drafts,
    payments: matchTripPayments(driver), attribution: attributePayments(driver),
  };
  const outcomes = driver.payPeriods.map(p => evaluatePeriod(ctx, p));
  const periods = withCarryover(driver, outcomes.map(o => o.result), options);
  const gaps: Gap[] = [...drafts.filter(g => g.workDate === null || !covered(g.workDate)), ...uncovered]
    .map(g => ({ code: g.code, driverId: driver.driverId, payPeriodId: null, recordIds: g.recordIds, detail: g.detail }));

  const scope: ScopeNote[] = [];
  if (driver.otherLicenseeHours.kind === 'not_reported' && driver.hourlyEntries.length > 0) {
    scope.push({ code: SCOPE.OTHER_LICENSEE_HOURS_NOT_REPORTED, sentence: 'Hours worked for other licensees during the run were not supplied. The step up at the hourly tier threshold may be applied late, and amounts owed may be understated.' });
  }
  if (hourly.pricedWithNoOvertimeRule) {
    scope.push({ code: SCOPE.NO_OVERTIME_RULE_IN_FORCE, sentence: 'Some hours fall on dates when the Commissioner\'s rate order contained no overtime rule. They are priced at the hourly rate only. Overtime owed under employment standards law is not evaluated, so amounts owed may be understated.' });
  }
  if (driver.callouts.kind === 'not_flagged') {
    scope.push({ code: SCOPE.CALLOUTS_NOT_FLAGGED, sentence: 'Callout days were not flagged in the input. The callout minimum was not evaluated, and amounts owed may be understated.' });
  }
  return {
    result: { driverId: driver.driverId, verdict: rollUp(periods, gaps), recordsVerdict: rollUpRecords(periods), periods, gaps, scope },
    ieoOffsetIoDriverIds: outcomes.flatMap(o => o.ieoOffsetIoDriverIds),
  };
}

// Pure: the same input, schedules and options always give the same result.
export function runCompliance(input: ComplianceInput, schedules: ScheduleSet, options: RunOptions): RunResult {
  const errors = validateRun(input, schedules, options);
  if (errors.length > 0) return { kind: 'invalid_input', errors };

  const outcomes = input.drivers.map(d => evaluateDriver(d, schedules, options));
  const offsetTargets = new Map<string, string[]>();   // employing I/O -> IEOs paid directly
  outcomes.forEach(o => o.ieoOffsetIoDriverIds.forEach(io => offsetTargets.set(io, [...(offsetTargets.get(io) ?? []), o.result.driverId])));

  const drivers = outcomes.map(({ result }): DriverResult => {
    const ieos = offsetTargets.get(result.driverId);
    if (ieos === undefined) return result;
    const gaps: Gap[] = [...result.gaps, {
      code: GAPS.IEO_OFFSET_NOT_EVALUATED, driverId: result.driverId, payPeriodId: null, recordIds: [...new Set(ieos)],
      detail: 'The licensee paid this operator\'s indirectly employed operator directly. The amount owed to this operator may be reduced by the indemnification offset, which is not evaluated in this engine version.',
    }];
    return { ...result, gaps, verdict: rollUp(result.periods, gaps) };
  });

  const scheduleIds = [...new Set(drivers.flatMap(d => d.periods.flatMap(p => p.scheduleIds)))].sort();
  const used: Provenance['schedules'] = scheduleIds.map(id => {
    const s = schedules.schedules.find(x => x.id === id);
    if (s !== undefined) return { id, status: s.status, verifiedBy: s.verifiedBy };
    return { id, status: id === schedules.fuelSupplement.seriesId ? schedules.fuelSupplement.status : schedules.fuelPublishedStatus, verifiedBy: null };
  });
  const unverified = used.filter(s => s.status !== 'verified').map(s => s.id);

  const scope: ScopeNote[] = [
    { code: SCOPE.IEO_OFFSET_NOT_IMPLEMENTED, sentence: 'The IEO indemnification offset is not implemented in this engine version. Where it could apply, the result is insufficient data.' },
  ];
  if (unverified.length > 0) {
    scope.push({ code: SCOPE.UNVERIFIED_SCHEDULE_USED, sentence: `Unverified rates were used: ${unverified.join(', ')}. These schedules are transcriptions that no second person has checked against the source.` });
  }
  if (input.drivers.some(d => d.payPeriods.some(p => p.deductions.length > 0))) {
    scope.push({ code: SCOPE.DEDUCTION_POLICY_IS_INTERPRETATION, sentence: `Deductions were classified under policy ${options.deductionPolicy.id}, which is a legal interpretation and not a regulated value.` });
  }
  const seen = new Set(scope.map(n => n.code));
  drivers.flatMap(d => d.scope).forEach(n => { if (!seen.has(n.code)) { seen.add(n.code); scope.push(n); } });

  return {
    kind: 'completed',
    provenance: {
      engineVersion: ENGINE_VERSION,
      scheduleIds,
      schedules: used,
      unverifiedSchedulesUsed: unverified.length > 0,
      rounding: options.rounding,
      asOf: options.asOf,
      deductionPolicyId: options.deductionPolicy.id,
      licenseeId: input.licenseeId,
      input: input.provenance,
    },
    scope,
    drivers,
  };
}
