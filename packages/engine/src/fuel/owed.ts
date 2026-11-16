import type { IsoDate } from '../types/primitives';
import type { FuelBasis } from '../types/input';
import type { FuelFormulaRules, ScheduleSet } from '../types/schedule';
import { GAPS } from '../rules/catalogue';
import { resolveComponent } from '../schedule/resolve';
import { yearMonthOf } from '../math/dates';
import { PERCENT_DENOMINATOR } from '../math/units';
import { divInt, mulInt, type Frac } from '../math/ratio';

export type FuelPct =
  | { readonly kind: 'pct'; readonly pct: number; readonly seriesId: string; readonly check: FormulaCheck }
  | { readonly kind: 'gap'; readonly code: typeof GAPS.FUEL_PCT_NOT_PUBLISHED | typeof GAPS.FUEL_BASIS_MISSING | typeof GAPS.NO_SCHEDULE_FOR_DATE | typeof GAPS.SCHEDULE_COMPONENT_ABSENT; readonly detail: string };

export type FormulaCheck =
  | { readonly kind: 'agrees' }
  | { readonly kind: 'mismatch'; readonly publishedPct: number; readonly formulaPct: number }
  | { readonly kind: 'not_checked' };

const floorTo = (value: number, step: number): number => value - (value % step);

// Whole steps above the threshold, times the percentage per step.
export function formulaPct(referenceCentsPerLitre: number, rules: FuelFormulaRules): number {
  const reference = floorTo(referenceCentsPerLitre, rules.roundReferenceDownToCents);
  if (reference <= rules.thresholdCentsPerLitre) return 0;
  const above = reference - rules.thresholdCentsPerLitre;
  return (floorTo(above, rules.stepCentsPerLitre) / rules.stepCentsPerLitre) * rules.pctPerStep;
}

// The published percentage governs. The formula checks it, or prices a discounted reference.
export function fuelPctFor(schedules: ScheduleSet, basis: FuelBasis, workDate: IsoDate): FuelPct {
  const month = yearMonthOf(workDate);
  if (basis.kind === 'not_reported') {
    return { kind: 'gap', code: GAPS.FUEL_BASIS_MISSING, detail: 'Whether the operator buys diesel at a discount was not reported.' };
  }
  const primary = Object.hasOwn(schedules.fuelPublished, month) ? schedules.fuelPublished[month] : undefined;
  const extra = Object.hasOwn(schedules.fuelSupplement.months, month) ? schedules.fuelSupplement.months[month] : undefined;
  const published = primary ?? extra;   // the primary series always wins
  const seriesId = primary !== undefined ? schedules.fuelPublishedSeriesId : schedules.fuelSupplement.seriesId;
  if (published === undefined) {
    return { kind: 'gap', code: GAPS.FUEL_PCT_NOT_PUBLISHED, detail: `No published fuel surcharge percentage is loaded for ${month}.` };
  }
  const formula = resolveComponent(schedules, workDate, 'fuel surcharge formula', s => s.fuelFormula);

  if (basis.kind === 'published') {
    if (formula.kind === 'gap' || published.referenceCentsPerLitre === null) return { kind: 'pct', pct: published.pct, seriesId, check: { kind: 'not_checked' } };
    const derived = formulaPct(published.referenceCentsPerLitre, formula.value);
    const check: FormulaCheck = derived === published.pct ? { kind: 'agrees' } : { kind: 'mismatch', publishedPct: published.pct, formulaPct: derived };
    return { kind: 'pct', pct: published.pct, seriesId, check };
  }

  const discounted = Object.hasOwn(basis.centsPerLitreByMonth, month) ? basis.centsPerLitreByMonth[month] : undefined;
  if (discounted === undefined) {
    return { kind: 'gap', code: GAPS.FUEL_BASIS_MISSING, detail: `The operator's discounted diesel price for ${month} was not reported.` };
  }
  if (formula.kind === 'gap') return { kind: 'gap', code: formula.code, detail: formula.detail };
  if (published.referenceCentsPerLitre === null) {
    return { kind: 'gap', code: GAPS.FUEL_PCT_NOT_PUBLISHED, detail: `No published reference price of diesel is loaded for ${month}, so a discounted basis cannot be priced.` };
  }
  // Reference price is the lower of the published price and the operator's own.
  const reference = Math.min(published.referenceCentsPerLitre, discounted);
  return { kind: 'pct', pct: formulaPct(reference, formula.value), seriesId, check: { kind: 'not_checked' } };
}

// base must already exclude the positioning movement rate.
export const fuelOwed = (base: Frac, pct: number): Frac => divInt(mulInt(base, pct), PERCENT_DENOMINATOR);
