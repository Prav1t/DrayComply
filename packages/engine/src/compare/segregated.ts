import type { RoundingMode } from '../types/primitives';
import { ZERO, isNegative, sum, toExact } from '../math/ratio';
import { computeDelta, exactDelta, isShortfall, type Bucket, type ComputedDelta } from './aggregate';

// Wait time and fuel are ring-fenced: a surplus in one bucket cannot cover another.
// The segregated figure is therefore the sum of the bucket shortfalls, never the worst one alone.
export function segregatedDelta(buckets: readonly Bucket[], rounding: RoundingMode): ComputedDelta {
  const deltas = buckets.map(b => computeDelta(b, rounding));
  const cents = deltas.filter(isShortfall).reduce((t, d) => t + d.cents, 0);
  const exact = sum(buckets.map(exactDelta).map(e => (isNegative(e) ? e : ZERO)));
  return { kind: 'computed', cents, exact: toExact(exact), roundingOnly: cents === 0 && deltas.some(d => d.roundingOnly) };
}
