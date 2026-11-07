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
- `server/manual-votes.ts` — persisted, off-by-default switch for logging manual vote adjustments. The
  switch is enforced on the server, not just hidden in the panel. `PATCH /api/artists/:id/votes` only
  accepts positive whole-number entries while it is on (never a deduction or overwrite), caps one entry
  at `MAX_MANUAL_VOTES_PER_ADDITION`, and writes an audit row. **It never changes `artists.total_votes`.**
  Official tallies are paid-only: `artists.total_votes` is rebuilt from the `votes` ledger at boot, and
  `getTotalVotesCast()` sums paid `votes` rows. Manual adjustments appear only in the audit log and are
  never counted in public totals, leaderboards or the admin total. Turning the switch off hides the
  controls and makes the route answer 409.
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
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API token. With `WHATSAPP_PHONE_NUMBER_ID`, approving a nominee sends their voting link automatically. |
| `WHATSAPP_PHONE_NUMBER_ID` | The WhatsApp Business number's id from the Meta app. |
| `WHATSAPP_TEMPLATE_NAME` | Optional approved template. Business-initiated messages need one outside the 24-hour window. Body parameters, in order: nominee name, category, voting link. |
| `WHATSAPP_TEMPLATE_LANG` | Optional template language code (default `en_US`). |
| `WHATSAPP_LOG_LEVEL` | Optional Baileys protocol log level (default `silent`). Set `warn` while diagnosing a failed link. |
| `ZERNIO_API_KEY` | Enables automatic poster posting to the Hope Awards Facebook Page, TikTok and YouTube through Zernio. Facebook/TikTok get the still poster; YouTube gets a 20-second vertical video with a generated gospel instrumental. Instagram is deliberately not connected. Create it at zernio.com → Settings → API Keys. Without it the Social tab explains the missing setup and posts nothing. |
| `ZERNIO_PROFILE_ID` | Optional. Use an existing Zernio profile instead of letting the server find/create `Hope Awards Kenya`. |

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

### Social poster posting — `server/social.ts` + `shared/social-caption.ts`

- **Only nominees with `artists.poster_ready = TRUE` are eligible while `social_automation.only_with_posters` is on (the default).** An uploaded photo is not proof of an official poster: admins mark the flag with the per-nominee pill in DELETE → MANAGE NOMINEES, the checkbox in EDIT, or the ADD ARTIST checkbox. The queue, its count and its preview must all apply the same filter; never infer poster readiness from `image_url`.
- One poster per artist, one row in `social_posts` (unique `artist_id`). The same poster can never publish twice; a failed post gets at most three attempts, then the queue moves on.
- The production server owns both the timer and manual publishing. The preview and test process never post to the real accounts (`SOCIAL_ALLOW_DEV_POSTS=true` is the only override, for a staging install with its own accounts). `startSocialAutomation()` starts the queue; manual publishing from Admin → Social uses `runSocialQueue({ force: true })` and bypasses the pause switch, the 4-hour slot and the retry wait, not the attempt cap, the one-row ledger or platform validation.
- The automatic cadence is one poster every 4 hours (6 per platform per day). Facebook's 100/day, TikTok Business's 15 photo/day and Zernio's 25/hour caps are not the constraint; **YouTube is**: a Data API video upload costs 1,600 of the default 10,000 units/day, so 6 uploads use 9,600. Do not raise the cadence back to 8/day without checking the channel's YouTube quota. Instagram is intentionally not in `SOCIAL_PLATFORMS`.
- `social_automation` holds the switch, Zernio profile id and last slot. Enabling it resets the slot so the next poster can go on the next five-minute queue tick (or immediately with POST NEXT POSTER); pausing survives restarts. The queue is off on a fresh install.
- Media must be a publicly reachable **HTTPS** URL. Uploaded images are served from `https://www.hopeawards.co.ke` (the bare domain 301s, which some media fetchers do not follow). `socialMediaUrl()` throws on `http://`, empty and scheme-only values rather than silently handing a bad URL to a platform, and the queue queries skip rows that are neither a relative path nor HTTPS so one bad URL cannot block every later poster.
- **YouTube gets a video, not the still image.** `server/poster-video.ts` renders a 1080x1920, 20-second H.264/AAC MP4 and uploads it to Zernio's presigned media storage; `server/gospel-audio.ts` synthesizes the soundtrack (original gospel organ/pentatonic instrumental). Do not swap in a copyrighted gospel recording: the generated track is deliberate so YouTube Content ID cannot mute or block the upload. The video uses the finished poster over a blurred, darkened copy of itself and becomes a YouTube Short. If YouTube is connected and the video cannot be rendered/uploaded, fail the whole post so the ledger retries it; never silently publish only Facebook/TikTok.
- ffmpeg comes from the `@ffmpeg-installer/ffmpeg` dependency; do not replace it with a system `ffmpeg` call. The npm package carries the static binary the Node host needs.
- Captions are **automatic**, built from the nominee's own row by `buildSocialCaption()`: name, category, USSD code, `/artist/:id` link, KES 10 and `VOTING_CLOSE_TEXT`. There is no manual caption editor and no generic fallback copy; the caption always names the person on the poster. Never hard-code a name or expose `VOTING_END` / `00:15`. TikTok gets a ≤90-character title and the full caption in `tiktokSettings.description`; Facebook uses the full caption; YouTube uses the title as its video title and the caption as its description.
- One request posts to every connected platform (`platforms[]` on Zernio), not one request per platform. The YouTube target carries `customMedia` with the rendered video while Facebook/TikTok use the shared still poster. Each platform's result is stored so a partial success is shown honestly in Admin → Social.
- Zernio is the transport and OAuth broker: the official `@zernio/node` SDK is already a dependency; do not add a second social-posting app or a parallel queue. Connect the Facebook Page, TikTok and YouTube channel from Admin → Social after setting `ZERNIO_API_KEY`. YouTube is a third connected account, so check the Zernio plan's account pricing.
- Account/API failures must never break the site or the WhatsApp rail. The timer catches errors, records them on the ledger and retries at most three times. A missing key or no connected accounts leaves everything else running.

### Nominee voting links (WhatsApp) — `server/whatsapp.ts` + `server/whatsapp-baileys.ts`

- `server/whatsapp.ts` owns the link (`/n/<request id>`), the congratulation message and the single
  send path (`notifyNominee`). Approval, the per-nominee button and the automatic run all call it,
  so a nominee can never receive two different links.
- `server/whatsapp-baileys.ts` is the transport: the awards' own WhatsApp number, linked once from
  Admin → WhatsApp automation with a pairing code or QR. It is an unofficial WhatsApp Web client —
  a number that spams strangers gets restricted, so runs are throttled (5 per batch, about a
  minute apart, at most one batch an hour) and a bad number is retried at most three times.
  `server/whatsapp-control.ts` owns that rate gate and the persistent pause switch; paused blocks
  approvals, single sends, bulk sends and the automatic sweep. The switch lives in
  `whatsapp_automation` and defaults to paused on a fresh install.
- The session must survive a deploy: the Baileys keys live in `whatsapp_auth`, never on disk. Do not
  switch this to `useMultiFileAuthState` — the host's disk is ephemeral, and re-pairing on every
  deploy would break the automation.
- This is automation, not buttons: approving a nominee messages them immediately (unless paused),
  and a sweep after the number is linked (then at most once an hour) covers everyone approved
  earlier who has no `sent` row. `nominee_notifications` is the ledger — check it before sending so
  nobody gets two messages.
- `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` remain as an optional Cloud API fallback. Baileys
  needs no template and no Meta review; the Cloud API path still does.
- Message copy must never mention the enforced close time (00:15). Only `VOTING_CLOSE_TEXT`.
- Only one process may hold the live session. `server/whatsapp-baileys.ts` takes a PostgreSQL session advisory lock (`WHATSAPP_LEADER_LOCK`) and refuses to connect in preview/test unless `WHATSAPP_ALLOW_DEV_SESSION=true`. This is what stops a deploy overlap or the shared preview from replacing the production socket and forcing a re-link.
- The first successful link on a fresh install auto-starts the queue once. Any explicit pause or resume sets `whatsapp_automation.auto_started`, so the automation never overrides the admin's choice again. Reconnects do not clear a chosen pause.
- Temporary drops retry themselves: `connectionReplaced` up to five times about a minute apart, `forbidden` up to twelve times two hours apart. Only `loggedOut`, `badSession` and `multideviceMismatch` require a new link (and clear the saved credentials).
- The automatic sweep sends one 5-message batch at most once an hour. A reconnect schedules another sweep, but `claimWhatsAppBatch()` still enforces the hourly slot and the persistent pause. Do not add a second scheduler or bypass that claim.
