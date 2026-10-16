// ─── Hope Awards Kenya 2026 — Schedule (single source of truth) ──────────────
// All server and client code must import dates from this file so the
// voting window and awards-night copy never drift apart again.

export const VOTING_START = new Date("2026-10-25T00:00:00+03:00").getTime();

// ENFORCED (server-internal) close time — 15 minutes past public midnight.
// The public announcement says voting closes at midnight on 6 Dec; the hard
// server guard actually closes at 00:15. This buffer is intentional and is
// known only to management. Do NOT expose VOTING_END (or 00:15) anywhere in
// client-facing UI, meta tags, or API responses.
export const VOTING_END = new Date("2026-12-06T00:15:00+03:00").getTime();

/** Publicly displayed close time (midnight on the 6th) — UI/meta copies only. */
export const VOTING_PUBLIC_END = new Date("2026-12-06T00:00:00+03:00").getTime();

/** Short label for interpolated strings, e.g. `Awards night ${AWARDS_DATE}.` */
export const AWARDS_DATE = "date to be announced";

export const AWARDS_VENUE = "Express Way Lounge, Mombasa Road";

/** Full display strings */
export const VOTING_OPEN_TEXT = "25th October 2026 (12:00 AM midnight EAT)";
export const VOTING_CLOSE_TEXT = "6th December 2026 (Midnight EAT)";
