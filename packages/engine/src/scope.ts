import type { ComplianceInput } from './types/input';
import type { IsoDate } from './types/primitives';
import type { RunResult, ScopeNote } from './types/result';
import { SCOPE } from './rules/catalogue';
import { rollUp, rollUpRecords } from './run';

export type PeriodSelection =
  | { readonly kind: 'all' }
  | { readonly kind: 'range'; readonly from: IsoDate; readonly to: IsoDate };

type Completed = Extract<RunResult, { kind: 'completed' }>;

// Reports only pay periods wholly inside the range. Every period was still calculated, so cumulative
// hours and carried-forward figures are unchanged; provenance still lists every schedule the calculation used.
export function restrictPeriods(run: Completed, input: ComplianceInput, selection: PeriodSelection): Completed {
  if (selection.kind === 'all') return run;
  const inside = new Set<string>();
  let partly = 0;
  for (const d of input.drivers) {
    for (const p of d.payPeriods) {
      if (p.from >= selection.from && p.to <= selection.to) inside.add(`${d.driverId}\u0000${p.payPeriodId}`);
      else if (p.to >= selection.from && p.from <= selection.to) partly += 1;
    }
  }
  let omittedPeriods = 0;
  let omittedDrivers = 0;
  const drivers = run.drivers.flatMap(d => {
    const periods = d.periods.filter(p => inside.has(`${d.driverId}\u0000${p.payPeriodId}`));
    omittedPeriods += d.periods.length - periods.length;
    if (periods.length === 0) { omittedDrivers += 1; return []; }
    return [{ ...d, periods, verdict: rollUp(periods, d.gaps), recordsVerdict: rollUpRecords(periods) }];
  });
  const note: ScopeNote = {
    code: SCOPE.PERIOD_SELECTION,
    sentence: `Results are reported only for pay periods wholly inside ${selection.from} to ${selection.to}. ${omittedPeriods} other pay period(s) were calculated but are not reported, ${partly} of them partly inside the range. ${omittedDrivers} driver(s) had no pay period wholly inside the range and are left out. Gaps not tied to one pay period are still reported for every driver shown.`,
  };
  return { ...run, scope: [...run.scope, note], drivers };
}
