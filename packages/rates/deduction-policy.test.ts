// Integrity tests for the deduction policy. It is an interpretation; these guard its internal consistency only.
import { describe, it, expect } from 'vitest';
import { DEDUCTION_CATEGORIES, DEDUCTION_POLICY_META, DEDUCTION_SOURCES } from './deduction-policy';

const entries = Object.entries(DEDUCTION_CATEGORIES);

describe('deduction policy', () => {
  it('is marked as an interpretation that no lawyer has reviewed', () => {
    expect([DEDUCTION_POLICY_META.status, DEDUCTION_POLICY_META.reviewedBy]).toEqual(['interpretation', null]);
  });
  it('cites at least one known source for every ruling', () => {
    entries.forEach(([name, c]) => {
      expect({ name, cited: c.basis.length > 0 }).toEqual({ name, cited: true });
      c.basis.forEach(key => expect({ name, known: key in DEDUCTION_SOURCES }).toEqual({ name, known: true }));
    });
  });
  it('gives every source a citation, a paraphrase and a link', () => {
    Object.values(DEDUCTION_SOURCES).forEach(s => {
      expect(s.cite.length).toBeGreaterThan(10);
      expect(s.says.length).toBeGreaterThan(20);
      expect(s.url.startsWith('https://')).toBe(true);
    });
  });
  it('disallows all nine Business Costs the licence lists', () => {
    const nine = ['chassis_rental', 'tire_wear', 'cargo_insurance', 'smartphone', 'bridge_or_road_tolls', 'loading_fees',
      'access_agreement_charges', 'terminal_gate_compliance_fees', 'gps_expenses'];
    nine.forEach(name => expect({ name, ruling: DEDUCTION_CATEGORIES[name]?.ruling }).toEqual({ name, ruling: 'disallowed' }));
  });
  it('disallows the three things section 24 names', () => {
    ['commission', 'rebate', 'rate_reduction'].forEach(name => {
      expect({ name, ruling: DEDUCTION_CATEGORIES[name]?.ruling, basis: DEDUCTION_CATEGORIES[name]?.basis }).toEqual({ name, ruling: 'disallowed', basis: ['ACT_S24'] });
    });
  });
  it('never allows anything on the strength of a stated source: every allowance is flagged as inferred', () => {
    // No source lists a permitted deduction by name. If this fails, someone has overstated the support for one.
    entries.filter(([, c]) => c.ruling === 'allowed').forEach(([name, c]) => expect({ name, strength: c.strength }).toEqual({ name, strength: 'inferred' }));
  });
  it('holds fuel, vehicle insurance, advances and unreturned GPS units as conditional, not allowed', () => {
    ['io_fuel_purchased_through_licensee', 'io_vehicle_insurance_premium', 'advance_repayment', 'gps_unit_not_returned']
      .forEach(name => expect({ name, ruling: DEDUCTION_CATEGORIES[name]?.ruling }).toEqual({ name, ruling: 'conditional' }));
  });
  it('uses lower_snake_case names with a note on each', () => {
    entries.forEach(([name, c]) => {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(c.note.length).toBeGreaterThan(10);
    });
  });
});
