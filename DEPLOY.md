# DEPLOY

A checklist you can follow yourself. Nothing here has been done: no account exists and nothing is deployed.

Host: DigitalOcean App Platform, region Toronto (`tor`). Database: DigitalOcean Managed PostgreSQL, datacenter `TOR1`. Why: DECISIONS 144.

## Expected monthly cost (US dollars, read 2026-11-16; check the pricing pages on the day)

| Item | About |
|---|---|
| Managed PostgreSQL, smallest single node (1 GB RAM, 10 GB disk, daily backups) | $15 |
| App Platform, one container with 1 GB RAM | $10 to $12 |
| Domain name | $1 to $2 (about $15 to $20 a year) |
| **Total** | **about $27 to $30** |

A 512 MB container is about $5 and may be enough; start at 1 GB and look at memory use after a week. A standby database node doubles the database cost; add it when a customer depends on uptime.

## Before you start

- [ ] Read `RELEASE_BLOCKERS.md`. Deploying is not the same as being ready for a customer to rely on a report.
- [ ] Merge branch `v-2` into `main` (the app spec deploys `main`).
- [ ] CI is green on `main` (GitHub, Actions tab: three jobs).

## 1. Accounts to create

- [ ] **DigitalOcean** (digitalocean.com). Needs a payment card. Turn on two-factor sign-in.
- [ ] **A domain registrar**, if you do not have a domain. Any will do.
- [ ] GitHub you already have. During step 4 DigitalOcean asks for access to the `DrayComply` repository only; grant just that one.
- [ ] Optional, later: an email provider and an error tracker (NEEDS_HUMAN 22 and 29).

## 2. Create the database

- [ ] DigitalOcean, Databases, Create. Engine PostgreSQL 16. **Datacenter Toronto (TOR1).** Smallest basic plan. Name it `draycomply-db`.
- [ ] Wait until it shows as online.
- [ ] Open a support ticket or read the backup documentation and confirm backups for a TOR1 cluster stay in Canada (NEEDS_HUMAN 26). Record the answer in RELEASE_BLOCKERS P1.
- [ ] Under "Trusted sources", leave it empty for now; step 4 adds the app automatically.

## 3. Build the image once on your own machine

The image has never been built (NEEDS_HUMAN 25). Find out now, not during a deploy.

    docker build -t draycomply .
    docker run --rm -p 8080:8080 \
      -e DATABASE_URL=postgresql://dray:dray@host.docker.internal:5432/dray_dev \
      -e APP_URL=http://localhost:8080 -e SIGNUP_OPEN=true draycomply

- [ ] The container prints `migrations applied` and then Next's "Ready".
- [ ] http://localhost:8080/api/health shows `{"status":"ok"}`.
- [ ] If the build fails, stop here and bring me the error.

## 4. Create the app

- [ ] Edit `.do/app.yaml`: replace `https://REPLACE-WITH-YOUR-DOMAIN` with your real origin, for example `https://app.yourdomain.ca`. No trailing slash. Check `instance_size_slug` against the App Platform pricing page. Commit to `main`.
- [ ] DigitalOcean, Apps, Create, "Use an app spec", and choose `.do/app.yaml` from the repository. Or with the CLI: `doctl apps create --spec .do/app.yaml`.
- [ ] Confirm the region shown is **Toronto**. If it shows anything else, stop.
- [ ] Confirm the database component is attached to the existing `draycomply-db` cluster, not a new "dev database".

### Environment variables (all set by the spec; check each in the app's Settings)

| Variable | Value | Secret |
|---|---|---|
| `DATABASE_URL` | `${db.DATABASE_URL}`, filled in by DigitalOcean | yes |
| `DATABASE_CA_CERT` | `${db.CA_CERT}`, filled in by DigitalOcean | yes |
| `APP_URL` | your origin, exactly as typed in a browser, no trailing slash | no |
| `SIGNUP_OPEN` | `false` | no |
| `CLIENT_IP_HEADER` | `do-connecting-ip` (verify, NEEDS_HUMAN 27) | no |
| `ERROR_WEBHOOK_URL` | unset until you have an error tracker | yes |
| `NODE_ENV`, `PORT` | set inside the image; do not add them | |

`APP_URL` must match the address in the browser exactly, or every form is refused with "This request did not come from the application".

## 5. Domain

- [ ] App, Settings, Domains, add `app.yourdomain.ca`. Add the CNAME record it shows at your registrar.
- [ ] Wait for the certificate to show as active. HTTPS is then automatic.

## 6. First deploy

- [ ] Press Deploy. Watch the runtime logs for `migrations applied`.
- [ ] If the logs show a certificate error from the database, `DATABASE_CA_CERT` is empty: re-check step 4.

## 7. Verify the deploy worked

- [ ] `https://app.yourdomain.ca/api/health` returns `{"status":"ok"}`.
- [ ] `curl -sI https://app.yourdomain.ca/ | grep -i -E "strict-transport|content-security|x-frame"` shows all three headers.
- [ ] `https://app.yourdomain.ca/signup` says accounts are by invitation only.
- [ ] Create the demo, from your own machine with the production connection string in your shell (not in a file). Add your machine's address to the database's trusted sources first, and remove it after:

      DATABASE_URL='...' DATABASE_CA_CERT="$(cat ca-certificate.crt)" APP_URL=https://app.yourdomain.ca \
        DEMO_EMAIL=you+demo@yourdomain.ca DEMO_PASSWORD='a long password you choose' npm run db:seed-demo

- [ ] Sign in as the demo user. The banner says "Demonstration organization".
- [ ] Open Runs, open the run: five drivers, two with a shortfall, one insufficient data, totals $62.76 on both comparisons.
- [ ] Press "Recompute and compare": "the result is identical".
- [ ] Download the binder. It opens, has no watermark, and section 8 lists the readings pending legal review.
- [ ] In a private window, paste the run's address: you are sent to sign in.
- [ ] Sign in wrongly eleven times with one email: the eleventh says "Too many attempts". Then check NEEDS_HUMAN 27: from a different network, sign-in for a different email should still work. If it does not, the address header is wrong.
- [ ] In DigitalOcean, the app's Insights show memory under the instance's limit.

## 8. Right after

- [ ] App, Settings, Alerts: turn on deployment-failed and health alerts to your email.
- [ ] Schedule `npm run db:purge-expired` daily (an App Platform job, or run it by hand weekly at first).
- [ ] Take a `pg_dump` and restore it once (`docs/OPERATIONS.md`).
- [ ] Set log retention to 30 days or less.

## Onboarding a customer

    DATABASE_URL='...' DATABASE_CA_CERT='...' APP_URL=https://app.yourdomain.ca npm run org:create -- "Their Company Ltd." owner@theircompany.ca

Send them the link it prints. It works once, for that email, for 7 days.

## Rolling back

App, Activity, pick the previous deployment, "Rollback". Migrations are not rolled back; so far every migration only adds things, so the previous code runs on the newer schema.
