# HANDOFF (written 2026-11-16)

Reply "continue" and I resume here.

## Where the queue stands

1. Engine decisions: **done.**
2. Rate data: **partly done.** Next steps, in order:
   a. Pre-repeal Regulation (April 3, 2014 to June 30, 2019). Source is readable:
      https://free.bcpublications.ca/civix/document/id/complete/statreg/248_2014_pit
      Seen but NOT yet transcribed, so treat as leads only:
      - s. 13 DEO hourly: $25.13/$26.28 before June 1, 2018; $25.78/$26.96 to May 31, 2019; $26.30/$27.50 from June 1, 2019.
      - s. 15 I/O hourly: $50.13/$51.28; $51.43/$52.61; $52.46/$53.66 on the same dates.
      - s. 18 I/O callout: $200 before June 1, 2018, $300 after. ss. 16-17 employee callout: 4x hourly (from May 14, 2015; $160 before).
      - 25 zones (A to Y), not 26. Schedule versions: original, BC Reg 186/2016, 92/2018, 94/2019.
      - Fuel: same formula, but a quarterly reference price (MJ Ervin) and B = remuneration under Division 1.
      Still to confirm before writing files: the text of ss. 12 to 18 between December 22, 2014 and May 14, 2015,
      and the exact dates each Schedule version applied (s. 19(4) makes 2018 and 2019 increases payable from June 1).
      Plan: one file per period, 25-zone tables, symmetry and one-to-one band tests between versions.
   b. Engine support the old rules need: a quarterly fuel reference; a component state for "no rule in force" (overtime
      before May 2023); possibly a trip-paid employee class (NEEDS_HUMAN 16).
   c. When Pravit uploads the 2023 to 2025 PDFs, read Appendix I and III by eye and fill the null tables.
   d. The April 2020 order is now in (`obcctc-2020-04-01.ts`). The July 2019 order still needs a human (NEEDS_HUMAN A2).
      Known from a bulletin: the PMR began July 1, 2019 at $25 per eligible trip.
3. Deductions: **draft done**, awaiting a lawyer (NEEDS_HUMAN 14 to 14b). Optional follow-up: open more decisions for deduction
   rulings, and read past licences to see whether the Business Costs list changed over time.
4. packages/ingest: **done.** Original note kept for reference: It must emit `workPeriod` on every pay line and `otherLicenseeHours` on every driver, map each
   deduction column to a category in `deduction-policy.ts` (unmapped stays unmapped, so the engine raises a gap), and is where
   decimal.js parsing lives. XLSX parsing needs a dependency: choose one, record it in DECISIONS.md.
   Item 2 also has unblocked work left (2a, and the bulletin leads in NEEDS_HUMAN 14c) to pick up when ingest is done or first,
   as Pravit prefers.
5. packages/report: **done.** Original note kept for reference: It must print `scope` notes and "unverified rates were used" in the header whenever
   `provenance.unverifiedSchedulesUsed` is true. Both are already in the run result.
6. apps/web: **first version done**, now with a template builder (local, in-browser, no persistence). Follow-ups: saved templates
   and runs, sign-in, hosting (NEEDS_HUMAN 17 to 20). Both follow-ups named here are done (engine v0.4.0; Regulation hourly rates). NEXT unblocked work, in order of value:
   (1) click-test the app in a browser (a person, or a browser tool if one is available); (2) saved templates and runs, which need
   Pravit's choice of storage; (3) the Regulation's trip schedules (25 areas, four versions), which only pay off once fuel figures for 2014-2019 are found. Original note kept for reference: Next.js 15. Flow: upload files, pick or build a mapping template, run ingest, show the reject list,
   run the engine with `OBCCTC_SCHEDULES` and `DEDUCTION_POLICY`, show results, download the binder PDF.
   Persisting templates and runs needs a database, and deploying needs an account: both are human decisions (log, do not do).
   Start with a local-only build that keeps everything in memory and the browser.
   Unblocked rate research also remains (item 2a and NEEDS_HUMAN 14c): Pravit has said to go and find missing values.

## Nothing is half-edited

Every file on disk is complete and the suite is green: 408 tests, 30 files, strict typecheck clean. Engine is v0.4.0.
Everything is pushed to https://github.com/Prav1t/DrayComply (branch main) after each item.

## How to run

    npm install
    npx tsc --noEmit -p .
    npx vitest run

## Limits found this session

- The workspace shell cannot reach obcctc.ca, BC Laws or CanLII. Pages can be read only through a fetch tool that
  summarises, and it cannot read tables that are images. That is why PDFs must be uploaded for the image appendices.
