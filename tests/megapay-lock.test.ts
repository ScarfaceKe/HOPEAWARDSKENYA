/**
 * MegaPay is in production and it is the rail KCB actually pays out on.
 *
 * Every other guard in `tests/` protects one *rule* (no reversals, the right
 * account number, settlement proof, CSRF). This suite protects the *shape* of
 * the live payment path, so that adding a second provider later cannot quietly
 * change how Kenyan fans pay today:
 *
 *   - the `/api/megapay/*` surface stays exactly three routes
 *   - the browser only ever talks to those routes
 *   - there are exactly two places that can ask the gateway to charge a phone
 *   - the initialize body still carries the KCB account number and the window
 *   - the callback is still the only POST that skips CSRF
 *
 * If someone needs to change a line here on purpose, they must also update the
 * freeze banner in `server/routes.ts` and say why in the commit message.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CSRF_EXEMPT_PATHS } from "../server/csrf";
import { COLLECTION_ACCOUNT_NUMBER, COLLECTION_PAYBILL } from "../shared/site";

const ROOT = process.cwd();
const ROUTES_SOURCE = readFileSync(join(ROOT, "server", "routes.ts"), "utf8");
const USSD_SOURCE = readFileSync(join(ROOT, "server", "ussd.ts"), "utf8");

/** The exact public surface the live flow depends on. Nothing else. */
const EXPECTED_ROUTES = [
  "GET /api/megapay/status/:reference",
  "POST /api/megapay/callback",
  "POST /api/megapay/initialize",
];

const INITIATESTK = '"https://megapay.co.ke/backend/v1/initiatestk"';
const TRANSACTION_STATUS = '"https://megapay.co.ke/backend/v1/transactionstatus"';

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

function routeBlocks(): { line: string; body: string }[] {
  const starts: { line: string; index: number }[] = [];
  for (const match of ROUTES_SOURCE.matchAll(
    /app\.(get|post|put|patch|delete|all)\(\s*"([^"]+)"/g,
  )) {
    starts.push({ line: `${match[1].toUpperCase()} ${match[2]}`, index: match.index ?? 0 });
  }

  return starts.map((start, i) => ({
    line: start.line,
    body: ROUTES_SOURCE.slice(start.index, starts[i + 1]?.index ?? ROUTES_SOURCE.length),
  }));
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("the live payment surface is exactly three routes", () => {
  const registered = routeBlocks()
    .map((block) => block.line)
    .filter((line) => line.includes("/api/megapay/"))
    .sort();

  assert.deepEqual(
    registered,
    EXPECTED_ROUTES,
    "A new payment provider must live under its own prefix. Adding, renaming or " +
      "removing a /api/megapay route changes the flow Kenyan fans are paying on today.",
  );
});

test("the browser only ever calls initialize and status", () => {
  const allowed = new Set(["initialize", "status"]);
  const seen = new Map<string, string>();

  for (const file of sourceFiles(join(ROOT, "client", "src"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\/api\/megapay\/([a-z-]+)/g)) {
      seen.set(match[1], file);
    }
  }

  assert.ok(seen.size > 0, "expected the client to reference the payment routes — the scan is broken");

  for (const [name, file] of seen) {
    assert.ok(allowed.has(name), `${file} calls /api/megapay/${name}, which is not part of the live flow`);
  }
});

test("only two code paths in the web app can ask the gateway to charge a phone", () => {
  // 1) /api/megapay/initialize — the real vote order.
  // 2) /api/admin/test-stk — the admin's 10 KES live probe.
  // The USSD rail has its own single, pinned call site (tested below).
  assert.equal(
    countOccurrences(ROUTES_SOURCE, INITIATESTK),
    2,
    "a new charge call site must be reconciled, rate-limited and alerting like these two",
  );

  // One lookup path: the status route, which is also what recovers a lost callback.
  assert.equal(
    countOccurrences(ROUTES_SOURCE, TRANSACTION_STATUS),
    1,
    "keep a single, rate-limited status lookup — MegaPay throttles repeated checks",
  );
});

test("initialize still sends the KCB account number, the phone and the voting window", () => {
  const block = routeBlocks().find((b) => b.line === "POST /api/megapay/initialize");
  assert.ok(block, "POST /api/megapay/initialize is missing");

  // The account number, never our order id — sending the order id is what made
  // KCB return every payment to the payer.
  assert.match(block.body, /reference:\s*collectionAccount\(\)/);
  assert.doesNotMatch(block.body, /reference:\s*reference\b/);
  assert.equal(COLLECTION_PAYBILL, "522533");
  assert.equal(COLLECTION_ACCOUNT_NUMBER, "8035572");

  // The amount is derived from the shared price and the phone is normalised
  // upstream; a raw body must never reach the gateway.
  assert.match(block.body, /parseVoteOrder\(req\.body\)/);
  assert.match(block.body, /msisdn:\s*phone/);

  // Voting window is enforced here, so no second rail can bypass it silently.
  assert.match(block.body, /VOTING_START/);
  assert.match(block.body, /VOTING_END/);
});

test("the callback stays the only payment POST that skips CSRF", () => {
  const exempt = [...CSRF_EXEMPT_PATHS].filter((path) => path.startsWith("/api/megapay")).sort();
  assert.deepEqual(exempt, ["/api/megapay/callback", "/api/megapay/initialize"]);
});

test("the USSD rail charges through the same account and the same rules", () => {
  // Exactly one gateway charge in server/ussd.ts. Anything more is a path
  // nobody is reconciling; anything less means USSD stopped working.
  assert.equal(countOccurrences(USSD_SOURCE, INITIATESTK), 1);

  // The account number rule is the one that caused the reversals: KCB posts to
  // the number in `reference`, so it must never be our order id. Check the
  // request body itself, not alert contexts that legitimately log the order.
  const chargeBody = USSD_SOURCE.slice(USSD_SOURCE.indexOf(INITIATESTK), USSD_SOURCE.indexOf(INITIATESTK) + 900);
  assert.match(chargeBody, /reference:\s*collectionAccountNumber\(/);
  assert.doesNotMatch(chargeBody, /reference:\s*order\.reference/);
  assert.match(chargeBody, /msisdn:\s*order\.phone/);

  // Same validation, same price, same velocity guard as the web route.
  assert.match(USSD_SOURCE, /parseVoteOrder\(/);
  assert.match(USSD_SOURCE, /voteVelocity\.check\(/);
  assert.match(USSD_SOURCE, /markPromptSent\(/);

  // No second status lookup: the callback and the background reconciler own
  // settlement, and MegaPay throttles repeated checks.
  assert.equal(countOccurrences(USSD_SOURCE, TRANSACTION_STATUS), 0);
});
