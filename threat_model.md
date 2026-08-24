# Threat Model

## Project Overview

Hope Awards Kenya is a React + Express voting platform backed by PostgreSQL and Paystack. Public users can browse nominees, submit nominations, upload nomination images, and pay to cast votes; a password-only admin surface manages nominees and nomination requests. Production risk is concentrated in the Express API, the shared session-based admin boundary, public submission flows, and the Paystack payment finalization paths.

## Assets

- **Admin session and shared admin password** -- compromise gives full control over nominee management, nomination review, artist deletion, and export of submitter phone numbers.
- **Voting integrity data** -- vote counts, Paystack references, and award timing rules determine contest outcomes and must not be forged, duplicated, or accepted outside the voting window.
- **Nomination data** -- nominee names, images, categories, and submitter phone numbers are user-supplied data that should only be exposed through intended workflows.
- **Uploaded media storage** -- public and admin image uploads are stored in PostgreSQL and served back from same-origin endpoints, so abuse can affect both storage availability and browser trust.
- **Application secrets** -- `SESSION_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL`, and Paystack API keys enable privileged access and payment operations.

## Trust Boundaries

- **Browser to Express API** -- all route inputs are attacker-controlled, including JSON bodies, query strings, path params, and uploaded files.
- **Public to admin boundary** -- `/api/admin/*`, artist management, uploads used by admin workflows, and request export must remain inaccessible without a valid admin session.
- **Server to PostgreSQL** -- nomination records, vote records, uploaded images, and sessions are persisted here; abusive public write paths can directly impact availability and confidentiality.
- **Server to Paystack** -- the backend initializes and verifies payments using a secret key; only authentic, in-scope payment events should be allowed to create votes.
- **Production vs dev-only boundary** -- `server/vite.ts`, local screenshots, attached assets, and build tooling are dev-only unless separately shown to be reachable from production.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/static.ts`
- **Highest-risk areas:** admin auth/session setup in `server/routes.ts`; Paystack initialize/verify/webhook handlers; public upload and nomination routes; phone-based status lookup and nominee share routes
- **Surface split:** public (`/api/artists`, `/api/paystack/*`, `/api/requests`, `/api/upload-public`, `/api/my-status`, `/api/requests/:id/public`), admin (`/api/admin/*`, artist CRUD, request export/update, `/api/upload`)
- **Usually dev-only:** `server/vite.ts`, `script/`, `screenshots/`, `attached_assets/`, generated `dist/`

## Threat Categories

### Spoofing

The application uses a single shared admin password with `express-session` to establish administrative access. The system must ensure that admin login attempts cannot be brute-forced over the public internet and that only a legitimately authenticated admin session can reach nominee-management and export routes. Paystack webhooks must be authenticated with the provider signature, and payment verification must only trust provider-confirmed transactions tied to this platform.

### Tampering

Contest integrity depends on server-side enforcement of category capacity, nominee approval state, and voting open/close windows. Public clients must not be able to bypass UI-only timing restrictions, submit business actions outside the intended phase, or cause votes to be recorded after the configured close time. Uploaded files and payment metadata must be validated at the server boundary before they influence stored state.

### Information Disclosure

Nomination requests include personal phone numbers and unpublished nomination details. Public endpoints must not let unauthenticated users enumerate or infer nomination status, pending entries, or other user-submitted records by guessing phone numbers or numeric IDs. API responses and logs must avoid exposing more personal or operational data than each caller needs. Admin exports that combine untrusted nominee fields with sensitive submitter data must also be safe to open in spreadsheet software without evaluating attacker-supplied formulas.

### Denial of Service

The application exposes unauthenticated write paths for nominations, uploads, and payment initialization. These endpoints must resist automated abuse with effective rate limiting and bounded resource consumption so attackers cannot exhaust database storage, session capacity, or outbound payment/provider requests.

### Elevation of Privilege

Admin-only routes control the platform’s authoritative data. The backend must enforce authorization server-side for all management routes and exports, and must not allow public endpoints or business-logic flaws to produce effects equivalent to admin privileges, such as publishing unpublished entries or changing final vote totals outside authorized windows.
