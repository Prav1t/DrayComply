import type { IsoDate } from '../types/primitives';
import type { DriverInput, PayLine, PayPeriod, RunOptions } from '../types/input';
import type { ScheduleSet } from '../types/schedule';
import type { CalloutItem, GapDraft, HourlyItem, TripItem } from '../types/internal';
import type { Delta, DeltaRange, EvaluationStatus, Finding, FindingNature, Gap, PeriodResult, RecordsVerdict, RuleEvaluation, Verdict } from '../types/result';
import { GAPS, RULES, RULE_IDS, type GapCode, type RuleId } from '../rules/catalogue';
import { classAt } from '../classify/class-at';
import { classifyDeductions } from '../deductions/classify';
import { fuelOwed, fuelPctFor } from '../fuel/owed';
import { hourlyOwed } from '../hourly/owed';
import type { TripPayments } from '../trip/match';
import type { Attribution } from './attribute';
import { waitTimeOwed } from '../wait/owed';
import { aggregateDelta, computeDelta, isShortfall, type ComputedDelta } from '../compare/aggregate';
import { segregatedDelta } from '../compare/segregated';
import { inRange, yearMonthOf } from '../math/dates';
import { ZERO, add, cmp, fromInt, isPositive, maxFrac, minFrac, roundFrac, sub, sum, toExact, type Frac } from '../math/ratio';
import { formatCents } from './format';

export interface DriverContext {
  readonly driver: DriverInput;
  readonly schedules: ScheduleSet;
  readonly options: RunOptions;
  readonly hourly: readonly HourlyItem[];
  readonly trips: readonly TripItem[];
  readonly callouts: readonly CalloutItem[];
  readonly drafts: readonly GapDraft[];
  readonly payments: TripPayments;
  readonly attribution: Attribution;
}

export interface PeriodOutcome {
  readonly result: PeriodResult;
  readonly ieoOffsetIoDriverIds: readonly string[];   // I/Os whose amount owed the offset would reduce
}

const NOT_COMPUTABLE: Delta = { kind: 'not_computable' };
const ONE_CENT = fromInt(1);
const CAVEAT = 'This is a calculation under the rules as encoded, for the data provided. It is not legal advice.';

const STATEMENTS: Readonly<Record<Verdict, string>> = {
  no_shortfall_detected: `No shortfall detected under the rules as encoded, for the data provided. ${CAVEAT}`,
  shortfall_aggregate: `A shortfall is indicated on the aggregate comparison. ${CAVEAT}`,
  shortfall_segregated_only: `A shortfall is indicated on the segregated comparison only; the aggregate comparison indicates none. ${CAVEAT}`,
  insufficient_data: `Insufficient data: no conclusion is drawn for this pay period. See the gaps listed. ${CAVEAT}`,
};

const paidOf = (lines: readonly PayLine[], ...kinds: readonly PayLine['kind'][]): number =>
  lines.filter(l => kinds.includes(l.kind)).reduce((t, l) => t + l.cents, 0);

export function evaluatePeriod(ctx: DriverContext, period: PayPeriod): PeriodOutcome {
  const { driver, schedules, options } = ctx;
  const mode = options.rounding;
  const inPeriod = (d: IsoDate): boolean => inRange(d, period.from, period.to);
  const hourly = ctx.hourly.filter(i => inPeriod(i.workDate));
  const trips = ctx.trips.filter(i => inPeriod(i.workDate));
  const callouts = ctx.callouts.filter(i => inPeriod(i.workDate));
  const open = options.asOf < period.payDate;
  const lines = ctx.attribution.linesByPeriod.get(period.payPeriodId) ?? [];   // by stated work period, not pay date

  const gaps: Gap[] = [];
  const findings: Finding[] = [];
  const scheduleIds = new Set<string>([...hourly.map(i => i.scheduleId), ...trips.flatMap(i => i.scheduleIds), ...callouts.map(i => i.scheduleId)]);
  const addGap = (code: GapCode, recordIds: readonly string[], detail: string): void => {
    gaps.push({ code, driverId: driver.driverId, payPeriodId: period.payPeriodId, recordIds, detail });
  };
  const addFinding = (ruleId: RuleId, nature: FindingNature, amount: Frac, recordIds: readonly string[], sentence: string): void => {
    // Any shortfall under one whole cent is labelled rounding only.
    const shortfall = nature === 'period_shortfall' || nature === 'item_shortfall';
    const tiny = shortfall && isPositive(amount) && cmp(amount, ONE_CENT) < 0;
    findings.push({
      ruleId, driverId: driver.driverId, payPeriodId: period.payPeriodId,
      nature: tiny ? 'rounding_only' : nature,
      amountCents: roundFrac(amount, mode), amountExact: toExact(amount), recordIds,
      sentence: tiny ? `${sentence} The difference is under one cent and arises from rounding only.` : sentence,
    });
  };
  const show = (amount: Frac): string => formatCents(roundFrac(amount, mode));

  ctx.drafts.filter(g => g.workDate !== null && inPeriod(g.workDate)).forEach(g => addGap(g.code, g.recordIds, g.detail));
  if (open) addGap(GAPS.PAY_PERIOD_OPEN, [period.payPeriodId], `Pay date ${period.payDate} is after the run date ${options.asOf}; payments for this period may still be made.`);

  // Payer checks, and the IEO indemnification offset this version does not evaluate.
  const ieoOffsetIoDriverIds = new Set<string>();
  const linesTotal = lines.reduce((t, l) => t + l.cents, 0);
  for (const item of hourly) {
    const cls = classAt(driver.classPeriods, item.workDate);
    if (cls !== null && cls.class === 'IEO' && period.payer === 'licensee' && linesTotal > 0) ieoOffsetIoDriverIds.add(cls.employingIoDriverId);
  }
  if (ieoOffsetIoDriverIds.size > 0) {
    addGap(GAPS.IEO_OFFSET_NOT_EVALUATED, [period.payPeriodId], 'The licensee paid an indirectly employed operator directly. The indemnification offset against the employing independent operator is not evaluated in this engine version.');
  }
  if (period.payer === 'employing_io' && (trips.length > 0 || hourly.some(i => i.driverClass !== 'IEO'))) {
    addGap(GAPS.CLASS_WORK_MISMATCH, [period.payPeriodId], 'The pay statement is marked as paid by an employing independent operator, but the work in the period is not all indirectly employed work.');
  }

  // Trip payments with no trip record are work the engine cannot price.
  const notStated = ctx.attribution.notStated.get(period.payPeriodId) ?? [];
  if (notStated.length > 0) addGap(GAPS.PAYMENT_WORK_PERIOD_NOT_STATED, notStated, 'Payments on this statement do not state the work period they are for, so they are counted toward no period.');
  const unmatched = ctx.attribution.unmatched.get(period.payPeriodId) ?? [];
  if (unmatched.length > 0) addGap(GAPS.PAYMENT_WORK_PERIOD_UNMATCHED, unmatched, 'Payments on this statement state work dates that do not fall inside exactly one pay period supplied.');

  const orphans = lines.filter(l => ctx.payments.orphanLineIds.has(l.lineId));
  if (orphans.length > 0) {
    addGap(GAPS.PAYMENT_WITHOUT_TRIP, orphans.map(l => l.lineId), 'Trip rate payments appear on the pay statement with no matching trip record.');
  }

  const deductions = classifyDeductions(period.deductions, options.deductionPolicy);
  if (deductions.unknown.length > 0) {
    addGap(GAPS.DEDUCTION_CATEGORY_UNKNOWN, deductions.unknown.map(d => d.deductionId), `Deduction policy ${options.deductionPolicy.id} does not classify: ${[...new Set(deductions.unknown.map(d => d.category))].join(', ')}.`);
  }
  const citations = options.deductionPolicy.citations;
  for (const d of deductions.disallowed) {
    const basis = Object.hasOwn(citations, d.category) ? ` Basis, as an interpretation: ${citations[d.category] ?? ''}.` : '';
    addFinding(RULES.DISALLOWED_DEDUCTION, 'prohibited_deduction', fromInt(d.cents), [d.deductionId],
      `Deduction ${d.deductionId} of ${formatCents(d.cents)} is in category "${d.category}", which deduction policy ${options.deductionPolicy.id} does not allow against regulated remuneration.${basis}`);
  }
  const disallowedCents = deductions.disallowed.reduce((t, d) => t + d.cents, 0);

  const waitOwed = waitTimeOwed(period);
  if (waitOwed === null) addGap(GAPS.WAIT_TIME_NOT_REPORTED, [period.payPeriodId], 'Wait time remuneration received by the licensee for this period was not reported.');

  // Fuel: independent operators only, on minimum compensation excluding the positioning movement rate.
  const fuelBearing: { readonly recordId: string; readonly workDate: IsoDate; readonly base: Frac }[] = [
    ...hourly.filter(i => i.driverClass === 'IO_HOURLY').map(i => ({ recordId: i.entryId, workDate: i.workDate, base: hourlyOwed(i) })),
    ...trips.flatMap(i => (i.base === null ? [] : [{ recordId: i.tripId, workDate: i.workDate, base: i.base }])),
    ...callouts.filter(i => i.driverClass === 'IO_HOURLY' || i.driverClass === 'IO_TRIP').map(i => ({ recordId: i.calloutId, workDate: i.workDate, base: i.topUp })),
  ];
  let fuelTotal: Frac = ZERO;
  let fuelChecked = false;
  const monthsSeen = new Set<string>();
  for (const item of fuelBearing) {
    const month = yearMonthOf(item.workDate);
    const pct = fuelPctFor(schedules, driver.fuelBasis, item.workDate);
    const firstInMonth = !monthsSeen.has(month);
    monthsSeen.add(month);
    if (pct.kind === 'gap') {
      if (firstInMonth) addGap(pct.code, fuelBearing.filter(f => yearMonthOf(f.workDate) === month).map(f => f.recordId), pct.detail);
      continue;
    }
    scheduleIds.add(pct.seriesId);
    if (pct.check.kind !== 'not_checked') fuelChecked = true;
    if (pct.check.kind === 'mismatch' && firstInMonth) {
      addFinding(RULES.FUEL_PUBLISHED_FORMULA_MISMATCH, 'validation', ZERO, [month],
        `The published fuel surcharge for ${month} is ${pct.check.publishedPct}%, but the formula applied to the published reference price gives ${pct.check.formulaPct}%. The published figure was used.`);
    }
    fuelTotal = add(fuelTotal, fuelOwed(item.base, pct.pct));
  }

  // Amounts owed. A trip amount under a gap contributes nothing; the period is not computable anyway.
  const straight = sum(hourly.map(i => i.straight));
  const dailyPremium = sum(hourly.map(i => i.dailyPremium));
  const weeklyPremium = sum(hourly.map(i => i.weeklyPremium));
  const hourlyTotal = add(add(straight, dailyPremium), weeklyPremium);
  const tripTotal = sum(trips.map(i => i.base ?? ZERO));
  const pmrTotal = sum(trips.map(i => i.pmr ?? ZERO));
  const topUpTotal = sum(callouts.map(i => i.topUp));
  const baseOwed = sum([hourlyTotal, tripTotal, pmrTotal, topUpTotal]);

  const basePaid = paidOf(lines, 'hourly', 'overtime', 'trip_rate', 'pmr', 'callout', 'other') - disallowedCents;
  const waitPaid = paidOf(lines, 'wait_time');
  const fuelPaid = paidOf(lines, 'fuel');

  // Per-trip findings, listed without netting one trip against another.
  let strictShort: Frac = ZERO;
  const pendingTripIds: string[] = [];
  for (const trip of trips) {
    if (trip.base === null) continue;
    const paid = ctx.payments.paidByTrip.get(trip.tripId);
    if (paid === undefined) {
      if (open) { pendingTripIds.push(trip.tripId); continue; }
      strictShort = add(strictShort, trip.base);
      addFinding(RULES.TRIP_NO_MATCHING_PAYMENT, 'item_shortfall', trip.base, [trip.tripId],
        `Trip ${trip.tripId} on ${trip.workDate} (${trip.description}) has a regulated trip rate of ${show(trip.base)} and no trip rate payment linked to it.`);
      continue;
    }
    const short = sub(trip.base, fromInt(paid));
    if (isPositive(short)) {
      strictShort = add(strictShort, short);
      addFinding(RULES.TRIP_RATE_BELOW_MINIMUM, 'item_shortfall', short, [trip.tripId],
        `Trip ${trip.tripId} on ${trip.workDate} (${trip.description}) was paid ${formatCents(paid)} against a regulated trip rate of ${show(trip.base)}, ${show(short)} short.`);
    }
  }
  if (pendingTripIds.length > 0) {
    addFinding(RULES.TRIP_NO_MATCHING_PAYMENT, 'pending', ZERO, pendingTripIds,
      `${pendingTripIds.length} trip(s) have no linked payment yet. The pay period is still open, so this is not reported as an underpayment.`);
  }

  // Positioning movement rate: owed per trip, and it must be its own line.
  const pmrPriced = trips.length > 0 && trips.every(i => i.pmr !== null);
  const pmrLines = lines.filter(l => l.kind === 'pmr');
  const pmrEvaluated = pmrPriced && !open;
  if (pmrEvaluated && isPositive(pmrTotal)) {
    const pmrPaid = fromInt(paidOf(lines, 'pmr'));
    if (pmrLines.length === 0) {
      addFinding(RULES.PMR_NOT_ITEMISED, 'record_keeping', ZERO, trips.map(i => i.tripId),
        `Positioning movement rate of ${show(pmrTotal)} is owed for ${trips.length} trip(s), but the pay statement does not identify it as a separate item.`);
    } else if (cmp(pmrPaid, pmrTotal) < 0) {
      addFinding(RULES.PMR_BELOW_MINIMUM, 'item_shortfall', sub(pmrTotal, pmrPaid), trips.map(i => i.tripId),
        `Positioning movement rate itemised at ${show(pmrPaid)} against ${show(pmrTotal)} owed for ${trips.length} trip(s).`);
    }
  }

  const computable = gaps.length === 0 && waitOwed !== null;
  let aggregate: Delta = NOT_COMPUTABLE;
  let segregated: Delta = NOT_COMPUTABLE;
  let strictPerTrip: Delta = trips.length === 0 ? { kind: 'not_applicable' } : NOT_COMPUTABLE;
  let range: DeltaRange = { kind: 'not_computable' };
  let buckets: PeriodResult['buckets'] = { base: NOT_COMPUTABLE, waitTime: NOT_COMPUTABLE, fuel: NOT_COMPUTABLE };
  let verdict: Verdict = 'insufficient_data';
  const periodDeltas = new Map<RuleId, ComputedDelta>();

  if (computable) {
    const base = computeDelta({ paidCents: basePaid, owed: baseOwed }, mode);
    const waitTime = computeDelta({ paidCents: waitPaid, owed: waitOwed }, mode);
    const fuel = computeDelta({ paidCents: fuelPaid, owed: fuelTotal }, mode);
    const all = [{ paidCents: basePaid, owed: baseOwed }, { paidCents: waitPaid, owed: waitOwed }, { paidCents: fuelPaid, owed: fuelTotal }];
    const agg = aggregateDelta(all, mode);
    const seg = segregatedDelta(all, mode);
    aggregate = agg;
    segregated = seg;
    buckets = { base, waitTime, fuel };
    range = { kind: 'computed', lowCents: Math.min(agg.cents, seg.cents), highCents: Math.max(agg.cents, seg.cents) };
    if (trips.length > 0) {
      strictPerTrip = { kind: 'computed', cents: 0 - roundFrac(strictShort, mode), exact: toExact(sub(ZERO, strictShort)), roundingOnly: isPositive(strictShort) && cmp(strictShort, ONE_CENT) < 0 };
    }
    verdict = isShortfall(agg) ? 'shortfall_aggregate' : isShortfall(seg) ? 'shortfall_segregated_only' : 'no_shortfall_detected';

    const periodFinding = (ruleId: RuleId, d: ComputedDelta, sentence: string): void => {
      periodDeltas.set(ruleId, d);
      if (d.cents >= 0) return;
      findings.push({
        ruleId, driverId: driver.driverId, payPeriodId: period.payPeriodId,
        nature: d.roundingOnly ? 'rounding_only' : 'period_shortfall',
        amountCents: -d.cents, amountExact: { num: d.exact.num.replace('-', ''), den: d.exact.den },   // exact is negative here
        recordIds: [period.payPeriodId],
        sentence: d.roundingOnly ? `${sentence} The difference is under one cent and arises from rounding only.` : sentence,
      });
    };
    periodFinding(RULES.BASE_SHORTFALL_SEGREGATED, base,
      `With wait time and fuel ring-fenced, base payments of ${formatCents(basePaid)} (after disallowed deductions) fall ${formatCents(-base.cents)} short of the ${show(baseOwed)} minimum for pay period ${period.payPeriodId}.`);
    periodFinding(RULES.WAIT_TIME_NOT_PASSED_THROUGH, waitTime,
      `The licensee received ${show(waitOwed)} in wait time remuneration and paid ${formatCents(waitPaid)} to the driver, ${formatCents(-waitTime.cents)} less than received.`);
    periodFinding(RULES.FUEL_SURCHARGE_BELOW_MINIMUM, fuel,
      `Fuel surcharge paid was ${formatCents(fuelPaid)} against ${show(fuelTotal)} owed on minimum compensation excluding the positioning movement rate, ${formatCents(-fuel.cents)} short.`);
    periodFinding(RULES.AGGREGATE_SHORTFALL, agg,
      `All credited payments less disallowed deductions fall ${formatCents(-agg.cents)} short of all amounts owed for pay period ${period.payPeriodId}.`);

    // Hourly components: straight time first, then the daily premium, then the weekly.
    if (hourly.length > 0) {
      const hourlyPaid = fromInt(paidOf(lines, 'hourly', 'overtime'));
      const entryIds = hourly.map(i => i.entryId);
      const straightShort = sub(straight, hourlyPaid);
      if (isPositive(straightShort)) {
        addFinding(RULES.HOURLY_BELOW_MINIMUM, 'item_shortfall', straightShort, entryIds,
          `Hourly payments of ${show(hourlyPaid)} fall ${show(straightShort)} short of ${show(straight)} owed at the regulated hourly rate before any overtime premium.`);
      }
      // Convention, not regulation: unpaid premium is attributed to daily overtime first, then weekly.
      const premiumShort = sub(hourlyTotal, maxFrac(hourlyPaid, straight));
      const dailyShort = minFrac(premiumShort, dailyPremium);
      const weeklyShort = sub(premiumShort, dailyShort);
      if (isPositive(dailyShort)) {
        addFinding(RULES.OVERTIME_DAILY_UNDERPAID, 'item_shortfall', dailyShort, entryIds,
          `Daily overtime premium of ${show(dailyPremium)} is owed for hours beyond the daily threshold; ${show(dailyShort)} of it is not covered by hourly and overtime payments. Unpaid premium is attributed to daily overtime first, then weekly, by engine convention.`);
      }
      if (isPositive(weeklyShort)) {
        addFinding(RULES.OVERTIME_WEEKLY_UNDERPAID, 'item_shortfall', weeklyShort, entryIds,
          `Weekly overtime premium of ${show(weeklyPremium)} is owed for hours beyond the weekly threshold; ${show(weeklyShort)} of it is not covered by hourly and overtime payments. Unpaid premium is attributed to daily overtime first, then weekly, by engine convention.`);
      }
    }

    // A callout floor is unmet only to the extent base pay is short.
    const baseShort = sub(baseOwed, fromInt(basePaid));
    const calloutShort = minFrac(topUpTotal, baseShort);
    if (isPositive(calloutShort)) {
      addFinding(RULES.CALLOUT_BELOW_MINIMUM, 'item_shortfall', calloutShort, callouts.filter(i => isPositive(i.topUp)).map(i => i.calloutId),
        `Callout minimums exceed pay for work in the availability windows by ${show(topUpTotal)}; ${show(calloutShort)} of that is not covered by base payments.`);
    }
  }

  // An item shortfall is informational when the period as a whole shows no shortfall.
  const reported: Finding[] = verdict !== 'no_shortfall_detected' ? findings : findings.map(f => (f.nature !== 'item_shortfall' ? f : {
    ...f, nature: 'informational', sentence: `${f.sentence} The pay period as a whole shows no shortfall; this item is listed for information.`,
  }));
  const recordsVerdict: RecordsVerdict = findings.some(f => f.nature === 'record_keeping') ? 'records_finding'
    : trips.length > 0 && !pmrEvaluated ? 'not_evaluated'
    : 'no_records_finding_detected';

  // A priced amount of zero on every trip means no positioning movement rate was in force.
  const pmrInForce = trips.some(i => i.pmr === null || isPositive(i.pmr));
  const evaluations = evaluate({ ctx, period, findings, computable, open, hourly, trips, callouts, pmrPriced, pmrInForce, fuelChecked, periodDeltas });
  return {
    result: {
      driverId: driver.driverId, payPeriodId: period.payPeriodId, verdict, recordsVerdict,
      aggregate, aggregateWithCarryover: NOT_COMPUTABLE, segregated, strictPerTrip, range, buckets,
      findings: reported, gaps, evaluations, scheduleIds: [...scheduleIds].sort(), statement: STATEMENTS[verdict],
    },
    ieoOffsetIoDriverIds: [...ieoOffsetIoDriverIds],
  };
}

interface EvaluationFacts {
  readonly ctx: DriverContext;
  readonly period: PayPeriod;
  readonly findings: readonly Finding[];
  readonly computable: boolean;
  readonly open: boolean;
  readonly hourly: readonly HourlyItem[];
  readonly trips: readonly TripItem[];
  readonly callouts: readonly CalloutItem[];
  readonly pmrPriced: boolean;
  readonly pmrInForce: boolean;
  readonly fuelChecked: boolean;
  readonly periodDeltas: ReadonlyMap<RuleId, ComputedDelta>;
}

// One status per rule. "Not evaluated" is never reported as passed.
function evaluate(f: EvaluationFacts): RuleEvaluation[] {
  const GAPPED = 'Data gaps prevent this comparison.';
  const fired = (ruleId: RuleId): boolean => f.findings.some(x => x.ruleId === ruleId && x.nature !== 'pending' && x.nature !== 'rounding_only');
  const status = (ruleId: RuleId, applicable: boolean, evaluated: boolean, blockedReason: string): RuleEvaluation => {
    if (fired(ruleId)) return { ruleId, status: 'triggered', reason: 'See findings.' };
    if (!applicable) return { ruleId, status: 'not_applicable', reason: 'No records of this kind in the pay period.' };
    if (!evaluated) return { ruleId, status: 'not_evaluated', reason: blockedReason };
    const roundingOnly = f.findings.some(x => x.ruleId === ruleId && x.nature === 'rounding_only');
    return { ruleId, status: 'not_triggered', reason: roundingOnly ? 'Difference under one cent; rounding only.' : 'Evaluated; no finding.' };
  };
  const overtimeEligible = f.hourly.some(i => i.driverClass !== 'IO_HOURLY');
  const tripsPriced = f.trips.every(i => i.base !== null);
  const flagged = f.ctx.driver.callouts.kind === 'flagged';
  const byRule: Readonly<Record<RuleId, () => RuleEvaluation>> = {
    HOURLY_BELOW_MINIMUM: () => status(RULES.HOURLY_BELOW_MINIMUM, f.hourly.length > 0, f.computable, GAPPED),
    OVERTIME_DAILY_UNDERPAID: () => status(RULES.OVERTIME_DAILY_UNDERPAID, overtimeEligible, f.computable, GAPPED),
    OVERTIME_WEEKLY_UNDERPAID: () => status(RULES.OVERTIME_WEEKLY_UNDERPAID, overtimeEligible, f.computable, GAPPED),
    CALLOUT_BELOW_MINIMUM: () => status(RULES.CALLOUT_BELOW_MINIMUM, true, flagged && f.computable, flagged ? GAPPED : 'Callout days were not flagged in the input.'),
    TRIP_RATE_BELOW_MINIMUM: () => status(RULES.TRIP_RATE_BELOW_MINIMUM, f.trips.length > 0, tripsPriced, 'One or more trips could not be priced.'),
    TRIP_NO_MATCHING_PAYMENT: () => status(RULES.TRIP_NO_MATCHING_PAYMENT, f.trips.length > 0, tripsPriced && !f.open, f.open ? 'The pay period is still open.' : 'One or more trips could not be priced.'),
    PMR_BELOW_MINIMUM: () => status(RULES.PMR_BELOW_MINIMUM, f.trips.length > 0 && f.pmrInForce, f.pmrPriced && !f.open, f.open ? 'The pay period is still open.' : 'The positioning movement rate could not be priced for every trip.'),
    PMR_NOT_ITEMISED: () => status(RULES.PMR_NOT_ITEMISED, f.trips.length > 0 && f.pmrInForce, f.pmrPriced && !f.open, f.open ? 'The pay period is still open.' : 'The positioning movement rate could not be priced for every trip.'),
    FUEL_SURCHARGE_BELOW_MINIMUM: () => status(RULES.FUEL_SURCHARGE_BELOW_MINIMUM, true, f.computable, GAPPED),
    FUEL_PUBLISHED_FORMULA_MISMATCH: () => status(RULES.FUEL_PUBLISHED_FORMULA_MISMATCH, true, f.fuelChecked, 'No published percentage was checked against the formula in this period.'),
    WAIT_TIME_NOT_PASSED_THROUGH: () => status(RULES.WAIT_TIME_NOT_PASSED_THROUGH, true, f.computable, GAPPED),
    DISALLOWED_DEDUCTION: () => status(RULES.DISALLOWED_DEDUCTION, f.period.deductions.length > 0, true, ''),
    BASE_SHORTFALL_SEGREGATED: () => status(RULES.BASE_SHORTFALL_SEGREGATED, true, f.computable, GAPPED),
    AGGREGATE_SHORTFALL: () => status(RULES.AGGREGATE_SHORTFALL, true, f.computable, GAPPED),
    IEO_OFFSET_APPLIED: () => ({ ruleId: RULES.IEO_OFFSET_APPLIED, status: 'not_evaluated' satisfies EvaluationStatus, reason: 'The indemnification offset is not implemented in this engine version.' }),
  };
  return RULE_IDS.map(id => byRule[id]());
}
