import type { Ratio, RoundingMode } from '../types/primitives';
import type { ExactCents } from '../types/result';

// Exact rational, always reduced, denominator positive.
export interface Frac { readonly n: bigint; readonly d: bigint }

export const ZERO: Frac = { n: 0n, d: 1n };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x === 0n ? 1n : x;
}

export function frac(n: bigint, d: bigint): Frac {
  if (d <= 0n) throw new RangeError('denominator must be positive');
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function big(x: number): bigint {
  if (!Number.isSafeInteger(x)) throw new RangeError(`not a safe integer: ${x}`);
  return BigInt(x);
}

export const fromInt = (x: number): Frac => ({ n: big(x), d: 1n });
export const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mulInt = (a: Frac, k: number): Frac => frac(a.n * big(k), a.d);
export const divInt = (a: Frac, k: number): Frac => frac(a.n, a.d * big(k));
export const mulRatio = (a: Frac, r: Ratio): Frac => frac(a.n * big(r.num), a.d * big(r.den));
export const sum = (xs: readonly Frac[]): Frac => xs.reduce(add, ZERO);

// Negative, zero or positive as a is below, equal to or above b.
export function cmp(a: Frac, b: Frac): number {
  const diff = a.n * b.d - b.n * a.d;
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

export const isNegative = (a: Frac): boolean => a.n < 0n;
export const isPositive = (a: Frac): boolean => a.n > 0n;
export const maxFrac = (a: Frac, b: Frac): Frac => (cmp(a, b) >= 0 ? a : b);
export const minFrac = (a: Frac, b: Frac): Frac => (cmp(a, b) <= 0 ? a : b);

// The only place a fraction becomes whole cents.
export function roundFrac(a: Frac, mode: RoundingMode): number {
  let q = a.n / a.d;
  let r = a.n - q * a.d;
  if (r < 0n) { q -= 1n; r += a.d; }   // floor division for negatives
  const twice = r + r;
  const up =
    mode === 'down' ? false
    : mode === 'up' ? r > 0n
    : mode === 'half_up' ? twice >= a.d
    : twice > a.d || (twice === a.d && q % (1n + 1n) !== 0n);
  const result = Number(up ? q + 1n : q);
  if (!Number.isSafeInteger(result)) throw new RangeError('rounded amount exceeds safe integer range');
  return result;
}

export const toExact = (a: Frac): ExactCents => ({ num: a.n.toString(), den: a.d.toString() });
export const fromExact = (e: ExactCents): Frac => frac(BigInt(e.num), BigInt(e.den));
export const negate = (a: Frac): Frac => ({ n: -a.n, d: a.d });

// Guard for multipliers arriving from a schedule.
export function isExactRatio(r: Ratio): boolean {
  return Number.isSafeInteger(r.num) && Number.isSafeInteger(r.den) && r.den > 0 && r.num >= 0;
}
