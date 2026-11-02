/**
 * The linking code is read from a screen and typed by a human under time
 * pressure. Getting the grouping or the expiry wrong makes a working code look
 * broken, so both are pinned here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PAIRING_CODE_TTL_MS,
  formatPairingCode,
  pairingCodeSecondsLeft,
} from "../shared/pairing";

test("the pairing code is shown the way WhatsApp groups it", () => {
  assert.equal(formatPairingCode("ABCD1234"), "ABCD-1234");
  assert.equal(formatPairingCode("abcd1234"), "ABCD-1234");
  // Already dashed input is normalised, never double-dashed.
  assert.equal(formatPairingCode("ABCD-1234"), "ABCD-1234");
  // Never mangle a value we did not expect.
  assert.equal(formatPairingCode("ABC"), "ABC");
});

test("the code countdown starts at three minutes and stops at zero", () => {
  const issued = 1_700_000_000_000;
  assert.equal(pairingCodeSecondsLeft(issued, issued), 180);
  assert.equal(pairingCodeSecondsLeft(issued, issued + 60_000), 120);
  assert.equal(pairingCodeSecondsLeft(issued, issued + PAIRING_CODE_TTL_MS), 0);
  assert.equal(pairingCodeSecondsLeft(issued, issued + PAIRING_CODE_TTL_MS + 5_000), 0);
  assert.equal(pairingCodeSecondsLeft(null), null);
});
