/**
 * Manual adjustments may move a nominee up the ranking, but the site-wide
 * total is money-backed: it must come only from paid `votes` rows.
 *
 * These are source-level guard rails like `megapay-lock.test.ts`: the route
 * suite runs without a database, so this pins the two different totals and the
 * one path allowed to change each of them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STORAGE_SOURCE = readFileSync(join(ROOT, "server", "storage.ts"), "utf8");
const ROUTES_SOURCE = readFileSync(join(ROOT, "server", "routes.ts"), "utf8");
const MIGRATE_SOURCE = readFileSync(join(ROOT, "server", "migrate.ts"), "utf8");
const ADMIN_SOURCE = readFileSync(join(ROOT, "client", "src", "pages", "Admin.tsx"), "utf8");

function functionBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  const next = source.indexOf("\n  async ", start + signature.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("VOTE INTEGRITY: manual adjustments change ranking, never the paid aggregate", () => {
  const manualBlock = functionBlock(STORAGE_SOURCE, "async addVotesToArtist");
  assert.ok(
    manualBlock.includes("totalVotes: sql`${artists.totalVotes} + ${votes}`"),
    "the manual path may add to the nominee's ranking tally",
  );

  const paidTotalBlock = functionBlock(STORAGE_SOURCE, "async getTotalVotesCast");
  assert.ok(
    paidTotalBlock.includes("SUM(${votes.votesAdded})"),
    "the public total must sum the paid votes ledger",
  );
  assert.ok(paidTotalBlock.includes(".from(votes)"), "the public total must read the votes table");
  assert.ok(paidTotalBlock.includes(".innerJoin(artists"), "deleted nominees' orphan rows must not inflate the public total");
  assert.equal(
    paidTotalBlock.includes("artists.totalVotes"),
    false,
    "the public total must never sum ranking tallies that include manual adjustments",
  );

  const routeStart = ROUTES_SOURCE.indexOf('app.patch("/api/artists/:id/votes"');
  assert.notEqual(routeStart, -1, "the manual adjustment route must exist");
  const routeEnd = ROUTES_SOURCE.indexOf('app.patch("/api/admin/artists/:id"', routeStart);
  const manualRoute = ROUTES_SOURCE.slice(routeStart, routeEnd);
  assert.match(manualRoute, /storage\.addVotesToArtist\(id, add\)/);
  assert.match(manualRoute, /paid site total unchanged/);
  assert.match(manualRoute, /adjustmentCounted: "ranking"/);

  assert.doesNotMatch(
    MIGRATE_SOURCE,
    /SET total_votes = paid\.total/,
    "startup must not wipe manual ranking adjustments",
  );
});

test("VOTE INTEGRITY: the admin headline uses paid votes, not the ranking sum", () => {
  assert.match(ADMIN_SOURCE, /adminStats\.paidVotes\.toLocaleString\(\)/);
  assert.doesNotMatch(
    ADMIN_SOURCE,
    /allArtists\.reduce[\s\S]{0,160}?totalVotes/,
    "the headline must not add up nominee ranking tallies that include manual adjustments",
  );
});
