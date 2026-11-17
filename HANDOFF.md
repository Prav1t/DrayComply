# HANDOFF (written 2026-11-16, production mode, branch `v-2`)

Reply "continue" and I resume here.

## Where the production queue stands

All nine items are done in code and pushed to branch `v-2`. See `STATUS.md` for the table and `CHECKPOINTS.md` for each item.

Nothing is half-edited. `npm run check`, `npm run test:integration` and `npm run e2e` all pass: 467 unit, 65 integration, 5 browser tests.

## Read these first

1. `DECISIONS.md` 120: the data layer is Drizzle, not Prisma. Say if you want it changed.
2. `RELEASE_BLOCKERS.md`: what stands between this and a customer relying on a report.
3. `NEEDS_HUMAN.md` section E: ten items only you can do.
4. `DEPLOY.md`: the checklist. Nothing is deployed.

## Next unblocked work, in order of value

1. **Driver deletion and a "correct a class period" flow.** Today a wrong driver can only be edited.
2. **Postgres row-level security** as a second tenancy barrier (RELEASE_BLOCKERS S2).
3. **Building a records template in the browser test field by field**, replacing the posted template in `flow.spec.ts` (DECISIONS 153).
4. **Pagination** on the runs list, reject list and activity log; a background queue if files get large.
5. **Password reset and email verification**, once an email provider exists.
6. **Two-factor sign-in for owners.**
7. Earlier queue, still open: deduction research; rate data, which is blocked on documents (NEEDS_HUMAN A).

## How to run

    npm install
    service postgresql start        # this workspace only; Postgres stops between sessions
    npm run check
    npm run test:integration
    CHROME_PATH=/usr/bin/google-chrome npm run e2e

## Limits found this session

- Prisma engines cannot be downloaded here (403). Docker has no daemon here, so the image is unbuilt.
- The workspace shell still cannot reach obcctc.ca, BC Laws or CanLII.
- Background processes, including Postgres, stop between replies.
