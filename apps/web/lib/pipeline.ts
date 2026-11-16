// Files and a template in; ingest result, engine run and audit binder out. Pure: the caller supplies every date.
import { ingest, type IngestResult, type SourceFile } from '../../../packages/ingest/src/index';
import { runCompliance, type RoundingMode, type RunResult } from '../../../packages/engine/src/index';
import { DEDUCTION_POLICY, OBCCTC_SCHEDULES } from '../../../packages/engine/src/adapters/obcctc';
import { buildBinder, type AuditBinder } from '../../../packages/report/src/index';

export interface PipelineOptions {
  readonly licenseeId: string;
  readonly licenseeName: string;
  readonly asOf: string;          // run date, YYYY-MM-DD
  readonly rounding: RoundingMode;
  readonly generatedAt: string;   // ISO timestamp for the binder
}

export type PipelineResult =
  | { readonly kind: 'stopped'; readonly stage: 'template' | 'files' | 'input'; readonly errors: readonly string[] }
  | {
      readonly kind: 'completed';
      readonly ingested: Extract<IngestResult, { kind: 'completed' }>;
      readonly run: Extract<RunResult, { kind: 'completed' }>;
      readonly binder: AuditBinder;
    };

export function runPipeline(files: readonly SourceFile[], template: unknown, options: PipelineOptions): PipelineResult {
  const ingested = ingest(files, template, options.licenseeId);
  if (ingested.kind === 'template_invalid') return { kind: 'stopped', stage: 'template', errors: ingested.errors };
  if (ingested.kind === 'file_invalid') return { kind: 'stopped', stage: 'files', errors: ingested.errors };
  const run = runCompliance(ingested.input, OBCCTC_SCHEDULES, { asOf: options.asOf, rounding: options.rounding, deductionPolicy: DEDUCTION_POLICY });
  if (run.kind === 'invalid_input') return { kind: 'stopped', stage: 'input', errors: run.errors };
  const binder = buildBinder(run, ingested, { licenseeName: options.licenseeName, generatedAt: options.generatedAt, preparedBy: 'DrayComply' });
  return { kind: 'completed', ingested, run, binder };
}
