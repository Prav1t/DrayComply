import { describe, it, expect } from 'vitest';
import { ZERO, add, cmp, divInt, frac, fromInt, isExactRatio, mulRatio, roundFrac, sub, sum, toExact } from './ratio';

const half = (n: number) => divInt(fromInt(n), 2);

describe('exact fractions', () => {
  it('keeps half cents exact through addition', () => {
    expect(toExact(add(half(1), half(1)))).toEqual({ num: '1', den: '1' });   // 0.5 + 0.5
  });
  it('reduces to lowest terms', () => {
    expect(toExact(frac(6n, 4n))).toEqual({ num: '3', den: '2' });
  });
  it('applies a 3/2 multiplier without floating point', () => {
    expect(toExact(mulRatio(fromInt(13_547), { num: 3, den: 2 }))).toEqual({ num: '40641', den: '2' });
  });
  it('sums an empty list to zero', () => {
    expect(sum([])).toEqual(ZERO);
  });
  it('orders fractions', () => {
    expect(cmp(half(1), fromInt(1))).toBeLessThan(0);
    expect(cmp(sub(fromInt(1), half(1)), half(1))).toBe(0);
  });
  it('rejects a non-positive denominator and unsafe integers', () => {
    expect(() => frac(1n, 0n)).toThrow(RangeError);
    expect(() => fromInt(0.5)).toThrow(RangeError);
  });
});

describe('rounding, the one place cents become whole', () => {
  it('rounds a half up under half_up and to even under half_even', () => {
    expect(roundFrac(half(7059), 'half_up')).toBe(3530);     // 3529.5
    expect(roundFrac(half(7059), 'half_even')).toBe(3530);   // 3530 is even
    expect(roundFrac(half(7057), 'half_even')).toBe(3528);   // 3528.5 -> 3528
  });
  it('rounds down and up as named', () => {
    expect(roundFrac(half(7059), 'down')).toBe(3529);
    expect(roundFrac(half(7059), 'up')).toBe(3530);
    expect(roundFrac(fromInt(100), 'up')).toBe(100);         // whole stays whole
  });
  it('floors negatives correctly', () => {
    expect(roundFrac(half(-1), 'down')).toBe(-1);            // -0.5 -> -1
    expect(roundFrac(half(-1), 'half_up')).toBe(0);          // -0.5 -> 0
  });
});

describe('ratio guard', () => {
  it('accepts integer ratios and rejects floats', () => {
    expect(isExactRatio({ num: 3, den: 2 })).toBe(true);
    expect(isExactRatio({ num: 1.5, den: 1 })).toBe(false);
    expect(isExactRatio({ num: 3, den: 0 })).toBe(false);
  });
});
