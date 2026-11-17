/**
 * Guard rails for the Neon compute incident (November 2026).
 *
 * Neon bills compute time and suspends a compute after five minutes without a
 * query. This app had a query every 60s (payment recovery), every 3 min
 * (reversal check), every 5 min (social queue), every 15 min (WhatsApp sweep),
 * every 30 min (upload cleanup) and on every health request — so the compute
 * never suspended and burned ~182 CU-hours/month at the smallest size against a
 * 100 CU-hour allowance.
 *
 * These are source-level checks, like `megapay-lock.test.ts`: the rule is about
 * *scheduling*, so it has to hold even when no database is available to observe.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

test("the connection pool is sized for one Express process", () => {
  const db = read("server", "db.ts");
  assert.doesNotMatch(db, /max:\s*20/, "a 20-connection pool belongs to a fleet, not one process");
  assert.match(db, /DB_POOL_MAX/, "pool size must stay configurable from the host");
  assert.match(db, /idleTimeoutMillis:\s*10_000/, "idle clients should be returned quickly");
  assert.match(db, /statement_timeout:\s*15_000/, "a runaway query must not burn compute for minutes");
  assert.match(db, /isDatabaseUnavailable/, "routes need a way to answer 503 on a real outage");
});

test("payment recovery and reversal checks are event-driven, not fixed polls", () => {
  const routes = read("server", "routes.ts");
  assert.doesNotMatch(routes, /setInterval\(recoverPendingPayments/);
  assert.doesNotMatch(routes, /setInterval\(reconcileRecentVotes/);
  assert.doesNotMatch(routes, /ORPHAN_CLEANUP_INTERVAL_MS/);

  const runner = read("server", "job-runner.ts");
  assert.match(runner, /idleDelayMs:\s*null/, "an empty pass must leave no timer behind");
  assert.match(runner, /name: "maintenance"/, "the hourly sweep must exist");
  assert.match(runner, /acquireJobLease/, "passes must be leased so two instances cannot duplicate work");
});

test("the hourly sweep still covers every safety net", () => {
  const routes = read("server", "routes.ts");
  assert.match(routes, /runPendingRecovery\(\{\s*olderThanMs: RECOVERY_MIN_AGE_MS,\s*limit: STALE_RECOVERY_BATCH/s);
  assert.match(routes, /await reconcileRecentVotes\(\)/);
  assert.match(routes, /await runSocialQueueOnce\(\)/);
  assert.match(routes, /runNomineeLinkSweepIfConnected\(\)/);
  assert.match(routes, /await runOrphanCleanup\(\)/);
  // The sweep must survive the failure of any one step.
  assert.match(routes, /Payment safety net failed/);
  assert.match(routes, /Reversal re-check failed/);
});

test("social and WhatsApp no longer own their own short timers", () => {
  const social = read("server", "social.ts");
  assert.doesNotMatch(social, /setInterval\(tick,\s*5 \* 60_000\)/);
  assert.match(social, /export async function runSocialQueueOnce/);

  const whatsapp = read("server", "whatsapp-baileys.ts");
  assert.doesNotMatch(whatsapp, /setInterval\(\(\) => \{\s*if \(sessionState === "connected"/);
  assert.match(whatsapp, /export async function runNomineeLinkSweepIfConnected/);
});

test("health checks do not query the database on every request", () => {
  const routes = read("server", "routes.ts");
  assert.match(routes, /HEALTH_PROBE_TTL_MS = 60_000/);
  assert.match(routes, /"\/api\/health\/live"/, "monitors need a process-only check");
});

test("recovery queries are bounded, ordered and indexed", () => {
  const storage = read("server", "storage.ts");
  assert.match(storage, /listPendingPaymentsForRecovery/);
  assert.match(storage, /listVotesNeedingReverification/);
  assert.match(storage, /\.limit\(safeLimit\)/);
  assert.match(storage, /DELETE FROM uploaded_images/);
  assert.doesNotMatch(storage, /referencedFromRequests/, "upload cleanup must not load every row");

  const migrate = read("server", "migrate.ts");
  assert.match(migrate, /votes_created_at_idx/);
  assert.match(migrate, /CREATE TABLE IF NOT EXISTS job_leases/);
});

test("the vote dialog backs off instead of polling the status route every 3 seconds", () => {
  const dialog = read("client", "src", "components", "VoteDialog.tsx");
  assert.match(dialog, /POLL_INTERVAL_SLOW_MS = 8_000/);
  assert.doesNotMatch(dialog, /pollTimerRef\.current = setInterval/);
  assert.match(dialog, /LIVE_TOTAL_MAX_MS/, "the success screen must stop refreshing eventually");
});
