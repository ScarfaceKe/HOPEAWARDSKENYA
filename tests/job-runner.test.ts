/**
 * The adaptive job runner is the fix for the Neon compute exhaustion: a job must
 * never poll on a fixed short interval, must never overlap itself, and must go
 * completely dormant when there is nothing to do. These cases run without a
 * database (the lease is disabled) and use millisecond delays.
 */
import test from "node:test";
import assert from "node:assert/strict";

// server/db.ts exits when DATABASE_URL is missing, and the runner imports the
// lease (which imports the pool). Nothing here opens a connection: every job in
// this file runs with the lease disabled.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://user:pass@127.0.0.1:1/not-a-database";
const { AdaptiveJob } = await import("../server/job-runner");

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("condition not reached in time");
    await sleep(5);
  }
}

test("a job with no work goes dormant instead of polling", async () => {
  const job = new AdaptiveJob({
    name: "test-dormant",
    activeDelayMs: 5_000,
    idleDelayMs: null,
    leaseTtlMs: 0,
  });
  let runs = 0;
  job.setHandler(async () => {
    runs += 1;
    return { work: false };
  });

  job.start(0);
  await waitUntil(() => runs === 1);
  assert.equal(job.scheduledFor, null, "no timer may remain after an empty pass");

  await sleep(80);
  assert.equal(runs, 1, "the job must not run again on its own");

  job.wake(0);
  await waitUntil(() => runs === 2);
  job.stop();
});

test("a job with work keeps its active cadence", async () => {
  const job = new AdaptiveJob({
    name: "test-active",
    activeDelayMs: 20,
    idleDelayMs: null,
    leaseTtlMs: 0,
    jitterRatio: 0,
  });
  let runs = 0;
  job.setHandler(async () => {
    runs += 1;
    return { work: true };
  });

  job.start(0);
  await waitUntil(() => runs >= 4);
  job.stop();
  assert.ok(runs >= 4, "a pass that finds work must schedule another pass");
});

test("a pass can never overlap itself, and a wake during it queues one follow-up", async () => {
  const job = new AdaptiveJob({
    name: "test-single-flight",
    activeDelayMs: 60_000,
    idleDelayMs: null,
    leaseTtlMs: 0,
  });
  let runs = 0;
  let concurrent = 0;
  let maxConcurrent = 0;

  job.setHandler(async () => {
    runs += 1;
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await sleep(40);
    concurrent -= 1;
    return { work: false };
  });

  job.start(0);
  await waitUntil(() => runs === 1);
  // Several wakes while the pass is running must collapse into one follow-up.
  job.wake(0);
  job.wake(0);
  job.wake(0);
  await waitUntil(() => runs === 2);
  await sleep(60);

  job.stop();
  assert.equal(maxConcurrent, 1, "two passes ran at the same time");
  assert.equal(runs, 2, "wakes must collapse, not stack, a pass");
});

test("stop() during a pass leaves no timer behind", async () => {
  // A shutdown (or a deploy) can land while a pass is awaiting the gateway. The
  // finished pass must not re-arm itself after the process asked it to stop.
  const job = new AdaptiveJob({
    name: "test-stop-mid-pass",
    activeDelayMs: 10,
    idleDelayMs: 10,
    leaseTtlMs: 0,
    jitterRatio: 0,
  });
  let runs = 0;
  job.setHandler(async () => {
    runs += 1;
    await sleep(30);
    return { work: true };
  });

  job.start(0);
  await waitUntil(() => runs === 1);
  job.stop();
  await sleep(80);

  assert.equal(runs, 1, "a stopped job must not run again");
  assert.equal(job.scheduledFor, null, "a stopped job must leave no timer");
});

test("a failing pass backs off instead of retrying in a tight loop", async () => {
  const job = new AdaptiveJob({
    name: "test-backoff",
    activeDelayMs: 1_000,
    idleDelayMs: null,
    maxErrorDelayMs: 8_000,
    leaseTtlMs: 0,
    jitterRatio: 0,
  });
  let runs = 0;
  job.setHandler(async () => {
    runs += 1;
    throw new Error("database is down");
  });

  job.start(0);
  await waitUntil(() => runs === 1);
  const delay = (job.scheduledFor ?? 0) - Date.now();
  job.stop();

  assert.ok(delay >= 700, `expected the first retry to wait about a second, got ${delay}ms`);
});
