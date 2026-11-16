// The drafted deduction policy running through the engine. Every ruling here is an interpretation.
import { describe, it, expect } from 'vitest';
import { DEDUCTION_POLICY } from './obcctc';
import { DEDUCTION_CATEGORIES } from '../../../rates/deduction-policy';
import { HOURLY } from '../../../rates/obcctc-2026-07-01';
import { OPTIONS, driver, entry, expectClean, gapCodes, line, only, period, run } from '../testing/builders';

const RATE = HOURLY.DEO.under2340;
const options = { ...OPTIONS, deductionPolicy: DEDUCTION_POLICY };
const withDeduction = (category: string, paid = RATE) => [driver({
  hourlyEntries: [entry('E1', '2026-07-06', 60)],
  payPeriods: [period({ lines: [line('L1', 'hourly', paid)], deductions: [{ deductionId: 'X1', category, cents: 4_000 }] })],
})];

describe('drafted deduction policy', () => {
  it('gives the engine every decided category and none of the conditional ones', () => {
    const conditional = Object.entries(DEDUCTION_CATEGORIES).filter(([, c]) => c.ruling === 'conditional').map(([n]) => n);
    expect(conditional.filter(n => n in DEDUCTION_POLICY.categories)).toEqual([]);
    expect(Object.keys(DEDUCTION_POLICY.categories)).toHaveLength(Object.keys(DEDUCTION_CATEGORIES).length - conditional.length);
    expect(Object.keys(DEDUCTION_POLICY.citations)).toEqual(Object.keys(DEDUCTION_POLICY.categories));
  });
  it('reports a chassis rental deduction, reduces counted pay by it, and cites the licence', () => {
    const p = only(withDeduction('chassis_rental'), options);
    const f = p.findings.find(x => x.ruleId === 'DISALLOWED_DEDUCTION');
    expect([f?.nature, f?.amountCents]).toEqual(['prohibited_deduction', 4_000]);
    expect(f?.sentence).toContain('2024-2026 CTS Licence, Appendix E, s. 2');
    expect(f?.sentence).toContain('as an interpretation');
    expect(p.verdict).toBe('shortfall_aggregate');
  });
  it('cites section 24 for a commission', () => {
    const f = only(withDeduction('commission'), options).findings.find(x => x.ruleId === 'DISALLOWED_DEDUCTION');
    expect(f?.sentence).toContain('Container Trucking Act, SBC 2014, c. 28, s. 24');
  });
  it('lets a statutory source deduction through without a finding', () => {
    expectClean(only(withDeduction('statutory_income_tax'), options));
  });
  it('raises a gap for fuel bought through the licensee: lawful only on conditions the engine cannot see', () => {
    const p = only(withDeduction('io_fuel_purchased_through_licensee'), options);
    expect(gapCodes(p)).toEqual(['DEDUCTION_CATEGORY_UNKNOWN']);
    expect(p.verdict).toBe('insufficient_data');
  });
  it('accepts the same money once the licensee attests it is an itemised, agreed payroll deduction', () => {
    expectClean(only(withDeduction('payroll_deduction_itemised_attested'), options));
  });
  it('raises a gap for a category the policy has never heard of', () => {
    expect(gapCodes(only(withDeduction('parking'), options))).toEqual(['DEDUCTION_CATEGORY_UNKNOWN']);
  });
  it('says in the run scope that deductions were classified under an interpretation', () => {
    const note = run(withDeduction('statutory_cpp'), options).scope.find(n => n.code === 'DEDUCTION_POLICY_IS_INTERPRETATION');
    expect(note?.sentence).toContain('draycomply-deduction-policy-2026-11-16');
  });
});
