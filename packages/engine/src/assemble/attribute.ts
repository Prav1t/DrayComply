import type { DriverInput, PayLine } from '../types/input';

export interface Attribution {
  readonly linesByPeriod: ReadonlyMap<string, readonly PayLine[]>;   // lines counted toward each work period
  readonly notStated: ReadonlyMap<string, readonly string[]>;        // statement period -> line ids
  readonly unmatched: ReadonlyMap<string, readonly string[]>;        // statement period -> line ids
}

const push = <T>(map: Map<string, T[]>, key: string, value: T): void => { map.set(key, [...(map.get(key) ?? []), value]); };

// A payment counts toward the work period it states, wherever and whenever it was paid.
// A line that states none, or states dates inside no single pay period, counts nowhere and is a gap.
export function attributePayments(driver: DriverInput): Attribution {
  const linesByPeriod = new Map<string, PayLine[]>();
  const notStated = new Map<string, string[]>();
  const unmatched = new Map<string, string[]>();
  for (const statement of driver.payPeriods) {
    for (const line of statement.lines) {
      const work = line.workPeriod;
      if (work.kind === 'not_stated') { push(notStated, statement.payPeriodId, line.lineId); continue; }
      const targets = driver.payPeriods.filter(p => work.from >= p.from && work.to <= p.to);
      const target = targets.length === 1 ? targets[0] : undefined;
      if (target === undefined) { push(unmatched, statement.payPeriodId, line.lineId); continue; }
      push(linesByPeriod, target.payPeriodId, line);
    }
  }
  return { linesByPeriod, notStated, unmatched };
}
