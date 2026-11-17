# Operations

## Health

`GET /api/health` returns `{"status":"ok"}` with 200 when the database answers, 503 otherwise. Point the host's health check and an uptime alert at it.

## Errors

Anything unhandled is logged as one JSON line with `event: "unhandled_error"`, the route pattern, the error's name and the first stack frame. The message is never logged, because it can quote a value from a customer's file. If `ERROR_WEBHOOK_URL` is set the same four fields are POSTed there.

## Logs

One JSON line per API request: route pattern, method, status, milliseconds, organization id, user id. No names, emails, file names or amounts. A test fails if that changes.

## Backups

DigitalOcean Managed PostgreSQL takes a daily backup and keeps point-in-time recovery for 7 days. That covers a bad deploy or a mistake made this week. It does not cover the account being closed or a mistake noticed after 7 days, so take your own copy monthly:

    # from a machine in Canada, with the connection string from the DigitalOcean dashboard
    pg_dump --format=custom --no-owner --file=draycomply-$(date +%F).dump "$DATABASE_URL"

Keep the file encrypted, in Canada, and delete copies older than a year. It contains payroll data.

### Restoring

1. In DigitalOcean: Databases, the cluster, Backups, "Restore to a new cluster", choose the time. This makes a second cluster; the first is untouched.
2. Or from your own dump: create an empty database, then `pg_restore --no-owner --dbname="$NEW_DATABASE_URL" draycomply-2026-12-01.dump`.
3. Point the app's `DATABASE_URL` and `DATABASE_CA_CERT` at the restored cluster and redeploy.
4. Open a run and press "Recompute and compare". Identical means the restored inputs and results agree.

Do this once before the first customer, so the first restore is not during an emergency.

## Routine commands

    npm run db:migrate          # apply migrations (also runs at every container start)
    npm run db:purge-expired    # expired sessions and old attempt rows; run daily
    npm run org:create -- "Company name" owner@example.com   # new customer; prints a one-time owner link
    npm run db:seed-demo        # needs DEMO_EMAIL and DEMO_PASSWORD

## Marking rates or readings as reviewed

- A schedule: set `status: 'verified'` and `verifiedBy` in its file under `packages/rates`, then deploy. New runs stop being watermarked. Old runs keep their watermark, because they are immutable; run again.
- A legal reading: set `status: 'reviewed'` and `reviewedBy` in `packages/rates/legal-interpretations.ts`.

## Resetting a password by hand (until email exists)

Have the person choose a new password, then on your own machine:

    npx tsx -e "import('./apps/web/server/crypto.ts').then(async c => console.log(await c.hashPassword(process.argv[1])))" 'the new password'

and `update users set password_hash = '<output>' where email = '<their email>'; delete from sessions where user_id = (select id from users where email = '<their email>');`
