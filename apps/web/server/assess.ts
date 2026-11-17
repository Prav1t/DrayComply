// Checking a data set and running an assessment. The app only orchestrates: packages/ingest reads the files,
// packages/engine calculates, packages/report summarises. Nothing here computes pay.
import { and, desc, eq } from 'drizzle-orm';
import { datasets, runResults, runs, uploads } from '../../../packages/db/src/index';
import { parseComplianceInput, restrictPeriods, runCompliance, ENGINE_VERSION, type ComplianceInput, type PeriodSelection, type RoundingMode, type RunResult } from '../../../packages/engine/src/index';
import { DEDUCTION_POLICY, OBCCTC_SCHEDULES } from '../../../packages/engine/src/adapters/obcctc';
import { ingest, type IngestResult, type SourceFile } from '../../../packages/ingest/src/index';
import { LEGAL_INTERPRETATIONS } from '../../../packages/rates/legal-interpretations';
import { buildBinder, pendingLegalReview, type AuditBinder, type BinderSummary } from '../../../packages/report/src/index';
import { audit } from './audit';
import { requireRole, type Ctx } from './context';
import { canonicalJson, sha256Hex } from './crypto';
import { loadDatasetFiles } from './datasets';
import { db } from './db';
import { loadRoster } from './drivers';
import { invalid, notFound } from './errors';
import { ROSTER_TABLES, rosterFiles } from './roster';
import { getTemplate } from './templates';

type CompletedRun = Extract<RunResult, { kind: 'completed' }>;
type CompletedIngest = Extract<IngestResult, { kind: 'completed' }>;
export type StoredIngest = Omit<CompletedIngest, 'input'>;

// The app passes half-up, as decided for v1. It is stored on every run because the engine has no default.
export const APP_ROUNDING: RoundingMode = 'half_up';

export type DriverSelection = { readonly kind: 'all' } | { readonly kind: 'only'; readonly driverIds: readonly string[] };

export type StoredOutcome =
  | { readonly kind: 'stopped'; readonly stage: 'template' | 'files' | 'input'; readonly errors: readonly string[] }
  | { readonly kind: 'completed'; readonly run: CompletedRun; readonly extraScope: readonly string[] };

export interface InputFile { readonly uploadId: string; readonly name: string; readonly sha256: string; readonly kind: 'source' | 'roster_snapshot' }

export interface RunSummary {
  readonly status: 'completed' | 'stopped';
  readonly binder: BinderSummary | null;
  readonly driversWithoutClass: number;
}

interface Composed {
  readonly files: readonly SourceFile[];
  readonly template: unknown;
  readonly templateRowId: string;
  readonly sources: readonly { readonly uploadId: string; readonly name: string; readonly sha256: string }[];
  readonly roster: readonly SourceFile[];
  readonly withoutClass: readonly string[];
}

async function compose(ctx: Ctx, datasetId: string, templateId: string): Promise<Composed> {
  const [dataset] = await db().select({ id: datasets.id }).from(datasets).where(and(eq(datasets.organizationId, ctx.organizationId), eq(datasets.id, datasetId)));
  if (dataset === undefined) throw notFound();
  const stored = await getTemplate(ctx, templateId);
  if (stored.purpose !== 'records') throw invalid('Choose a records template, not a driver import template.');
  const sources = await loadDatasetFiles(ctx, datasetId);
  const roster = rosterFiles(await loadRoster(db(), ctx));
  return {
    files: [...sources, ...roster.files],
    // The driver tables always come from the roster snapshot, whatever the saved template says.
    template: { ...stored.template, tables: { ...stored.template.tables, ...ROSTER_TABLES } },
    templateRowId: stored.id,
    sources: sources.map(s => ({ uploadId: s.uploadId, name: s.name, sha256: s.sha256 })),
    roster: roster.files, withoutClass: roster.withoutClass,
  };
}

export type CheckResult =
  | { readonly kind: 'stopped'; readonly stage: 'template' | 'files'; readonly errors: readonly string[] }
  | {
      readonly kind: 'read';
      readonly ingest: StoredIngest;
      readonly drivers: readonly { readonly driverId: string; readonly payPeriods: readonly { readonly payPeriodId: string; readonly from: string; readonly to: string }[] }[];
      readonly driversWithoutClass: readonly string[];
    };

const withoutInput = (i: CompletedIngest): StoredIngest => ({
  kind: i.kind, rejects: i.rejects, withheldDrivers: i.withheldDrivers, unattributedRejects: i.unattributedRejects, manifest: i.manifest, templateId: i.templateId, statement: i.statement,
});

// Reads the data set through the template and reports every rejected row. Nothing is stored and nothing is calculated.
export async function checkDataset(ctx: Ctx, datasetId: string, templateId: string): Promise<CheckResult> {
  const c = await compose(ctx, datasetId, templateId);
  const result = ingest(c.files, c.template, ctx.organizationId);
  if (result.kind === 'template_invalid') return { kind: 'stopped', stage: 'template', errors: result.errors };
  if (result.kind === 'file_invalid') return { kind: 'stopped', stage: 'files', errors: result.errors };
  return {
    kind: 'read', ingest: withoutInput(result), driversWithoutClass: c.withoutClass,
    drivers: result.input.drivers.map(d => ({ driverId: d.driverId, payPeriods: d.payPeriods.map(p => ({ payPeriodId: p.payPeriodId, from: p.from, to: p.to })) })),
  };
}

export interface RunRequest {
  readonly datasetId: string;
  readonly templateId: string;
  readonly asOf: string;
  readonly periods: PeriodSelection;
  readonly drivers: DriverSelection;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkRequest(ctx: Ctx, r: RunRequest): void {
  const dates = [r.asOf, ...(r.periods.kind === 'range' ? [r.periods.from, r.periods.to] : [])];
  if (dates.some(d => !ISO_DATE.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)))) throw invalid('Dates must be valid, in the form YYYY-MM-DD.');
  // One day of slack covers a browser whose local date is ahead of the server's.
  if (r.asOf > new Date(ctx.now.getTime() + 86_400_000).toISOString().slice(0, 10)) throw invalid('The run date cannot be in the future.');
  if (r.periods.kind === 'range' && r.periods.to < r.periods.from) throw invalid('The period range ends before it starts.');
  if (r.drivers.kind === 'only' && r.drivers.driverIds.length === 0) throw invalid('Choose at least one driver, or all drivers.');
}

function calculate(ingested: CompletedIngest, request: RunRequest, withoutClass: readonly string[]): { outcome: StoredOutcome; input: ComplianceInput } {
  const all = ingested.input.drivers;
  const chosen = request.drivers.kind === 'all' ? all : all.filter(d => request.drivers.kind === 'only' && request.drivers.driverIds.includes(d.driverId));
  const input: ComplianceInput = { ...ingested.input, drivers: chosen };
  const result = runCompliance(input, OBCCTC_SCHEDULES, { asOf: request.asOf, rounding: APP_ROUNDING, deductionPolicy: DEDUCTION_POLICY });
  if (result.kind === 'invalid_input') return { outcome: { kind: 'stopped', stage: 'input', errors: result.errors }, input };
  const extraScope: string[] = [];
  if (request.drivers.kind === 'only') {
    const missing = request.drivers.driverIds.filter(id => !all.some(d => d.driverId === id));
    extraScope.push(`This run was limited to ${request.drivers.driverIds.length} selected driver(s). ${all.length - chosen.length} other driver(s) in the data were not calculated.`);
    if (missing.length > 0) extraScope.push(`${missing.length} selected driver(s) had no usable records in the data and are not in this result: ${missing.join(', ')}.`);
  }
  if (withoutClass.length > 0) extraScope.push(`${withoutClass.length} driver(s) on the roster have no class period and were left out of the roster snapshot: ${withoutClass.join(', ')}. Records for them were rejected.`);
  return { outcome: { kind: 'completed', run: restrictPeriods(result, input, request.periods), extraScope }, input };
}

const binderMeta = (licenseeName: string, generatedAt: string, extraScope: readonly string[]) =>
  ({ licenseeName, generatedAt, preparedBy: 'DrayComply', interpretations: LEGAL_INTERPRETATIONS, extraScope });

// Stores the inputs, the options and the result in one transaction. A run is never updated: running again makes a new run.
export async function createRun(ctx: Ctx, request: RunRequest): Promise<{ id: string; status: 'completed' | 'stopped' }> {
  requireRole(ctx, 'payroll');
  checkRequest(ctx, request);
  const c = await compose(ctx, request.datasetId, request.templateId);
  const ingested = ingest(c.files, c.template, ctx.organizationId);
  const stoppedEarly: StoredOutcome | null = ingested.kind === 'template_invalid' ? { kind: 'stopped', stage: 'template', errors: ingested.errors }
    : ingested.kind === 'file_invalid' ? { kind: 'stopped', stage: 'files', errors: ingested.errors } : null;
  const calculated = ingested.kind === 'completed' ? calculate(ingested, request, c.withoutClass) : null;
  const outcome: StoredOutcome | null = stoppedEarly ?? calculated?.outcome ?? null;
  if (outcome === null) throw new Error('run produced no outcome');
  const completed = outcome.kind === 'completed' && ingested.kind === 'completed' ? { run: outcome.run, ingested } : null;
  const binder = completed === null || calculated === null ? null
    : buildBinder(completed.run, { ...completed.ingested, input: calculated.input }, binderMeta('', ctx.now.toISOString(), outcome.kind === 'completed' ? outcome.extraScope : []));
  const summary: RunSummary = { status: outcome.kind, binder: binder?.summary ?? null, driversWithoutClass: c.withoutClass.length };

  return db().transaction(async tx => {
    const inputFiles: InputFile[] = c.sources.map(s => ({ ...s, kind: 'source' }));
    for (const f of c.roster) {
      const sha256 = sha256Hex(f.bytes);
      const [row] = await tx.insert(uploads).values({ organizationId: ctx.organizationId, kind: 'roster_snapshot', name: f.name, format: 'csv', sha256, sizeBytes: f.bytes.length, content: Buffer.from(f.bytes), uploadedBy: ctx.userId }).returning({ id: uploads.id });
      if (row === undefined) throw new Error('roster snapshot insert returned nothing');
      inputFiles.push({ uploadId: row.id, name: f.name, sha256, kind: 'roster_snapshot' });
    }
    const [run] = await tx.insert(runs).values({
      organizationId: ctx.organizationId, datasetId: request.datasetId, templateId: c.templateRowId, createdBy: ctx.userId, createdAt: ctx.now.toISOString(),
      status: outcome.kind, asOf: request.asOf, rounding: APP_ROUNDING, periodSelection: request.periods, driverSelection: request.drivers,
      engineVersion: ENGINE_VERSION, deductionPolicyId: DEDUCTION_POLICY.id,
      scheduleIds: completed?.run.provenance.scheduleIds ?? [],
      unverifiedSchedulesUsed: completed?.run.provenance.unverifiedSchedulesUsed ?? false,
      pendingInterpretationIds: completed === null ? [] : pendingLegalReview(completed.run, LEGAL_INTERPRETATIONS).map(i => i.id),
      inputFiles, summary,
    }).returning({ id: runs.id });
    if (run === undefined) throw new Error('run insert returned nothing');
    await tx.insert(runResults).values({
      runId: run.id, organizationId: ctx.organizationId,
      engineInput: calculated?.input ?? null,
      ingest: ingested.kind === 'completed' ? withoutInput(ingested) : { kind: ingested.kind },
      result: outcome, resultSha256: sha256Hex(canonicalJson(outcome)),
    });
    await audit(tx, ctx, 'run.created', 'run', run.id, { status: outcome.kind, engineVersion: ENGINE_VERSION, datasetId: request.datasetId });
    return { id: run.id, status: outcome.kind };
  });
}

const RUN_LIST = {
  id: runs.id, createdAt: runs.createdAt, status: runs.status, asOf: runs.asOf, datasetId: runs.datasetId, datasetName: datasets.name, engineVersion: runs.engineVersion,
  unverifiedSchedulesUsed: runs.unverifiedSchedulesUsed, pendingInterpretationIds: runs.pendingInterpretationIds, summary: runs.summary, periodSelection: runs.periodSelection,
};

export async function listRuns(ctx: Ctx) {
  return db().select(RUN_LIST).from(runs)
    .innerJoin(datasets, and(eq(datasets.organizationId, runs.organizationId), eq(datasets.id, runs.datasetId)))
    .where(eq(runs.organizationId, ctx.organizationId)).orderBy(desc(runs.createdAt));
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

// The stored outcome was hashed when it was written. A row whose hash no longer matches is refused, never shown.
function decodeOutcome(value: unknown, expectedSha256: string): StoredOutcome {
  if (sha256Hex(canonicalJson(value)) !== expectedSha256) throw new Error('stored run result does not match its recorded hash');
  if (isStoredOutcome(value)) return value;
  throw new Error('stored run result has an unknown shape');
}
function isStoredOutcome(v: unknown): v is StoredOutcome {
  if (!isObject(v)) return false;
  if (v['kind'] === 'stopped') return Array.isArray(v['errors']) && typeof v['stage'] === 'string';
  const run = v['run'];
  return v['kind'] === 'completed' && Array.isArray(v['extraScope']) && isObject(run) && run['kind'] === 'completed' && Array.isArray(run['drivers']) && isObject(run['provenance']);
}
function isStoredIngest(v: unknown): v is StoredIngest {
  return isObject(v) && v['kind'] === 'completed' && Array.isArray(v['rejects']) && Array.isArray(v['manifest']) && Array.isArray(v['withheldDrivers']) && typeof v['statement'] === 'string';
}

export interface LoadedRun {
  readonly id: string;
  readonly createdAt: string;
  readonly asOf: string;
  readonly rounding: string;
  readonly engineVersion: string;
  readonly datasetId: string;
  readonly templateId: string;
  readonly periodSelection: unknown;
  readonly driverSelection: unknown;
  readonly inputFiles: unknown;
  readonly resultSha256: string;
  readonly outcome: StoredOutcome;
  readonly ingest: StoredIngest | null;
  readonly input: ComplianceInput | null;
}

export async function getRun(ctx: Ctx, runId: string): Promise<LoadedRun> {
  const [row] = await db().select().from(runs)
    .innerJoin(runResults, and(eq(runResults.organizationId, runs.organizationId), eq(runResults.runId, runs.id)))
    .where(and(eq(runs.organizationId, ctx.organizationId), eq(runs.id, runId)));
  if (row === undefined) throw notFound();
  const parsedInput = row.run_results.engineInput === null ? null : parseComplianceInput(row.run_results.engineInput);
  if (parsedInput !== null && parsedInput.kind !== 'ok') throw new Error('stored engine input no longer parses');
  return {
    id: row.runs.id, createdAt: row.runs.createdAt, asOf: row.runs.asOf, rounding: row.runs.rounding, engineVersion: row.runs.engineVersion,
    datasetId: row.runs.datasetId, templateId: row.runs.templateId, periodSelection: row.runs.periodSelection, driverSelection: row.runs.driverSelection,
    inputFiles: row.runs.inputFiles, resultSha256: row.run_results.resultSha256,
    outcome: decodeOutcome(row.run_results.result, row.run_results.resultSha256),
    ingest: isStoredIngest(row.run_results.ingest) ? row.run_results.ingest : null,
    input: parsedInput === null ? null : parsedInput.value,
  };
}

// The binder for a completed run, rebuilt from what was stored. The same stored run always gives the same binder.
export function binderFor(run: LoadedRun, licenseeName: string, generatedAt: string): AuditBinder | null {
  if (run.outcome.kind !== 'completed' || run.ingest === null || run.input === null) return null;
  return buildBinder(run.outcome.run, { ...run.ingest, input: run.input }, binderMeta(licenseeName, generatedAt, run.outcome.extraScope));
}

export interface Recomputation {
  readonly matches: boolean;
  readonly storedEngineVersion: string;
  readonly currentEngineVersion: string;
  readonly storedSha256: string;
  readonly recomputedSha256: string;
}

const isPeriodSelection = (v: unknown): v is PeriodSelection =>
  isObject(v) && (v['kind'] === 'all' || (v['kind'] === 'range' && typeof v['from'] === 'string' && typeof v['to'] === 'string'));

// Runs the stored input through the engine as it is now and compares the result with what was stored. Changes nothing.
export async function recompute(ctx: Ctx, runId: string): Promise<Recomputation> {
  const run = await getRun(ctx, runId);
  if (run.outcome.kind !== 'completed' || run.input === null) throw invalid('This run stopped before the calculation, so there is nothing to recompute.');
  if (!isPeriodSelection(run.periodSelection)) throw new Error('stored period selection has an unknown shape');
  const rounding = (['half_up', 'half_even', 'down', 'up'] as const).find(m => m === run.rounding);
  if (rounding === undefined) throw new Error('stored rounding mode is unknown');
  const again = runCompliance(run.input, OBCCTC_SCHEDULES, { asOf: run.asOf, rounding, deductionPolicy: DEDUCTION_POLICY });
  const recomputed = again.kind === 'completed' ? restrictPeriods(again, run.input, run.periodSelection) : again;
  const storedSha256 = sha256Hex(canonicalJson(run.outcome.run));
  const recomputedSha256 = sha256Hex(canonicalJson(recomputed));
  return { matches: storedSha256 === recomputedSha256, storedEngineVersion: run.engineVersion, currentEngineVersion: ENGINE_VERSION, storedSha256, recomputedSha256 };
}
