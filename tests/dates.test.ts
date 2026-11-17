/**
 * Schedule invariants.
 *
 * The voting window moved twice (and a stale "after close" test fixture slipped
 * through the second move), so the shape of the schedule is now pinned here:
 * the public close is midnight EAT, the enforced close is exactly 15 minutes
 * later, and that buffer never leaks into anything a fan can read.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  VOTING_START,
  VOTING_END,
  VOTING_PUBLIC_END,
  VOTING_CLOSE_TEXT,
  VOTING_OPEN_TEXT,
  AWARDS_DATE,
} from "../shared/dates";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** EAT is UTC+3 with no daylight saving, so a fixed offset is correct here. */
const EAT_OFFSET_MS = 3 * 60 * MINUTE;

/** The wall-clock hour/minute a timestamp reads as in Nairobi. */
function eatClock(ms: number): { hour: number; minute: number } {
  const d = new Date(ms + EAT_OFFSET_MS);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

test("the public close is midnight EAT", () => {
  const { hour, minute } = eatClock(VOTING_PUBLIC_END);
  assert.equal(hour, 0, "the announced close must read as midnight in Nairobi");
  assert.equal(minute, 0);
});

test("the enforced close is exactly 15 minutes after the public close", () => {
  assert.equal(
    VOTING_END - VOTING_PUBLIC_END,
    15 * MINUTE,
    "the management buffer is 15 minutes; changing it changes what fans are told",
  );
});

test("the voting window opens before it closes and lasts whole days", () => {
  assert.ok(VOTING_START < VOTING_PUBLIC_END, "voting must open before it closes");
  assert.equal(
    (VOTING_PUBLIC_END - VOTING_START) % DAY,
    0,
    "the window should be a whole number of days",
  );
  const days = (VOTING_PUBLIC_END - VOTING_START) / DAY;
  // Announced as 25 October -> midnight, so 44 days after the two-day extension.
  assert.ok(days > 0 && days <= 60, `unexpected window length: ${days} days`);
});

test("the switch to awards night leaves room after voting closes", () => {
  const awardsNight = new Date(AWARDS_DATE).getTime();
  assert.ok(Number.isFinite(awardsNight), `AWARDS_DATE is not a date: "${AWARDS_DATE}"`);
  assert.ok(
    awardsNight > VOTING_END,
    "awards night must fall after voting closes, or the countdown reads backwards",
  );
});

test("the enforced 00:15 buffer never appears in public copy", () => {
  for (const text of [VOTING_CLOSE_TEXT, VOTING_OPEN_TEXT]) {
    assert.doesNotMatch(text, /00:15|12:15/, `"${text}" exposes the private close buffer`);
  }
  // The public close is announced as midnight, so the copy must say so.
  assert.match(VOTING_CLOSE_TEXT, /Midnight/i);
  assert.doesNotMatch(VOTING_CLOSE_TEXT, /00:15/, "close copy must not leak the buffer");
});
