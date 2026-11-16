# CHECKPOINTS

## Item 1: engine decisions. DONE 2026-11-16

- All nine decisions applied; engine is v0.2.0. See DECISIONS 9 to 28.
- Tests: 184 at the end of item 1 (154 before). Eight new rules each broken once; a test failed every time.
- A real defect surfaced: deltas of zero came out as negative zero and did not survive JSON. Fixed (DECISIONS 27).
- New files: `src/assemble/attribute.ts`, `src/boundary/parse.ts`, `src/decisions.test.ts`.
- Changed: `src/types/{input,result,schedule}.ts`, `src/rules/catalogue.ts`, `src/math/ratio.ts`, `src/compare/*`,
  `src/hourly/owed.ts`, `src/assemble/result.ts`, `src/run.ts`, `src/validate.ts`, `src/adapters/obcctc.ts`, `src/index.ts`,
  `src/version.ts`, `src/testing/builders.ts`, `fixtures/schema.ts`, both fixture cases, `src/run.test.ts`.
- Project knowledge: the whole `packages/engine` tree replaces `draycomply-engine.zip`. The two rates files are unchanged.
- Input shape changed (breaking): every pay line needs `workPeriod`; every driver needs `otherLicenseeHours`.

## Item 2: rate data. PARTIAL 2026-11-16

- Transcribed from obcctc.ca, all `unverified-transcription`:
  - `obcctc-2025-07-01.ts`, `obcctc-2024-07-01.ts`, `obcctc-2023-07-01.ts`: hourly, overtime, callout, PMR, fuel formula. Trip tables null.
  - `obcctc-2022-07-01.ts`: all of the above plus both trip tables, and the May 1, 2023 overtime order.
  - `obcctc-fuel-published-supplement.ts`: monthly percentages 2021 to 2024, and November 2026.
- Each has its own integrity suite. Adapter now loads six schedules covering July 1, 2022 onward with no gap or overlap.
- Not done: the July 2019 and April 2020 orders (not found), the pre-repeal Regulation (found, not transcribed),
  trip tables for 2023 to 2025 (images). See NEEDS_HUMAN A1 to A5.
- Tests: 242 passing in 17 files.
- New files in `packages/rates`: four schedule files, the supplement, five test suites. New: `src/adapters/history.test.ts`.
- Changed in engine: `src/adapters/obcctc.ts`, `src/fuel/owed.ts`, `src/types/schedule.ts`, four re-pointed tests (DECISIONS 36).
- Project knowledge: no existing file is replaced. `obcctc-2026-07-01.ts` and its test are untouched.


## Item 3: deductions. DRAFT DONE 2026-11-16 (needs a lawyer)

- Read: Container Trucking Act ss. 23 to 25; the current Regulation (it has no deduction rule); the 2024-2026 CTS Licence
  (Appendix E, the Business Costs definition, Sponsorship Agreement items 10 to 12, Appendix D); the May 26, 2016 hold-backs bulletin;
  Decision 17/2018. Decision 14/2016 is an unreadable scan.
- Wrote `packages/rates/deduction-policy.ts`: 24 categories (16 disallowed, 4 allowed, 4 conditional), each citing its source,
  each flagged `stated` or `inferred`. Status `interpretation`, `reviewedBy: null`.
- Engine v0.3.0: `DeductionPolicy.citations` (breaking); findings state the basis "as an interpretation";
  `DEDUCTION_POLICY` exported from the adapter.
- Three rules broken on purpose (a Business Cost marked allowed; conditional categories quietly allowed; unknown category
  treated as allowed). A test failed each time.
- Tests: 258 passing in 19 files.
- New files: `packages/rates/deduction-policy.ts`, `packages/rates/deduction-policy.test.ts`, `packages/engine/src/adapters/deduction-policy.test.ts`.
- Changed: `src/types/input.ts`, `src/boundary/parse.ts`, `src/assemble/result.ts`, `src/adapters/obcctc.ts`, `src/testing/builders.ts`,
  `src/decisions.test.ts` (one options literal gained `citations`), both fixture cases, `src/version.ts`.
- Project knowledge: `draycomply-repo.zip` is replaced by the new zip. Nothing else is replaced.
- DECISIONS 38 to 47. NEEDS_HUMAN 14, 14a, 14b, 14c.

## Item 4: packages/ingest. DONE 2026-11-16

- A pure library: bytes and a template in; engine input, a reject list (file, row, field, raw value, reason) and a hashed
  file manifest out. Reads CSV and XLSX. Depends on `decimal.js` and `fflate` only.
- Nine tables, each field with a declared blank meaning (`src/specs.ts`). Templates are plain JSON, validated on load.
- Money never touches a float: XLSX numbers are read as the decimal text the file stores.
- Sample template and exports in `src/testing/sample.ts`; a real openpyxl workbook in `samples/payments.xlsx`.
- Eight rules broken on purpose; a test failed each time.
- Tests: 326 passing in 22 files (68 in ingest).
- New: everything under `packages/ingest`. Changed: root `package.json` (two dependencies), `.gitignore`.
- Project knowledge: nothing replaced. Work is now pushed to GitHub (Prav1t/DrayComply, branch main).
- DECISIONS 48 to 63. No new NEEDS_HUMAN entries.

## Items 5 and 6: NOT STARTED
