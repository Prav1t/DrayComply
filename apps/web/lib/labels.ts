// Plain-language names for what the engine reports. Wording only; no rule or value lives here.
import type { EvaluationStatus, RecordsVerdict, RuleId, Verdict } from '../../../packages/engine/src/index';

export const RULE_LABELS: Readonly<Record<RuleId, string>> = {
  HOURLY_BELOW_MINIMUM: 'Hourly pay at or above the regulated hourly rate',
  OVERTIME_DAILY_UNDERPAID: 'Overtime for hours beyond the daily limit',
  OVERTIME_WEEKLY_UNDERPAID: 'Overtime for hours beyond the weekly limit',
  CALLOUT_BELOW_MINIMUM: 'Callout minimum',
  TRIP_RATE_BELOW_MINIMUM: 'Each trip paid at or above the regulated trip rate',
  TRIP_NO_MATCHING_PAYMENT: 'Every trip has a payment',
  PMR_BELOW_MINIMUM: 'Positioning movement rate paid',
  PMR_NOT_ITEMISED: 'Positioning movement rate shown as its own line on the pay statement',
  FUEL_SURCHARGE_BELOW_MINIMUM: 'Fuel surcharge paid',
  FUEL_PUBLISHED_FORMULA_MISMATCH: 'Published fuel percentage agrees with the formula',
  WAIT_TIME_NOT_PASSED_THROUGH: 'All wait time money received was passed to the driver',
  DISALLOWED_DEDUCTION: 'No deduction the policy disallows',
  BASE_SHORTFALL_SEGREGATED: 'Base pay meets the minimum on its own (segregated comparison)',
  AGGREGATE_SHORTFALL: 'Total pay meets the total owed (aggregate comparison)',
  IEO_OFFSET_APPLIED: 'IEO indemnification offset',
};

export const STATUS_LABELS: Readonly<Record<EvaluationStatus, string>> = {
  triggered: 'Problem found',
  not_triggered: 'Checked, no problem found',
  not_evaluated: 'Could not be checked',
  not_applicable: 'Does not apply',
};

// The first line is the only wording used for a clean result. It never says more than this.
export const VERDICT_LABELS: Readonly<Record<Verdict, string>> = {
  no_shortfall_detected: 'No shortfall detected under the rules as encoded, for the data provided.',
  shortfall_aggregate: 'Shortfall: total pay is below the total owed.',
  shortfall_segregated_only: 'Shortfall on the segregated comparison only: total pay covers the total owed, but base pay, wait time or fuel is short on its own.',
  insufficient_data: 'Insufficient data: something needed for the calculation is missing, so no result is given.',
};

export const RECORDS_LABELS: Readonly<Record<RecordsVerdict, string>> = {
  no_records_finding_detected: 'No pay statement finding detected.',
  records_finding: 'Pay statement finding: something that must be shown on the statement is not.',
  not_evaluated: 'Pay statement not checked.',
};

export const verdictClass = (v: Verdict): string => (v === 'no_shortfall_detected' ? 'ok' : v === 'insufficient_data' ? 'warn' : 'bad');
