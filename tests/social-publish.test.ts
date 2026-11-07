import assert from "node:assert/strict";
import test from "node:test";
import {
  SOCIAL_INTERVAL_MS,
  SOCIAL_PLATFORMS,
  socialIdempotencyKey,
  summarizeSocialPublish,
} from "../server/social";

test("a mixed platform result is reported as partial, never published", () => {
  const summary = summarizeSocialPublish("published", [
    { status: "published" },
    { status: "failed" },
  ]);

  assert.equal(summary.overall, "partial");
  assert.equal(summary.publishedCount, 1);
  assert.equal(summary.failedCount, 1);
});

test("all platforms published is a clean success", () => {
  const summary = summarizeSocialPublish("published", [
    { status: "published" },
    { status: "published" },
    { status: "published" },
  ]);

  assert.equal(summary.overall, "published");
  assert.equal(summary.publishedCount, 3);
});

test("a platform holding a post is queued, not failed", () => {
  const summary = summarizeSocialPublish("partial", [
    { status: "published" },
    { status: "processing" },
  ]);

  assert.equal(summary.overall, "partial");
  assert.equal(summary.heldCount, 1);
  assert.equal(
    summarizeSocialPublish("scheduled", [{ status: "pending" }]).overall,
    "queued",
  );
});

test("no published platform is a failure", () => {
  const summary = summarizeSocialPublish("partial", [
    { status: "failed" },
    { status: "failed" },
  ]);

  assert.equal(summary.overall, "failed");
  assert.equal(summary.publishedCount, 0);
});

test("a top-level published status still covers a response with no platform rows", () => {
  assert.equal(summarizeSocialPublish("published", []).overall, "published");
});

test("one poster retry reuses the same Zernio idempotency key", () => {
  assert.equal(socialIdempotencyKey(42), socialIdempotencyKey(42));
  assert.match(socialIdempotencyKey(42), /42$/);
  assert.notEqual(socialIdempotencyKey(42), socialIdempotencyKey(43));
  assert.ok(socialIdempotencyKey(42).length <= 255);
});

test("the social cadence and platform list protect the YouTube quota", () => {
  assert.equal(SOCIAL_INTERVAL_MS, 4 * 60 * 60_000);
  assert.deepEqual([...SOCIAL_PLATFORMS], ["facebook", "tiktok", "youtube"]);
  assert.ok(!(SOCIAL_PLATFORMS as readonly string[]).includes("instagram"));
});
