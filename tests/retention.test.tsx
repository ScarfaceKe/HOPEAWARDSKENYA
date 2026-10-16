/**
 * The retention job and the words we publish have to agree. These tests lock the
 * window and prove the customer-facing pages actually quote it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import Privacy from "../client/src/pages/Privacy";
import Terms from "../client/src/pages/Terms";
import {
  PENDING_PAYMENT_RETENTION_DAYS,
  PAYMENT_CLAIM_WINDOW_DAYS,
  MAX_VOTES_PER_TRANSACTION,
  VOTE_PRICE_KES,
  SUPPORT_PHONE_DISPLAY,
} from "../shared/site";

test("the purge window keeps records at least as long as fans are told they can claim", () => {
  assert.ok(Number.isInteger(PENDING_PAYMENT_RETENTION_DAYS));
  assert.ok(
    PENDING_PAYMENT_RETENTION_DAYS >= PAYMENT_CLAIM_WINDOW_DAYS,
    "deleting a pending record before the claim window closes would destroy the evidence behind a claim",
  );
  assert.ok(PENDING_PAYMENT_RETENTION_DAYS >= 30 && PENDING_PAYMENT_RETENTION_DAYS <= 3650);
});

test("the Privacy Policy quotes the retention window instead of hard-coding one", () => {
  const html = renderToStaticMarkup(
    <Router ssrPath="/privacy">
      <Privacy />
    </Router>,
  );
  assert.ok(html.includes(`${PENDING_PAYMENT_RETENTION_DAYS} days`), "the policy must state the window");
  assert.equal(html.includes("00:15"), false, "the enforced close buffer must never be published");
  assert.ok(html.includes("Data Protection Act, 2019"), "still names the Act it operates under");
});

test("the Terms quote the price, the ceiling and the claim window from shared constants", () => {
  const html = renderToStaticMarkup(
    <Router ssrPath="/terms">
      <Terms />
    </Router>,
  );
  assert.ok(html.includes(String(VOTE_PRICE_KES)), "vote price must come from the shared constant");
  assert.ok(
    html.includes(MAX_VOTES_PER_TRANSACTION.toLocaleString()),
    "the per-transaction ceiling must match the code",
  );
  assert.ok(html.includes(String(PAYMENT_CLAIM_WINDOW_DAYS)), "claim window must come from the shared constant");
  assert.equal(html.includes("00:15"), false);
});

test("both pages render a table of contents that links to sections that exist", () => {
  for (const [name, node] of [
    ["privacy", <Privacy key="p" />],
    ["terms", <Terms key="t" />],
  ] as const) {
    const html = renderToStaticMarkup(<Router ssrPath={`/${name}`}>{node}</Router>);
    const anchors = [...html.matchAll(/href="#([a-z0-9-]+)"/g)].map((m) => m[1]);
    const ids = new Set([...html.matchAll(/<section id="([a-z0-9-]+)"/g)].map((m) => m[1]));
    assert.ok(anchors.length > 5, `${name} should have a table of contents`);
    for (const anchor of anchors) {
      assert.ok(ids.has(anchor), `${name} links to #${anchor}, which has no matching section`);
    }
  }
});

test("the Terms keep the route a voter uses to claim a payment that recorded no votes", () => {
  // Trimming the legal pages must never cost a wronged fan the way back to
  // their money: the support number, the non-refundable rule and the claim
  // window travel together in section 6.
  const html = renderToStaticMarkup(
    <Router ssrPath="/terms">
      <Terms />
    </Router>,
  );
  assert.ok(html.includes(SUPPORT_PHONE_DISPLAY), "the support number must stay on the page");
  assert.ok(/non-refundable/i.test(html), "recorded votes must still be declared non-refundable");
  assert.ok(
    html.includes(`${PAYMENT_CLAIM_WINDOW_DAYS} days`),
    "the claim window must sit next to the route that uses it",
  );
});

test("every section cross-reference in the Terms points at a section that exists", () => {
  const html = renderToStaticMarkup(
    <Router ssrPath="/terms">
      <Terms />
    </Router>,
  );
  const sectionCount = (html.match(/<section id="/g) || []).length;
  const refs = [...html.matchAll(/section (\d+)/g)].map((m) => Number(m[1]));
  assert.ok(refs.length > 0, "the Terms do cross-reference other sections");
  for (const n of refs) {
    assert.ok(n >= 1 && n <= sectionCount, `"section ${n}" does not exist — the page has ${sectionCount}`);
  }
});

test("every table-of-contents label numbers the heading it points at", () => {
  for (const [name, node] of [
    ["privacy", <Privacy key="p" />],
    ["terms", <Terms key="t" />],
  ] as const) {
    const html = renderToStaticMarkup(<Router ssrPath={`/${name}`}>{node}</Router>);
    const pairs = [...html.matchAll(/href="#([a-z0-9-]+)"[^>]*>([^<]+)</g)].map(
      (m) => [m[1], m[2].trim()] as const,
    );
    assert.ok(pairs.length > 5, `${name} should have a table of contents`);

    for (const [id, label] of pairs) {
      const start = html.indexOf(`<section id="${id}"`);
      const end = html.indexOf("</section>", start);
      const heading = html.slice(start, end).match(/<h2>([^<]+)<\/h2>/);
      assert.ok(heading, `${name}: no <h2> found inside #${id}`);
      const labelNum = label.match(/^(\d+)\./)?.[1];
      const headingNum = heading[1].match(/^(\d+)\./)?.[1];
      assert.equal(labelNum, headingNum, `${name}: contents says "${label}" but heading is "${heading[1]}"`);
    }
  }
});
