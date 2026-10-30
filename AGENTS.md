# Project Rules — Hope Awards Kenya

Standing instructions for anyone (human or AI agent) working in this repository.

## Git delivery

- **Never run `git push`, and never trigger a deploy, without explicit approval from the owner.**
  Rule set by the owner on 2026-10-16. Edit and verify freely; stop and report instead.
  Wait for a clear "push it" / "deploy it" before anything leaves this machine.

## Environment

- `.env` / `.env.local` hold real secrets. Never read, print, or commit them.
- Production values live in the host's environment settings, not in the repo.

## Schedule (single source of truth: `shared/dates.ts`)

- Voting opens **2026-10-25 00:00 EAT** (`VOTING_START`).
- Publicly announced close is **midnight, 2026-12-06** (`VOTING_PUBLIC_END`) — this is what every
  client-facing surface, meta tag, and API response may show.
- Enforced server close is **2026-12-06 00:15 EAT** (`VOTING_END`) — a 15-minute management-only
  buffer. Never expose `VOTING_END` or `00:15` in UI, meta tags, or API payloads.

## Styling

- Keep the Tailwind directives, CSS variables, and the `@media (hover: none)` GPU-hardening block
  in `client/src/index.css` intact — it prevents compositor tearing on cheap Android GPUs
  (Mali/PowerVR/Adreno). New glass/blur effects must degrade to solid colours there.
- Avoid scroll-triggered reveal animations (`whileInView`) on content that must always be visible;
  a missed trigger leaves text permanently invisible.

## Verifying changes

- Run `npm run check` (TypeScript), `npm test` and `npm run build` before claiming a change works.
- `npm test` runs the `node:test` suites in `tests/` through `tsx` (no extra dependency, no database
  needed — `tests/routes.test.ts` points `DATABASE_URL` at a closed port and drives the real Express
  app over HTTP, so keep new cases on paths that are decided before storage).
- Backend: Express + Drizzle on Postgres (`server/`, `shared/`). Anything a test cannot reach has to be
  verified directly (e.g. curl against the running app) instead of assuming a build is proof.

## Security controls (server)

Money and admin access are guarded in dedicated modules — change the rules there, not inline in routes:

- `server/vote-rules.ts` — vote-order validation (whole numbers only, `MAX_VOTES_PER_TRANSACTION`
  ceiling, Kenyan M-Pesa numbers) and the in-memory velocity guard (per-number and per-IP caps,
  duplicate-order blocking, daily vote ceiling).
- `server/csrf.ts` — deny-by-default CSRF for every non-safe `/api` request; only the paths listed in
  `CSRF_EXEMPT_PATHS` skip it. The token is session-bound and handed out by `/api/admin/check`.
- `server/totp.ts` — RFC 6238 second factor for admin login, no extra dependency.
- `server/alerts.ts` — anomaly alerts (payment, CSRF, callbacks, lockouts). Every alert is logged and
  kept for the admin **Security** tab; the last 200 are in memory only.
- `admin_audit_log` — one row per admin mutation (what, when, from which IP), written via
  `audit()` in `server/routes.ts`.

### The MegaPay path is frozen — additive changes only

`/api/megapay/initialize`, `/api/megapay/status/:reference` and `/api/megapay/callback` are live and
settle to KCB paybill `522533`, account `8035572`. Do not rename, re-order, refactor or add behaviour
to them. A new payment provider (for example IntaSend for Tanzanian wallets) gets its own module and
its own route prefix and must reuse the same order validation, velocity guard and settlement rules —
it must never become a second branch inside this flow. `tests/megapay-lock.test.ts` fails the suite if
the route surface, the collection account, the charge call sites or the CSRF exemptions drift.

Optional-but-recommended environment variables (production values belong in the host's env settings):

| Variable | Purpose |
| --- | --- |
| `ADMIN_TOTP_SECRET` | Turns on two-factor admin login. Generate it from Admin → Security and add it to the host. |
| `MEGAPAY_CALLBACK_SECRET` | Shared secret the gateway must send on `/api/megapay/callback` (header `x-megapay-signature` or `?secret=`). |
| `MEGAPAY_CALLBACK_IPS` | Comma-separated allowlist of gateway IPs, used when MegaPay cannot send a secret. |
| `ALERT_WEBHOOK_URL` | HTTPS webhook (Slack-compatible `{text}` payload) for warning/critical alerts. |
| `MOBILESASA_USSD_SECRET` | Required for USSD voting. Portal secret under Settings → Webhooks; the callback is rejected without it. |

### USSD voting (`*246*2345#`) — MobileSasa

- `server/ussd.ts` owns the whole rail. It is a **second front door to the same money**, not a new
  provider: it records a pending order and charges through the same MegaPay gateway with the same
  `reference: collectionAccountNumber()`.
- The callback is authenticated by MobileSasa's HMAC signature (`X-MobileSasa-Signature`, hidden payload
  is the raw form body) or the shared secret header. Never disable that check to "test" it.
- Sessions are in memory, keyed on `sessionId`, and expire in 3 minutes. A missing session restarts the
  menu; it must never guess the step from the accumulated `text`.
- A nominee's USSD code is their artist id zero-padded to three digits (`42` → `042`), from
  `ussdNomineeCode()` in `shared/site.ts`. Never renumber them mid-season — they are printed on posters.
- `tests/megapay-lock.test.ts` pins this rail too: one charge call site, the same account number, the same
  validation, no second transaction-status lookup.

Without `MEGAPAY_CALLBACK_SECRET` or `MEGAPAY_CALLBACK_IPS` the callback stays open and the server
logs a loud warning — anyone who can reach it could claim a payment succeeded, so set one of them
before voting opens.
