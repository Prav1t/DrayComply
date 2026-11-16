# NEEDS_HUMAN

Things only a person can get, check or decide. Nothing here was filled in from a secondary source.

## A. Documents to obtain and upload to project knowledge

1. **Trip rate appendices for the 2023, 2024 and 2025 rate orders.** Appendix I (on-dock) and Appendix III (off-dock) are
   images in each PDF, and the workspace cannot download files from obcctc.ca to read them by eye. Upload the PDFs:
   - https://obcctc.ca/wp-content/uploads/2025/07/2025-06-26-Rate-Order-FINAL.pdf
   - https://obcctc.ca/wp-content/uploads/2025/07/2024-05-15-Rate-Order-FINAL1.pdf
   - https://obcctc.ca/wp-content/uploads/2023/07/2023-06-07-Rate-Order-FINAL-Revised.pdf
   Until then every trip from July 1, 2023 to June 30, 2026 is `insufficient_data`.
2. **The Commissioner's order effective July 1, 2019** (in force to March 31, 2020). Not linked from
   https://obcctc.ca/rates/order/ or https://obcctc.ca/decisions-orders/orders/. Ask OBCCTC, or check an archive of obcctc.ca.
3. **The order effective April 1, 2020 as first issued, and every amendment before July 1, 2022.** The only copy found is the
   July 1, 2022 amended version, which does not say what applied from April 2020 to June 2022. Same sources as item 2.
4. **Container Trucking Regulation, Part 4 and Schedules 1 and 2, as they read before repeal.** Readable at
   https://free.bcpublications.ca/civix/document/id/complete/statreg/248_2014_pit (BC Laws point-in-time table).
   Schedule 1 Table 2 as re-enacted by BC Reg 94/2019 (in force June 1 to June 30, 2019) is an image there.
   The amending regulations are BC Regs 72/2015, 186/2016, 92/2018, 94/2019 and 144/2019. Not yet transcribed; see HANDOFF.md.
5. **Fuel surcharge percentages for July 2019 to December 2020**, the reference prices for 2021 to 2024, and December 2026.
   https://obcctc.ca/rates/fuel-surcharge/ shows percentages from January 2021 and reference prices from January 2025 only.
   The pre-2019 Regulation used a quarterly reference price reported by MJ Ervin; no published series was found.

## B. Values to check against the source (a second person, by eye)

6. **Every file marked `unverified-transcription`:** `obcctc-2022-07-01.ts`, `obcctc-2023-07-01.ts`, `obcctc-2024-07-01.ts`,
   `obcctc-2025-07-01.ts`, `obcctc-fuel-published-supplement.ts`. They were read through an automated page fetch that
   summarises, not from the PDF directly.
   - The 2022 tables are well guarded: symmetry, and a one-to-one mapping onto the verified 2026 tables.
   - The scalar files are weakly guarded. I changed the 2024 DEO rate by one digit ($32.26 to $33.26) and no test failed.
     Only the 2025 figures have an independent cross-check (`HOURLY_2025_07_01`).
7. **`obcctc-2026-07-01.ts` says `verifiedBy: null` and "VERIFY BEFORE USE"**, while the project instructions call it verified.
   The adapter marks it `verified`. Record the sign-off in the file, or tell me to mark it unverified.
   I did compare it to the PDF by eye on 2026-11-14: all 78 on-dock values and six rows of the off-dock matrix matched.
8. **2025 order signing date.** The fetched text says May 26, 2025; the file name says 2025-06-26. `orderedOn` holds May 26.
9. **2023 order, overtime section.** The fetched summary says overtime "applies when the operator has fewer than 2,340
   collective hours". That is probably a garbled reading of two overtime rates. Check page 3 of the 2023 PDF.
   The file encodes 1.5x for all DEO and IEO hours, which does not understate.
10. **2022 file start date.** ASSUMPTION: the amended figures apply from July 1, 2022. If the amendment changed only part of
    the order, some figures applied earlier and April 2020 to June 2022 could be partly filled.
11. **November 2026 fuel surcharge:** 72% on a $2.85 reference, from the OBCCTC page. The verified file notes it as not yet published.

## C. Legal interpretations for a lawyer

12. **A disallowed deduction is treated as a contravention in itself** and is never downgraded to informational (DECISIONS 16).
13. **Overtime before May 1, 2023.** The Commissioner's orders contain no overtime rule before then. Whether employment
    standards overtime applied to container truck drivers, and at what thresholds, is not encoded (DECISIONS 32).
14. **The deduction policy is a first draft by an AI and needs a lawyer.** `packages/rates/deduction-policy.ts`. Review points:
    - Section 24 of the Act bars any set-off, commission, rate deduction or rebate "from a trucker", with no stated exception.
      The licence nevertheless permits statutory deductions and undefined "Payroll Deductions". How those fit together is the core question.
    - Rulings flagged `inferred`: administration fees, damage to licensee equipment, statutory source deductions,
      and the attested payroll deduction.
    - Rulings held `conditional` (the engine raises a gap): fuel bought through the licensee, vehicle insurance premiums,
      advance repayments, unreturned GPS units (DECISIONS 40).
    - The policy applies one reading to all dates back to 2014. Earlier licences are at https://obcctc.ca/cts-licence/past-licences/ and were not read.
    - Whether a prohibited deduction is a contravention even when net pay still meets the minimum (DECISIONS 16).
14a. **Aheer Transportation Ltd. (CTC Decision No. 14/2016)** is the decision the Commissioner cites for the bar on holding back
    business costs. The PDF is a scan with no text layer and could not be read:
    https://obcctc.ca/wp-content/uploads/2016/12/CTC-Decision-No.14-2016-Aheer-Transportation-Ltd-FINAL.pdf
14b. **About 190 Commissioner's decisions were not searched for deduction rulings.** The index at
    https://obcctc.ca/decisions-orders/decisions/ gives titles only, so each PDF must be opened. Two were read (14/2016 failed, 17/2018).
14c. **Leads for queue item 2 found while reading bulletins** (not yet read): fuel surcharge amendment bulletins of
    December 18, 2019, April 1, 2020 and January 13, 2022, and the "Rate and Licensing Update" of July 18, 2019, all linked from
    https://obcctc.ca/industry-communications/bulletins/. They may fix the dates and figures missing for 2019 to 2022.
15. **Wait time.** The rate orders are silent. OBCCTC publishes "Distribution of wait time payments" bulletins
    (for example https://obcctc.ca/wp-content/uploads/2026/10/2026-10-26-Distribution-of-wait-time-payments-Q4-2025-FINAL.pdf).
    These and section 23 of the Regulation should be read before the wait-time rule is relied on.
16. **Driver class not modelled:** before May 14, 2015 the Regulation set $40 per trip for directly employed operators paid
    by the trip (former ss. 10 and 11). The engine has no trip-paid employee class.

## D. Nothing in this session spent money, created an account, contacted anyone, published or deployed.
