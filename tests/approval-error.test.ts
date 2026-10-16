import test from "node:test";
import assert from "node:assert/strict";
import { approvalFailure, createArtistError } from "../client/src/lib/approvalError";
import { CATEGORY_CAP } from "../shared/schema";

/**
 * The panel used to blame a full category for every failure — it showed
 * "already has 9 nominees" even while every category read 0/9 spots filled.
 * The copy may only claim a full category when the server said so.
 */
test("only a server category-full rejection may claim the category is full", () => {
  const err = Object.assign(
    new Error(`This category is already full (${CATEGORY_CAP}/${CATEGORY_CAP} nominees).`),
    { categoryFull: true as boolean },
  );
  const out = approvalFailure(err, "Kamba Song of the Year 2026");
  assert.equal(out.categoryFull, true);
  assert.equal(out.title, "Cannot approve — category full");
  assert.match(out.description, new RegExp(`its ${CATEGORY_CAP} nominees`));
  assert.match(out.description, /Kamba Song of the Year 2026/);
});

test("any other failure reports the server's real reason", () => {
  const messages = [
    "Security token missing or expired. Reload the page and try again.",
    "Failed to create artist",
    "Name must be at least 2 characters.",
  ];
  for (const message of messages) {
    const out = approvalFailure(new Error(message), "Kamba Song of the Year 2026");
    assert.equal(out.categoryFull, false, `wrongly blamed the category for: ${message}`);
    assert.equal(out.title, "Approval failed");
    assert.equal(out.description, message);
  }
});

test("the failure copy never invents a nominee count", () => {
  for (const err of [new Error("boom"), undefined, null]) {
    const out = approvalFailure(err as any, "Comedian of the Year 2026");
    assert.equal(/already has its \d+ nominees/.test(out.description), false);
    assert.equal(out.categoryFull, false);
  }
});

test("a failure with no message still names the category it failed on", () => {
  const out = approvalFailure(new Error(""), "Comedian of the Year 2026");
  assert.equal(out.description, "Could not add this nominee to Comedian of the Year 2026.");
});

test("only the server's own capacity rejection may be flagged categoryFull", () => {
  // This flag is what the toast copy keys off, so a wrong value here is the
  // original bug wearing a different hat.
  const full = createArtistError(409, {
    message: `This category is already full (${CATEGORY_CAP}/${CATEGORY_CAP} nominees).`,
    categoryFull: true,
  });
  assert.equal(full.categoryFull, true);
  assert.match(full.message, /already full/);
  assert.equal(approvalFailure(full, "Kamba Song of the Year 2026").categoryFull, true);

  const forbidden = createArtistError(403, {
    message: "Security token missing or expired. Reload the page and try again.",
  });
  assert.equal(forbidden.categoryFull, undefined, "a 403 must never be relabelled as a full category");
  assert.equal(approvalFailure(forbidden, "Kamba Song of the Year 2026").description, forbidden.message);
});

test("the create error keeps the server's reason when there is one", () => {
  assert.equal(
    createArtistError(400, { message: "Invalid category", field: "category" }).message,
    "Invalid category",
  );
  assert.equal(createArtistError(400, {}).message, "That nomination is not valid.");
  assert.equal(createArtistError(500, undefined).message, "Failed to create artist");
});

test("a server that sets categoryFull itself is honoured at any status", () => {
  assert.equal(createArtistError(409, { categoryFull: true }).categoryFull, true);
  assert.equal(createArtistError(409, {}).categoryFull, true, "a bare 409 still means the category is full");
  assert.equal(createArtistError(201, { categoryFull: true }).categoryFull, true);
});
