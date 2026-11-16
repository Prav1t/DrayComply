// Fixture envelope. The input and options inside it go through the engine's own boundary parser.
import type { ComplianceInput, RunOptions } from '../src/types/input';
import type { Verdict } from '../src/types/result';
import { parseComplianceInput, parseRunOptions, type Parsed } from '../src/boundary/parse';

export type FixtureSource =
  | { readonly kind: 'illustrative'; readonly note: string }
  | { readonly kind: 'obcctc_decision'; readonly citation: string; readonly url: string; readonly decisionDate: string };

// null means the delta is expected to be not computable (or not applicable).
export interface ExpectedPeriod {
  readonly driverId: string;
  readonly payPeriodId: string;
  readonly verdict: Verdict;
  readonly aggregateCents: number | null;
  readonly segregatedCents: number | null;
  readonly strictPerTripCents: number | null;
  readonly ruleIds: readonly string[];    // distinct finding rule ids, sorted
  readonly gapCodes: readonly string[];   // distinct gap codes, sorted
}

export interface Fixture {
  readonly id: string;
  readonly title: string;
  readonly source: FixtureSource;
  readonly scheduleSet: 'obcctc';
  readonly options: RunOptions;
  readonly input: ComplianceInput;
  readonly expected: { readonly periods: readonly ExpectedPeriod[] };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, wanted: string): never {
  throw new TypeError(`fixture ${path}: expected ${wanted}`);
}
const obj = (v: unknown, p: string): Obj => (isObj(v) ? v : fail(p, 'an object'));
const str = (v: unknown, p: string): string => (typeof v === 'string' ? v : fail(p, 'a string'));
const int = (v: unknown, p: string): number => (typeof v === 'number' && Number.isSafeInteger(v) ? v : fail(p, 'an integer (money is integer cents)'));
const arr = <T>(v: unknown, p: string, each: (x: unknown, p: string) => T): T[] =>
  Array.isArray(v) ? v.map((x, i) => each(x, `${p}[${i}]`)) : fail(p, 'an array');
const oneOf = <T extends string>(v: unknown, p: string, allowed: readonly T[]): T =>
  allowed.find(a => a === v) ?? fail(p, `one of ${allowed.join(', ')}`);
const nullable = <T>(v: unknown, p: string, inner: (x: unknown, p: string) => T): T | null => (v === null ? null : inner(v, p));

function unwrap<T>(parsed: Parsed<T>, name: string): T {
  if (parsed.kind === 'invalid') throw new TypeError(`fixture ${name}: ${parsed.errors.join('; ')}`);
  return parsed.value;
}

function source(v: unknown, p: string): FixtureSource {
  const o = obj(v, p);
  return oneOf(o.kind, `${p}.kind`, ['illustrative', 'obcctc_decision']) === 'illustrative'
    ? { kind: 'illustrative', note: str(o.note, `${p}.note`) }
    : { kind: 'obcctc_decision', citation: str(o.citation, `${p}.citation`), url: str(o.url, `${p}.url`), decisionDate: str(o.decisionDate, `${p}.decisionDate`) };
}

function expectedPeriod(v: unknown, p: string): ExpectedPeriod {
  const o = obj(v, p);
  return {
    driverId: str(o.driverId, `${p}.driverId`), payPeriodId: str(o.payPeriodId, `${p}.payPeriodId`),
    verdict: oneOf(o.verdict, `${p}.verdict`, ['no_shortfall_detected', 'shortfall_aggregate', 'shortfall_segregated_only', 'insufficient_data']),
    aggregateCents: nullable(o.aggregateCents, `${p}.aggregateCents`, int),
    segregatedCents: nullable(o.segregatedCents, `${p}.segregatedCents`, int),
    strictPerTripCents: nullable(o.strictPerTripCents, `${p}.strictPerTripCents`, int),
    ruleIds: arr(o.ruleIds, `${p}.ruleIds`, str), gapCodes: arr(o.gapCodes, `${p}.gapCodes`, str),
  };
}

export function decodeFixture(v: unknown, name: string): Fixture {
  const o = obj(v, name);
  return {
    id: str(o.id, `${name}.id`), title: str(o.title, `${name}.title`),
    source: source(o.source, `${name}.source`),
    scheduleSet: oneOf(o.scheduleSet, `${name}.scheduleSet`, ['obcctc']),
    options: unwrap(parseRunOptions(o.options), name),
    input: unwrap(parseComplianceInput(o.input), name),
    expected: { periods: arr(obj(o.expected, `${name}.expected`).periods, `${name}.expected.periods`, expectedPeriod) },
  };
}
