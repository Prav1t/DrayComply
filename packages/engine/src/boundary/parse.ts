// Handwritten boundary parser: unknown JSON in, typed engine input out, or every reason it was refused.
// It checks shape only. Dates, ranges and cross-references are checked by validateRun.
import type {
  CalloutInput, ClassPeriod, ComplianceInput, DeductionLine, DriverInput, FuelBasis, HourlyEntry, OtherLicenseeHours,
  PayLine, PayPeriod, RunOptions, StatedWorkPeriod, TripRecord,
} from '../types/input';
import type { Reported } from '../types/primitives';

export type Parsed<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'invalid'; readonly errors: readonly string[] };

type Obj = Record<string, unknown>;
type Decoder<T> = (v: unknown, p: string) => T;

class ShapeError extends Error {}

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, wanted: string): never {
  throw new ShapeError(`${path}: expected ${wanted}`);
}

const obj: Decoder<Obj> = (v, p) => (isObj(v) ? v : fail(p, 'an object'));
const str: Decoder<string> = (v, p) => (typeof v === 'string' ? v : fail(p, 'a string'));
// Money, minutes and sequence numbers are whole numbers. A decimal is refused, never rounded.
const int: Decoder<number> = (v, p) => (typeof v === 'number' && Number.isSafeInteger(v) ? v : fail(p, 'an integer'));
const arr = <T>(v: unknown, p: string, each: Decoder<T>): T[] =>
  Array.isArray(v) ? v.map((x, i) => each(x, `${p}[${i}]`)) : fail(p, 'an array');
const oneOf = <T extends string>(v: unknown, p: string, allowed: readonly T[]): T =>
  allowed.find(a => a === v) ?? fail(p, `one of ${allowed.join(', ')}`);
const nullable = <T>(v: unknown, p: string, inner: Decoder<T>): T | null => (v === null ? null : inner(v, p));

function reported<T>(v: unknown, p: string, inner: Decoder<T>): Reported<T> {
  const o = obj(v, p);
  return oneOf(o.kind, `${p}.kind`, ['reported', 'not_reported']) === 'reported'
    ? { kind: 'reported', value: inner(o.value, `${p}.value`) }
    : { kind: 'not_reported' };
}

const classPeriod: Decoder<ClassPeriod> = (v, p) => {
  const o = obj(v, p);
  const cls = oneOf(o.class, `${p}.class`, ['DEO', 'IEO', 'IO_HOURLY', 'IO_TRIP']);
  const from = str(o.from, `${p}.from`);
  const to = nullable(o.to, `${p}.to`, str);
  return cls === 'IEO' ? { class: cls, employingIoDriverId: str(o.employingIoDriverId, `${p}.employingIoDriverId`), from, to } : { class: cls, from, to };
};

const hourlyEntry: Decoder<HourlyEntry> = (v, p) => {
  const o = obj(v, p);
  return { entryId: str(o.entryId, `${p}.entryId`), workDate: str(o.workDate, `${p}.workDate`), seq: int(o.seq, `${p}.seq`), minutes: int(o.minutes, `${p}.minutes`) };
};

const trip: Decoder<TripRecord> = (v, p) => {
  const o = obj(v, p);
  const m = obj(o.move, `${p}.move`);
  const move: TripRecord['move'] = oneOf(m.kind, `${p}.move.kind`, ['on_dock', 'off_dock']) === 'on_dock'
    ? { kind: 'on_dock', zone: reported(m.zone, `${p}.move.zone`, str), terminal: reported(m.terminal, `${p}.move.terminal`, str) }
    : { kind: 'off_dock', origin: reported(m.origin, `${p}.move.origin`, str), destination: reported(m.destination, `${p}.move.destination`, str) };
  return {
    tripId: str(o.tripId, `${p}.tripId`), workDate: str(o.workDate, `${p}.workDate`), move,
    containers: reported(o.containers, `${p}.containers`, (x, q) => oneOf(x, q, ['one', 'two'])),
  };
};

const callouts: Decoder<CalloutInput> = (v, p) => {
  const o = obj(v, p);
  if (oneOf(o.kind, `${p}.kind`, ['flagged', 'not_flagged']) === 'not_flagged') return { kind: 'not_flagged' };
  return { kind: 'flagged', records: arr(o.records, `${p}.records`, (x, q) => {
    const c = obj(x, q);
    return { calloutId: str(c.calloutId, `${q}.calloutId`), workDate: str(c.workDate, `${q}.workDate`), entryIds: arr(c.entryIds, `${q}.entryIds`, str), tripIds: arr(c.tripIds, `${q}.tripIds`, str) };
  }) };
};

const otherLicenseeHours: Decoder<OtherLicenseeHours> = (v, p) => {
  const o = obj(v, p);
  if (oneOf(o.kind, `${p}.kind`, ['reported', 'not_reported']) === 'not_reported') return { kind: 'not_reported' };
  return { kind: 'reported', entries: arr(o.entries, `${p}.entries`, (x, q) => {
    const e = obj(x, q);
    return { workDate: str(e.workDate, `${q}.workDate`), minutes: int(e.minutes, `${q}.minutes`) };
  }) };
};

const fuelBasis: Decoder<FuelBasis> = (v, p) => {
  const o = obj(v, p);
  const kind = oneOf(o.kind, `${p}.kind`, ['published', 'io_discounted', 'not_reported']);
  if (kind !== 'io_discounted') return { kind };
  const prices = obj(o.centsPerLitreByMonth, `${p}.centsPerLitreByMonth`);
  return { kind, centsPerLitreByMonth: Object.fromEntries(Object.entries(prices).map(([month, c]) => [month, int(c, `${p}.centsPerLitreByMonth.${month}`)])) };
};

const workPeriod: Decoder<StatedWorkPeriod> = (v, p) => {
  const o = obj(v, p);
  return oneOf(o.kind, `${p}.kind`, ['stated', 'not_stated']) === 'stated'
    ? { kind: 'stated', from: str(o.from, `${p}.from`), to: str(o.to, `${p}.to`) }
    : { kind: 'not_stated' };
};

const payLine: Decoder<PayLine> = (v, p) => {
  const o = obj(v, p);
  const lineId = str(o.lineId, `${p}.lineId`);
  const cents = int(o.cents, `${p}.cents`);
  const work = workPeriod(o.workPeriod, `${p}.workPeriod`);
  const kind = oneOf(o.kind, `${p}.kind`, ['hourly', 'overtime', 'trip_rate', 'pmr', 'fuel', 'wait_time', 'callout', 'other']);
  if (kind !== 'trip_rate') return { lineId, kind, cents, workPeriod: work };
  const l = obj(o.link, `${p}.link`);
  const link: Extract<PayLine, { kind: 'trip_rate' }>['link'] = oneOf(l.kind, `${p}.link.kind`, ['trip', 'unlinked']) === 'trip'
    ? { kind: 'trip', tripId: str(l.tripId, `${p}.link.tripId`) }
    : { kind: 'unlinked' };
  return { lineId, kind, cents, workPeriod: work, link };
};

const deduction: Decoder<DeductionLine> = (v, p) => {
  const o = obj(v, p);
  return { deductionId: str(o.deductionId, `${p}.deductionId`), category: str(o.category, `${p}.category`), cents: int(o.cents, `${p}.cents`) };
};

const payPeriod: Decoder<PayPeriod> = (v, p) => {
  const o = obj(v, p);
  return {
    payPeriodId: str(o.payPeriodId, `${p}.payPeriodId`), from: str(o.from, `${p}.from`), to: str(o.to, `${p}.to`), payDate: str(o.payDate, `${p}.payDate`),
    payer: oneOf(o.payer, `${p}.payer`, ['licensee', 'employing_io']),
    waitTimeReceived: reported(o.waitTimeReceived, `${p}.waitTimeReceived`, int),
    lines: arr(o.lines, `${p}.lines`, payLine), deductions: arr(o.deductions, `${p}.deductions`, deduction),
  };
};

const driver: Decoder<DriverInput> = (v, p) => {
  const o = obj(v, p);
  return {
    driverId: str(o.driverId, `${p}.driverId`),
    classPeriods: arr(o.classPeriods, `${p}.classPeriods`, classPeriod),
    openingCumulativeMinutes: reported(o.openingCumulativeMinutes, `${p}.openingCumulativeMinutes`, int),
    hourlyCoverageFrom: reported(o.hourlyCoverageFrom, `${p}.hourlyCoverageFrom`, str),
    otherLicenseeHours: otherLicenseeHours(o.otherLicenseeHours, `${p}.otherLicenseeHours`),
    fuelBasis: fuelBasis(o.fuelBasis, `${p}.fuelBasis`),
    hourlyEntries: arr(o.hourlyEntries, `${p}.hourlyEntries`, hourlyEntry),
    trips: arr(o.trips, `${p}.trips`, trip),
    callouts: callouts(o.callouts, `${p}.callouts`),
    payPeriods: arr(o.payPeriods, `${p}.payPeriods`, payPeriod),
  };
};

const complianceInput: Decoder<ComplianceInput> = (v, p) => {
  const o = obj(v, p);
  const prov = obj(o.provenance, `${p}.provenance`);
  return {
    licenseeId: str(o.licenseeId, `${p}.licenseeId`),
    provenance: { sources: arr(prov.sources, `${p}.provenance.sources`, (x, q) => {
      const s = obj(x, q);
      return { name: str(s.name, `${q}.name`), digest: str(s.digest, `${q}.digest`) };
    }) },
    drivers: arr(o.drivers, `${p}.drivers`, driver),
  };
};

const runOptions: Decoder<RunOptions> = (v, p) => {
  const o = obj(v, p);
  const policy = obj(o.deductionPolicy, `${p}.deductionPolicy`);
  const categories = obj(policy.categories, `${p}.deductionPolicy.categories`);
  const citations = obj(policy.citations, `${p}.deductionPolicy.citations`);
  return {
    asOf: str(o.asOf, `${p}.asOf`),
    rounding: oneOf(o.rounding, `${p}.rounding`, ['half_up', 'half_even', 'down', 'up']),
    deductionPolicy: {
      id: str(policy.id, `${p}.deductionPolicy.id`),
      categories: Object.fromEntries(Object.entries(categories).map(([c, s]) => [c, oneOf(s, `${p}.deductionPolicy.categories.${c}`, ['allowed', 'disallowed'])])),
      citations: Object.fromEntries(Object.entries(citations).map(([c, s]) => [c, str(s, `${p}.deductionPolicy.citations.${c}`)])),
    },
  };
};

// Stops at the first shape error: later paths are unreliable once one has failed.
function run<T>(decode: Decoder<T>, v: unknown, root: string): Parsed<T> {
  try {
    return { kind: 'ok', value: decode(v, root) };
  } catch (e) {
    if (e instanceof ShapeError) return { kind: 'invalid', errors: [e.message] };
    throw e;
  }
}

export const parseComplianceInput = (v: unknown): Parsed<ComplianceInput> => run(complianceInput, v, 'input');
export const parseRunOptions = (v: unknown): Parsed<RunOptions> => run(runOptions, v, 'options');
