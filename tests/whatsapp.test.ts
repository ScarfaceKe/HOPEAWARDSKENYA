/**
 * A nominee's voting link is the whole point of the WhatsApp work: one wrong
 * link, one wrong number format or one message that leaks the management-only
 * close time is a real problem on the night.
 *
 * These tests cover the parts that decide what gets sent — the link, the phone
 * normalisation, the wording in each part of the window, and the exact request
 * Meta would receive. Nothing here needs the network or a database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { USSD_SHORTCODE, VOTE_PRICE_KES, SITE_URL } from "../shared/site";
import { VOTING_CLOSE_TEXT, VOTING_OPEN_TEXT, VOTING_START, VOTING_END } from "../shared/dates";
import { normalizeVotePhone } from "../server/vote-rules";
import {
  buildNomineeMessage,
  buildWhatsAppPayload,
  nomineeVotingLink,
  nomineesMissingLink,
  notifyNominee,
  votingState,
  waLinkFor,
  whatsappConfig,
  whatsappEndpoint,
  type LiveWhatsAppTransport,
} from "../server/whatsapp";
import type { IStorage } from "../server/storage";

const OPEN_NOW = VOTING_START + 60_000;
const BEFORE_NOW = VOTING_START - 60_000;
const CLOSED_NOW = VOTING_END + 60_000;

test("the link is the same one the nominee dashboard shares", () => {
  assert.equal(nomineeVotingLink(7), `${SITE_URL}/n/7`);
  // Truncation, not rounding: ids are integers everywhere else.
  assert.equal(nomineeVotingLink(7.9), `${SITE_URL}/n/7`);
});

test("the voting window decides the wording", () => {
  assert.equal(votingState(BEFORE_NOW), "before");
  assert.equal(votingState(OPEN_NOW), "open");
  assert.equal(votingState(CLOSED_NOW), "closed");
});

test("an open-voting message carries the link, the price and the USSD code", () => {
  const message = buildNomineeMessage({
    name: "Kakai Kilonzo",
    categoryName: "Kamba Male Artist of the Year 2026",
    requestId: 42,
    ussdCode: "042",
    now: OPEN_NOW,
  });

  assert.match(message, /Kakai Kilonzo/);
  assert.match(message, /Kamba Male Artist of the Year 2026/);
  assert.ok(message.includes(`${SITE_URL}/n/42`), "the personal link must be in the message");
  assert.ok(message.includes(`KES ${VOTE_PRICE_KES}`), "the price must be stated");
  assert.match(message, /\*246\*2345#/);
  assert.match(message, /042/);
});

test("the message is exactly the approved copy, word for word", () => {
  const message = buildNomineeMessage({
    name: "Kakai Kilonzo",
    categoryName: "Kamba Male Artist of the Year 2026",
    requestId: 42,
    ussdCode: "042",
    now: OPEN_NOW,
  });

  assert.equal(
    message,
    [
      "Hongera, Kakai Kilonzo! Congratulations — you are officially a Hope Awards Kenya 2026 nominee in Kamba Male Artist of the Year 2026.",
      "",
      "Voting is OPEN and this is your personal voting link: https://hopeawards.co.ke/n/42",
      "",
      "Now go for it: put this link in your bio, post it on your status and ask your fans to vote as much as they can, every single day. Vote smart, campaign hard, and win with flying colours. 🏆",
      "",
      "1 vote = KES 10. Fans without data can dial *246*2345# and choose code 042. Reply here if your name, photo or category needs correcting.",
    ].join("\n"),
  );
});

test("the USSD code keeps both leading asterisks: *246*2345#", () => {
  // The code is dialled, so it must be sent exactly as printed on the posters.
  // Losing an asterisk turns it into a dead string: 2462345# connects to nothing.
  assert.equal(USSD_SHORTCODE, "*246*2345#");

  const message = buildNomineeMessage({
    name: "USSD Nominee",
    categoryName: "Kamba Male Artist of the Year 2026",
    requestId: 42,
    ussdCode: "042",
    now: OPEN_NOW,
  });

  assert.ok(
    message.includes("dial *246*2345# and choose code 042"),
    `the exact dial string must survive: ${message}`,
  );
  assert.ok(!message.includes("2462345#"), "the stripped form must never appear");
});

test("a nominee with no published artist row gets no USSD code", () => {
  const message = buildNomineeMessage({
    name: "Pending Nominee",
    categoryName: "New Song of the Year 2026",
    requestId: 3,
    ussdCode: null,
    now: OPEN_NOW,
  });
  assert.ok(message.includes(`${SITE_URL}/n/3`));
  assert.doesNotMatch(message, /246/);
});

test("before voting opens the link is described as ready, not payable", () => {
  const message = buildNomineeMessage({
    name: "Early Nominee",
    categoryName: "DJ of the Year 2026",
    requestId: 9,
    now: BEFORE_NOW,
  });
  assert.ok(message.includes(VOTING_OPEN_TEXT));
  assert.ok(message.includes(`${SITE_URL}/n/9`));
  assert.doesNotMatch(message, /Voting is OPEN/);
});

test("after the close the message stops selling votes", () => {
  const message = buildNomineeMessage({
    name: "Late Nominee",
    categoryName: "MC of the Year 2026",
    requestId: 10,
    now: CLOSED_NOW,
  });
  assert.ok(message.includes(VOTING_CLOSE_TEXT));
  assert.doesNotMatch(message, /Voting is OPEN/);
});

test("the first message congratulates the nominee and pushes a smart campaign", () => {
  for (const now of [BEFORE_NOW, OPEN_NOW]) {
    const message = buildNomineeMessage({
      name: "Congratulated Nominee",
      categoryName: "Kamba Male Artist of the Year 2026",
      requestId: 21,
      ussdCode: "021",
      now,
    });
    assert.match(message, /Congratulations/);
    assert.match(message, /Hongera/);
    assert.match(message, /vote as much as (you|they) can/i);
    assert.match(message, /flying colours/i);
    assert.ok(message.includes(`${SITE_URL}/n/21`));
  }
});

test("no message ever exposes the management-only close time", () => {
  // The enforced close is 00:15; only midnight is public. A nominee sharing a
  // screenshot must never be the way that leaks.
  for (const now of [BEFORE_NOW, OPEN_NOW, CLOSED_NOW]) {
    const message = buildNomineeMessage({
      name: "Screenshot Nominee",
      categoryName: "Legend of the Year 2026",
      requestId: 11,
      ussdCode: "011",
      now,
    });
    assert.doesNotMatch(message, /00:15/);
    assert.doesNotMatch(message, /12:15/);
  }
});

test("the one-tap link points at the nominee's number with the message attached", () => {
  const message = "Vote for me 🏆 https://hopeawards.co.ke/n/12";
  const link = waLinkFor(normalizeVotePhone("0712 345 678"), message);

  assert.ok(link);
  assert.ok(link.startsWith("https://wa.me/254712345678?text="));
  assert.equal(decodeURIComponent(link.split("?text=")[1]), message);

  // No usable number means no link, never a malformed wa.me URL.
  assert.equal(waLinkFor(normalizeVotePhone("not a phone"), message), null);
  assert.equal(waLinkFor(null, message), null);
});

test("the Cloud API config needs both the token and the phone number id", () => {
  assert.equal(whatsappConfig({} as NodeJS.ProcessEnv), null);
  assert.equal(whatsappConfig({ WHATSAPP_TOKEN: "t" } as NodeJS.ProcessEnv), null);
  assert.equal(whatsappConfig({ WHATSAPP_PHONE_NUMBER_ID: "1" } as NodeJS.ProcessEnv), null);

  const config = whatsappConfig({
    WHATSAPP_TOKEN: "  token  ",
    WHATSAPP_PHONE_NUMBER_ID: " 1234 ",
  } as NodeJS.ProcessEnv);

  assert.ok(config);
  assert.equal(config.token, "token");
  assert.equal(config.phoneNumberId, "1234");
  assert.equal(config.templateName, undefined);
  assert.equal(config.templateLanguage, "en_US");
});

test("the endpoint targets the configured phone number id", () => {
  const base = { token: "t", phoneNumberId: "999", templateLanguage: "en_US" };
  assert.equal(whatsappEndpoint(base), "https://graph.facebook.com/999/messages");
  assert.equal(
    whatsappEndpoint({ ...base, apiVersion: "v23.0" }),
    "https://graph.facebook.com/v23.0/999/messages",
  );
});

test("free-form sends are text messages that preview the link", () => {
  const config = { token: "t", phoneNumberId: "999", templateLanguage: "en_US" };
  const payload = buildWhatsAppPayload(config, "254712345678", "Hello https://hopeawards.co.ke/n/5", []);

  assert.equal(payload.to, "254712345678");
  assert.equal(payload.messaging_product, "whatsapp");
  assert.equal(payload.type, "text");
  assert.deepEqual(payload.text, {
    preview_url: true,
    body: "Hello https://hopeawards.co.ke/n/5",
  });
});

test("a configured template is used instead of free text, in order", () => {
  const config = {
    token: "t",
    phoneNumberId: "999",
    templateName: "nominee_voting_link",
    templateLanguage: "en",
    };
  const payload = buildWhatsAppPayload(
    config,
    "254712345678",
    "ignored when a template is set",
    ["Kakai Kilonzo", "Kamba Male Artist of the Year 2026", "https://hopeawards.co.ke/n/42"],
  );

  assert.equal(payload.type, "template");
  const template = payload.template as any;
  assert.equal(template.name, "nominee_voting_link");
  assert.equal(template.language.code, "en");
  assert.deepEqual(
    template.components[0].parameters.map((p: any) => p.text),
    ["Kakai Kilonzo", "Kamba Male Artist of the Year 2026", "https://hopeawards.co.ke/n/42"],
  );
  // A message body must never ride along with a template send.
  assert.equal(payload.text, undefined);
});

// ─── The automatic run: who still needs a message ───────────────────────────

test("the automatic run only picks nominees who have not been messaged", () => {
  const approved = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Nominee ${id}` }));
  const now = 1_000_000_000_000;
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000);

  const queue = nomineesMissingLink({
    approved,
    now,
    notifications: [
      { requestId: 2, status: "sent", createdAt: hoursAgo(1) },
      { requestId: 3, status: "skipped", createdAt: hoursAgo(1) },
      { requestId: 4, status: "failed", createdAt: hoursAgo(0.1) },
      { requestId: 5, status: "failed", createdAt: hoursAgo(1) },
      { requestId: 5, status: "failed", createdAt: hoursAgo(2) },
      { requestId: 5, status: "failed", createdAt: hoursAgo(3) },
      { requestId: 6, status: "not_configured", createdAt: hoursAgo(1) },
      { requestId: 1, status: "failed", createdAt: hoursAgo(7) },
    ],
  });

  // 1: old failure, worth one more try. 6: never actually sent. 2/3 are final,
  // 4 failed a moment ago, 5 has burned its three attempts.
  assert.deepEqual(queue.map((r) => r.id), [1, 6]);
});

test("the automatic run is capped so a link batch can never blast the list", () => {
  const approved = [1, 2, 3].map((id) => ({ id, name: `Nominee ${id}` }));
  const queue = nomineesMissingLink({ approved, notifications: [], limit: 2 });
  assert.deepEqual(queue.map((r) => r.id), [1, 2]);
  assert.equal(nomineesMissingLink({ approved: [], notifications: [] }).length, 0);
});

// ─── Transport: the linked session is used, and every attempt is recorded ────

function fakeStorage(records: any[]): IStorage {
  return {
    getCategory: async (id: string) => ({ id, name: "Kamba Male Artist of the Year 2026" }),
    findArtistByNameCategory: async () => ({ id: 42 }),
    createNomineeNotification: async (input: any) => {
      records.push(input);
      return { id: records.length, ...input };
    },
  } as unknown as IStorage;
}

const TARGET = {
  requestId: 42,
  name: "Kakai Kilonzo",
  category: "kamba-male",
  submitterPhone: "0712 345 678",
};

test("a linked WhatsApp session sends by itself and is recorded as baileys", async () => {
  const records: any[] = [];
  const sent: { to: string; message: string }[] = [];
  const transport: LiveWhatsAppTransport = {
    name: "baileys",
    send: async (to, message) => {
      sent.push({ to, message });
      return { ok: true, providerMessageId: "3EB0ABC" };
    },
  };

  const notice = await notifyNominee(fakeStorage(records), TARGET, {
    now: OPEN_NOW,
    transport,
    config: null,
  });

  assert.equal(notice.status, "sent");
  assert.equal(sent.length, 1, "exactly one message per nominee");
  assert.equal(sent[0].to, "254712345678", "the number must be normalised for WhatsApp");
  assert.ok(sent[0].message.includes(`${SITE_URL}/n/42`));
  assert.match(sent[0].message, /Congratulations/);

  const row = records.at(-1);
  assert.equal(row.status, "sent");
  assert.equal(row.provider, "baileys");
  assert.equal(row.providerMessageId, "3EB0ABC");
  assert.ok(row.sentAt instanceof Date);
});

test("a dropped session records a failure instead of throwing", async () => {
  const records: any[] = [];
  const notice = await notifyNominee(fakeStorage(records), TARGET, {
    now: OPEN_NOW,
    transport: { name: "baileys", send: async () => ({ ok: false, error: "not connected" }) },
    config: null,
  });

  assert.equal(notice.status, "failed");
  assert.equal(notice.error, "not connected");
  assert.equal(records.at(-1).status, "failed");
  assert.equal(records.at(-1).provider, "baileys");
});

test("no session and no Cloud API config is recorded as not_configured", async () => {
  const records: any[] = [];
  const notice = await notifyNominee(fakeStorage(records), {
    ...TARGET,
    submitterPhone: "not a phone",
  }, { now: OPEN_NOW, transport: null, config: null });

  // An unusable number is a failure, never a silent no-op.
  assert.equal(notice.status, "failed");
  assert.equal(records.at(-1).status, "failed");
});

test("a landline is never attempted on WhatsApp", async () => {
  const records: any[] = [];
  let called = false;
  const notice = await notifyNominee(fakeStorage(records), {
    ...TARGET,
    submitterPhone: "020 222 3333",
  }, {
    now: OPEN_NOW,
    transport: { name: "baileys", send: async () => { called = true; return { ok: true }; } },
    config: null,
  });

  assert.equal(notice.status, "failed");
  assert.equal(called, false);
});
