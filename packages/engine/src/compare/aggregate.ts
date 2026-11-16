import type { RoundingMode } from '../types/primitives';
import type { Delta } from '../types/result';
import { cmp, fromInt, negate, roundFrac, sub, sum, toExact, type Frac } from '../math/ratio';

export interface Bucket { readonly paidCents: number; readonly owed: Frac }
export type ComputedDelta = Extract<Delta, { kind: 'computed' }>;

// exact is paid minus owed. The amount short is rounded once; under one whole cent is rounding only.
export function deltaFromExact(exact: Frac, rounding: RoundingMode): ComputedDelta {
  const cents = 0 - roundFrac(negate(exact), rounding);   // 0 - x, so a zero is never negative zero
  return { kind: 'computed', cents, exact: toExact(exact), roundingOnly: cents < 0 && cmp(exact, fromInt(-1)) > 0 };
}

export const exactDelta = (bucket: Bucket): Frac => sub(fromInt(bucket.paidCents), bucket.owed);
export const computeDelta = (bucket: Bucket, rounding: RoundingMode): ComputedDelta => deltaFromExact(exactDelta(bucket), rounding);

// Every credited payment against every amount owed, as one pool.
export function aggregateDelta(buckets: readonly Bucket[], rounding: RoundingMode): ComputedDelta {
  return deltaFromExact(sum(buckets.map(exactDelta)), rounding);
}

export const isShortfall = (d: ComputedDelta): boolean => d.cents < 0 && !d.roundingOnly;
