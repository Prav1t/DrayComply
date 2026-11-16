// Runs every case in fixtures/cases through the engine. Add a JSON file; no code change needed.
import { describe, it, expect } from 'vitest';
import { loadFixtures } from './load';
import { decodeFixture } from './schema';
import { runCompliance } from '../src/run';
import { OBCCTC_SCHEDULES } from '../src/adapters/obcctc';
import { RULE_IDS, GAPS } from '../src/rules/catalogue';
import type { Delta } from '../src/types/result';

const SCHEDULE_SETS = { obcctc: OBCCTC_SCHEDULES };
const centsOf = (d: Delta): number | null => (d.kind === 'computed' ? d.cents : null);
const distinct = (xs: readonly string[]): string[] => [...new Set(xs)].sort();
const fixtures = loadFixtures();

describe('fixtures', () => {
  it('loads the two illustrative cases', () => {
    expect(fixtures.map(f => f.id)).toEqual(['illustrative-01-aggregate-vs-segregated', 'illustrative-02-no-schedule-for-date']);
  });
  it('expects only rule ids and gap codes that exist in the catalogue', () => {
    const gapCodes: readonly string[] = Object.values(GAPS);
    const ruleIds: readonly string[] = RULE_IDS;
    fixtures.flatMap(f => f.expected.periods).forEach(p => {
      expect(p.ruleIds.filter(r => !ruleIds.includes(r))).toEqual([]);
      expect(p.gapCodes.filter(g => !gapCodes.includes(g))).toEqual([]);
    });
  });
  it('rejects a fixture that carries money as a decimal', () => {
    const bad = { ...JSON.parse(JSON.stringify(fixtures[0])), expected: { periods: [{ ...fixtures[0]?.expected.periods[0], aggregateCents: 11.5 }] } };
    expect(() => decodeFixture(bad, 'bad.json')).toThrow(/integer/);
  });

  describe.each(fixtures)('$id', fixture => {
    const result = runCompliance(fixture.input, SCHEDULE_SETS[fixture.scheduleSet], fixture.options);

    it('is accepted as valid input', () => {
      expect(result.kind).toBe('completed');
    });
    it('matches the expected verdicts, deltas, rule ids and gap codes', () => {
      const periods = result.kind === 'completed' ? result.drivers.flatMap(d => d.periods) : [];
      const actual = periods.map(p => ({
        driverId: p.driverId, payPeriodId: p.payPeriodId, verdict: p.verdict,
        aggregateCents: centsOf(p.aggregate), segregatedCents: centsOf(p.segregated), strictPerTripCents: centsOf(p.strictPerTrip),
        ruleIds: distinct(p.findings.map(f => f.ruleId)), gapCodes: distinct(p.gaps.map(g => g.code)),
      }));
      expect(actual).toEqual(fixture.expected.periods);
    });
  });
});
