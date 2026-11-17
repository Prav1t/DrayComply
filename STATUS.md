# STATUS

Written 2026-11-16 at the start of production mode (branch `v-2`). Updated at each handoff; the latest state is at the bottom.

## What existed at the start (main, commit be36d08)

| Part | What it does | State |
|---|---|---|
| `packages/rates` | One file per rate schedule (three from the pre-repeal Regulation, six Commissioner's orders, a fuel supplement), each with an integrity suite; the deduction policy as data. | Only `obcctc-2026-07-01.ts` is verified. Nine files are `unverified-transcription`. Gaps remain that only a person can close. |
| `packages/engine` v0.5.0 | Pure compliance engine: hourly, overtime, callout, trip, PMR, fuel, wait time, deductions; aggregate and segregated comparisons; gaps; provenance. Zero runtime dependencies. | Done for v1. IEO offset deferred (emits a gap). |
| `packages/ingest` | CSV and XLSX to engine input through a mapping template; reject list with a reason per row; SHA-256 of every file; inspection and preview for the template builder. | Done. |
| `packages/report` | Run result to audit binder (data), block layout and PDF. | Done against the old spec. Missing two release-safety items: the watermark and the list of unreviewed legal interpretations. |
| `apps/web` | One Next.js 15 page that runs the whole pipeline in the browser, with a template builder. No server code, database or accounts. | First version done. Everything in the production queue was missing. |

Tests at the start: **437 passing in 31 files**, plus 6 browser checks. Strict typecheck clean.

## Earlier queue

| Item | State | Note |
|---|---|---|
| 1. Engine decisions | Done | |
| 2. Historic rates | Partial, blocked on people | NEEDS_HUMAN A1 to A5. Nothing more can be transcribed from this workspace. |
| 3. Deductions | Draft done | Awaiting a lawyer (NEEDS_HUMAN C14). |
| 4. Ingest | Done | |
| 5. Report | Partial | Finished in this session: watermark, pending-legal-review list. |
| 6. App | First version | Replaced by the production queue. |

## State at the end of this session (2026-11-16, branch `v-2`)

| Part | State |
|---|---|
| `packages/rates` | Unchanged values. Added `legal-interpretations.ts` (LI-01 to LI-09, none reviewed) |
| `packages/engine` v0.6.0 | Added `restrictPeriods`. `runCompliance` unchanged |
| `packages/ingest` | Unchanged |
| `packages/report` | Finished: watermark, pending-legal-review section, caller scope notes |
| `packages/db` | New. Drizzle schema, two migrations, immutability triggers |
| `apps/web` | Production app: sign-in, organizations, roles, drivers, data sets, templates, check, runs, reports, settings, export, deletion, demo, privacy and terms drafts. The old in-browser page is at `/try` |

Tests: **467 unit (34 files), 65 integration on Postgres (5 files), 5 Playwright.** Lint and typecheck clean. Build succeeds.

| Production queue | State |
|---|---|
| 1. Monorepo hygiene and CI | Done |
| 2. Data layer | Done, on Drizzle instead of Prisma (DECISIONS 120) |
| 3. Auth and tenancy | Done. No password reset or email verification (needs an email provider) |
| 4. Upload and mapping | Done |
| 5. Driver setup | Done. A driver cannot be deleted yet, only edited |
| 6. Runs | Done |
| 7. Reports | Done |
| 8. Production readiness | Done in code. Legal, privacy and security review are people's work: `RELEASE_BLOCKERS.md` |
| 9. Deployment preparation | Done. Not deployed. Docker image never built |

Not ready for a customer to rely on: see `RELEASE_BLOCKERS.md`. The largest items are rate verification, legal review, and the missing 2023 to 2025 trip tables.
