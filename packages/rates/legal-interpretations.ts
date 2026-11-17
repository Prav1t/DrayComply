// Legal interpretations the calculation rests on. NOT REGULATED VALUES. Each was chosen by the developer or an AI
// and no lawyer has reviewed any of them. A report lists every one its run relied on. See NEEDS_HUMAN.md section C.
// To record a review: set status to 'reviewed' and reviewedBy to the lawyer's name and date. Nothing else clears the notice.

export type InterpretationTrigger =
  | { readonly kind: 'always' }
  | { readonly kind: 'scope'; readonly codes: readonly string[] }            // a scope note with one of these codes is on the run
  | { readonly kind: 'rule_evaluated'; readonly ruleIds: readonly string[] } // the rule was triggered or checked and not triggered
  | { readonly kind: 'gap'; readonly codes: readonly string[] }
  | { readonly kind: 'schedule'; readonly ids: readonly string[] };          // one of these schedules priced something

export interface LegalInterpretation {
  readonly id: string;
  readonly title: string;
  readonly reading: string;        // what the engine does
  readonly alternative: string;    // the other reading, and which way it would move the figures
  readonly record: string;         // where the choice is recorded
  readonly status: 'pending_legal_review' | 'reviewed';
  readonly reviewedBy: string | null;
  readonly appliesWhen: readonly InterpretationTrigger[];   // any one is enough
}

const pending = (i: Omit<LegalInterpretation, 'status' | 'reviewedBy'>): LegalInterpretation => ({ ...i, status: 'pending_legal_review', reviewedBy: null });

export const LEGAL_INTERPRETATIONS: readonly LegalInterpretation[] = [
  pending({
    id: 'LI-01', title: 'Two comparisons: aggregate and segregated',
    reading: 'Both are reported. The segregated figure ring-fences wait time and fuel so they cannot top up the base rate, and adds up the shortfall in each bucket.',
    alternative: 'The Commissioner may apply only one of the two, or measure the segregated shortfall differently. Either figure could be the one that matters.',
    record: 'DECISIONS 9', appliesWhen: [{ kind: 'always' }],
  }),
  pending({
    id: 'LI-02', title: 'Payments are counted toward the work dates they state',
    reading: 'A payment counts toward the pay period containing the work dates on its line, compared pay period by pay period. An earlier surplus is not carried forward except in the labelled second figure.',
    alternative: 'An auditor may compare over a different window, such as a month or the whole audit period, which could remove or create shortfalls.',
    record: 'DECISIONS 10, 11, 22', appliesWhen: [{ kind: 'always' }],
  }),
  pending({
    id: 'LI-03', title: 'Which deductions are permitted',
    reading: 'Deductions are classified by the DrayComply deduction policy, drafted by an AI from the Act, the 2024-2026 licence, one bulletin and one decision, and applied to all dates.',
    alternative: 'Section 24 of the Act may bar deductions the policy allows, or the licence may permit deductions the policy disallows. Earlier licences were not read.',
    record: 'DECISIONS 38 to 47; NEEDS_HUMAN 14',
    appliesWhen: [{ kind: 'scope', codes: ['DEDUCTION_POLICY_IS_INTERPRETATION'] }, { kind: 'gap', codes: ['DEDUCTION_CATEGORY_UNKNOWN'] }, { kind: 'rule_evaluated', ruleIds: ['DISALLOWED_DEDUCTION'] }],
  }),
  pending({
    id: 'LI-04', title: 'A disallowed deduction is reported whatever the net pay',
    reading: 'A deduction the policy disallows is reported as a finding even when the driver was still paid at least the minimum.',
    alternative: 'It may be a contravention only when it takes pay below the minimum, in which case some findings here overstate.',
    record: 'DECISIONS 16; NEEDS_HUMAN 12', appliesWhen: [{ kind: 'rule_evaluated', ruleIds: ['DISALLOWED_DEDUCTION'] }],
  }),
  pending({
    id: 'LI-05', title: 'No overtime owed where the rate order had no overtime rule',
    reading: 'Employee hours on dates before the Commissioner ordered overtime are priced at the hourly rate only.',
    alternative: 'Employment standards overtime may have applied to these drivers. If so, amounts owed are understated.',
    record: 'DECISIONS 91, 99; NEEDS_HUMAN 13', appliesWhen: [{ kind: 'scope', codes: ['NO_OVERTIME_RULE_IN_FORCE'] }],
  }),
  pending({
    id: 'LI-06', title: 'Callout is a minimum for the availability window, not an extra payment',
    reading: 'The callout amount is a floor on what the driver is paid for the window. Pay for work done inside the window counts toward it.',
    alternative: 'The callout amount may be owed in addition to pay for work performed, in which case amounts owed are understated.',
    record: 'DECISIONS 6', appliesWhen: [{ kind: 'rule_evaluated', ruleIds: ['CALLOUT_BELOW_MINIMUM'] }],
  }),
  pending({
    id: 'LI-07', title: 'Wait time pass-through',
    reading: 'All wait time remuneration the licensee reports receiving for a driver and pay period must be paid to that driver in that pay period.',
    alternative: 'The rate orders are silent. OBCCTC bulletins on distributing wait time payments may set different timing or shares.',
    record: 'NEEDS_HUMAN 15', appliesWhen: [{ kind: 'rule_evaluated', ruleIds: ['WAIT_TIME_NOT_PASSED_THROUGH'] }],
  }),
  pending({
    id: 'LI-08', title: 'Overtime: daily first, then weekly; hours for other licensees counted first',
    reading: 'An unpaid overtime premium is attributed to daily overtime first. Hours for another licensee on the same date are counted before this licensee\'s, so the higher hourly tier starts no later than it could have.',
    alternative: 'A different order would move amounts between findings and could move the date the higher tier starts by one day.',
    record: 'DECISIONS 14, 17', appliesWhen: [{ kind: 'rule_evaluated', ruleIds: ['HOURLY_BELOW_MINIMUM', 'OVERTIME_DAILY_UNDERPAID', 'OVERTIME_WEEKLY_UNDERPAID'] }],
  }),
  pending({
    id: 'LI-09', title: 'Effective dates assumed for older schedules',
    reading: 'The April 2020 order is applied from April 1, 2020 using its January 2022 text; the amended 2022 figures from July 1, 2022; the Regulation\'s 2018 tables from June 1, 2018; the first hourly rates back to April 3, 2014.',
    alternative: 'If an amendment changed a rate on another date, figures for the affected months are wrong in either direction.',
    record: 'DECISIONS 30, 80, 97, 109',
    appliesWhen: [{ kind: 'schedule', ids: ['obcctc-2020-04-01', 'obcctc-2022-07-01', 'obcctc-2022-07-01+overtime-2023-05-01', 'ctr-2014-04-03', 'ctr-2014-04-03+off-dock-2016-07-20', 'ctr-2018-06-01', 'ctr-2019-06-01'] }],
  }),
];
