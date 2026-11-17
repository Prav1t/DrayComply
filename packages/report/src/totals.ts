import { formatCents } from './binder';

export interface TotalsView { readonly aggregate: string; readonly segregated: string; readonly coverage: string }

// A total over zero computable pay periods is not $0.00; it is no figure at all.
export function totalsView(aggregateShortfallCents: number, segregatedShortfallCents: number, periods: number, periodsNotComputable: number): TotalsView {
  const computable = periods - periodsNotComputable;
  if (computable <= 0) {
    return { aggregate: 'Not computed', segregated: 'Not computed', coverage: 'No pay period could be computed, so there is no total.' };
  }
  return {
    aggregate: formatCents(aggregateShortfallCents), segregated: formatCents(segregatedShortfallCents),
    coverage: periodsNotComputable === 0
      ? `Totals cover all ${computable} pay period(s).`
      : `Totals cover ${computable} of ${periods} pay period(s). The other ${periodsNotComputable} could not be computed and are not in the totals.`,
  };
}
