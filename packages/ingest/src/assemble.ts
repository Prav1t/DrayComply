import type {
  CalloutRecord, ClassPeriod, ComplianceInput, DeductionLine, DriverInput, HourlyEntry, InputProvenance, PayLine, PayPeriod, TripRecord,
} from '../../engine/src/index';
import type { Reject, Row, TableKind } from './types';

export interface Assembled {
  readonly input: ComplianceInput;
  readonly rejects: readonly Reject[];
  readonly withheldDrivers: readonly { readonly driverId: string; readonly rejectedRows: number }[];
  readonly unattributedRejects: number;
  readonly acceptedRows: ReadonlyMap<TableKind, number>;
}

type PayLineKind = PayLine['kind'];
type Reported<T> = { readonly kind: 'reported'; readonly value: T } | { readonly kind: 'not_reported' };
const NOT_REPORTED = { kind: 'not_reported' } as const;
const reportedOr = <T>(v: T | null): Reported<T> => (v === null ? NOT_REPORTED : { kind: 'reported', value: v });

// Typed reads of a mapped row. null means the cell was an accepted blank.
const text = (r: Row, f: string): string | null => { const v = r.values[f]; return v !== undefined && (v.kind === 'text' || v.kind === 'date') ? v.value : null; };
const num = (r: Row, f: string): number | null => { const v = r.values[f]; return v !== undefined && (v.kind === 'cents' || v.kind === 'minutes' || v.kind === 'integer') ? v.value : null; };
const list = (r: Row, f: string): readonly string[] => { const v = r.values[f]; return v !== undefined && v.kind === 'list' ? v.value : []; };
const generated = (r: Row): string => `${r.table}:${r.file}#${r.rowNumber}`;

const CLASSES = ['DEO', 'IEO', 'IO_HOURLY', 'IO_TRIP'] as const;
const LINE_KINDS: readonly PayLineKind[] = ['hourly', 'overtime', 'trip_rate', 'pmr', 'fuel', 'wait_time', 'callout', 'other'];
const PER_DRIVER_FIELDS = ['openingCumulativeHours', 'hourlyCoverageFrom', 'fuelBasis', 'calloutsFlagged', 'otherLicenseeHoursReported'];

interface Draft {
  readonly first: Row;
  readonly classPeriods: ClassPeriod[];
  readonly entries: HourlyEntry[];
  readonly trips: TripRecord[];
  readonly callouts: CalloutRecord[];
  readonly others: { workDate: string; minutes: number }[];
  readonly prices: Map<string, number>;
  readonly periods: Map<string, { readonly head: Omit<PayPeriod, 'lines' | 'deductions'>; readonly lines: PayLine[]; readonly deductions: DeductionLine[] }>;
  readonly ids: Set<string>;
}

// Typed rows to engine input. A row that cannot be placed is rejected with a reason; nothing is guessed.
export function assemble(rows: Readonly<Record<TableKind, readonly Row[]>>, mapRejects: readonly Reject[], licenseeId: string, provenance: InputProvenance): Assembled {
  const rejects: Reject[] = [...mapRejects];
  const accepted = new Map<TableKind, number>();
  const drafts = new Map<string, Draft>();
  const reject = (r: Row, field: string | null, reason: string): void => {
    const raw = field === null ? '' : text(r, field) ?? (num(r, field)?.toString() ?? '');
    rejects.push({ table: r.table, file: r.file, rowNumber: r.rowNumber, field, driverId: text(r, 'driverId'), raw, reason });
  };
  const accept = (r: Row): void => { accepted.set(r.table, (accepted.get(r.table) ?? 0) + 1); };

  for (const r of rows.drivers) {
    const driverId = text(r, 'driverId') ?? '';
    const cls = CLASSES.find(c => c === text(r, 'class'));
    const from = text(r, 'classFrom');
    if (cls === undefined || from === null) { reject(r, 'class', 'class or start date could not be read'); continue; }
    const employer = text(r, 'employingIoDriverId');
    if (cls === 'IEO' && employer === null) { reject(r, 'employingIoDriverId', 'an IEO row needs the driver id of the employing I/O'); continue; }
    const existing = drafts.get(driverId);
    if (existing !== undefined) {
      const conflict = PER_DRIVER_FIELDS.find(f => JSON.stringify(existing.first.values[f]) !== JSON.stringify(r.values[f]));
      if (conflict !== undefined) { reject(r, conflict, 'value differs from an earlier row for the same driver'); continue; }
    }
    const draft: Draft = existing ?? { first: r, classPeriods: [], entries: [], trips: [], callouts: [], others: [], prices: new Map(), periods: new Map(), ids: new Set<string>() };
    const to = text(r, 'classTo');
    draft.classPeriods.push(cls === 'IEO' ? { class: cls, employingIoDriverId: employer ?? '', from, to } : { class: cls, from, to });
    drafts.set(driverId, draft);
    accept(r);
  }

  // Finds the driver for a row of any other table, and claims its record id.
  const place = (r: Row, idField: string | null): { draft: Draft; id: string } | null => {
    const draft = drafts.get(text(r, 'driverId') ?? '');
    if (draft === undefined) { reject(r, 'driverId', 'driver is not in the drivers table'); return null; }
    const id = idField === null ? generated(r) : text(r, idField) ?? generated(r);
    if (draft.ids.has(id)) { reject(r, idField, `identifier "${id}" is already used by another record of this driver`); return null; }
    return { draft, id };
  };
  const claim = (p: { draft: Draft; id: string }, r: Row): void => { p.draft.ids.add(p.id); accept(r); };

  for (const r of rows.payPeriods) {
    const p = place(r, 'payPeriodId');
    if (p === null) continue;
    const from = text(r, 'from');
    const to = text(r, 'to');
    const payDate = text(r, 'payDate');
    const payer = text(r, 'payer');
    if (from === null || to === null || payDate === null || (payer !== 'licensee' && payer !== 'employing_io')) { reject(r, null, 'pay period could not be read'); continue; }
    p.draft.periods.set(p.id, { head: { payPeriodId: p.id, from, to, payDate, payer, waitTimeReceived: reportedOr(num(r, 'waitTimeReceived')) }, lines: [], deductions: [] });
    claim(p, r);
  }

  for (const r of rows.hours) {
    const p = place(r, 'entryId');
    const workDate = text(r, 'workDate');
    const minutes = num(r, 'duration');
    if (p === null || workDate === null || minutes === null) continue;
    p.draft.entries.push({ entryId: p.id, workDate, seq: num(r, 'seq') ?? r.rowNumber, minutes });
    claim(p, r);
  }

  for (const r of rows.trips) {
    const p = place(r, 'tripId');
    const workDate = text(r, 'workDate');
    const kind = text(r, 'moveKind');
    if (p === null || workDate === null) continue;
    const count = text(r, 'containers');
    const containers = reportedOr<'one' | 'two'>(count === 'one' || count === 'two' ? count : null);
    const move: TripRecord['move'] = kind === 'on_dock'
      ? { kind: 'on_dock', zone: reportedOr(text(r, 'zone')), terminal: reportedOr(text(r, 'terminal')) }
      : { kind: 'off_dock', origin: reportedOr(text(r, 'origin')), destination: reportedOr(text(r, 'destination')) };
    p.draft.trips.push({ tripId: p.id, workDate, move, containers });
    claim(p, r);
  }

  for (const r of rows.payments) {
    const p = place(r, 'lineId');
    if (p === null) continue;
    const period = p.draft.periods.get(text(r, 'payPeriodId') ?? '');
    if (period === undefined) { reject(r, 'payPeriodId', 'pay period is not in the payPeriods table for this driver'); continue; }
    const kind = LINE_KINDS.find(k => k === text(r, 'kind'));
    const cents = num(r, 'amount');
    if (kind === undefined || cents === null) { reject(r, 'kind', 'payment could not be read'); continue; }
    const from = text(r, 'workFrom');
    const to = text(r, 'workTo');
    if ((from === null) !== (to === null)) { reject(r, from === null ? 'workFrom' : 'workTo', 'only one end of the work period is given; give both, or neither'); continue; }
    const workPeriod: PayLine['workPeriod'] = from !== null && to !== null ? { kind: 'stated', from, to } : { kind: 'not_stated' };
    const tripId = text(r, 'tripId');
    period.lines.push(kind === 'trip_rate'
      ? { lineId: p.id, kind, cents, workPeriod, link: tripId === null ? { kind: 'unlinked' } : { kind: 'trip', tripId } }
      : { lineId: p.id, kind, cents, workPeriod });
    claim(p, r);
  }

  for (const r of rows.deductions) {
    const p = place(r, 'deductionId');
    if (p === null) continue;
    const period = p.draft.periods.get(text(r, 'payPeriodId') ?? '');
    const category = text(r, 'category');
    const cents = num(r, 'amount');
    if (period === undefined) { reject(r, 'payPeriodId', 'pay period is not in the payPeriods table for this driver'); continue; }
    if (category === null || cents === null) continue;
    period.deductions.push({ deductionId: p.id, category, cents });
    claim(p, r);
  }

  // Rows in these tables are refused unless the driver row says the table applies. They are never dropped quietly.
  const flag = (d: Draft, f: string): string | null => text(d.first, f);
  for (const r of rows.callouts) {
    const p = place(r, 'calloutId');
    const workDate = text(r, 'workDate');
    if (p === null || workDate === null) continue;
    if (flag(p.draft, 'calloutsFlagged') !== 'yes') { reject(r, null, 'the driver row does not say callouts are flagged'); continue; }
    p.draft.callouts.push({ calloutId: p.id, workDate, entryIds: list(r, 'entryIds'), tripIds: list(r, 'tripIds') });
    claim(p, r);
  }
  for (const r of rows.otherLicenseeHours) {
    const p = place(r, null);
    const workDate = text(r, 'workDate');
    const minutes = num(r, 'duration');
    if (p === null || workDate === null || minutes === null) continue;
    if (flag(p.draft, 'otherLicenseeHoursReported') !== 'yes') { reject(r, null, 'the driver row does not say other-licensee hours are reported'); continue; }
    p.draft.others.push({ workDate, minutes });
    claim(p, r);
  }
  for (const r of rows.fuelPrices) {
    const p = place(r, null);
    const month = text(r, 'month');
    const price = num(r, 'pricePerLitre');
    if (p === null || month === null || price === null) continue;
    if (flag(p.draft, 'fuelBasis') !== 'io_discounted') { reject(r, null, 'the driver row does not say fuel is priced on a discounted basis'); continue; }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { reject(r, 'month', 'month is not in YYYY-MM form'); continue; }
    if (p.draft.prices.has(month)) { reject(r, 'month', 'a price for this month is already given for this driver'); continue; }
    p.draft.prices.set(month, price);
    claim(p, r);
  }

  // A driver with any rejected row is withheld: a verdict on partial records would mislead.
  const rejectedByDriver = new Map<string, Set<string>>();
  let unattributed = 0;
  const seenRows = new Set<string>();
  for (const x of rejects) {
    const rowKey = `${x.table}|${x.file}|${x.rowNumber}`;
    if (x.driverId !== null && drafts.has(x.driverId)) {
      rejectedByDriver.set(x.driverId, (rejectedByDriver.get(x.driverId) ?? new Set()).add(rowKey));
    } else if (!seenRows.has(rowKey)) {
      unattributed += 1;
    }
    seenRows.add(rowKey);
  }

  const drivers: DriverInput[] = [...drafts.entries()].filter(([id]) => !rejectedByDriver.has(id)).map(([driverId, d]) => {
    const opening = num(d.first, 'openingCumulativeHours');
    const basis = flag(d, 'fuelBasis');
    return {
      driverId,
      classPeriods: d.classPeriods,
      openingCumulativeMinutes: reportedOr(opening),
      hourlyCoverageFrom: reportedOr(text(d.first, 'hourlyCoverageFrom')),
      otherLicenseeHours: flag(d, 'otherLicenseeHoursReported') === 'yes' ? { kind: 'reported', entries: d.others } : NOT_REPORTED,
      fuelBasis: basis === 'published' ? { kind: 'published' } : basis === 'io_discounted' ? { kind: 'io_discounted', centsPerLitreByMonth: Object.fromEntries(d.prices) } : NOT_REPORTED,
      hourlyEntries: d.entries,
      trips: d.trips,
      callouts: flag(d, 'calloutsFlagged') === 'yes' ? { kind: 'flagged', records: d.callouts } : { kind: 'not_flagged' },
      payPeriods: [...d.periods.values()].map(p => ({ ...p.head, lines: p.lines, deductions: p.deductions })),
    };
  });

  return {
    input: { licenseeId, provenance, drivers },
    rejects,
    withheldDrivers: [...rejectedByDriver.entries()].map(([driverId, rowKeys]) => ({ driverId, rejectedRows: rowKeys.size })),
    unattributedRejects: unattributed,
    acceptedRows: accepted,
  };
}
