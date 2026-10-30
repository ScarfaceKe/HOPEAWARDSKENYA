// ─── USSD voting rail (*246*2345#) ──────────────────────────────────────────
// Fans without data vote on a feature phone: dial the code, type the nominee's
// code, choose a vote pack, confirm, and pay with the same M-Pesa prompt the
// website uses. Money lands in the same KCB account (paybill 522533 / 8035572)
// because this rail charges through the same gateway and sends the same
// `reference: collectionAccount()` the live route sends.
//
// MobileSasa's contract (docs.mobilesasa.com/ussd/callback):
//   POST form-encoded  sessionId, phoneNumber, networkCode, serviceCode, text
//   `text` is the whole input trail after the extension ("1*3*2*10"), empty on
//   the first screen. We keep our own session state keyed on sessionId — their
//   docs say to — and only read the last token as the current keypress.
//   Reply plain text starting with "CON " (keep session) or "END " (hang up).
//   They give up after 10 seconds and never retry a step.
//
// `server/routes.ts` is frozen: this module never touches those handlers. The
// charge call site below is pinned by `tests/megapay-lock.test.ts`, so it can
// never drift from the account number, the price or the voting window.

import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { VOTING_CLOSE_TEXT, VOTING_END, VOTING_OPEN_TEXT, VOTING_START } from "@shared/dates";
import {
  SUPPORT_PHONE_DISPLAY,
  USSD_SHORTCODE,
  VOTE_PRICE_KES,
  collectionAccountNumber,
  parseUssdNomineeCode,
  ussdNomineeCode,
} from "@shared/site";
import { recordAlertThrottled } from "./alerts";
import type { IStorage } from "./storage";
import { maskPhone, normalizeVotePhone, parseVoteOrder, voteVelocity } from "./vote-rules";

export const USSD_CALLBACK_PATH = "/api/ussd/callback";

/** A session dies with the call; this only stops abandoned ones piling up. */
export const USSD_SESSION_TTL_MS = 3 * 60_000;

/** MobileSasa signs `${t}.${rawBody}`; reject replays outside this window. */
export const USSD_SIGNATURE_TOLERANCE_MS = 5 * 60_000;

/**
 * Vote packs offered on the handset: KES 20, 30, 50, 100, 200, 500, 1,000.
 * There is deliberately no single-vote option — a KES 10 entry is what every
 * fan picks, and it starves the nominees of the volume the season needs.
 * All amounts stay multiples of VOTE_PRICE_KES, so pricing has one source.
 */
export const USSD_PACKS = [2, 3, 5, 10, 20, 50, 100] as const;

export interface UssdInput {
  sessionId: string;
  phoneNumber: string;
  networkCode: string;
  serviceCode: string;
  text: string;
}

export interface UssdArtist {
  id: number;
  name: string;
  /** Human category name ("Best Female Artist 2026"), not the slug. */
  categoryName: string;
}

export interface UssdDeps {
  getArtist(id: number): Promise<UssdArtist | undefined>;
  getVotesByPhone(phone: string): Promise<{ artistId: number; votesAdded: number }[]>;
  preparePayment(order: {
    artistId: number;
    votesAdded: number;
    phone: string;
  }): Promise<
    | { ok: true; reference: string; votesAdded: number; amountKes: number }
    | { ok: false; message: string }
  >;
}

type Step = "menu" | "code" | "packs" | "confirm";

interface UssdSession {
  phone: string;
  step: Step;
  artistId?: number;
  artistName?: string;
  artistCategory?: string;
  votes?: number;
  updatedAt: number;
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export class UssdSessions {
  private sessions = new Map<string, UssdSession>();

  get(sessionId: string, now = Date.now()): UssdSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (now - session.updatedAt > USSD_SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  set(sessionId: string, session: Omit<UssdSession, "updatedAt">, now = Date.now()): UssdSession {
    const fresh: UssdSession = { ...session, updatedAt: now };
    this.sessions.set(sessionId, fresh);
    if (this.sessions.size > 5000) {
      for (const [id, value] of this.sessions) {
        if (now - value.updatedAt > USSD_SESSION_TTL_MS) this.sessions.delete(id);
      }
    }
    return fresh;
  }

  delete(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  size() {
    return this.sessions.size;
  }
}

const sharedSessions = new UssdSessions();

// ─── Signature ──────────────────────────────────────────────────────────────

/** Constant-time compare that never throws on a length mismatch. */
function sameSecret(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verifies MobileSasa's `X-MobileSasa-Signature: t=<unix>,v1=<hex>` header,
 * where v1 is HMAC-SHA256 of `<t>.<raw body>` keyed with the portal secret.
 * Falls back to the plain `X-MobileSasa-Secret` header when no signature is
 * sent, so a dashboard "Send test" still works with the same secret.
 */
export function verifyUssdSignature(input: {
  rawBody: string;
  secret: string;
  signature?: string;
  secretHeader?: string;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, secret, signature, secretHeader } = input;
  const now = input.now ?? Date.now();
  if (!secret) return { ok: false, reason: "no-secret-configured" };

  if (signature) {
    const parts = new Map<string, string>();
    for (const pair of signature.split(",")) {
      const at = pair.indexOf("=");
      if (at > 0) parts.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }
    // Sign the exact timestamp string we received, not a re-formatted number:
    // the gateway's HMAC was computed over its own bytes.
    const stampRaw = parts.get("t") ?? "";
    const stamp = Number(stampRaw);
    const digest = (parts.get("v1") ?? "").toLowerCase();
    if (!Number.isFinite(stamp) || !stampRaw || !digest) {
      return { ok: false, reason: "malformed-signature" };
    }
    const stampMs = stamp > 1e12 ? stamp : stamp * 1000;
    if (Math.abs(now - stampMs) > USSD_SIGNATURE_TOLERANCE_MS) {
      return { ok: false, reason: "stale-signature" };
    }
    const expected = crypto.createHmac("sha256", secret).update(`${stampRaw}.${rawBody}`).digest("hex");
    return sameSecret(expected, digest) ? { ok: true } : { ok: false, reason: "bad-signature" };
  }

  if (secretHeader && sameSecret(secret, secretHeader)) return { ok: true };
  return { ok: false, reason: "missing-signature" };
}

// ─── Menus ──────────────────────────────────────────────────────────────────

const con = (text: string) => `CON ${text}`;
const end = (text: string) => `END ${text}`;

/** USSD screens are small and some handsets only render ASCII. */
function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3).trimEnd()}...`;
}

const MAIN_MENU = con(
  ["Hope Awards Kenya 2026", "1. Vote", "2. My votes", "3. Help"].join("\n"),
);

const CODE_PROMPT = con(
  ["Enter the nominee code", "shown on their page or", "poster, e.g. 042.", "0. Main menu"].join("\n"),
);

const HELP = end(
  [
    "How to vote:",
    "1. Get the nominee code",
    "   from hopeawards.co.ke",
    `2. Dial ${USSD_SHORTCODE}`,
    "3. Enter code, pick votes",
    `Each vote is KES ${VOTE_PRICE_KES}.`,
    `Support ${SUPPORT_PHONE_DISPLAY}.`,
  ].join("\n"),
);

function packsScreen(artist: UssdArtist): string {
  // Seven packs have to survive a 160-character USSD screen, so the name is
  // clipped hard and the category is held back for the confirmation screen —
  // where the fan is about to approve money and needs to see exactly who.
  const lines = [
    `${ussdNomineeCode(artist.id)} ${clip(artist.name, 16)}`,
    ...USSD_PACKS.map(
      (votes, i) =>
        `${i + 1}. ${votes} votes KES ${votes * VOTE_PRICE_KES}`,
    ),
  ];
  return con(lines.join("\n"));
}

function confirmScreen(
  artistName: string,
  categoryName: string,
  votes: number,
  amountKes: number,
): string {
  return con(
    [
      `Pay KES ${amountKes} for ${votes}`,
      `votes to ${clip(artistName, 24)}?`,
      clip(categoryName, 30),
      "1. Yes - send M-Pesa prompt",
      "2. Cancel",
    ].join("\n"),
  );
}

function paymentError(message: string): string {
  // Turn a server sentence into something that fits a handset.
  if (/valid Safaricom/i.test(message)) {
    return "This line cannot receive an M-Pesa prompt. Use a Safaricom number.";
  }
  // The velocity guard already writes a handset-sized sentence with the exact
  // number of seconds left; rewriting it here is what turned a 40-second wait
  // into "try again in a few minutes".
  if (/prompt .*still waiting|already sent an M-Pesa prompt/i.test(message)) return message;
  if (/Too many payment attempts|too many/i.test(message)) {
    return "Too many payment attempts. Wait a few minutes and dial again.";
  }
  if (/Maximum/i.test(message)) return "That is more votes than one payment allows.";
  return "Could not start the payment. Try again in a minute.";
}

function lastToken(text: string): string {
  const tokens = String(text ?? "").split("*");
  return (tokens[tokens.length - 1] ?? "").trim();
}

// ─── Flow ───────────────────────────────────────────────────────────────────

/**
 * One USSD callback → one screen. Pure apart from the injected deps, so the
 * whole menu tree can be tested without a database or a network.
 */
export async function handleUssd(
  input: UssdInput,
  deps: UssdDeps,
  sessions: UssdSessions = sharedSessions,
  /** Injected by tests so the voting window can be exercised without waiting. */
  now: number = Date.now(),
): Promise<string> {

  if (now < VOTING_START) {
    return end(`Voting opens ${VOTING_OPEN_TEXT}.\nDial again then.`);
  }
  if (now > VOTING_END) {
    return end("Voting has closed.\nThank you for taking part\nin Hope Awards Kenya 2026.");
  }

  const phone = normalizeVotePhone(input.phoneNumber);
  if (!phone) {
    return end("This line cannot vote.\nM-Pesa voting needs a\nSafaricom number.");
  }

  const pressed = lastToken(input.text);
  const sessionId = input.sessionId || `no-session-${phone}`;
  let session = sessions.get(sessionId, now);

  // A session id that suddenly reports a different number must never inherit
  // the previous caller's nominee, votes or confirmation.
  if (session && session.phone !== phone) {
    sessions.delete(sessionId);
    session = undefined;
  }

  if (!session) {
    if (pressed) {
      // Server restarted, or the caller left the phone idle past the TTL.
      return end("Session expired.\nPlease dial again.");
    }
    sessions.set(sessionId, { phone, step: "menu" }, now);
    return MAIN_MENU;
  }

  switch (session.step) {
    case "menu": {
      if (!pressed) return MAIN_MENU;
      if (pressed === "1") {
        sessions.set(sessionId, { phone, step: "code" }, now);
        return CODE_PROMPT;
      }
      if (pressed === "2") {
        sessions.delete(sessionId);
        return myVotes(phone, deps);
      }
      if (pressed === "3") {
        sessions.delete(sessionId);
        return HELP;
      }
      return MAIN_MENU;
    }

    case "code": {
      if (!pressed) return CODE_PROMPT;
      if (pressed === "0") {
        sessions.set(sessionId, { phone, step: "menu" }, now);
        return MAIN_MENU;
      }
      const id = parseUssdNomineeCode(pressed);
      const artist = id === null ? undefined : await deps.getArtist(id);
      if (!artist) {
        return con(
          [
            `No nominee with code ${clip(pressed, 8)}.`,
            "Check the code on their",
            "page or poster.",
            "0. Main menu",
          ].join("\n"),
        );
      }
      sessions.set(
        sessionId,
        {
          phone,
          step: "packs",
          artistId: artist.id,
          artistName: artist.name,
          artistCategory: artist.categoryName,
        },
        now,
      );
      return packsScreen(artist);
    }

    case "packs": {
      const artist =
        session.artistId === undefined
          ? undefined
          : {
              id: session.artistId,
              name: session.artistName ?? "",
              categoryName: session.artistCategory ?? "",
            };
      if (!artist) {
        sessions.set(sessionId, { phone, step: "menu" }, now);
        return MAIN_MENU;
      }
      if (pressed === "0") {
        sessions.set(sessionId, { phone, step: "menu" }, now);
        return MAIN_MENU;
      }
      const index = Number(pressed);
      const votes = Number.isInteger(index) ? USSD_PACKS[index - 1] : undefined;
      if (!votes) return packsScreen(artist);

      sessions.set(
        sessionId,
        {
          phone,
          step: "confirm",
          artistId: artist.id,
          artistName: artist.name,
          artistCategory: artist.categoryName,
          votes,
        },
        now,
      );
      return confirmScreen(artist.name, artist.categoryName, votes, votes * VOTE_PRICE_KES);
    }

    case "confirm": {
      const artistId = session.artistId;
      const votes = session.votes;
      if (artistId === undefined || !votes) {
        sessions.set(sessionId, { phone, step: "menu" }, now);
        return MAIN_MENU;
      }
      const artist: UssdArtist = {
        id: artistId,
        name: session.artistName ?? "this nominee",
        categoryName: session.artistCategory ?? "",
      };
      if (pressed === "0") {
        sessions.set(
          sessionId,
          {
            phone,
            step: "packs",
            artistId,
            artistName: artist.name,
            artistCategory: artist.categoryName,
          },
          now,
        );
        return packsScreen(artist);
      }
      if (pressed === "2") {
        sessions.delete(sessionId);
        return end("Cancelled. No payment was\nrequested. Dial again\nany time before 6 Dec.");
      }
      if (pressed !== "1") {
        return confirmScreen(artist.name, artist.categoryName, votes, votes * VOTE_PRICE_KES);
      }

      sessions.delete(sessionId);
      const result = await deps.preparePayment({ artistId, votesAdded: votes, phone });
      if (!result.ok) {
        return end(paymentError(result.message));
      }
      return end(
        [
          "Payment request sent.",
          "Enter your M-Pesa PIN to",
          `pay KES ${result.amountKes.toLocaleString("en-KE")} for ${result.votesAdded}`,
          `vote${result.votesAdded === 1 ? "" : "s"}.`,
          "No prompt in 1 minute?",
          "Dial again.",
        ].join("\n"),
      );
    }
  }
}

async function myVotes(phone: string, deps: UssdDeps): Promise<string> {
  try {
    const votes = await deps.getVotesByPhone(phone);
    if (!votes.length) {
      return end(
        [
          "No votes found on this",
          "number yet.",
          `Dial ${USSD_SHORTCODE} and`,
          "choose 1 to vote.",
        ].join("\n"),
      );
    }

    const total = votes.reduce((sum, v) => sum + v.votesAdded, 0);
    const perArtist = new Map<number, number>();
    for (const vote of votes) {
      perArtist.set(vote.artistId, (perArtist.get(vote.artistId) ?? 0) + vote.votesAdded);
    }
    const top = [...perArtist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const names = await Promise.all(
      top.map(async ([id, count]) => {
        const artist = await deps.getArtist(id);
        return `${clip(artist?.name ?? "Nominee", 18)} - ${count}`;
      }),
    );

    return end(
      [
        `You have ${total.toLocaleString("en-KE")} votes on`,
        "this number.",
        ...names,
        `Voting closes ${VOTING_CLOSE_TEXT}.`,
      ].join("\n"),
    );
  } catch {
    return end("Could not read your votes\nright now. Try again in a\nminute.");
  }
}

// ─── Payment ────────────────────────────────────────────────────────────────

/**
 * Validates the order and records it *before* the gateway is asked to charge,
 * so a callback can always find the order it belongs to. Returns fast — the
 * fan is waiting on a USSD screen with a 10 second budget.
 */
export async function prepareUssdPayment(
  storage: IStorage,
  input: { artistId: number; votesAdded: number; phone: string },
): Promise<
  | { ok: true; reference: string; votesAdded: number; amountKes: number }
  | { ok: false; message: string }
> {
  const parsed = parseVoteOrder(input);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const order = parsed.order;

  const verdict = voteVelocity.check({
    ...order,
    // USSD has no browser IP: every callback comes from the gateway. Keying the
    // IP rules on the paying number keeps one shared gateway address from
    // throttling the whole shortcode, while the per-number caps still apply.
    ip: `ussd:${order.phone}`,
  });
  if (!verdict.allowed) return { ok: false, message: verdict.message };

  const apiKey = process.env.MEGAPAY_API_KEY;
  const email = process.env.MEGAPAY_EMAIL || "";
  if (!apiKey || !email) {
    console.error("[USSD] MegaPay credentials are missing (MEGAPAY_API_KEY / MEGAPAY_EMAIL)");
    recordAlertThrottled(
      "critical",
      "payment.ussd_gateway_unconfigured",
      "USSD voting cannot charge — MegaPay credentials are missing",
      {},
      10 * 60_000,
    );
    return { ok: false, message: "Payment is not available right now." };
  }

  const reference = `hopeawards-${order.artistId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  try {
    await storage.createPendingPayment(
      reference,
      order.artistId,
      order.votesAdded,
      order.amountKes,
      order.phone,
    );
  } catch (err) {
    console.error("[USSD] Could not record the pending payment:", err);
    recordAlertThrottled(
      "critical",
      "payment.ussd_pending_insert_failed",
      "Could not record a USSD vote order before charging the fan",
      { reference, artistId: order.artistId, votesAdded: order.votesAdded },
    );
    return { ok: false, message: "Could not start the payment." };
  }

  // Reserve the number while the prompt is on screen, exactly like the web
  // route: two live prompts on one phone is the only way to double-debit.
  voteVelocity.markPromptSent(order.phone);

  return { ok: true, reference, votesAdded: order.votesAdded, amountKes: order.amountKes };
}

/**
 * Sends the STK push after the USSD screen has already been answered.
 *
 * Never aborted: if the gateway accepted the charge and we dropped the request
 * early, we would lose the transaction id and the callback could not match the
 * order. The background reconciler plus the callback are what credit the
 * votes; this call only asks for the prompt.
 */
export async function chargePreparedOrder(
  storage: IStorage,
  order: { reference: string; artistId: number; votesAdded: number; amountKes: number; phone: string },
): Promise<void> {
  const apiKey = process.env.MEGAPAY_API_KEY;
  const email = process.env.MEGAPAY_EMAIL || "";

  try {
    const response = await fetch("https://megapay.co.ke/backend/v1/initiatestk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        email,
        amount: String(order.amountKes),
        msisdn: order.phone,
        // Same rule as the live route: the account number KCB must post to,
        // never our order id. See shared/site.ts.
        reference: collectionAccountNumber(process.env.MEGAPAY_ACCOUNT_NUMBER),
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    console.log(
      `[USSD-CHARGED] ref=${order.reference}, votes=${order.votesAdded}, ` +
        `amount=${order.amountKes}KES, msisdn=${maskPhone(order.phone)}, gateway=${JSON.stringify(data)}`,
    );

    if (data.success !== true && data.ResultCode !== "0") {
      await storage.deletePendingPayment(order.reference).catch(() => {});
      voteVelocity.release(order.phone);
      recordAlertThrottled(
        "warning",
        "payment.ussd_gateway_refused",
        "MegaPay refused a USSD vote charge",
        { reference: order.reference, response: data },
      );
      return;
    }

    const gatewayRequestId = data.transaction_request_id ?? data.CheckoutRequestID;
    if (gatewayRequestId) {
      await storage
        .setPendingGatewayRequestId(order.reference, String(gatewayRequestId))
        .catch((err) => console.error("[USSD] Could not store gateway request id:", err));
    }
  } catch (err) {
    // The charge may still have reached the gateway, so the pending order is
    // deliberately kept: the callback or the reconciler will settle it.
    console.error("[USSD] MegaPay charge error:", err);
    recordAlertThrottled(
      "critical",
      "payment.ussd_gateway_error",
      "MegaPay did not answer a USSD charge request",
      { reference: order.reference, error: String((err as Error)?.message ?? err) },
    );
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────

function readFields(rawBody: string, body: unknown): Record<string, string> {
  if (body && typeof body === "object" && Object.keys(body as object).length > 0) {
    return body as Record<string, string>;
  }
  const fields: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) fields[key] = value;
  return fields;
}

function bodyText(req: Request): string {
  const raw = (req as Request & { rawBody?: unknown }).rawBody;
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  return "";
}

/**
 * Registers the MobileSasa callback. Called before the CSRF middleware, and
 * exempted in `server/csrf.ts`, because the caller is a server: there is no
 * cookie to forge, and the signature is the authentication.
 */
export function registerUssdRoutes(app: Express, storage: IStorage) {
  const deps: UssdDeps = {
    getArtist: async (id) => {
      const artist = await storage.getArtist(id);
      if (!artist) return undefined;
      const category = await storage.getCategory(artist.category);
      return {
        id: artist.id,
        name: artist.name,
        categoryName: category?.name ?? artist.category.replace(/-/g, " "),
      };
    },
    getVotesByPhone: async (phone) =>
      (await storage.getVotesByPhone(phone)).map((vote) => ({
        artistId: vote.artistId,
        votesAdded: vote.votesAdded,
      })),
    preparePayment: async (order) => {
      const prepared = await prepareUssdPayment(storage, order);
      if (!prepared.ok) return prepared;

      // Answer the handset first, charge after: MobileSasa abandons a step
      // after 10 seconds and never retries it.
      setImmediate(() => {
        void chargePreparedOrder(storage, {
          reference: prepared.reference,
          artistId: order.artistId,
          votesAdded: prepared.votesAdded,
          amountKes: prepared.amountKes,
          phone: order.phone,
        });
      });

      return prepared;
    },
  };

  app.post(USSD_CALLBACK_PATH, async (req: Request, res: Response) => {
    const secret = (process.env.MOBILESASA_USSD_SECRET ?? "").trim();
    const rawBody = bodyText(req);

    if (!secret) {
      console.error("[USSD] MOBILESASA_USSD_SECRET is not set — every callback will be rejected");
      recordAlertThrottled(
        "critical",
        "ussd.secret_missing",
        "USSD callback rejected: MOBILESASA_USSD_SECRET is not configured",
        {},
        30 * 60_000,
      );
      return res
        .status(503)
        .type("text/plain")
        .send("END Voting is not available right now.");
    }

    const verdict = verifyUssdSignature({
      rawBody,
      secret,
      signature: req.get("x-mobilesasa-signature") ?? undefined,
      secretHeader: req.get("x-mobilesasa-secret") ?? undefined,
    });

    if (!verdict.ok) {
      recordAlertThrottled(
        "warning",
        "ussd.signature_rejected",
        "Rejected a USSD callback that failed signature verification",
        { reason: verdict.reason, ip: req.ip ?? "unknown" },
        30_000,
      );
      return res.status(403).type("text/plain").send("END Request rejected.");
    }

    const fields = readFields(rawBody, req.body);
    const input: UssdInput = {
      sessionId: String(fields.sessionId ?? ""),
      phoneNumber: String(fields.phoneNumber ?? ""),
      networkCode: String(fields.networkCode ?? ""),
      serviceCode: String(fields.serviceCode ?? ""),
      text: String(fields.text ?? ""),
    };

    try {
      const reply = await handleUssd(input, deps);
      return res.type("text/plain").send(reply);
    } catch (err) {
      console.error("[USSD] Handler error:", err);
      recordAlertThrottled(
        "critical",
        "ussd.handler_error",
        "The USSD menu threw an error — the caller saw a failure screen",
        { phone: maskPhone(normalizeVotePhone(input.phoneNumber) || input.phoneNumber), step: input.text },
      );
      return res
        .type("text/plain")
        .send("END Sorry, the service is busy.\nPlease dial again in a\nminute.");
    }
  });
}
