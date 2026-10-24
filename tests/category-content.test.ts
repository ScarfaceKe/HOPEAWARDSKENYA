import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVERY_TAGS,
  categoriesMissingIntro,
  categoriesWithTag,
  categoryIntro,
  categoryMetaDescription,
  categorySummary,
  categoryTags,
} from "../shared/categoryContent";
import { CATEGORIES, CATEGORY_CAP, isSongCategory } from "../shared/schema";
import { VOTE_PRICE_KES } from "../shared/site";

test("every category has intro copy, and no two share it", () => {
  assert.equal(categoriesMissingIntro().length, 0);
  const intros = CATEGORIES.map((c) => categoryIntro(c.id));
  assert.equal(new Set(intros).size, CATEGORIES.length);
  for (const intro of intros) {
    assert.ok(intro.length > 30, `intro too thin: ${intro}`);
    assert.ok(intro.endsWith("."), `intro should be a sentence: ${intro}`);
  }
});

test("the summary states the facts the rest of the site states", () => {
  const summary = categorySummary("male-artist");
  assert.ok(summary.includes(`KES ${VOTE_PRICE_KES}`));
  assert.ok(summary.includes(String(CATEGORY_CAP)));
  assert.ok(summary.includes("6th December 2026"), "uses the publicly announced close");
  assert.ok(summary.includes("25th October 2026"), "uses the published opening");
  assert.equal(summary.includes("00:15"), false, "must never leak the enforced close buffer");
});

test("every category renders a full summary paragraph", () => {
  for (const category of CATEGORIES) {
    const summary = categorySummary(category.id);
    assert.ok(summary.length >= 80, `${category.id} summary is only ${summary.length} chars`);
    assert.equal(summary.includes("00:15"), false, `${category.id} leaks the buffer`);
  }
});

test("meta descriptions are a sane length and carry the edition", () => {
  for (const category of CATEGORIES) {
    const meta = categoryMetaDescription(category.id);
    assert.ok(meta.length > 60 && meta.length < 320, `${category.id} meta is ${meta.length} chars`);
    assert.match(meta, /3rd Edition/);
    assert.ok(meta.includes(category.name), `${category.id} meta should name the category`);
  }
});

test("region and language filters resolve to real categories", () => {
  for (const tag of DISCOVERY_TAGS) {
    const ids = categoriesWithTag(tag.id);
    assert.ok(ids.length > 0, `${tag.id} matches nothing`);
    for (const id of ids) {
      assert.ok(
        CATEGORIES.some((c) => c.id === id),
        `${tag.id} points at unknown category ${id}`,
      );
    }
  }
  assert.ok(categoriesWithTag("coast").includes("coast-region-artist"));
  assert.ok(categoriesWithTag("kamba").includes("kamba-male-artist"));
});

test("categories without a region tag simply have none (no empty strings)", () => {
  for (const category of CATEGORIES) {
    for (const tag of categoryTags(category.id)) {
      assert.ok(DISCOVERY_TAGS.some((t) => t.id === tag), `${category.id} has unknown tag ${tag}`);
    }
  }
});

test("a category an admin adds later is usable without hand-written copy", () => {
  // Categories now live in the database, so these helpers must handle an id
  // that is not in the build-time list instead of crashing or inventing text.
  const added = "best-gospel-song-of-the-year-2026";
  assert.equal(isSongCategory(added), true, "a song category added in the panel still asks for a song title");
  assert.equal(isSongCategory("best-gospel-choir-2026"), false);
  assert.equal(categorySummary(added), "", "no paragraph is better than an empty one the rule cannot fill");
  assert.equal(categoryMetaDescription(added), "");
  assert.deepEqual(categoryTags(added), []);
  assert.equal(isSongCategory("female-songwriter-of-the-year-2026"), false);
});
