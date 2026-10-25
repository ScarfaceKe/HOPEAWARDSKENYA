import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTSTANDING_PROMPT_MS,
  VoteVelocityGuard,
  maskPhone,
  normalizeVotePhone,
  parseVoteOrder,
} from "../server/vote-rules";
import { getRecentAlerts } from "../server/alerts";
import { MAX_VOTES_PER_TRANSACTION, VOTE_PRICE_KES } from "../shared/site";

const goodBody = { artistId: 12, votesAdded: 3, phone: "0712 345 678" };

test("accepts a normal order and prices it from the shared constant", () => {
  const result = parseVoteOrder(goodBody);
  assert.ok(result.ok);
  assert.equal(result.order.phone, "254712345678");
  assert.equal(result.order.artistId, 12);
  assert.equal(result.order.votesAdded, 3);
  assert.equal(result.order.amountKes, 3 * VOTE_PRICE_KES);
});

test("rejects fractional vote counts (`2.5` used to slip through)", () => {
  for (const input of [2.5, "2.5", -5, 0, "abc", "", null, undefined, true, {}, [3], 1e12]) {
    const result = parseVoteOrder({ ...goodBody, votesAdded: input });
    assert.equal(result.ok, false, `votesAdded=${JSON.stringify(input)} must be rejected`);
    if (!result.ok) assert.equal(result.status, 400);
  }
});

test("accepts digit strings but rejects anything that only coerces", () => {
  assert.equal(parseVoteOrder({ ...goodBody, votesAdded: "3" }).ok, true);
  assert.equal(parseVoteOrder({ ...goodBody, votesAdded: ["3"] }).ok, false);
  assert.equal(parseVoteOrder({ ...goodBody, votesAdded: true }).ok, false);
});

test("enforces the per-transaction ceiling server-side", () => {
  assert.equal(parseVoteOrder({ ...goodBody, votesAdded: MAX_VOTES_PER_TRANSACTION }).ok, true);
  const over = parseVoteOrder({ ...goodBody, votesAdded: MAX_VOTES_PER_TRANSACTION + 1 });
  assert.equal(over.ok, false);
  if (!over.ok) assert.match(over.message, /Maximum/);
});

test("rejects bad artist ids", () => {
  for (const artistId of [0, -1, "abc", "1.5", null, undefined, {}, [1]]) {
    assert.equal(parseVoteOrder({ ...goodBody, artistId }).ok, false, `artistId=${JSON.stringify(artistId)}`);
  }
});

test("normalises the phone shapes fans actually type", () => {
  assert.equal(normalizeVotePhone("0712345678"), "254712345678");
  assert.equal(normalizeVotePhone("+254 712 345 678"), "254712345678");
  assert.equal(normalizeVotePhone("254712345678"), "254712345678");
  assert.equal(normalizeVotePhone("712345678"), "254712345678");
  assert.equal(normalizeVotePhone("0112345678"), "254112345678");
});

test("rejects numbers M-Pesa cannot charge", () => {
  for (const phone of ["0712345", "12345", "020 1234567", "+1 202 555 0143", "", undefined, 254712345678]) {
    assert.equal(normalizeVotePhone(phone as unknown), "", `phone=${JSON.stringify(phone)}`);
  }
  const missing = parseVoteOrder({ artistId: 3, votesAdded: 1 });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.message, /M-Pesa number/);
});

test("maskPhone never returns a full number", () => {
  assert.equal(maskPhone("254712345678"), "25471***78");
  assert.equal(maskPhone("123"), "***");
});

test("blocks the seventh attempt from one number inside the window", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 6; i++) {
    const result = guard.check(
      { phone: "254712345678", ip: "1.1.1.1", artistId: 1 + i, votesAdded: 1, amountKes: 10 },
      t0 + i * 1000,
    );
    assert.equal(result.allowed, true, `attempt ${i + 1}`);
  }
  const blocked = guard.check(
    { phone: "254712345678", ip: "1.1.1.1", artistId: 9, votesAdded: 1, amountKes: 10 },
    t0 + 6000,
  );
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.status, 429);
});

test("blocks a double-tap on the identical order but allows a real retry", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  const order = { phone: "254700000001", ip: "2.2.2.2", artistId: 5, votesAdded: 10, amountKes: 100 };
  assert.equal(guard.check(order, t0).allowed, true);
  const again = guard.check(order, t0 + 10_000);
  assert.equal(again.allowed, false);
  if (!again.allowed) assert.match(again.message, /already sent/i);
  assert.equal(guard.check(order, t0 + 40_000).allowed, true);
});

test("one live prompt per number: a second prompt is refused until the first settles", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  const first = { phone: "254733000001", ip: "3.3.3.3", artistId: 7, votesAdded: 2, amountKes: 20 };
  assert.equal(guard.check(first, t0).allowed, true);
  guard.markPromptSent("254733000001", t0);

  // Same amount, different nominee: still only one prompt on the phone.
  const second = guard.check({ ...first, artistId: 8, votesAdded: 5, amountKes: 50 }, t0 + 30_000);
  assert.equal(second.allowed, false);
  if (!second.allowed) {
    assert.equal(second.status, 429);
    assert.match(second.message, /still waiting/i);
  }

  // Other numbers are not affected.
  assert.equal(guard.check({ ...first, phone: "254733000002" }, t0 + 31_000).allowed, true);

  // Once the order settles, the number can vote again immediately.
  guard.release("254733000001");
  assert.equal(guard.check({ ...first, artistId: 9, votesAdded: 1, amountKes: 10 }, t0 + 40_000).allowed, true);
});

test("a prompt nobody approved stops blocking after OUTSTANDING_PROMPT_MS", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  const order = { phone: "254733000003", ip: "4.4.4.4", artistId: 3, votesAdded: 1, amountKes: 10 };
  assert.equal(guard.check(order, t0).allowed, true);
  guard.markPromptSent("254733000003", t0);
  assert.equal(guard.check({ ...order, artistId: 4 }, t0 + 60_000).allowed, false);
  assert.equal(
    guard.check({ ...order, artistId: 5 }, t0 + OUTSTANDING_PROMPT_MS + 1).allowed,
    true,
    "an abandoned prompt must not lock the fan out forever",
  );
});

test("enforces the daily vote ceiling for a single number", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  // 11 minutes apart, so the 10-minute attempt window never fills up: this
  // isolates the daily ceiling from the short-term velocity cap.
  const gap = 11 * 60_000;
  for (let i = 0; i < 6; i++) {
    const result = guard.check(
      { phone: "254700000002", ip: `10.0.0.${i}`, artistId: 1, votesAdded: 5000, amountKes: 50_000 },
      t0 + i * gap,
    );
    assert.equal(result.allowed, true, `order ${i + 1} should be allowed`);
  }
  const state = guard.stateFor("254700000002");
  assert.ok(state);
  assert.equal(state.votesToday, 30_000);
  const blocked = guard.check(
    { phone: "254700000002", ip: "10.0.0.99", artistId: 1, votesAdded: 5000, amountKes: 50_000 },
    t0 + 6 * gap,
  );
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.match(blocked.message, /today's limit/i);
});

const PHONE_DAILY_CAP = 30_000;

test("a fan cannot exceed the daily ceiling across many small orders", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  let votes = 0;
  let blockedAt = -1;
  for (let i = 0; i < 40; i++) {
    const result = guard.check(
      { phone: "254700000003", ip: `10.1.0.${i % 20}`, artistId: 1, votesAdded: 2000, amountKes: 20_000 },
      t0 + i * 11 * 60_000,
    );
    if (!result.allowed) {
      blockedAt = i;
      break;
    }
    votes += 2000;
  }
  assert.ok(blockedAt > 0, "the ceiling must eventually block");
  assert.ok(votes <= PHONE_DAILY_CAP, `never let more than the cap through (saw ${votes})`);
  assert.ok(votes >= PHONE_DAILY_CAP - 2000, `should allow up to the cap (saw ${votes})`);
});

test("blocks an implausible burst from one connection", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  let blockedAt = -1;
  for (let i = 0; i < 45; i++) {
    const result = guard.check(
      { phone: `25470001${String(1000 + i)}`, ip: "9.9.9.9", artistId: 1, votesAdded: 1, amountKes: 10 },
      t0 + i * 100,
    );
    if (!result.allowed) {
      blockedAt = i;
      break;
    }
  }
  assert.ok(blockedAt > 0 && blockedAt <= 40, `expected a block within 40 attempts, got ${blockedAt}`);
});

test("many numbers from one IP raises a critical alert without blocking", () => {
  const guard = new VoteVelocityGuard();
  const t0 = 1_700_000_000_000;
  let blocked = 0;
  for (let i = 0; i < 45; i++) {
    // 20s apart: inside the per-IP attempt rate, over the distinct-number threshold.
    const result = guard.check(
      { phone: `2547111${String(10000 + i)}`, ip: "8.8.8.8", artistId: 1, votesAdded: 1, amountKes: 10 },
      t0 + i * 20_000,
    );
    if (!result.allowed) blocked++;
  }
  assert.equal(blocked, 0, "fan-out is observed, not blocked");
  const alert = getRecentAlerts(50).find((a) => a.kind === "payment.ip_fanout");
  assert.ok(alert, "expected an ip_fanout alert");
  assert.equal(alert.severity, "critical");
});

test("alerts never carry a full MSISDN", () => {
  const recent = getRecentAlerts(100);
  const serialised = JSON.stringify(recent.map((a) => a.context ?? {}));
  assert.equal(serialised.includes("254711110000"), false);
  assert.equal(serialised.includes("254700000002"), false);
});
