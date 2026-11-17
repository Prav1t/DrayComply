// The audit binder as plain data. Everything a reader needs is here; the PDF only lays it out.
import type { Delta, DriverResult, Finding, Gap, PeriodResult, RecordsVerdict, RuleEvaluation, RunResult, ScopeNote, Verdict } from '../../engine/src/index';
import type { IngestResult, ManifestEntry, Reject } from '../../ingest/src/index';
import { pendingLegalReview, type LegalInterpretation } from './interpretations';

type CompletedRun = Extract<RunResult, { kind: 'completed' }>;
type CompletedIngest = Extract<IngestResult, { kind: 'completed' }>;

// generatedAt is supplied by the caller. The report layer reads no clock.
export interface BinderMeta {
  readonly licenseeName: string;
  readonly generatedAt: string;
  readonly preparedBy: string;
  readonly interpretations: readonly LegalInterpretation[];   // the registry; the binder lists those this run relied on
  readonly extraScope: readonly string[];                     // limits the caller applied, such as a driver selection
}

export interface BinderHeader {
  readonly title: string;
  readonly licenseeName: string;
  readonly licenseeId: string;
  readonly generatedAt: string;
  readonly preparedBy: string;
  readonly engineVersion: string;
  readonly asOf: string;
  readonly rounding: string;
  readonly deductionPolicyId: string;
  readonly unverifiedRatesNotice: string | null;   // non-null whenever an unverified schedule priced anything
  readonly watermark: string | null;               // painted across every page; non-null on the same condition
  readonly legalReviewNotice: string | null;       // non-null whenever the run relied on an unreviewed interpretation
  readonly disclaimer: string;
}

export interface BinderSummary {
  readonly driversEvaluated: number;
  readonly driversWithheld: number;
  readonly byVerdict: Readonly<Record<Verdict, number>>;
  readonly byRecordsVerdict: Readonly<Record<RecordsVerdict, number>>;
  readonly aggregateShortfallCents: number;    // sum of the period shortfalls on the aggregate comparison
  readonly segregatedShortfallCents: number;   // the same on the segregated comparison
  readonly periodsTotal: number;
  readonly periodsNotComputable: number;
  readonly findingCount: number;
  readonly gapCount: number;
  readonly rejectedRows: number;
  readonly unattributedRejects: number;
}

export interface WorksheetPeriod {
  readonly payPeriodId: string;
  readonly verdict: Verdict;
  readonly recordsVerdict: RecordsVerdict;
  readonly statement: string;
  readonly figures: readonly { readonly label: string; readonly value: string }[];
  readonly findings: readonly Finding[];
  readonly gaps: readonly Gap[];
  readonly evaluations: readonly RuleEvaluation[];
}

export interface Worksheet {
  readonly driverId: string;
  readonly verdict: Verdict;
  readonly recordsVerdict: RecordsVerdict;
  readonly scope: readonly ScopeNote[];
  readonly gaps: readonly Gap[];
  readonly periods: readonly WorksheetPeriod[];
}

export interface AuditBinder {
  readonly header: BinderHeader;
  readonly summary: BinderSummary;
  readonly scope: readonly string[];
  readonly pendingLegalReview: readonly LegalInterpretation[];
  readonly schedules: readonly { readonly id: string; readonly status: string; readonly verifiedBy: string | null }[];
  readonly manifest: readonly ManifestEntry[];
  readonly inputSources: readonly { readonly name: string; readonly digest: string }[];
  readonly findings: readonly Finding[];
  readonly gaps: readonly Gap[];
  readonly rejects: readonly Reject[];
  readonly withheldDrivers: readonly { readonly driverId: string; readonly rejectedRows: number }[];
  readonly worksheets: readonly Worksheet[];
}

export const WATERMARK = 'UNVERIFIED RATES - NOT FOR RELIANCE';
export const NO_SHORTFALL_WORDING = 'No shortfall detected under the rules as encoded, for the data provided.';
export const DISCLAIMER = 'This binder reports calculations under the rules as encoded, for the data provided. It is not legal advice and is not a statement that any person has or has not met a legal obligation.';

// Integer cents to text. String work only.
export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${cents < 0 ? '-' : ''}$${whole}.${(abs % 100).toString().padStart(2, '0')}`;
}

export function formatDelta(d: Delta): string {
  if (d.kind === 'not_computable') return 'not computable (see gaps)';
  if (d.kind === 'not_applicable') return 'not applicable';
  const side = d.cents < 0 ? 'short' : d.cents > 0 ? 'over' : 'level';
  return `${formatCents(d.cents)} (${side}${d.roundingOnly ? '; rounding only' : ''})`;
}

const VERDICT_TEXT: Readonly<Record<Verdict, string>> = {
  no_shortfall_detected: 'No shortfall detected',
  shortfall_aggregate: 'Shortfall on the aggregate comparison',
  shortfall_segregated_only: 'Shortfall on the segregated comparison only',
  insufficient_data: 'Insufficient data',
};
const RECORDS_TEXT: Readonly<Record<RecordsVerdict, string>> = {
  no_records_finding_detected: 'No records finding detected',
  records_finding: 'Records finding',
  not_evaluated: 'Records not evaluated',
};
export const verdictText = (v: Verdict): string => VERDICT_TEXT[v];
export const recordsText = (v: RecordsVerdict): string => RECORDS_TEXT[v];

const shortfall = (d: Delta): number => (d.kind === 'computed' && d.cents < 0 && !d.roundingOnly ? -d.cents : 0);

function period(p: PeriodResult): WorksheetPeriod {
  return {
    payPeriodId: p.payPeriodId, verdict: p.verdict, recordsVerdict: p.recordsVerdict, statement: p.statement,
    // Both comparisons are always shown side by side. Neither is labelled as the answer.
    figures: [
      { label: 'Aggregate comparison', value: formatDelta(p.aggregate) },
      { label: 'Segregated comparison', value: formatDelta(p.segregated) },
      { label: 'Base bucket', value: formatDelta(p.buckets.base) },
      { label: 'Wait time bucket', value: formatDelta(p.buckets.waitTime) },
      { label: 'Fuel bucket', value: formatDelta(p.buckets.fuel) },
      { label: 'Strict per-trip (third figure)', value: formatDelta(p.strictPerTrip) },
      { label: 'Aggregate with earlier surplus carried forward (second figure)', value: formatDelta(p.aggregateWithCarryover) },
    ],
    findings: p.findings, gaps: p.gaps, evaluations: p.evaluations,
  };
}

const worksheet = (d: DriverResult): Worksheet =>
  ({ driverId: d.driverId, verdict: d.verdict, recordsVerdict: d.recordsVerdict, scope: d.scope, gaps: d.gaps, periods: d.periods.map(period) });

// Pure: the same run, ingest result and meta always give the same binder.
export function buildBinder(run: CompletedRun, ingested: CompletedIngest | null, meta: BinderMeta): AuditBinder {
  const periods = run.drivers.flatMap(d => d.periods);
  const unverified = run.provenance.schedules.filter(s => s.status !== 'verified').map(s => s.id);
  const rejects = ingested?.rejects ?? [];
  const pending = pendingLegalReview(run, meta.interpretations);
  const verdicts = (v: Verdict): number => run.drivers.filter(d => d.verdict === v).length;
  const records = (v: RecordsVerdict): number => run.drivers.filter(d => d.recordsVerdict === v).length;
  return {
    header: {
      title: 'Driver Remuneration Calculation Binder',
      licenseeName: meta.licenseeName, licenseeId: run.provenance.licenseeId, generatedAt: meta.generatedAt, preparedBy: meta.preparedBy,
      engineVersion: run.provenance.engineVersion, asOf: run.provenance.asOf, rounding: run.provenance.rounding, deductionPolicyId: run.provenance.deductionPolicyId,
      unverifiedRatesNotice: unverified.length === 0 ? null
        : `UNVERIFIED RATES WERE USED. These schedules are transcriptions that no second person has checked against the source: ${unverified.join(', ')}. Figures that rest on them may be wrong.`,
      watermark: unverified.length === 0 ? null : WATERMARK,
      legalReviewNotice: pending.length === 0 ? null
        : `PENDING LEGAL REVIEW. This calculation relies on ${pending.length} legal interpretation(s) that no lawyer has reviewed: ${pending.map(i => i.id).join(', ')}. They are listed in section 8.`,
      disclaimer: DISCLAIMER,
    },
    summary: {
      driversEvaluated: run.drivers.length,
      driversWithheld: ingested?.withheldDrivers.length ?? 0,
      byVerdict: {
        no_shortfall_detected: verdicts('no_shortfall_detected'), shortfall_aggregate: verdicts('shortfall_aggregate'),
        shortfall_segregated_only: verdicts('shortfall_segregated_only'), insufficient_data: verdicts('insufficient_data'),
      },
      byRecordsVerdict: {
        no_records_finding_detected: records('no_records_finding_detected'), records_finding: records('records_finding'), not_evaluated: records('not_evaluated'),
      },
      aggregateShortfallCents: periods.reduce((t, p) => t + shortfall(p.aggregate), 0),
      segregatedShortfallCents: periods.reduce((t, p) => t + shortfall(p.segregated), 0),
      periodsTotal: periods.length,
      periodsNotComputable: periods.filter(p => p.aggregate.kind !== 'computed').length,
      findingCount: periods.reduce((t, p) => t + p.findings.length, 0),
      gapCount: periods.reduce((t, p) => t + p.gaps.length, 0) + run.drivers.reduce((t, d) => t + d.gaps.length, 0),
      rejectedRows: new Set(rejects.map(x => `${x.table}|${x.file}|${x.rowNumber}`)).size,
      unattributedRejects: ingested?.unattributedRejects ?? 0,
    },
    pendingLegalReview: pending,
    scope: [
      ...run.scope.map(n => n.sentence),
      ...meta.extraScope,
      ...(ingested === null ? ['The input was supplied directly, not through file ingest, so no file manifest or reject list exists for it.'] : [ingested.statement]),
      ...(ingested !== null && ingested.withheldDrivers.length > 0
        ? [`${ingested.withheldDrivers.length} driver(s) were withheld from the calculation because rows in their records were rejected. No figure in this binder covers them.`] : []),
      ...(ingested !== null && ingested.unattributedRejects > 0
        ? [`${ingested.unattributedRejects} rejected row(s) could not be tied to a known driver. They may belong to any driver, so every result here may be missing records.`] : []),
    ],
    schedules: run.provenance.schedules,
    manifest: ingested?.manifest ?? [],
    inputSources: run.provenance.input.sources,
    findings: periods.flatMap(p => p.findings),
    gaps: [...run.drivers.flatMap(d => d.gaps), ...periods.flatMap(p => p.gaps)],
    rejects,
    withheldDrivers: ingested?.withheldDrivers ?? [],
    worksheets: run.drivers.map(worksheet),
  };
}
