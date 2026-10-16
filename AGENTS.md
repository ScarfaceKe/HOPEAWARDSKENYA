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

- Run `npm run check` (TypeScript) and `npm run build` before claiming a change works.
- Backend: Express + Drizzle on Postgres (`server/`, `shared/`). There is no test suite, so verify
  behaviour directly (e.g. curl against the running app) instead of assuming a build is proof.
