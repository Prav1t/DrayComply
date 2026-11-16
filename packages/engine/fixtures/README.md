# Fixtures

Each file in `cases/` is one case: inputs, expected deltas, expected rule ids.
`fixtures.test.ts` runs every file, so adding a case needs no code change.

## Adding a case from a published OBCCTC decision

1. Copy an illustrative case and name it `<id>.json`. The `id` field must match the file name.
2. Set `source` to:
   `{ "kind": "obcctc_decision", "citation": "...", "url": "...", "decisionDate": "YYYY-MM-DD" }`
3. Enter `input` from the decision's own figures. All money is integer cents; a decimal is rejected.
   Every pay line needs a `workPeriod` (the work dates it pays, or `not_stated`), and every driver needs
   `otherLicenseeHours` (`reported` with entries, or `not_reported`). The engine's boundary parser checks the shape.
4. Enter `expected.periods` from the decision's findings, not from what the engine prints.
   Use `null` for a delta the engine should be unable to compute.
5. Run `vitest`. A mismatch means either the engine or the transcription is wrong; check the decision first.

A decision dated before 2026-07-01 will mostly yield `insufficient_data` until earlier
schedules are added to `packages/rates`. That is the correct result, and still a useful fixture.

`ruleIds` and `gapCodes` are distinct values, sorted alphabetically.
