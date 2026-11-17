# DrayComply

Recomputes what Port of Vancouver container truck drivers were owed under the Container Trucking Act and the Commissioner's rate orders, compares it with what was paid, and reports shortfalls. It reports calculations, never legal advice.

| Part | What it is |
|---|---|
| `packages/rates` | Rate schedules as data, one file per schedule, plus the deduction policy and the list of legal readings. Only `obcctc-2026-07-01.ts` is verified |
| `packages/engine` | The pure calculation engine (v0.6.0). No clock, no I/O, no dependencies |
| `packages/ingest` | CSV and XLSX to engine input through a mapping template, with a reject list |
| `packages/report` | A run to an audit binder and a PDF, with the watermark and the pending-legal-review list |
| `packages/db` | Postgres schema (Drizzle), SQL migrations, immutability triggers |
| `apps/web` | The Next.js 15 app: sign-in, organizations, drivers, uploads, mapping, runs, reports |

## Commands

    npm install
    npm run check              # lint, typecheck, unit tests, build
    npm run test:integration   # needs Postgres; see .env.example
    npm run e2e                # needs Postgres, a build, and Chrome (CHROME_PATH or `npx playwright install chromium`)
    npm run check:full         # all of the above

Local development:

    cp .env.example .env && set -a && . ./.env && set +a
    createdb dray_dev && npm run db:migrate
    DEMO_EMAIL=demo@example.test DEMO_PASSWORD='demo password 123' npm run db:seed-demo
    npm run dev                # http://localhost:3000

## Where things are written down

`STATUS.md` (what exists), `HANDOFF.md` (where work stopped), `DECISIONS.md`, `NEEDS_HUMAN.md`, `RELEASE_BLOCKERS.md`, `CHECKPOINTS.md`, `DEPLOY.md`, `docs/OPERATIONS.md`, `docs/RETENTION.md`.
