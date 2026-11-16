import type { IsoDate } from '../types/primitives';
import type { ClassPeriod } from '../types/input';
import { inRange } from '../math/dates';

// Class as of a date; null when no period covers it. Overlaps are rejected by validateInput.
export function classAt(periods: readonly ClassPeriod[], date: IsoDate): ClassPeriod | null {
  return periods.find(p => inRange(date, p.from, p.to)) ?? null;
}
