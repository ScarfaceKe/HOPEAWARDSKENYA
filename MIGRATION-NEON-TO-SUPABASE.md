# Neon → Supabase migration runbook (Hope Awards Kenya)

Written during the November 2026 Neon compute-exhaustion incident, while a live
voting window is running. Read the whole document before running anything.

**Nothing here is executed automatically. A production `DATABASE_URL` change is a
manual, approved step.**

---

## 1. What actually ran out

Neon bills **compute time**, not queries. A Free project has 100 CU-hours per
month, and the smallest compute (0.25 CU) costs 0.25 CU-hour per hour it is
awake. Neon suspends a compute after **5 minutes with no query**; from that:

- 0.25 CU × 730 h = **182.5 CU-hours** for a month at 24/7.
- 100 CU-hours ≈ **400 hours** — 16.6 days.

So the allowance is only survivable if the compute is idle for roughly half the
month. Any query at least every 5 minutes keeps it awake permanently, even when
the site has no visitors. This app had several:

| Timer (before) | Interval | What it did |
| --- | --- | --- |
| `recoverPendingPayments` | 60 s | scanned `pending_payments` every minute, for ever |
| `reconcileRecentVotes` | 3 min | loaded every vote of the last hour, then gateway lookups |
| social queue tick | 5 min | read `social_automation` + Zernio on every tick |
| WhatsApp sweep loop | 15 min | read the automation switch to discover the hourly gate said no |
| upload cleanup | 30 min | 3 full-table selects + a DELETE, every half hour |
| `/api/health` | per request | ran `SELECT` on `categories` |
| admin dashboard | 5 s – 30 s | several database-backed queries while open |

None of those were user traffic. Together they kept the compute Active around the
clock, so the month burned ~182 CU-hours before real voting even mattered — the
compute was gone around day 16–17, exactly as Neon's alert describes. Voting
traffic and autoscaling up to 2 CU only made it faster.

**A fixed timer shorter than 5 minutes is a decision to never scale to zero.**
That was the bug.

After the fix (see `server/job-runner.ts` and §2 below), the database is woken by
real events: a fan starting a payment, a vote being credited, or one consolidated
hourly maintenance sweep. Empty passes leave no timer at all.

---

## 2. Can Supabase Free carry the current voting load?

**Yes, technically — with three caveats that matter for a money-handling app.**

Compatibility:

- Supabase *is* PostgreSQL. Drizzle ORM + `node-postgres` (`pg`), which this app
  uses, work unchanged. The storage layer stays on `DATABASE_URL`.
- The schema uses only `pgTable`, `serial`, `text`, `integer`, `timestamp`,
  `boolean`, indexes and `ON CONFLICT` — all plain PostgreSQL. No extensions, no
  triggers, no functions, no row-level security, no `pgsodium`. The app's
  `server/migrate.ts` recreates everything idempotently.
- Free plan: 500 MB database, Nano compute (shared CPU, 0.5 GB RAM, 60 direct
  connections / 200 pooled clients), 5 GB egress. This database is a few MB even
  after a full awards season, so size is not a risk.

Caveats:

1. **No backups on Free.** Supabase does not back up Free projects and offers no
   PITR. For payment records that is a real downgrade from "you have Neon's
   historical branch" — plan to take your own `pg_dump` at least daily during the
   window (script included below).
2. **Free projects pause after a week of low activity.** Not a risk while voting,
   but it must not be the long-term home of payment records.
3. **Use the *session* pooler (port 5432), not the transaction pooler (6543).**
   `server/whatsapp-baileys.ts` takes a session-level advisory lock
   (`pg_try_advisory_lock`) to guarantee only one process owns the WhatsApp
   socket. Transaction-mode pooling silently breaks session advisory locks, so
   two instances could both "own" the number.

**Recommendation, in order:**

1. **Best for this incident:** keep Neon and move the project to the **Launch**
   plan (pay-as-you-go, ~$0.106/CU-hour). A realistic post-fix month (idle most
   of the night + real voting traffic during the day) lands around 40–90
   CU-hours, i.e. a few dollars. No migration, no cutover, no new failure mode
   during voting. Also cap autoscaling (max compute 0.5 CU) so a burst cannot
   multiply the burn.
2. **If the allowance is already exhausted and cannot be raised:** Supabase Free
   is a workable temporary home for the remaining voting window, using the
   procedure below, accepting "no automated backups" and doing the dump daily.
   Do it during a low-traffic hour, not at peak.
3. **Do not** point Render at a fresh empty Supabase database. Votes, nominees
   and payment references must arrive with the data.

---

## 3. Pre-flight (do not skip)

- [ ] Voting traffic frozen or accepted as a known small delta (ideally a few
      minutes after a `pg_dump`; announce a short maintenance note).
- [ ] You have the current production `DATABASE_URL` (Neon) and a Supabase
      project's **session pooler** connection string.
- [ ] PostgreSQL client tools 16+ (`pg_dump`, `pg_restore`, `psql`) available.
      The shell environment is not the place these secrets are stored — pass them
      as environment variables on the command line only.
- [ ] The Render service is on an always-on plan (already true) so the cutover
      restart is quick.

## 4. Export (two independent copies)

```sh
mkdir -p backups
DATABASE_URL='postgresql://…neon…' sh ./scripts/db-export.sh
DATABASE_URL='postgresql://…neon…' sh ./scripts/db-export.sh ./backups/second-copy
```

The script uses `pg_dump --format=custom --no-owner --no-privileges` and then
runs `pg_restore --list` on the file so a corrupt backup fails immediately.

## 5. Restore into the replacement database

In the Supabase SQL editor (or `psql`), make sure the target is empty of the
app's tables. Drizzle/`runMigrations` will also create anything missing on boot,
but restoring into a non-empty `public` schema is how half-migrated databases
happen — start clean.

```sh
TARGET_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
  sh ./scripts/db-restore.sh backups/hopeawards-<stamp>.dump
```

`--single-transaction --exit-on-error` means a failure leaves the target
untouched. The script refuses to run if `TARGET_DATABASE_URL` equals
`DATABASE_URL`.

## 6. Verification gate — this is the part that protects the money

Run the same read-only checks against both databases and diff them:

```sh
psql "$DATABASE_URL"        -f scripts/db-verify.sql > backups/source.txt
psql "$TARGET_DATABASE_URL" -f scripts/db-verify.sql > backups/target.txt
diff backups/source.txt backups/target.txt
```

An empty diff means, section by section:

| Section | What it proves |
| --- | --- |
| 1 | Every table has the same row count (nominees, votes, categories, requests, pending payments, audit log, notifications, uploads, social posts, WhatsApp session). |
| 2 | Vote totals per nominee match, both the ranking tally and the paid ledger. Non-zero `difference` is legitimate only for admin manual adjustments — and must be identical on both sides. |
| 3 | The site-wide paid aggregate and revenue are identical. |
| 4 | Payment references are unique and none is missing. A duplicate here is a double-credit bug. |
| 5 | Pending payments survive with their MegaPay `gateway_request_id`, and no pending order is already credited. |
| 6 | Content checksums match (including uploaded images and the WhatsApp session, printed only as hashes). |
| 7 | Every sequence is at or above `max(id)`, so new votes/orders get fresh ids and cannot collide with migrated rows. |
| 8 | Indexes exist — in particular `votes_payment_reference_unique` (double-credit guard), `votes_gateway_request_id_idx`, `votes_created_at_idx`, `pending_payments_created_at_idx`. |
| 9 | The table set matches. |

If any section differs, **stop**. Do not change Render's `DATABASE_URL`.

## 7. Application smoke test against the replacement

Point a local/staging copy at `TARGET_DATABASE_URL` (never production Render yet):

```sh
DATABASE_URL="$TARGET_DATABASE_URL" npm run check
DATABASE_URL="$TARGET_DATABASE_URL" npm test            # 169 tests, no live DB needed
DATABASE_URL="$TARGET_DATABASE_URL" npm run build
DATABASE_URL="$TARGET_DATABASE_URL" PORT=5055 npm start # boots, runs migrations
curl -s localhost:5055/api/health | jq .                # status ok, database ok
curl -s localhost:5055/api/categories | jq 'length'
curl -s localhost:5055/api/artists | jq 'length'
```

Then drive one real read/write path. Do **not** create a fake paid vote on the
production target; verify a write with something reversible, e.g. an admin login
session and a category read, or re-run `scripts/db-verify.sql` after the boot to
confirm `job_leases` exists and the sequences are unchanged.

## 8. Cutover

1. Note the exact current Render value of `DATABASE_URL` (it is the rollback).
2. Render → service → Environment → set `DATABASE_URL` to the Supabase **session
   pooler** URL (port 5432, `postgres.<ref>` user, database `postgres`). Keep the
   existing SSL setup: `server/db.ts` sets `ssl: { rejectUnauthorized: false }`;
   do not append `sslmode=` (it can conflict and produce
   `DEPTH_ZERO_SELF_SIGNED_CERT`).
3. Leave `MEGAPAY_API_KEY`, `MEGAPAY_EMAIL`, `MEGAPAY_CALLBACK_SECRET`,
   `MEGAPAY_CALLBACK_IPS`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`,
   `WHATSAPP_*`, `ZERNIO_*`, `ALERT_WEBHOOK_URL` untouched.
4. Optionally add `DB_POOL_MAX=5` (the default is already 5).
5. Deploy/restart. Watch the boot log for `[migrate] Tables and DB indexes
   applied.` and `serving on port …`.
6. Immediately: `curl https://www.hopeawards.co.ke/api/health` (expect
   `"database":"ok"`), load `/api/artists`, `/api/categories`, and open one
   nominee page. Place a **real 10 KES test payment** only if the owner approves
   one; otherwise watch the first live payment's callback and the vote landing.
7. Re-run `scripts/db-verify.sql` on Supabase and compare the vote count against
   what the dashboard shows.

## 9. Rollback

Neon is **never deleted or modified** by this procedure (it is read-only after
the dump). Rollback is therefore:

1. Set Render's `DATABASE_URL` back to the Neon value and restart.
2. Re-check `/api/health` and one vote/status path.

**Important:** anything written to Supabase between cutover and rollback (votes,
payments, pending orders) is *not* in Neon. If the switch lasted more than a few
minutes, do a reverse migration instead of a plain rollback:

```sh
DATABASE_URL="$TARGET_DATABASE_URL" sh ./scripts/db-export.sh ./backups/reverse
# restore into a NEW Neon branch, verify with scripts/db-verify.sql, then swap
```

Never restore over the original Neon database.

## 10. If Neon is currently inaccessible

Do not pretend anything is complete:

- A Neon compute that hit its monthly allowance **resumes at the start of the next
  billing period, or immediately on upgrade/credits** (Neon does not delete the
  data). The project is not lost.
- While it is suspended there is no way to take a dump. Contact Neon support for
  an allowance/credit (they explicitly offer this) or upgrade the plan, then dump.
- Render cannot be pointed at an empty database to "keep the site up": every
  nominee, vote and payment reference would be gone. If the site must stay up
  before Neon returns, it should be taken to a read-only "we'll be right back"
  page, not a fresh database.

## 11. Post-migration checklist

- [ ] Neon project left untouched (still holds the pre-cutover data).
- [ ] Render `DATABASE_URL` points at the session pooler, not the transaction
      pooler.
- [ ] `/api/health` reports `database: ok`; external monitors point at
      `/api/health/live` (no database).
- [ ] The hourly maintenance sweep is running: look for `[maintenance] Payment
      safety net:` only when orders are open, and one `[job:maintenance]` pass an
      hour at most.
- [ ] Daily `pg_dump` scheduled off-host while Supabase Free has no backups.
- [ ] A 10 KES payment initiated from a real phone: prompt arrives, callback or
      the one-minute recovery credits it exactly once, `votes` row and
      `artists.total_votes` both move.
