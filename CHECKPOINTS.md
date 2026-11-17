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

## Engine v0.4.0: no overtime rule in force. DONE 2026-11-16

- Company driver and IEO hours from April 2020 to April 2023 are now priced (straight time) instead of returning insufficient data.
- Every such result carries a scope note that employment standards overtime is not evaluated and amounts may be understated.
- An untranscribed overtime component is still a gap. Three aspects broken on purpose; a test failed each time.
- Two tests changed their expectation because the behaviour was changed on purpose (history.test.ts; DECISIONS 91).
- Tests: 370 passing in 27 files. DECISIONS 90 to 94. NEEDS_HUMAN 13 updated.

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

## Pre-repeal Regulation, hourly rates. DONE 2026-11-16

- Three unverified schedules cover April 3, 2014 to June 30, 2019 for hourly rates and the independent operator callout floor.
- Company driver and IEO hours for those years are now computable (straight time, with the no-overtime scope note).
- Cross-checks: the June 2019 company driver rates equal the April 2020 order's; I swapped digits in two files and tests caught both.
- Not transcribed: the 25-area trip schedules, employee callout, fuel surcharge. Independent operators in those years still
  return insufficient data, because no fuel surcharge figures exist for them.
- The only period with no schedule at all is now July 1, 2019 to March 31, 2020.
- Tests: 403 passing in 30 files. DECISIONS 95 to 100. NEEDS_HUMAN 4 updated.

## Guided template builder with row preview. DONE 2026-11-16

- The builder now works one table at a time, with tabs showing which tables are done and how many things each still needs.
- Once a table's mapping is complete, a preview shows how its first rows will be read, and every row that would be rejected with the reason.
- `previewTable` and `parseTableMapping` added to ingest. The one build warning is fixed.
- `next build` succeeds with no warnings. NOT clicked through in a browser.
- Tests: 408 passing in 30 files. DECISIONS 101 to 105.

## Pre-repeal Regulation, trip schedules. DONE 2026-11-16

- On-dock rates (25 areas, three terminals) are in for April 3, 2014 to May 31, 2019; off-dock rates (25 by 25) for April 3, 2014 to May 31, 2018.
- The off-dock table changes on July 20, 2016 (two rows), handled as a second schedule from the same file.
- Engine v0.5.0: a schedule can say no positioning movement rate was in force; nothing is owed and the PMR rules report not applicable.
- Still images in the source: off-dock June 2018 to June 2019, on-dock June 2019. Those trips are a gap.
- Independent operators in 2014 to 2019 still return insufficient data overall: no fuel surcharge figures exist for those years.
- Mutation checks: PMR-as-gap, swapped origin and destination, a symmetric off-dock typo, and a digit in each on-dock table. All caught.
- Tests: 430 passing in 30 files. DECISIONS 106 to 113. NEEDS_HUMAN 4 rewritten, 4a to 4c added.
- Changed: `packages/rates/ctr-2014-04-03.ts`, `ctr-2018-06-01.ts`, `ctr-2019-06-01.ts` and the first two test suites;
  `packages/engine/src/adapters/obcctc.ts`, `trip/owed.ts`, `assemble/result.ts`, `version.ts`, `adapters/history.test.ts`. None replaces a project knowledge file.

## Browser test of the app. DONE 2026-11-16

- Six checks in headless Chrome: sample run and PDF download; uploaded files with a template saved from the builder; broken template
  and rejected rows; a table built from scratch; an Excel file; phone width.
- Found and fixed: "$0.00 short" shown when nothing was computed (web and PDF); units preselected in the builder; a date field that
  could not be marked "not in this file"; a missing page icon (404); no hint to choose an Excel sheet; an orphaned PDF heading.
- Tests: 437 passing in 31 files, plus 6 browser checks. DECISIONS 114 to 119. NEEDS_HUMAN 19 and 20 rewritten.
- New: `apps/web/e2e/smoke.mjs`, `apps/web/app/icon.svg`, `packages/report/src/totals.ts` (+ test).
  Changed: `packages/report/src/{binder,layout,pdf,index}.ts`, `apps/web/lib/builder.ts` (+ test), `apps/web/components/{Workbench,TemplateBuilder}.tsx`, `package.json`.
