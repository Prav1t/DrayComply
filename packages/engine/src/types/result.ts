import type { Cents, IsoDate, RoundingMode } from './primitives';
import type { InputProvenance } from './input';
import type { GapCode, RuleId, ScopeCode } from '../rules/catalogue';
import type { ScheduleStatus } from './schedule';

export type Verdict =
  | 'no_shortfall_detected'
  | 'shortfall_aggregate'
  | 'shortfall_segregated_only'
  | 'insufficient_data';

// Exact fractional cents as a reduced fraction; strings so JSON keeps every digit.
export interface ExactCents { readonly num: string; readonly den: string }

// cents is paid minus rounded owed; negative means short.
export type Delta =
  | { readonly kind: 'computed'; readonly cents: Cents; readonly exact: ExactCents; readonly roundingOnly: boolean }
  | { readonly kind: 'not_computable' }
  | { readonly kind: 'not_applicable' };

export type FindingNature =
  | 'period_shortfall'   // drives the verdict
  | 'item_shortfall'     // listed beside the period comparison, never netted
  | 'informational'      // an item shortfall in a period that shows no shortfall overall
  | 'prohibited_deduction'
  | 'rounding_only'      // under one cent in exact terms; not an underpayment
  | 'record_keeping'
  | 'pending'            // pay period still open
  | 'validation';

export interface Finding {
  readonly ruleId: RuleId;
  readonly driverId: string;
  readonly payPeriodId: string;
  readonly nature: FindingNature;
  readonly amountCents: Cents;
  readonly amountExact: ExactCents;
  readonly recordIds: readonly string[];
  readonly sentence: string;
}

export interface Gap {
  readonly code: GapCode;
  readonly driverId: string;
  readonly payPeriodId: string | null;
  readonly recordIds: readonly string[];
  readonly detail: string;
}

export type EvaluationStatus = 'triggered' | 'not_triggered' | 'not_evaluated' | 'not_applicable';

export interface RuleEvaluation {
  readonly ruleId: RuleId;
  readonly status: EvaluationStatus;
  readonly reason: string;
}

// Separate from the payment verdict: what the pay statement must show, not what was paid.
export type RecordsVerdict = 'no_records_finding_detected' | 'records_finding' | 'not_evaluated';

export interface ScopeNote { readonly code: ScopeCode; readonly sentence: string }

export type DeltaRange =
  | { readonly kind: 'computed'; readonly lowCents: Cents; readonly highCents: Cents }
  | { readonly kind: 'not_computable' };

export interface PeriodResult {
  readonly driverId: string;
  readonly payPeriodId: string;
  readonly verdict: Verdict;
  readonly recordsVerdict: RecordsVerdict;
  readonly aggregate: Delta;
  readonly aggregateWithCarryover: Delta;   // second figure: earlier surpluses carried forward
  readonly segregated: Delta;               // sum of the bucket shortfalls
  readonly strictPerTrip: Delta;
  readonly range: DeltaRange;
  readonly buckets: { readonly base: Delta; readonly waitTime: Delta; readonly fuel: Delta };
  readonly findings: readonly Finding[];
  readonly gaps: readonly Gap[];
  readonly evaluations: readonly RuleEvaluation[];
  readonly scheduleIds: readonly string[];
  readonly statement: string;
}

export interface DriverResult {
  readonly driverId: string;
  readonly verdict: Verdict;
  readonly recordsVerdict: RecordsVerdict;
  readonly periods: readonly PeriodResult[];
  readonly gaps: readonly Gap[];   // gaps not tied to one pay period
  readonly scope: readonly ScopeNote[];
}

export interface Provenance {
  readonly engineVersion: string;
  readonly scheduleIds: readonly string[];
  readonly schedules: readonly { readonly id: string; readonly status: ScheduleStatus; readonly verifiedBy: string | null }[];
  readonly unverifiedSchedulesUsed: boolean;
  readonly rounding: RoundingMode;
  readonly asOf: IsoDate;
  readonly deductionPolicyId: string;
  readonly licenseeId: string;
  readonly input: InputProvenance;
}

export type RunResult =
  | { readonly kind: 'invalid_input'; readonly errors: readonly string[] }
  | { readonly kind: 'completed'; readonly provenance: Provenance; readonly scope: readonly ScopeNote[]; readonly drivers: readonly DriverResult[] };
