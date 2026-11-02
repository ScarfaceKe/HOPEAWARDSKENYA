// ─── Nominee voting links on WhatsApp ───────────────────────────────────────
// A nominee should have their own voting link in their hand the moment they go
// live — not when an admin gets round to copying it out of the dashboard.
//
// WhatsApp has three delivery paths:
//
//   1. A linked WhatsApp Web session (Baileys, `server/whatsapp-baileys.ts`) —
//      the awards' own number sends free-form messages to any nominee, with no
//      template and no Meta review. This is the automatic path.
//   2. Cloud API (`WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`) — kept as a
//      fallback; business-initiated messages only work with a Meta-approved
//      template outside a 24-hour conversation.
//   3. A one-tap `wa.me` link — no credentials at all: WhatsApp opens with the
//      exact message and the nominee's number filled in. Every attempt carries
//      one, so nothing is ever un-sendable.
//
// Nothing here may throw into a request: approving a nominee must never fail
// because WhatsApp is down. `notifyNominee` catches everything and records the
// attempt so the admin panel can show what happened.

import { SITE_URL, USSD_SHORTCODE, VOTE_PRICE_KES, ussdNomineeCode } from "@shared/site";
import { VOTING_CLOSE_TEXT, VOTING_END, VOTING_OPEN_TEXT, VOTING_START } from "@shared/dates";
import { normalizeVotePhone } from "./vote-rules";
import type { IStorage } from "./storage";

/** The public page a nominee shares; same route the dashboard copies from. */
export function nomineeVotingLink(requestId: number): string {
  return `${SITE_URL}/n/${Math.trunc(requestId)}`;
}

export type VotingState = "before" | "open" | "closed";

/**
 * Where we are in the window. Uses the enforced close so a link is never sent
 * after payments have stopped, but no message ever quotes that moment: the copy
 * only repeats the publicly announced close date.
 */
export function votingState(now: number = Date.now()): VotingState {
  if (now < VOTING_START) return "before";
  if (now >= VOTING_END) return "closed";
  return "open";
}

export interface NomineeMessageInput {
  name: string;
  categoryName: string;
  requestId: number;
  /** Zero-padded USSD code, when the nominee has a published artist row. */
  ussdCode?: string | null;
  now?: number;
}

export function buildNomineeMessage(input: NomineeMessageInput): string {
  const state = votingState(input.now);
  const link = nomineeVotingLink(input.requestId);
  const name = input.name.trim();
  const category = input.categoryName.trim();
  const voteCost = `1 vote = KES ${VOTE_PRICE_KES}.`;

  // The copy is fixed. Every nominee gets this exact wording, with their own
  // name, category, link and USSD code — do not reformat it into extra lines.
  const footer = [
    voteCost,
    input.ussdCode
      ? `Fans without data can dial ${USSD_SHORTCODE} and choose code ${input.ussdCode}.`
      : null,
    "Reply here if your name, photo or category needs correcting.",
  ]
    .filter(Boolean)
    .join(" ");

  if (state === "open") {
    return [
      `Hongera, ${name}! Congratulations — you are officially a Hope Awards Kenya 2026 nominee in ${category}.`,
      "",
      `Voting is OPEN and this is your personal voting link: ${link}`,
      "",
      "Now go for it: put this link in your bio, post it on your status and ask your fans to vote as much as they can, every single day. Vote smart, campaign hard, and win with flying colours. 🏆",
      "",
      footer,
    ].join("\n");
  }

  if (state === "before") {
    return [
      `Hongera, ${name}! Congratulations — you are officially a Hope Awards Kenya 2026 nominee in ${category}.`,
      "",
      `Voting opens ${VOTING_OPEN_TEXT}. This is your personal voting link — keep it and share it the moment voting goes live: ${link}`,
      "",
      "Start rallying your fans now: vote as much as you can, campaign smart, and win with flying colours. 🏆",
      "",
      footer,
    ].join("\n");
  }

  return [
    `${name} — Hope Awards Kenya 2026 nominee, ${category}.`,
    "",
    `Voting closed ${VOTING_CLOSE_TEXT}. Thank you for taking part — here is your nominee page: ${link}`,
  ].join("\n");
}

/**
 * One-tap send. Works with no API credentials, which is why it is the fallback
 * for every nominee: the admin taps it and WhatsApp opens on their own phone or
 * desktop with the message ready to send from the awards' number.
 */
export function waLinkFor(phone: string | null, message: string): string | null {
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  /** Meta-approved template; without it only a 24-hour-open conversation works. */
  templateName?: string;
  templateLanguage: string;
  /** Optional Graph version pin, e.g. "v23.0". Unset means the default one. */
  apiVersion?: string;
}

export function whatsappConfig(env: NodeJS.ProcessEnv = process.env): WhatsAppConfig | null {
  const token = env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    templateName: env.WHATSAPP_TEMPLATE_NAME?.trim() || undefined,
    templateLanguage: env.WHATSAPP_TEMPLATE_LANG?.trim() || "en_US",
    apiVersion: env.WHATSAPP_API_VERSION?.trim() || undefined,
  };
}

export function whatsappEndpoint(config: WhatsAppConfig): string {
  const version = config.apiVersion ? `${config.apiVersion.replace(/^\/+|\/+$/g, "")}/` : "";
  return `https://graph.facebook.com/${version}${config.phoneNumberId}/messages`;
}

/**
 * The exact request Meta receives. Split out from the network call so a test
 * can pin the shape: a template needs body parameters in order, and free-form
 * text must never be sent by accident when a template is configured.
 */
export function buildWhatsAppPayload(
  config: WhatsAppConfig,
  to: string,
  message: string,
  templateParams: string[],
): Record<string, unknown> {
  if (config.templateName) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: config.templateName,
        language: { code: config.templateLanguage },
        components: [
          {
            type: "body",
            parameters: templateParams.map((text) => ({ type: "text", text })),
          },
        ],
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: true, body: message },
  };
}

export interface WhatsAppSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * A live WhatsApp Web session (Baileys) registers itself here. The send path is
 * a function reference so this module never imports the socket library: the API
 * process stays light, tests need no network, and Cloud API remains a drop-in
 * fallback with identical recording.
 */
export interface LiveWhatsAppTransport {
  name: "baileys";
  send: (to: string, message: string) => Promise<WhatsAppSendResult>;
}

let liveTransport: LiveWhatsAppTransport | null = null;

export function setLiveWhatsAppTransport(transport: LiveWhatsAppTransport | null): void {
  liveTransport = transport;
}

export function liveWhatsAppTransport(): LiveWhatsAppTransport | null {
  return liveTransport;
}

/** Never throws. A failed send is a recorded outcome, not an exception. */
export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  to: string,
  message: string,
  templateParams: string[],
): Promise<WhatsAppSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(whatsappEndpoint(config), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildWhatsAppPayload(config, to, message, templateParams)),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      const reason = body.error?.message || `HTTP ${res.status}`;
      console.error(`[WHATSAPP] Send to ${to} failed: ${reason}`);
      return { ok: false, error: reason };
    }

    return { ok: true, providerMessageId: body.messages?.[0]?.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "request failed";
    console.error(`[WHATSAPP] Send to ${to} failed: ${reason}`);
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

export interface NomineeLinkTarget {
  requestId: number;
  name: string;
  category: string;
  submitterPhone: string;
}

export type NomineeLinkStatus = "sent" | "failed" | "not_configured" | "skipped";

export interface NomineeLinkNotice {
  status: NomineeLinkStatus;
  /** Normalised 254… number, or null when the nomination has an unusable one. */
  phone: string | null;
  link: string;
  message: string;
  waLink: string | null;
  error?: string;
  providerMessageId?: string;
}

export interface NotifyOptions {
  now?: number;
  config?: WhatsAppConfig | null;
  /** Overrides the registered live session; tests use it to pin behaviour. */
  transport?: LiveWhatsAppTransport | null;
}

/**
 * Who still needs their message. Sent and closed-season rows are final; a failed
 * number is retried a few times and then left alone so a landline can never turn
 * into an endless send loop.
 */
export interface LinkQueueInput {
  approved: { id: number; name: string }[];
  notifications: { requestId: number; status: string; createdAt?: Date | string | null }[];
  limit?: number;
  now?: number;
  retryAfterMs?: number;
  maxAttempts?: number;
}

export function nomineesMissingLink<T extends { id: number }>(
  input: Omit<LinkQueueInput, "approved"> & { approved: T[] },
): T[] {
  const limit = input.limit ?? 25;
  const now = input.now ?? Date.now();
  const retryAfterMs = input.retryAfterMs ?? 6 * 60 * 60 * 1000;
  const maxAttempts = input.maxAttempts ?? 3;

  const done = new Set<number>();
  const failures = new Map<number, number>();
  const lastFailure = new Map<number, number>();

  for (const n of input.notifications) {
    if (n.status === "sent" || n.status === "skipped") {
      done.add(n.requestId);
      continue;
    }
    if (n.status === "failed") {
      failures.set(n.requestId, (failures.get(n.requestId) ?? 0) + 1);
      const at = n.createdAt ? new Date(n.createdAt).getTime() : 0;
      if (Number.isFinite(at) && at > (lastFailure.get(n.requestId) ?? 0)) {
        lastFailure.set(n.requestId, at);
      }
    }
  }

  return input.approved
    .filter((request) => {
      if (done.has(request.id)) return false;
      if ((failures.get(request.id) ?? 0) >= maxAttempts) return false;
      const last = lastFailure.get(request.id) ?? 0;
      return now - last >= retryAfterMs;
    })
    .slice(0, limit);
}

/**
 * The one place a nominee's link is sent. Used when an admin approves a
 * nomination, when they press send on a card, and by the bulk action — so every
 * path produces the same message, the same link and the same audit trail.
 *
 * Always settles. The returned notice is what the admin panel shows; the row in
 * `nominee_notifications` is what survives a restart.
 */
export async function notifyNominee(
  storage: IStorage,
  target: NomineeLinkTarget,
  options: NotifyOptions = {},
): Promise<NomineeLinkNotice> {
  const now = options.now ?? Date.now();
  const config = options.config === undefined ? whatsappConfig() : options.config;
  const transport = options.transport === undefined ? liveWhatsAppTransport() : options.transport;
  const provider: string | null = transport ? transport.name : config ? "whatsapp_cloud" : null;

  const phone = normalizeVotePhone(target.submitterPhone) || null;

  let categoryName = target.category;
  let artistId: number | null = null;
  try {
    const [category, artist] = await Promise.all([
      storage.getCategory(target.category).catch(() => undefined),
      storage.findArtistByNameCategory(target.name, target.category).catch(() => undefined),
    ]);
    if (category) categoryName = category.name;
    if (artist) artistId = artist.id;
  } catch {
    // Names are cosmetic; a failure here must not stop the link going out.
  }

  const requestId = Math.trunc(target.requestId);
  const ussdCode = artistId === null ? null : ussdNomineeCode(artistId);
  const message = buildNomineeMessage({ name: target.name, categoryName, requestId, ussdCode, now });
  const link = nomineeVotingLink(requestId);
  const waLink = waLinkFor(phone, message);

  // Keep something searchable even when the number is unusable.
  const storedPhone = phone ?? (target.submitterPhone.replace(/[^\d+]/g, "").slice(0, 20) || "unknown");

  const record = async (
    status: NomineeLinkStatus,
    extra: { providerMessageId?: string; error?: string; sentAt?: Date | null } = {},
  ) => {
    try {
      await storage.createNomineeNotification({
        requestId,
        artistId,
        phone: storedPhone,
        link,
        message,
        status,
        provider,
        providerMessageId: extra.providerMessageId ?? null,
        error: extra.error ?? null,
        sentAt: extra.sentAt ?? null,
      });
    } catch (err) {
      console.error("[WHATSAPP] Could not record the nominee link attempt:", err);
    }
  };

  const notice = (status: NomineeLinkStatus, extra: { error?: string; providerMessageId?: string } = {}): NomineeLinkNotice => ({
    status,
    phone,
    link,
    message,
    waLink,
    ...extra,
  });

  if (!phone) {
    const error = "The number on this nomination is not a Kenyan mobile number, so WhatsApp cannot reach it.";
    await record("failed", { error });
    return notice("failed", { error });
  }

  if (votingState(now) === "closed") {
    const error = "Voting has closed, so the link was not sent.";
    await record("skipped", { error });
    return notice("skipped", { error });
  }

  if (!transport && !config) {
    const error =
      "WhatsApp is not linked yet. Scan the QR or use a pairing code in Admin → WhatsApp automation (or set WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID), then the message goes out by itself.";
    await record("not_configured", { error });
    return notice("not_configured", { error });
  }

  const result = transport
    ? await transport.send(phone, message)
    : await sendWhatsAppMessage(config!, phone, message, [target.name, categoryName, link]);
  if (!result.ok) {
    const error = result.error || "WhatsApp rejected the message.";
    await record("failed", { error });
    return notice("failed", { error });
  }

  await record("sent", { providerMessageId: result.providerMessageId, sentAt: new Date() });
  console.log(`[WHATSAPP] Voting link sent for nomination ${requestId}.`);
  return notice("sent", { providerMessageId: result.providerMessageId });
}
