import test from "node:test";
import assert from "node:assert/strict";
import { CSRF_EXEMPT_PATHS, CSRF_HEADER, issueCsrfToken, requireCsrf } from "../server/csrf";
import { getRecentAlerts } from "../server/alerts";

function fakeRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function run(req: Record<string, unknown>) {
  const res = fakeRes();
  let passedThrough = false;
  // Express always supplies ip + socket; the fake has to as well, because a
  // rejection path records an alert that includes the caller's address.
  requireCsrf(
    { ip: "1.2.3.4", socket: { remoteAddress: "1.2.3.4" }, ...req } as never,
    res as never,
    () => {
      passedThrough = true;
    },
  );
  return { res, passedThrough };
}

test("safe methods are never blocked", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    const { passedThrough } = run({ method, path: "/api/admin/shuffle-nominees", headers: {}, session: {} });
    assert.equal(passedThrough, true, method);
  }
});

test("the public forms and the gateway callback stay exempt", () => {
  const expected = [
    "/api/admin/login",
    "/api/requests",
    "/api/upload-token",
    "/api/upload-public",
    "/api/megapay/initialize",
    "/api/megapay/callback",
  ];
  for (const path of expected) {
    assert.ok(CSRF_EXEMPT_PATHS.has(path), `${path} should be exempt`);
    const { passedThrough } = run({ method: "POST", path, headers: {}, session: {}, body: {} });
    assert.equal(passedThrough, true, path);
  }
});

test("admin writes are denied by default", () => {
  const { res, passedThrough } = run({
    method: "POST",
    path: "/api/admin/shuffle-nominees",
    headers: {},
    session: {},
    ip: "1.2.3.4",
    socket: { remoteAddress: "1.2.3.4" },
  });
  assert.equal(passedThrough, false);
  assert.equal(res.statusCode, 403);
  assert.equal(getRecentAlerts(20).some((a) => a.kind === "security.csrf_rejected"), true);
});

test("a write with the session token passes, and the token is per session", () => {
  const sessionA: Record<string, unknown> = {};
  const sessionB: Record<string, unknown> = {};
  const tokenA = issueCsrfToken({ session: sessionA } as never);
  const tokenB = issueCsrfToken({ session: sessionB } as never);

  assert.ok(tokenA.length >= 32);
  assert.notEqual(tokenA, tokenB, "different sessions must not share a token");
  assert.equal(issueCsrfToken({ session: sessionA } as never), tokenA, "stable within a session");

  const ok = run({
    method: "DELETE",
    path: "/api/artists/7",
    headers: { [CSRF_HEADER]: tokenA },
    session: sessionA,
  });
  assert.equal(ok.passedThrough, true);

  const crossSession = run({
    method: "DELETE",
    path: "/api/artists/7",
    headers: { [CSRF_HEADER]: tokenB },
    session: sessionA,
  });
  assert.equal(crossSession.passedThrough, false, "another session's token must not work");
  assert.equal(crossSession.res.statusCode, 403);
});

test("malformed and truncated tokens are rejected", () => {
  const session: Record<string, unknown> = {};
  const token = issueCsrfToken({ session } as never);
  for (const bad of [token.slice(0, 10), "x".repeat(token.length), "", "undefined"]) {
    const { passedThrough, res } = run({
      method: "PATCH",
      path: "/api/requests/1",
      headers: { [CSRF_HEADER]: bad },
      session,
    });
    assert.equal(passedThrough, false, `token ${JSON.stringify(bad)}`);
    assert.equal(res.statusCode, 403);
  }
});

test("a request with no session at all is rejected rather than crashing", () => {
  const { passedThrough, res } = run({ method: "POST", path: "/api/admin/shuffle-nominees", headers: {} });
  assert.equal(passedThrough, false);
  assert.equal(res.statusCode, 403);
});
