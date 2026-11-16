# DECISIONS

Each entry: the choice, the alternative, one line of reasoning. Newest section last.

## 2026-11-14/15: engine v0.1 (agreed with Pravit before autonomous mode)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 1 | 1.5x two-container rule applies to off-dock only; two-container on-dock is a gap | Apply 1.5x to both | The order attaches the rule to the off-dock rate only |
| 2 | Tier threshold and multipliers live in the rates file as data (`HOURLY_TIER_THRESHOLD_HOURS`, `Ratio`) | Literals in the adapter | Constraint 2: the regulation is data |
| 3 | Exact fractions (bigint) carried through; rounded once per driver per pay period; mode is a required run option | Round per line | Rounding must not compound across trips |
| 4 | A shortfall under one whole cent in exact terms is `rounding_only` | Report as underpayment | Pravit's instruction |
| 5 | The entry crossing 2,340 hours is split at the threshold minute | Whole entry at one rate | The order prices by hours performed |
| 6 | Callout is a floor on pay for the window, not an addition; unflagged callouts are `not_evaluated` | Add the callout amount | "$348 or the trip rate, whichever is greater" reads as a guarantee |
| 7 | Trip payment with no trip record is a gap; trip with no payment is a finding, or `pending` while the period is open | Both findings | A payment without a trip is unpriceable work |
| 8 | IEO indemnification offset not implemented; a direct licensee payment to an IEO is a gap on both drivers | Implement | Needs the I/O's own payments to the IEO |

## 2026-11-16: item 1 (Pravit's nine decisions, and the choices they forced)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 9 | Segregated figure = sum of the negative bucket deltas; all three buckets stay in the result | Worst bucket only | Pravit's decision; ring-fenced shortfalls add up |
| 10 | Each pay line states the work dates it pays (`workPeriod`); it counts toward the one pay period containing those dates | Count by statement | Pravit's decision; late payment no longer looks like a shortfall |
| 11 | A line stating no work period, or dates inside no single pay period, counts nowhere and raises a gap on its statement's period | Fall back to the statement's period | A fallback is an inference on missing data |
| 12 | Deductions stay with the statement they appear on | Give deductions a stated work period too | Not asked for; statements seldom date deductions. Revisit in item 3 |
| 13 | `otherLicenseeHours` is optional (`reported`/`not_reported`); absence is a scope note, not a gap | Gap | Pravit's decision |
| 14 | Other-licensee hours on the same date count before this licensee's entries | Count after | Does not understate what is owed: the tier steps up no later than it could have |
| 15 | Item findings become `informational` when the period verdict is `no_shortfall_detected` | Always `item_shortfall` | Pravit's decision |
| 16 | A disallowed deduction is `prohibited_deduction` and is never downgraded | Downgrade like other items | INTERPRETATION: a prohibited deduction is a contravention whatever the net pay. For lawyer review |
| 17 | Unpaid overtime premium is attributed to daily overtime first, then weekly; stated in the finding sentence and a code comment | Pro-rate | Convention only; the order does not say. Totals are unaffected |
| 18 | Trips recorded against an hourly driver stay a gap (`CLASS_WORK_MISMATCH`) | Ignore them | Pravit's decision: keep strict |
| 19 | `recordsVerdict` (`no_records_finding_detected`, `records_finding`, `not_evaluated`) on period and driver; `PMR_NOT_ITEMISED` drives it | A fifth payment verdict | Pravit's decision |
| 20 | Boundary parser lives in `src/boundary/parse.ts`; stops at the first shape error | Collect all errors | Paths after a failed parent are unreliable |
| 21 | The parser refuses a missing `workPeriod` or `otherLicenseeHours` field; the caller must say `not_stated`/`not_reported` | Treat a missing field as not stated | Absence of a field is a bug upstream, not a fact about the data |
| 22 | `aggregateWithCarryover`: an earlier surplus carries forward; a shortfall never carries; it never changes a verdict | Net across all periods | Pravit's decision: no carryover by default, a second figure with it |
| 23 | After a period that cannot be computed, later carryover figures are `not_computable` | Carry zero | Zero would be a default for an unknown surplus |
| 24 | Schedules carry `status` and `verifiedBy`; provenance lists each schedule used and sets `unverifiedSchedulesUsed`; a run-level scope note names them | Reject unverified schedules | Pravit's rule: accept, mark, state in every report |
| 25 | The adapter marks the 2026 schedule `verified` although `SCHEDULE_META.verifiedBy` is null | Derive status from `verifiedBy` | Project instructions call it verified. Logged in NEEDS_HUMAN.md |
| 26 | Result and run carry `scope` notes (limits that are not gaps) | Put limits in gaps | A scope limit must not force `insufficient_data` |
| 27 | Delta cents are `0 - round(...)` | `-round(...)` | Negative zero did not survive JSON; a test caught it |
| 28 | Engine version 0.2.0 | Keep 0.1.0 | Results changed shape and meaning |

## 2026-11-16: item 2 (rate data), in progress

| # | Choice | Alternative | Why |
|---|---|---|---|
| 29 | One file per order; trip tables that could not be read are `null`, which the adapter maps to an absent component | 999999 sentinels | A null cannot be mistaken for a rate; the engine raises a gap |
| 30 | The 2022 file covers July 1, 2022 to June 30, 2023 only | Cover from April 1, 2020 | The amended order does not say which figures applied before the amendment. ASSUMPTION logged |
| 31 | The April 28, 2023 overtime order is a second schedule (`obcctc-2022-07-01+overtime-2023-05-01`) sharing the 2022 tables | An effective-dated component inside one schedule | Keeps resolution one schedule per date |
| 32 | Before May 1, 2023 the overtime component is absent, so DEO/IEO hours are a gap | Treat as "no overtime owed" | Employment standards overtime may have applied; the engine cannot price it. Does not understate |
| 33 | Extra fuel months live in a separate unverified supplement; the verified series always wins | Merge into one table | Never edit the verified file; provenance shows which series priced a month |
| 34 | A supplement month with no reference price prices the published basis only; a discounted basis is a gap | Derive the price from the percentage | Would be an invented value |
| 35 | The adapter now builds 2025 from its own file; `HOURLY_2025_07_01` in the 2026 file is used only as a cross-check in tests | Keep both | Two independent transcriptions agreeing is the strongest check available |
| 36 | Four tests whose premise was a data fact were re-pointed, not weakened: unpublished month is now December 2026; the "no overtime in the prior order" case runs on a schedule set built without it; "before any schedule" uses the day before the oldest schedule; the adapter test now asserts only the image-only tables are absent | Leave them red, or delete them | Their assertions about engine behaviour are unchanged; only the data they stood on moved |
| 37 | Pre-2019 Regulation rates not transcribed this session | Transcribe the hourly scalars seen | Period boundaries before BC Reg 72/2015 are not yet confirmed; a wrong boundary is worse than a gap |

## 2026-11-16: item 3 (deductions)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 38 | The policy lives in `packages/rates/deduction-policy.ts` as data with a source key on every ruling, marked `interpretation`, `reviewedBy: null` | Hard-code categories in the engine | Pravit's rule for legal interpretations; the engine stays ignorant of the law |
| 39 | Three rulings in the data (`disallowed`, `allowed`, `conditional`); the engine still knows two | Add `conditional` to the engine | A conditional category is left out of the engine's map, so it raises `DEDUCTION_CATEGORY_UNKNOWN` instead of picking a side |
| 40 | Fuel bought through the licensee, vehicle insurance premiums, advance repayments and unreturned GPS units are `conditional` | Disallow them (the reading that cannot understate), or allow them | The licence permits "Payroll Deductions" but never defines them. ALTERNATIVE LOGGED: disallowing all four would overstate shortfalls for the common fuel-card case; allowing them would understate. A gap does neither |
| 41 | `payroll_deduction_itemised_attested` is allowed: the licensee, through ingest mapping, attests the conditions in items 10 to 12 are met | No way to clear the gap | Makes the attestation an explicit act that shows in the input, not an engine assumption |
| 42 | `administration_fee` and `damage_to_licensee_equipment` are disallowed, flagged `inferred` | Leave unlisted | Does not understate what drivers are owed. No source names either; Decision 17/2018 is the nearest |
| 43 | Statutory source deductions (income tax, CPP, EI) are allowed, flagged `inferred` | Leave unlisted | The licence refers to statutory deductions as permitted without listing them |
| 44 | No catch-all. Garnishments, union dues, benefits, parking, WCB and anything else unlisted is a gap | A default ruling | Constraint 5 |
| 45 | `DeductionPolicy` gains `citations`; a disallowed-deduction finding states its basis "as an interpretation" | Keep citations out of results | An auditor needs to see what the ruling rests on. Breaking input change; engine is v0.3.0 |
| 46 | The policy is exported from `adapters/obcctc.ts` | A second adapter file | Keeps the purity rule "one file imports packages/rates" intact without touching its test |
| 47 | One policy for all dates | Effective-dated policies | Sources read are the 2024-2026 licence, a 2016 bulletin and a 2018 decision; earlier licences were not read. Logged in NEEDS_HUMAN |

## 2026-11-16: item 4 (packages/ingest)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 48 | XLSX is read with `fflate` (unzip) and a small handwritten XML reader | SheetJS `xlsx`, or `exceljs` | The file stores numbers as decimal text; reading that text keeps money out of floats entirely. SheetJS hands back floats and its npm build carries open advisories |
| 49 | No cell styles are read, so a date cell arrives as its serial number and the template names `excel_serial` | Detect date formats from styles | The template stating the format is explicit; detection is inference |
| 50 | Amounts are trimmed to 9 decimal places before the two-decimal check | Strict two decimals | Removes float storage noise (139.10000000000002) without ever hiding a real third decimal (139.105 is refused) |
| 51 | Negative and bracketed amounts are rejected | Treat as reversals | A reversal changes what a line means; the licensee must restate it |
| 52 | Hours that are not a whole number of minutes are rejected | Round to the minute | Rounding is an inference; 8.33 h is not 8 h 20 min |
| 53 | Every table and every field must be declared in the template; an absent table is `none`, stated by the licensee | Optional tables | Silence about a table would be read as "no records", which is an assumption |
| 54 | A blank cell is accepted only if the field has a blank meaning AND the template opts in per field | Field-level rule only | The licensee decides whether blank means "not reported" in their export |
| 55 | A driver with any rejected row is withheld from the engine input | Run the driver on the rows that parsed | A verdict on partial records misleads in either direction |
| 56 | A rejected row tied to no known driver is counted as `unattributedRejects` and stated in the result | Ignore | It could belong to any driver; the report must say so |
| 57 | Missing record ids are generated as `table:file#row`; a blank `seq` uses the row number | Reject rows without ids | An identifier is not a value; generation is deterministic and traceable to the file |
| 58 | A duplicated or missing column header stops the whole ingest (`file_invalid`) | Pick the first match | Picking is guessing |
| 59 | Unmapped deduction labels pass through unchanged | Reject the row | The engine then raises `DEDUCTION_CATEGORY_UNKNOWN`, which is the designed gap |
| 60 | Rows in callouts, otherLicenseeHours and fuelPrices are rejected unless the driver row says the table applies | Drop them | Never drop data quietly |
| 61 | SHA-256 is handwritten and synchronous; each file and the template are hashed into `provenance.sources` | Platform crypto | Keeps the library pure and usable in a browser or server alike; checked against published vectors |
| 62 | One file (and sheet) per table | Several files per table | Simpler; concatenating exports is the caller's job for now |
| 63 | `tripId` on a non-trip payment is ignored | Reject | Harmless; exports often repeat the column |

## 2026-11-16: item 5 (packages/report)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 64 | Three layers: `buildBinder` (data), `layout` (flat blocks), `renderPdf` (paint) | Render straight from the run result | The binder and the block list are plain data, so wording is tested without parsing a PDF |
| 65 | `pdf-lib` with the standard Helvetica and Courier fonts | Puppeteer/HTML to PDF, or pdfkit | Pure JavaScript, no browser, no font files, runs anywhere the app runs |
| 66 | Text outside Latin-1 prints as "?" | Embed a Unicode font | The standard fonts cannot encode it; failing the whole report over a name is worse. Logged as a known limit |
| 67 | `generatedAt` is an argument; the PDF's dates come from it; the same binder gives identical bytes | Stamp the current time | Reproducibility; the report layer reads no clock |
| 68 | The unverified-rates notice is the third block, directly under the title, boxed | A footnote | Pravit's rule: every report header states that unverified rates were used |
| 69 | The summary totals shortfalls only; surpluses are never netted in, and rounding-only differences are excluded | Net totals | A surplus for one driver does not reduce what another is short |
| 70 | Both comparisons appear first and side by side on every worksheet; carryover and strict per-trip are labelled as second and third figures | Lead with one number | Never collapse the two comparisons, never label one as the answer |
| 71 | Withheld drivers and unattributed rejects are repeated in the scope statement in plain words | Leave them in the reject list only | A reader of the summary must see what the figures do not cover |
| 72 | Report text never uses the word "compliant"; a test enforces it | Trust review | Liability wording rule |

## 2026-11-16: item 6 (apps/web)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 73 | Next.js 15 App Router, React 19, plain CSS, no UI library | Tailwind and a component kit | The spec's stack is not in project knowledge (NEEDS_HUMAN 17); this is the smallest stack that satisfies "Next.js 15" and is easy to restyle |
| 74 | The whole pipeline runs in the browser; no file leaves the device | Server actions or API routes | The packages are pure, so no server is needed. Payroll data never being uploaded is a real selling point, and nothing has to be hosted securely yet |
| 75 | No database, no accounts, no saved runs; templates are JSON files the user keeps | Add persistence now | Choosing a database or host, creating accounts and deploying are Pravit's decisions |
| 76 | `lib/pipeline.ts` holds the only orchestration and is unit-tested; the component only gathers inputs and shows results | Logic in components | The click-through cannot be tested here, so the logic must be testable without it |
| 77 | The run date defaults to the browser's date and the binder timestamp is taken at the click | Hard-code or omit | The clock is read once, in the app layer, and passed down as an argument; the packages stay pure |
| 78 | The app imports the sample template and files from `packages/ingest/src/testing/sample.ts` for the "Load the built-in sample" button | Duplicate the sample | One sample, used by tests and the demo |
| 79 | The app compiles the packages from source via `experimental.externalDir` | Build and publish the packages | No build step for the packages yet; fewer moving parts |

## 2026-11-16: item 2 again (April 2020 order found)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 80 | `obcctc-2020-04-01.ts` covers April 1, 2020 to June 30, 2022, from the January 13, 2022 version of the order | Cover only January 13 to June 30, 2022 | The bulletin of that date says its only change was a company name. ASSUMPTION: no earlier amendment changed a rate. If one raised rates, this file overstates what was owed before it, which does not understate |
| 81 | Its trip tables were transcribed again from the second PDF, not copied from the 2022 file | Reuse the 2022 tables | The two files now check each other cell for cell; a test enforces it |
| 82 | April 2020 fuel surcharge (6%) added to the supplement from the correcting bulletin, with no reference price | Leave 2020 empty | It is a primary source for one month. Every other 2020 month stays a gap |
| 83 | Two more tests re-pointed because the oldest schedule moved from July 2022 to April 2020 | Leave red | Same engine behaviour asserted, one day before the new oldest schedule |

## 2026-11-16: template builder (chosen over the pre-2019 Regulation)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 84 | Built the template builder before transcribing the pre-2019 Regulation | Regulation first | Without a builder nobody can run their own files. The Regulation years would still mostly return insufficient data: no published fuel percentages and no overtime rule exist for them |
| 85 | The builder never pre-selects a column, even when a header matches a field name | Auto-map by header name | A wrong guess would be silent. The user picks every field; the parser lists what is left |
| 86 | A date column cannot be used until its format is chosen; money and duration show a visible default (dollars, decimal hours) | Require a choice for every format | 07/06/2026 means two different days; a money unit mistake is caught by the two-decimal rule |
| 87 | The builder shows the distinct values found in a column so each can be mapped by hand | Free-text mapping only | Reporting what is in the file is not inference; deciding what it means stays with the user |
| 88 | `inspectFile` lives in `packages/ingest`; the form state and its conversion live in `apps/web/lib/builder.ts`, both tested | All in the component | The component cannot be tested here |
| 89 | Validation is the template parser's, shown live; the builder adds no rules of its own | A second validator in the UI | One source of truth for what a valid template is |

## 2026-11-16: "no overtime rule in force" (engine v0.4.0)

| # | Choice | Alternative | Why |
|---|---|---|---|
| 90 | A schedule component has three states: `present`, `not_in_force` (the order was read and has no such rule) and `absent` (nobody has transcribed it) | Keep two states and a gap | They are different facts. Supersedes DECISIONS 32 |
| 91 | Employee hours under an order with no overtime rule are owed at the hourly rate only, with a driver and run scope note saying employment standards overtime is not evaluated and amounts may be understated | Keep them a gap; or encode employment standards overtime | The engine measures the Commissioner's orders, and under those orders nothing more was owed. INTERPRETATION, for a lawyer: ALTERNATIVE LOGGED is that employment standards overtime applied and should be added, which this figure would understate. The scope note says so in every report |
| 92 | A day with no overtime rule does not count toward a later rule's weekly total; later employee entries in that same week are a gap | Count it | Only the week of April 30, 2023 is affected. Whether Sunday April 30 hours count toward the first week's 45 is not stated anywhere |
| 93 | Only overtime uses `not_in_force` today; every other caller still gets a gap for it | Apply it to all components | Safe default. The pre-2019 Regulation will want it for the positioning movement rate, which began July 1, 2019 |
| 94 | In the rates files the marker is `OVERTIME = 'no_rule_in_order'`; `null` still means not transcribed | Reuse null | A reader of the file must be able to tell the two apart |
