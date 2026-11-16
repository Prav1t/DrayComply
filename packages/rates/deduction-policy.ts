// Deduction policy. LEGAL INTERPRETATION, NOT A REGULATED VALUE. Drafted by an AI from the sources below.
// No lawyer has reviewed it. Every ruling cites what it rests on. See NEEDS_HUMAN.md section C.
// A category that is not listed is unknown: the engine raises a gap. Nothing here is a default.

export const DEDUCTION_POLICY_META = {
  id: 'draycomply-deduction-policy-2026-11-16',
  status: 'interpretation',
  reviewedBy: null,                         // a lawyer's sign-off goes here
  draftedOn: '2026-11-16',
  transcription: 'Sources read through an automated page fetch that summarises; not read from the PDFs by eye.',
} as const;

// What each ruling rests on. Wording is paraphrase, not quotation.
export const DEDUCTION_SOURCES = {
  ACT_S24: {
    cite: 'Container Trucking Act, SBC 2014, c. 28, s. 24',
    says: 'A licensee must not seek or receive, directly or indirectly, any financial set-off, commission, rate deduction or rebate from a trucker.',
    url: 'https://free.bcpublications.ca/civix/document/id/complete/statreg/14028_01',
  },
  LICENCE_APP_E_S2: {
    cite: '2024-2026 CTS Licence, Appendix E, s. 2',
    says: 'The licensee must not set off or deduct Business Costs from Compensation or Wait Time Remuneration owed to a trucker.',
    url: 'https://obcctc.ca/wp-content/uploads/2025/02/2024-CTS-Licence-FINAL1.pdf',
  },
  LICENCE_BUSINESS_COSTS: {
    cite: '2024-2026 CTS Licence, Schedule 1, s. 1, definition of "Business Costs"',
    says: 'Costs of operating a business for which a licensee is responsible. A non-exhaustive list of nine items.',
    url: 'https://obcctc.ca/wp-content/uploads/2025/02/2024-CTS-Licence-FINAL1.pdf',
  },
  LICENCE_SPONSORSHIP_10_12: {
    cite: '2024-2026 CTS Licence, Sponsorship Agreement, items 10 to 12',
    says: 'Payroll Deductions are the only non-statutory deductions permitted; each must come with an itemised list of expenses; the operator may cancel them on 30 days written notice. "Payroll Deductions" is not defined.',
    url: 'https://obcctc.ca/wp-content/uploads/2025/02/2024-CTS-Licence-FINAL1.pdf',
  },
  LICENCE_APP_D_B2A: {
    cite: '2024-2026 CTS Licence, Appendix D, Part B, s. 2(a)',
    says: 'On request the licensee confirms that source deductions and WCB submissions were made for truckers who are employees.',
    url: 'https://obcctc.ca/wp-content/uploads/2025/02/2024-CTS-Licence-FINAL1.pdf',
  },
  BULLETIN_2016_05_26: {
    cite: 'OBCCTC Bulletin, "Owner Operator Remuneration Hold Backs", May 26, 2016',
    says: 'Insurance claim costs are a Business Cost. Holding back remuneration to cover possible future insurance claims, or in connection with the GPS program, is prohibited, unless the operator unreasonably failed to cooperate in returning the GPS unit.',
    url: 'https://obcctc.ca/wp-content/uploads/2016/12/2016-05-26-BC-CTC-Industry-Bulletin-Owner-Operator-Remuneration-Hold-Backs.pdf',
  },
  DECISION_17_2018: {
    cite: 'Aheer Transportation Ltd. (CTC Decision No. 17/2018), para. 20',
    says: 'Holding back monies to cover business costs is prohibited. The holdback there was said to offset damage to the licensee\'s truck and chassis.',
    url: 'https://obcctc.ca/wp-content/uploads/2018/06/OBCCTC-Decision-No.17-2018-Aheer-Transportation-Ltd-FINAL.pdf',
  },
} as const;

export type DeductionSourceKey = keyof typeof DEDUCTION_SOURCES;

// disallowed: reduces what the driver is counted as paid, and is reported.
// allowed:    does not reduce it.
// conditional: lawful only on conditions the engine cannot see. Deliberately NOT given to the engine, so it raises a gap.
export type DeductionRuling = 'disallowed' | 'allowed' | 'conditional';

export interface DeductionCategory {
  readonly ruling: DeductionRuling;
  readonly basis: readonly DeductionSourceKey[];
  readonly strength: 'stated' | 'inferred';   // stated: the source names this item. inferred: my reading of it.
  readonly note: string;
}

const BUSINESS_COST: readonly DeductionSourceKey[] = ['LICENCE_BUSINESS_COSTS', 'LICENCE_APP_E_S2'];

export const DEDUCTION_CATEGORIES: Readonly<Record<string, DeductionCategory>> = {
  // The nine items the licence lists as Business Costs.
  chassis_rental:                { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost.' },
  tire_wear:                     { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost: wear and tear on tires.' },
  cargo_insurance:               { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost.' },
  smartphone:                    { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost: smart phone costs.' },
  bridge_or_road_tolls:          { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost.' },
  loading_fees:                  { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost.' },
  access_agreement_charges:      { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost.' },
  terminal_gate_compliance_fees: { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost: Terminal Gate Compliance Initiative fees.' },
  gps_expenses:                  { ruling: 'disallowed', basis: BUSINESS_COST, strength: 'stated', note: 'Listed Business Cost. For an unreturned unit use gps_unit_not_returned.' },
  gps_unit_not_returned:         { ruling: 'conditional', basis: ['LICENCE_BUSINESS_COSTS', 'BULLETIN_2016_05_26'], strength: 'stated', note: 'Outside the bar only if the operator unreasonably failed to cooperate in returning the unit. That is a finding of fact.' },

  // Named by the bulletin or a decision.
  insurance_claim_costs:         { ruling: 'disallowed', basis: ['BULLETIN_2016_05_26', 'LICENCE_APP_E_S2'], strength: 'stated', note: 'The bulletin treats insurance claim costs as a Business Cost.' },
  holdback_for_future_claims:    { ruling: 'disallowed', basis: ['BULLETIN_2016_05_26'], strength: 'stated', note: 'Holding back pay after an operator leaves, against possible claims.' },
  damage_to_licensee_equipment:  { ruling: 'disallowed', basis: ['DECISION_17_2018', 'LICENCE_APP_E_S2'], strength: 'inferred', note: 'The decision calls a holdback for truck and chassis damage a holdback of business costs, but made no order on it.' },

  // Named by section 24 itself.
  commission:                    { ruling: 'disallowed', basis: ['ACT_S24'], strength: 'stated', note: 'Section 24 names commissions.' },
  rebate:                        { ruling: 'disallowed', basis: ['ACT_S24'], strength: 'stated', note: 'Section 24 names rebates.' },
  rate_reduction:                { ruling: 'disallowed', basis: ['ACT_S24'], strength: 'stated', note: 'Section 24 names rate deductions.' },
  administration_fee:            { ruling: 'disallowed', basis: ['ACT_S24', 'LICENCE_BUSINESS_COSTS'], strength: 'inferred', note: 'Read as a financial set-off and a cost of the licensee\'s own business. No source names it.' },

  // Statutory deductions. The licence refers to them as permitted without listing them.
  statutory_income_tax:          { ruling: 'allowed', basis: ['LICENCE_SPONSORSHIP_10_12', 'LICENCE_APP_D_B2A'], strength: 'inferred', note: 'Source deduction for an employee.' },
  statutory_cpp:                 { ruling: 'allowed', basis: ['LICENCE_SPONSORSHIP_10_12', 'LICENCE_APP_D_B2A'], strength: 'inferred', note: 'Source deduction for an employee.' },
  statutory_ei:                  { ruling: 'allowed', basis: ['LICENCE_SPONSORSHIP_10_12', 'LICENCE_APP_D_B2A'], strength: 'inferred', note: 'Source deduction for an employee.' },

  // Payroll Deductions under the Sponsorship Agreement: permitted, but only on conditions.
  payroll_deduction_itemised_attested: { ruling: 'allowed', basis: ['LICENCE_SPONSORSHIP_10_12'], strength: 'inferred', note: 'Use ONLY where the licensee attests: the operator agreed, an itemised list was given with each deduction, it was not cancelled, and it is not a Business Cost.' },
  io_fuel_purchased_through_licensee:  { ruling: 'conditional', basis: ['LICENCE_SPONSORSHIP_10_12'], strength: 'inferred', note: 'The agreement form contemplates the sponsor paying fuel for the operator. Recoverable only as a Payroll Deduction meeting items 10 to 12.' },
  io_vehicle_insurance_premium:        { ruling: 'conditional', basis: ['LICENCE_SPONSORSHIP_10_12'], strength: 'inferred', note: 'The agreement form contemplates the sponsor paying vehicle insurance. Recoverable only as a Payroll Deduction meeting items 10 to 12. Cargo insurance is different: it is a Business Cost.' },
  advance_repayment:                   { ruling: 'conditional', basis: ['ACT_S24', 'LICENCE_SPONSORSHIP_10_12'], strength: 'inferred', note: 'No source addresses advances or loans. It could be a prohibited set-off or a permitted Payroll Deduction.' },
};
