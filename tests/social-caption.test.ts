import assert from "node:assert/strict";
import test from "node:test";
import { VOTING_CLOSE_TEXT } from "../shared/dates";
import { buildSocialCaption, socialMediaUrl } from "../shared/social-caption";

const NOW = new Date("2026-11-05T12:00:00+03:00").getTime();

test("a poster caption is built from that nominee's own details", () => {
  const { title, caption } = buildSocialCaption(
    { id: 42, name: "MC GATONYE", categoryName: "MC of the Year 2026" },
    NOW,
  );

  assert.match(caption, /MC GATONYE/);
  assert.match(caption, /MC of the Year 2026/);
  assert.match(caption, /\*246\*2345#/);
  assert.match(caption, /042/);
  assert.match(caption, /https:\/\/hopeawards\.co\.ke\/artist\/42/);
  assert.match(caption, /1 vote = KES 10/);
  assert.ok(caption.includes(VOTING_CLOSE_TEXT));
  assert.ok(title.length <= 90);
  assert.match(title, /MC GATONYE/);
});

test("social captions never expose the enforced 00:15 close buffer", () => {
  const { caption, title } = buildSocialCaption(
    { id: 7, name: "Test Nominee", categoryName: "Best Artist" },
    NOW,
  );

  assert.doesNotMatch(caption, /00:15|12:15/);
  assert.doesNotMatch(title, /00:15|12:15/);
  assert.doesNotMatch(caption, /VOTING_END/);
});

test("closed voting gets a graceful caption instead of asking for votes", () => {
  const afterClose = new Date("2026-12-07T12:00:00+03:00").getTime();
  const { caption } = buildSocialCaption(
    { id: 9, name: "Closed Nominee", categoryName: "Best Artist" },
    afterClose,
  );

  assert.match(caption, /Voting has closed/);
  assert.doesNotMatch(caption, /Vote for Closed Nominee today/);
  assert.doesNotMatch(caption, /00:15/);
});

test("uploaded images become absolute HTTPS URLs for the platforms", () => {
  assert.equal(
    socialMediaUrl("/api/uploaded-images/poster.png"),
    "https://www.hopeawards.co.ke/api/uploaded-images/poster.png",
  );
  assert.equal(
    socialMediaUrl("https://cdn.example.com/poster.jpg"),
    "https://cdn.example.com/poster.jpg",
  );
  assert.throws(() => socialMediaUrl("http://cdn.example.com/poster.jpg"), /HTTPS/);
  assert.throws(() => socialMediaUrl(""), /empty/);
  assert.throws(() => socialMediaUrl("//cdn.example.com/poster.jpg"), /HTTPS/);
  assert.throws(() => socialMediaUrl("data:image/png;base64,abc"), /HTTPS/);
});
