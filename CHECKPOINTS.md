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


### Item 2, addendum 2026-11-16

- Found and transcribed the April 1, 2020 order (January 13, 2022 version): `obcctc-2020-04-01.ts`, with both trip tables.
  It matches the July 2022 tables cell for cell, from a separate reading. Coverage now starts April 1, 2020.
- Added April 2020 (6%) to the fuel supplement. Confirmed from a bulletin that the PMR began July 1, 2019 and that the fuel
  reference became monthly on January 1, 2020.
- Still missing: the July 2019 order, 2019 and most 2020 fuel percentages, the 2023 to 2025 trip tables, the pre-2019 Regulation.
- Tests: 359 passing in 25 files. DECISIONS 80 to 83.

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

## Item 5: packages/report. DONE 2026-11-16

- `buildBinder(run, ingested, meta)` gives the audit binder as data: header, summary, scope statement, schedules used,
  input file manifest with hashes, findings, gaps, rejected rows, and a worksheet per driver.
- `renderPdf(binder)` lays it out as a Letter-size PDF with `pdf-lib`. Same binder, same bytes.
- The header states "UNVERIFIED RATES WERE USED" whenever an unverified schedule priced anything.
- I rendered a sample (one short trip, a missing PMR line, one orphan row) and read all four pages.
- Four rules broken on purpose. Three were caught; netting surpluses into the shortfall total was not, so I added a test for it
  and confirmed it now fails when the rule is broken.
- Tests: 342 passing in 23 files.
- New: everything under `packages/report`. Changed: root `package.json` (pdf-lib).
- Project knowledge: nothing replaced. Pushed to GitHub.
- DECISIONS 64 to 72. No new NEEDS_HUMAN entries.

## Item 6: apps/web. FIRST VERSION DONE 2026-11-16

- A one-page Next.js 15 app: choose files, load a template, set licensee and run date, run, read results, download the binder PDF.
- Everything runs in the browser. No server code, no database, no accounts.
- Shows the unverified-rates notice, withheld drivers, both comparisons, findings, gaps, rejected rows, scope and file hashes.
- `next build` succeeds and the built page serves. The click-through itself is NOT tested in a browser (NEEDS_HUMAN 19).
- Tests: 348 passing in 24 files (6 for the pipeline).
- New: everything under `apps/web`. Changed: root `package.json` (next, react), `.gitignore`.
- Project knowledge: nothing replaced. Pushed to GitHub.
- DECISIONS 73 to 79. NEEDS_HUMAN 17 to 20.

## Template builder. DONE 2026-11-16

- In the app, step 2 now has "Build a template from these files" / "Edit this template".
- For each of the nine tables: map it to a file (and sheet, header row, separator) or state there are no such records.
  For each field: pick the column, the format, how the values found in that column map, and whether a blank is accepted.
- Live list of what is still unsettled, from the same parser ingest uses. "Use this template" and "Save template (JSON)".
- `inspectFile` added to ingest. Builder state model in `apps/web/lib/builder.ts`.
- `next build` succeeds. NOT clicked through in a browser (NEEDS_HUMAN 19, 20).
- Tests: 367 passing in 27 files.
- New: `packages/ingest/src/inspect.ts` (+ test), `apps/web/lib/builder.ts` (+ test), `apps/web/components/TemplateBuilder.tsx`.
  Changed: `packages/ingest/src/index.ts`, `apps/web/components/Workbench.tsx`, `apps/web/app/globals.css`.
- DECISIONS 84 to 89.
