import type { DeductionLine, DeductionPolicy } from '../types/input';

export interface ClassifiedDeductions {
  readonly disallowed: readonly DeductionLine[];
  readonly unknown: readonly DeductionLine[];
}

// A category the policy does not list is unknown, never assumed allowed.
export function classifyDeductions(lines: readonly DeductionLine[], policy: DeductionPolicy): ClassifiedDeductions {
  const statusOf = (l: DeductionLine): 'allowed' | 'disallowed' | undefined =>
    Object.hasOwn(policy.categories, l.category) ? policy.categories[l.category] : undefined;
  return {
    disallowed: lines.filter(l => statusOf(l) === 'disallowed'),
    unknown: lines.filter(l => statusOf(l) === undefined),
  };
}
