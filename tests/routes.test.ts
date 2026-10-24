/**
 * HTTP integration tests: boots the real Express app and drives the security
 * surfaces over the wire. No database is needed — every case here is decided
 * before storage is reached (validation, CSRF, gateway authentication, login),
 * so DATABASE_URL can point at a closed port.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { VOTING_START } from "../shared/dates";
import { getRecentAlerts } from "../server/alerts";
import { enrollmentSecret, generateTotp } from "../server/totp";

const FAKE_NOW = VOTING_START + 5 * 24 * 60 * 60 * 1000; // mid voting window
const ADMIN_PASSWORD = "correct-horse-battery";
const CALLBACK_SECRET = "callback-secret";

let server: http.Server;
let base: string;
const realDateNow = Date.now;

before(async () => {
  process.env.DATABASE_URL = "postgres://user:pass@127.0.0.1:1/not-a-database";
  process.env.SESSION_SECRET = "integration-session-secret";
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  process.env.MEGAPAY_API_KEY = "test-key";
  process.env.MEGAPAY_EMAIL = "test@example.com";
  process.env.MEGAPAY_CALLBACK_SECRET = CALLBACK_SECRET;
  delete process.env.MEGAPAY_CALLBACK_IPS;
  delete process.env.ADMIN_TOTP_SECRET;

  // server/db.ts reads DATABASE_URL at import time, so the module is loaded
  // only after the environment above is in place.
  const { registerRoutes } = await import("../server/routes");

  const app = express();
  app.use(express.json());
  server = http.createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  Date.now = () => FAKE_NOW;
});

after(async () => {
  Date.now = realDateNow;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const post = (path: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const get = (path: string, headers: Record<string, string> = {}) => fetch(`${base}${path}`, { headers });

const cookieOf = (res: Response) => (res.headers.get("set-cookie") || "").split(";")[0];

async function signIn(): Promise<{ cookie: string; csrfToken: string }> {
  const res = await post("/api/admin/login", { password: ADMIN_PASSWORD });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { csrfToken: string };
  return { cookie: cookieOf(res), csrfToken: body.csrfToken };
}

test("CSRF: admin writes are denied without a token and allowed with one", async () => {
  const denied = await post("/api/admin/shuffle-nominees");
  assert.equal(denied.status, 403);

  const { cookie, csrfToken } = await signIn();
  const allowed = await post("/api/admin/shuffle-nominees", {}, { cookie, "x-csrf-token": csrfToken });
  assert.notEqual(allowed.status, 403, "a valid token must clear the CSRF gate");
  assert.notEqual(allowed.status, 401, "a signed-in admin must clear requireAdmin");
});

test("CSRF: the token from before sign-in no longer authorises writes", async () => {
  const check = await get("/api/admin/check");
  const { csrfToken: anonymousToken } = (await check.json()) as { csrfToken: string };
  assert.ok(anonymousToken.length >= 32);

  const { cookie, csrfToken } = await signIn();
  assert.notEqual(csrfToken, anonymousToken, "login must rotate the token");

  const stale = await post("/api/admin/shuffle-nominees", {}, { cookie, "x-csrf-token": anonymousToken });
  assert.equal(stale.status, 403);
});

test("CSRF: the approve flow's POST /api/artists is refused bare and cleared with the token", async () => {
  // Regression for "I cannot approve a nominee": the admin panel created the
  // artist through its own fetch, which carried no x-csrf-token, so the valid
  // session still got a 403 — and the panel blamed a category full of nominees
  // that the capacity endpoint reported as 0/9.
  const nomination = {
    name: "New Artist",
    genre: "Benga",
    imageUrl: "https://images.example.com/new-artist.jpg",
    category: "kamba-song",
  };
  const { cookie, csrfToken } = await signIn();

  const bare = await post("/api/artists", nomination, { cookie });
  assert.equal(bare.status, 403, "a cookie-authenticated create without a token must be refused");
  const bareBody = (await bare.json()) as { message?: string };
  assert.match(bareBody.message || "", /token/i, "and it must say so instead of pretending another reason");

  const signed = await post("/api/artists", nomination, { cookie, "x-csrf-token": csrfToken });
  assert.notEqual(signed.status, 403, "the token must carry the request past the security gate");
  assert.notEqual(signed.status, 401, "a signed-in admin must clear requireAdmin");
});

test("logout is a CSRF-protected write that succeeds with a valid token", async () => {
  // The client refreshes a stale token and replays (see tests/csrf-client.test.ts),
  // so the endpoint itself must stay protected and still work.
  const { cookie, csrfToken } = await signIn();
  const withoutToken = await post("/api/admin/logout", {}, { cookie });
  assert.equal(withoutToken.status, 403);

  const loggedOut = await post("/api/admin/logout", {}, { cookie, "x-csrf-token": csrfToken });
  assert.equal(loggedOut.status, 200);
  const afterLogout = await get("/api/admin/check", { cookie });
  const body = (await afterLogout.json()) as { isAdmin: boolean };
  assert.equal(body.isAdmin, false);
});

test("ADMIN: wrong password is rejected with an attempt counter", async () => {
  const res = await post("/api/admin/login", { password: "nope" });
  assert.equal(res.status, 401);
  const body = (await res.json()) as { message: string; attemptsRemaining: number };
  assert.match(body.message, /Wrong password/i);
  assert.ok(body.attemptsRemaining >= 1);
});

test("2FA: a password alone is not enough, a valid code completes the login", async () => {
  const secret = enrollmentSecret();
  process.env.ADMIN_TOTP_SECRET = secret;
  try {
    const noCode = await post("/api/admin/login", { password: ADMIN_PASSWORD });
    assert.equal(noCode.status, 401);
    assert.equal(((await noCode.json()) as { twoFactorRequired: boolean }).twoFactorRequired, true);

    const badCode = await post("/api/admin/login", { password: ADMIN_PASSWORD, code: "000000" });
    assert.equal(badCode.status, 401);

    const good = await post("/api/admin/login", {
      password: ADMIN_PASSWORD,
      code: generateTotp(secret, FAKE_NOW),
    });
    assert.equal(good.status, 200);
    const body = (await good.json()) as { success: boolean; csrfToken: string };
    assert.equal(body.success, true);
    assert.ok(body.csrfToken.length >= 32, "login must hand back the token for the new session");
  } finally {
    delete process.env.ADMIN_TOTP_SECRET;
  }
});

test("2FA enrolment: the same secret is handed out on every request", async () => {
  // Regression: a rotating secret meant an admin could scan one, look away, then
  // configure the other and be locked out with the code from the first.
  const { cookie } = await signIn();
  const first = (await (await get("/api/admin/2fa", { cookie })).json()) as { enabled: boolean; secret: string };
  const second = (await (await get("/api/admin/2fa", { cookie })).json()) as { enabled: boolean; secret: string };
  assert.equal(first.enabled, false);
  assert.equal(first.secret, second.secret);
  assert.match(first.secret, /^[A-Z2-7]{16,}$/);

  process.env.ADMIN_TOTP_SECRET = first.secret;
  try {
    const enabled = (await (await get("/api/admin/2fa", { cookie })).json()) as { enabled: boolean; secret?: string };
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.secret, undefined, "the secret must stop being returned once 2FA is on");
  } finally {
    delete process.env.ADMIN_TOTP_SECRET;
  }
});

test("PAYMENT: fractions, overshoots and bad numbers are all rejected before the gateway", async () => {
  const fractional = await post("/api/megapay/initialize", { artistId: 1, votesAdded: 2.5, phone: "0712345678" });
  assert.equal(fractional.status, 400);
  assert.match(((await fractional.json()) as { message: string }).message, /whole number/i);

  const overshoot = await post("/api/megapay/initialize", { artistId: 1, votesAdded: 10001, phone: "0712345678" });
  assert.equal(overshoot.status, 400);

  const badPhone = await post("/api/megapay/initialize", { artistId: 1, votesAdded: 1, phone: "12345" });
  assert.equal(badPhone.status, 400);
  assert.match(((await badPhone.json()) as { message: string }).message, /M-Pesa number/i);

  const noArtist = await post("/api/megapay/initialize", { votesAdded: 1, phone: "0712345678" });
  assert.equal(noArtist.status, 400);
});

test("CALLBACK: a rejected callback is refused and alerted without storing the fan's number", async () => {
  // Regression: the whole raw body (including MSISDN) used to be kept in the
  // alert buffer that the admin panel renders. This is the first rejection of the
  // run, so it cannot be swallowed by the alert throttle.
  const forged = await post("/api/megapay/callback", {
    reference: "hopeawards-9-9-leak-check",
    status: "success",
    ResultCode: "0",
    Msisdn: "254799999999",
  });
  assert.equal(forged.status, 403);
  assert.deepEqual(await forged.json(), { status: "forbidden" });

  const alert = getRecentAlerts(50).find(
    (a) => a.kind === "payment.callback_unauthenticated" && JSON.stringify(a.context).includes("leak-check"),
  );
  assert.ok(alert, "expected an alert for the rejected callback");
  assert.equal(alert.severity, "critical");
  const context = JSON.stringify(alert.context);
  assert.equal(context.includes("254799999999"), false, "the full MSISDN must not be stored");
  assert.equal(context.includes("25479***99"), true, "the masked form is what we keep");
  assert.ok(context.includes("reference"), "field names stay available for debugging");

  // A forged callback must never be processed, even on retry.
  const replay = await post("/api/megapay/callback", { reference: "hopeawards-9-9-leak-check", status: "success" });
  assert.equal(replay.status, 403);
});

test("CALLBACK: the shared secret and the IP allowlist both authenticate", async () => {
  const withHeader = await post(
    "/api/megapay/callback",
    { reference: "hopeawards-1-2-signed", status: "success" },
    { "x-megapay-signature": CALLBACK_SECRET },
  );
  assert.notEqual(withHeader.status, 403);

  const withQuery = await fetch(`${base}/api/megapay/callback?secret=${CALLBACK_SECRET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "success" }),
  });
  assert.notEqual(withQuery.status, 403);

  delete process.env.MEGAPAY_CALLBACK_SECRET;
  process.env.MEGAPAY_CALLBACK_IPS = "203.0.113.9";
  try {
    const fromUnapprovedIp = await post("/api/megapay/callback", { reference: "x", status: "success" });
    assert.equal(fromUnapprovedIp.status, 403, "an allowlist that doesn't include us must refuse");
  } finally {
    process.env.MEGAPAY_CALLBACK_SECRET = CALLBACK_SECRET;
    delete process.env.MEGAPAY_CALLBACK_IPS;
  }
});

test("DISCOVERY: filters are validated before any database work", async () => {
  assert.equal((await get("/api/discover?tag=not-a-tag")).status, 400);
  assert.equal((await get("/api/discover?group=Not%20A%20Group")).status, 400);
  assert.notEqual((await get("/api/discover?tag=coast&q=kamba")).status, 400);
  assert.notEqual((await get("/api/discover?limit=999")).status, 400);
});

test("SITEMAP: lists the new pages and never leaks the enforced close", async () => {
  const res = await get("/sitemap.xml");
  assert.equal(res.status, 200);
  const xml = await res.text();
  for (const path of ["/discover", "/about", "/terms", "/privacy", "/nominate"]) {
    assert.ok(xml.includes(`${path}</loc>`), `sitemap should list ${path}`);
  }
  assert.equal(xml.includes("00:15"), false);
});

test("HEALTH: a dead database is reported as degraded, not as a healthy page", async () => {
  // The SPA catch-all answers every unknown path with the app shell, so a
  // health check that merely returned 200 would lie. This suite points
  // DATABASE_URL at a closed port on purpose, which is exactly the failure the
  // endpoint has to surface.
  const res = await get("/api/health");
  assert.equal(res.status, 503);
  const body = (await res.json()) as { status: string; database: string };
  assert.equal(body.status, "degraded");
  assert.equal(body.database, "unreachable");
});

test("SECURITY: alert and audit endpoints require an admin session", async () => {
  assert.equal((await get("/api/admin/alerts")).status, 401);
  assert.equal((await get("/api/admin/audit")).status, 401);
  assert.equal((await get("/api/admin/2fa")).status, 401);
  assert.equal((await get("/api/admin/pending-payments")).status, 401);
});
