// ─── Hope Awards Kenya 2026 — Schedule (single source of truth) ──────────────
// All server and client code must import dates from this file so the
// voting window and awards-night copy never drift apart again.

export const VOTING_START = new Date("2026-10-25T00:00:00+03:00").getTime();
export const VOTING_END = new Date("2026-12-06T00:15:00+03:00").getTime();

/** Short label for interpolated strings, e.g. `Awards night ${AWARDS_DATE}.` */
export const AWARDS_DATE = "date to be announced";

export const AWARDS_VENUE = "Express Way Lounge, Mombasa Road";

/** Full display strings */
export const VOTING_OPEN_TEXT = "25th October 2026 (12:00 AM midnight EAT)";
export const VOTING_CLOSE_TEXT = "6th December 2026 (00:15 EAT)";
