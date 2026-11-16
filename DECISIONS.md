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
