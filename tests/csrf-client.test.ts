import test from "node:test";
import assert from "node:assert/strict";
import { apiRequest } from "../client/src/lib/queryClient";
import { getCsrfToken, setCsrfToken } from "../client/src/lib/csrf";

type Call = { url: string; init: RequestInit | undefined };

function stubFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("a write sends the CSRF header it was given", async () => {
  setCsrfToken("token-1");
  const stub = stubFetch(() => json({ ok: true }));
  try {
    await apiRequest("POST", "/api/admin/shuffle-nominees", {});
    const headers = stub.calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["x-csrf-token"], "token-1");
  } finally {
    stub.restore();
  }
});

test("reads never carry a CSRF header", async () => {
  setCsrfToken("token-1");
  const stub = stubFetch(() => json({ ok: true }));
  try {
    await apiRequest("GET", "/api/admin/check");
    const headers = (stub.calls[0].init?.headers ?? {}) as Record<string, string>;
    assert.equal("x-csrf-token" in headers, false);
  } finally {
    stub.restore();
  }
});

test("a stale token is refreshed from /api/admin/check and the write is replayed once", async () => {
  // Regression: after a redeploy/restart the session token goes stale and every
  // admin write — including signing out — used to 403 until the page was reloaded.
  setCsrfToken("stale-token");
  let writeAttempts = 0;
  const stub = stubFetch((call) => {
    if (call.url === "/api/admin/check") return json({ isAdmin: true, csrfToken: "fresh-token" });
    writeAttempts++;
    if (writeAttempts === 1) return json({ message: "Security token missing or expired." }, 403);
    return json({ success: true });
  });
  try {
    const res = await apiRequest("POST", "/api/admin/logout");
    assert.equal(res.status, 200);
    assert.equal(writeAttempts, 2, "the write must be replayed exactly once");
    assert.equal(getCsrfToken(), "fresh-token");
    const retryHeaders = stub.calls[2].init?.headers as Record<string, string>;
    assert.equal(retryHeaders["x-csrf-token"], "fresh-token");
  } finally {
    stub.restore();
  }
});

test("a 403 that stays a 403 is surfaced, not retried forever", async () => {
  setCsrfToken("stale-token");
  let writeAttempts = 0;
  const stub = stubFetch((call) => {
    if (call.url === "/api/admin/check") return json({ isAdmin: false, csrfToken: "another" });
    writeAttempts++;
    return json({ message: "nope" }, 403);
  });
  try {
    await assert.rejects(() => apiRequest("DELETE", "/api/artists/1"));
    assert.equal(writeAttempts, 2, "one retry, then give up");
  } finally {
    stub.restore();
  }
});

test("if the refresh itself fails the original response is what surfaces", async () => {
  setCsrfToken("stale-token");
  let writeAttempts = 0;
  const stub = stubFetch((call) => {
    if (call.url === "/api/admin/check") return json({ message: "boom" }, 500);
    writeAttempts++;
    return json({ message: "Security token missing or expired." }, 403);
  });
  try {
    await assert.rejects(() => apiRequest("POST", "/api/admin/logout"));
    assert.equal(writeAttempts, 1, "no replay without a fresh token");
  } finally {
    stub.restore();
  }
});

test("a network failure while refreshing does not mask the original error", async () => {
  setCsrfToken("stale-token");
  let writeAttempts = 0;
  const stub = stubFetch((call) => {
    if (call.url === "/api/admin/check") throw new Error("offline");
    writeAttempts++;
    return json({ message: "stale" }, 403);
  });
  try {
    await assert.rejects(() => apiRequest("POST", "/api/admin/logout"));
    assert.equal(writeAttempts, 1);
  } finally {
    stub.restore();
  }
});
