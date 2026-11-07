/**
 * Official vote totals are money-backed: every count must come from a paid
 * `votes` row. Manual admin adjustments are audit-only and must never reach
 * `artists.total_votes` or the public totals endpoint.
 *
 * These are source-level guard rails like `megapay-lock.test.ts`: the route
 * suite runs without a database, so this pins the shape of the only code paths
 * allowed to move an official tally.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STORAGE_SOURCE = readFileSync(join(ROOT, "server", "storage.ts"), "utf8");
const ROUTES_SOURCE = readFileSync(join(ROOT, "server", "routes.ts"), "utf8");
const MIGRATE_SOURCE = readFileSync(join(ROOT, "server", "migrate.ts"), "utf8");

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

function functionBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  const next = source.indexOf("\n  async ", start + signature.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("VOTE INTEGRITY: admin adjustments cannot change an official tally", () => {
  assert.equal(
    STORAGE_SOURCE.includes("addVotesToArtist"),
    false,
    "there must be no storage method that adds votes to an artist directly",
  );

  // Only the paid credit path, its retry-safe twin, and a reversal may touch
  // `artists.total_votes`. A manual adjustment would be a fourth write.
  assert.equal(
    countOccurrences(STORAGE_SOURCE, "totalVotes: sql`"),
    3,
    "only createVote, createVoteForce and voidVoteByReference may update official tallies",
  );

  const routeStart = ROUTES_SOURCE.indexOf('app.patch("/api/artists/:id/votes"');
  assert.notEqual(routeStart, -1, "the manual adjustment route must exist");
  const routeEnd = ROUTES_SOURCE.indexOf('app.patch("/api/admin/artists/:id"', routeStart);
  const manualRoute = ROUTES_SOURCE.slice(routeStart, routeEnd);
  assert.doesNotMatch(manualRoute, /totalVotes\s*:/, "the manual route must not write a vote total");
  assert.match(manualRoute, /storage\.getArtist\(id\)/, "the route only looks the nominee up for its audit row");
  assert.match(manualRoute, /log_manual_votes/);
  assert.match(manualRoute, /adjustmentCounted: false/);
});

test("VOTE INTEGRITY: aggregate and cached totals are rebuilt from paid votes", () => {
  const totalBlock = functionBlock(STORAGE_SOURCE, "async getTotalVotesCast");
  assert.ok(
    totalBlock.includes("SUM(${votes.votesAdded})"),
    "the public total must sum the paid votes ledger",
  );
  assert.ok(totalBlock.includes(".from(votes)"), "the public total must read the votes table");
  assert.ok(totalBlock.includes(".innerJoin(artists"), "deleted nominees' orphan rows must not inflate the public total");

  assert.match(
    MIGRATE_SOURCE,
    /SET total_votes = paid\.total/,
    "startup migration must rebuild cached tallies from paid votes",
  );
});
