/**
 * USSD voting (*246*2345#) is a money path: every screen ends in an M-Pesa
 * prompt against the same KCB account as the website. These tests drive the
 * whole menu tree without a database or a network, and pin the signature rule
 * that stops anyone else from posting steps into the session.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import {
  UssdSessions,
  handleUssd,
  registerUssdRoutes,
  verifyUssdSignature,
  USSD_CALLBACK_PATH,
  USSD_PACKS,
  type UssdDeps,
} from "../server/ussd";
import type { IStorage } from "../server/storage";
import { USSD_SHORTCODE, parseUssdNomineeCode, ussdNomineeCode } from "../shared/site";
import { VOTING_END, VOTING_START } from "../shared/dates";

const NOW = VOTING_START + 24 * 60 * 60_000; // day two of voting
const PHONE = "254712345678";
const ARTIST = { id: 42, name: "Jane Wanjiku", categoryName: "Best Female Artist 2026" };

interface Prepared {
  artistId: number;
  votesAdded: number;
  phone: string;
}

function harness() {
  const prepared: Prepared[] = [];
  const deps: UssdDeps = {
    getArtist: async (id) => (id === ARTIST.id ? ARTIST : undefined),
    getVotesByPhone: async () => [],
    preparePayment: async (order) => {
      prepared.push(order);
      return {
        ok: true,
        reference: `hopeawards-${order.artistId}-test`,
        votesAdded: order.votesAdded,
        amountKes: order.votesAdded * 10,
      };
    },
  };
  const sessions = new UssdSessions();
  const send = (text: string, sessionId = "sess-1", phone = PHONE) =>
    handleUssd({ sessionId, phoneNumber: phone, networkCode: "1", serviceCode: USSD_SHORTCODE, text }, deps, sessions, NOW);
  /**
   * Walks a real session: MobileSasa posts one callback per screen, each one
   * carrying the whole accumulated trail, so the test must do the same.
   */
  const dial = async (steps: string[], sessionId = "sess-1", phone = PHONE) => {
    // The dial itself is the first callback: empty text, main menu.
    let reply = await send("", sessionId, phone);
    for (let i = 0; i < steps.length; i++) {
      reply = await send(steps.slice(0, i + 1).join("*"), sessionId, phone);
    }
    return reply;
  };
  return { deps, sessions, send, dial, prepared };
}

test("the first screen is the menu and starts no payment", async () => {
  const { send, prepared } = harness();
  const reply = await send("");
  assert.match(reply, /^CON /);
  assert.match(reply, /1\. Vote/);
  assert.match(reply, /2\. My votes/);
  assert.equal(prepared.length, 0);
});

test("an unknown nominee code re-prompts instead of charging", async () => {
  const { dial, prepared } = harness();
  const reply = await dial(["1", "999"]);
  assert.match(reply, /^CON /);
  assert.match(reply, /No nominee with code 999/);
  assert.equal(prepared.length, 0);
});

test("the packs start at two votes — no single-vote option for KES 10", () => {
  assert.equal(USSD_PACKS[0], 2);
  assert.deepEqual(
    USSD_PACKS.map((votes) => votes * 10),
    [20, 30, 50, 100, 200, 500, 1000],
  );
});

test("a valid code opens the packs, and a pack asks for confirmation", async () => {
  const packsRun = harness();
  const packs = await packsRun.dial(["1", "42"]);
  assert.match(packs, /^CON /);
  assert.match(packs, /042 Jane Wanjiku/);
  for (const votes of USSD_PACKS) {
    assert.match(packs, new RegExp(`${votes} votes? KES ${votes * 10}`));
  }
  // Seven packs have to reach a feature phone in one screen.
  assert.ok(packs.length <= 160, `pack screen is ${packs.length} characters`);
  assert.equal(packsRun.prepared.length, 0);

  const confirmRun = harness();
  const confirm = await confirmRun.dial(["1", "42", "3"]);
  assert.match(confirm, /^CON /);
  assert.match(confirm, /Pay KES 50 for 5/);
  assert.match(confirm, /Best Female Artist 2026/);
  assert.match(confirm, /1\. Yes/);
  assert.equal(confirmRun.prepared.length, 0, "nothing may be charged before the fan confirms");
});

test("confirming sends exactly one order for the chosen pack", async () => {
  const { dial, prepared } = harness();
  const reply = await dial(["1", "42", "3", "1"]);

  assert.match(reply, /^END /);
  assert.match(reply, /Payment request sent/);
  assert.match(reply, /KES 50 for 5/);
  assert.deepEqual(prepared, [{ artistId: 42, votesAdded: 5, phone: PHONE }]);
});

test("cancelling never reaches the payment step", async () => {
  const { dial, prepared } = harness();
  const reply = await dial(["1", "42", "2", "2"]);
  assert.match(reply, /^END /);
  assert.match(reply, /Cancelled/);
  assert.equal(prepared.length, 0);
});

test("a replayed confirmation cannot charge twice", async () => {
  const { dial, send, prepared } = harness();
  await dial(["1", "42", "3", "1"]);

  const replay = await send("1*42*3*1");
  assert.match(replay, /^END /);
  assert.match(replay, /Session expired/);
  assert.equal(prepared.length, 1);
});

test("a refused payment is reported on the handset, not swallowed", async () => {
  const { sessions } = harness();
  const deps: UssdDeps = {
    getArtist: async () => ARTIST,
    getVotesByPhone: async () => [],
    preparePayment: async () => ({
      ok: false,
      message:
        "An M-Pesa prompt from this number is still waiting. Approve it, or dial again in 30 seconds.",
    }),
  };
  const send = (text: string) =>
    handleUssd(
      { sessionId: "sess-x", phoneNumber: PHONE, networkCode: "1", serviceCode: USSD_SHORTCODE, text },
      deps,
      sessions,
      NOW,
    );

  const steps = ["", "1", "1*42", "1*42*1", "1*42*1*1"];
  let reply = "";
  for (const step of steps) reply = await send(step);
  assert.match(reply, /^END /);
  // The exact countdown must survive the handset wording, not become "minutes".
  assert.match(reply, /dial again in 30 seconds/);
});

test("one session cannot inherit another number's nominee", async () => {
  const { dial, send, prepared } = harness();
  await dial(["1", "42", "1"]); // sitting on the confirmation for 254712345678

  // Same sessionId, different phone: the carried-over confirmation is dead.
  const other = await send("1*42*1*1", "sess-1", "254798765432");
  assert.match(other, /^END /);
  assert.match(other, /Session expired/);
  assert.equal(prepared.length, 0);
});

test("voting outside the window is refused before any menu work", async () => {
  const { deps, sessions } = harness();
  const before = await handleUssd(
    { sessionId: "early", phoneNumber: PHONE, networkCode: "1", serviceCode: USSD_SHORTCODE, text: "" },
    deps,
    sessions,
    VOTING_START - 1,
  );
  assert.match(before, /^END /);
  assert.match(before, /Voting opens/);

  const after = await handleUssd(
    { sessionId: "late", phoneNumber: PHONE, networkCode: "1", serviceCode: USSD_SHORTCODE, text: "" },
    deps,
    sessions,
    VOTING_END + 1,
  );
  assert.match(after, /^END /);
  assert.match(after, /Voting has closed/);
});

test("nominee codes are stable, zero-padded and parse back", () => {
  assert.equal(ussdNomineeCode(42), "042");
  assert.equal(ussdNomineeCode(7), "007");
  assert.equal(ussdNomineeCode(1234), "1234");
  assert.equal(parseUssdNomineeCode("042"), 42);
  assert.equal(parseUssdNomineeCode("42"), 42);
  assert.equal(parseUssdNomineeCode("0"), null);
  assert.equal(parseUssdNomineeCode("abc"), null);
  assert.equal(parseUssdNomineeCode("99999"), null);
});

test("the HTTP callback rejects unsigned calls and serves a signed menu", async () => {
  const secret = "ussd-http-secret";
  const previousSecret = process.env.MOBILESASA_USSD_SECRET;
  process.env.MOBILESASA_USSD_SECRET = secret;

  const realNow = Date.now;
  Date.now = () => NOW;

  // The route only needs storage once a fan confirms a payment; the menu path
  // never touches it, so a stub is enough to prove the wiring.
  const stub = {
    getArtist: async () => undefined,
    getCategory: async () => undefined,
    getVotesByPhone: async () => [],
  } as unknown as IStorage;

  const app = express();
  app.use(
    express.urlencoded({
      extended: false,
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  registerUssdRoutes(app, stub);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const body = "sessionId=s1&phoneNumber=254712345678&networkCode=1&serviceCode=%2A246%2A2345%23&text=";
  const stamp = Math.floor(NOW / 1000);
  const digest = crypto.createHmac("sha256", secret).update(`${stamp}.${body}`).digest("hex");

  try {
    const unsigned = await fetch(`${base}${USSD_CALLBACK_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    assert.equal(unsigned.status, 403);
    assert.match(await unsigned.text(), /^END /);

    const signed = await fetch(`${base}${USSD_CALLBACK_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-MobileSasa-Signature": `t=${stamp},v1=${digest}`,
      },
      body,
    });
    assert.equal(signed.status, 200);
    const reply = await signed.text();
    assert.match(reply, /^CON /);
    assert.match(reply, /1\. Vote/);
  } finally {
    Date.now = realNow;
    if (previousSecret === undefined) delete process.env.MOBILESASA_USSD_SECRET;
    else process.env.MOBILESASA_USSD_SECRET = previousSecret;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("the signature is HMAC over the timestamp and the raw body", () => {
  const secret = "test-secret";
  const rawBody = "sessionId=a&phoneNumber=254712345678&text=1";
  const stamp = 1_800_000_000;
  const digest = crypto.createHmac("sha256", secret).update(`${stamp}.${rawBody}`).digest("hex");

  assert.deepEqual(
    verifyUssdSignature({
      rawBody,
      secret,
      signature: `t=${stamp},v1=${digest}`,
      now: stamp * 1000,
    }),
    { ok: true },
  );

  assert.equal(
    verifyUssdSignature({
      rawBody,
      secret,
      signature: `t=${stamp},v1=${"0".repeat(64)}`,
      now: stamp * 1000,
    }).ok,
    false,
  );

  // A captured body cannot be replayed an hour later.
  assert.deepEqual(
    verifyUssdSignature({
      rawBody,
      secret,
      signature: `t=${stamp},v1=${digest}`,
      now: stamp * 1000 + 60 * 60_000,
    }),
    { ok: false, reason: "stale-signature" },
  );

  // Altered body, same signature.
  assert.equal(
    verifyUssdSignature({
      rawBody: `${rawBody}&text=2`,
      secret,
      signature: `t=${stamp},v1=${digest}`,
      now: stamp * 1000,
    }).ok,
    false,
  );

  // No signature header at all: only the shared secret header is accepted.
  assert.equal(verifyUssdSignature({ rawBody, secret }).ok, false);
  assert.deepEqual(
    verifyUssdSignature({ rawBody, secret, secretHeader: secret }),
    { ok: true },
  );
  assert.equal(verifyUssdSignature({ rawBody, secret, secretHeader: "wrong" }).ok, false);

  const unconfigured = verifyUssdSignature({ rawBody, secret: "", secretHeader: "" });
  assert.equal(unconfigured.ok, false);
  if (!unconfigured.ok) assert.equal(unconfigured.reason, "no-secret-configured");
});
