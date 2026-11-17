# RELEASE BLOCKERS

Everything that must be true before a real customer relies on a report. The app reads nothing from this file.

Status: **open** (not done), **partial**, **done**.

## Rates

| # | Must be true | Status | Detail |
|---|---|---|---|
| R1 | The 2026 schedule's sign-off is recorded in the file (`verifiedBy`) | open | NEEDS_HUMAN 7. The app treats it as verified because the project instructions say so |
| R2 | Every other schedule a customer's dates touch is checked by a person against the source and marked verified | open | Nine files are `unverified-transcription`. Until then those reports are watermarked, which is the safe state |
| R3 | Trip tables for July 2023 to June 2026 are transcribed | open | NEEDS_HUMAN 1. Until then trips in those years are insufficient data |
| R4 | The July 2019 to March 2020 order is found | open | NEEDS_HUMAN 2 |
| R5 | Fuel percentages before 2021 are found | open | NEEDS_HUMAN 5 |
| R6 | A process exists to add each new rate order and monthly fuel percentage | open | December 2026 fuel is already missing |

## Law

| # | Must be true | Status | Detail |
|---|---|---|---|
| L1 | A lawyer has reviewed LI-01 to LI-09 and each is marked reviewed with their name | open | `packages/rates/legal-interpretations.ts`. Until then every report carries "pending legal review" |
| L2 | A lawyer has reviewed the deduction policy | open | NEEDS_HUMAN 14 |
| L3 | A lawyer has reviewed the terms of service, especially liability | open | `/terms` is a draft with gaps |
| L4 | The report wording has been read by a lawyer | open | "No shortfall detected under the rules as encoded, for the data provided" |
| L5 | Professional liability insurance is in place, or a decision not to carry it | open | A wrong "no shortfall" is the product's main risk |

## Privacy (BC PIPA)

| # | Must be true | Status | Detail |
|---|---|---|---|
| P1 | Data is stored only in Canada, backups included | partial | Config puts app and database in Toronto. Backup location unconfirmed (NEEDS_HUMAN 26) |
| P2 | The privacy policy is reviewed and names a privacy contact and every sub-processor | open | `/privacy` is a draft |
| P3 | A written retention policy exists | done | `docs/RETENTION.md`. Needs your agreement on the numbers |
| P4 | An organization can export and delete its data | done | Settings; tested |
| P5 | A breach response plan exists | open | Who is told, by whom, how fast |
| P6 | A data processing agreement to sign with each customer | open | Lawyer |

## Security

| # | Must be true | Status | Detail |
|---|---|---|---|
| S1 | One organization cannot reach another's data | done | Tested on every route; broken on purpose and caught |
| S2 | Row-level security in Postgres as a second barrier | open | DECISIONS 129 |
| S3 | Password reset and email verification | open | NEEDS_HUMAN 22 |
| S4 | Two-factor sign-in for owners | open | Not built |
| S5 | An outside security review or penetration test | open | |
| S6 | The Docker image builds and runs | open | Never built (NEEDS_HUMAN 25) |
| S7 | The rate-limit address header is right on the host | open | NEEDS_HUMAN 27 |
| S8 | `npm audit` is clean for production dependencies | partial | Four moderate advisories, all in a development tool (DECISIONS 146) |
| S9 | Next.js is on a supported release | partial | 15 with a patched postcss; plan the move to 16 |

## Operations

| # | Must be true | Status | Detail |
|---|---|---|---|
| O1 | Deployed, with the checks in DEPLOY.md passing | open | |
| O2 | A restore from backup has been tried once | open | `docs/OPERATIONS.md` |
| O3 | Someone is alerted when the health check fails | open | Host alert on `/api/health` |
| O4 | Error tracking is connected | open | Hook exists; needs `ERROR_WEBHOOK_URL` |

## Product

| # | Must be true | Status | Detail |
|---|---|---|---|
| X1 | One real licensee's export has gone through end to end with a person watching | open | NEEDS_HUMAN 30 |
| X2 | A results screen has been read by a payroll clerk who was not told what it means | open | |
| X3 | IEO indemnification offset | open | Deferred; emits a gap |
| X4 | Large files (tens of thousands of rows) tried | open | Runs are synchronous (DECISIONS 138) |
