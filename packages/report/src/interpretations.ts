// Which unreviewed legal interpretations a run relied on. The registry is data supplied by the caller.
import type { RunResult } from '../../engine/src/index';

export type InterpretationTrigger =
  | { readonly kind: 'always' }
  | { readonly kind: 'scope'; readonly codes: readonly string[] }
  | { readonly kind: 'rule_evaluated'; readonly ruleIds: readonly string[] }
  | { readonly kind: 'gap'; readonly codes: readonly string[] }
  | { readonly kind: 'schedule'; readonly ids: readonly string[] };

export interface LegalInterpretation {
  readonly id: string;
  readonly title: string;
  readonly reading: string;
  readonly alternative: string;
  readonly record: string;
  readonly status: 'pending_legal_review' | 'reviewed';
  readonly reviewedBy: string | null;
  readonly appliesWhen: readonly InterpretationTrigger[];
}

type Completed = Extract<RunResult, { kind: 'completed' }>;

function fires(t: InterpretationTrigger, run: Completed): boolean {
  const periods = run.drivers.flatMap(d => d.periods);
  switch (t.kind) {
    case 'always': return true;
    case 'scope': return [...run.scope, ...run.drivers.flatMap(d => d.scope)].some(n => t.codes.includes(n.code));
    case 'rule_evaluated': return periods.some(p =>
      p.evaluations.some(e => t.ruleIds.includes(e.ruleId) && (e.status === 'triggered' || e.status === 'not_triggered')) || p.findings.some(f => t.ruleIds.includes(f.ruleId)));
    case 'gap': return [...run.drivers.flatMap(d => d.gaps), ...periods.flatMap(p => p.gaps)].some(g => t.codes.includes(g.code));
    case 'schedule': return run.provenance.scheduleIds.some(id => t.ids.includes(id));
  }
}

// An interpretation counts as reviewed only with both the status and a named reviewer.
export const isReviewed = (i: LegalInterpretation): boolean => i.status === 'reviewed' && i.reviewedBy !== null && i.reviewedBy.trim() !== '';

export const interpretationsRelied = (run: Completed, registry: readonly LegalInterpretation[]): LegalInterpretation[] =>
  registry.filter(i => i.appliesWhen.some(t => fires(t, run)));

export const pendingLegalReview = (run: Completed, registry: readonly LegalInterpretation[]): LegalInterpretation[] =>
  interpretationsRelied(run, registry).filter(i => !isReviewed(i));
