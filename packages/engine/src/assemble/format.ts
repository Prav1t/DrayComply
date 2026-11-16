import { CENTS_PER_DOLLAR } from '../math/units';

// Integer cents to "$1234.56" text. Integer and string work only; no locale, no floating point.
export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const remainder = abs % CENTS_PER_DOLLAR;
  const dollars = (abs - remainder) / CENTS_PER_DOLLAR;
  const padded = remainder.toString().padStart(CENTS_PER_DOLLAR.toString().length - 1, '0');
  return `${cents < 0 ? '-' : ''}$${dollars}.${padded}`;
}
