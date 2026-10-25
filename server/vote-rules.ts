// ─── Vote order validation & velocity control ───────────────────────────────
// The M-Pesa flow is money-in, so validation happens before anything touches the
// gateway or the database: whole numbers only, a hard ceiling per transaction,
// a real Kenyan M-Pesa number, and per-number/per-network velocity limits so a
// single fan (or a script) cannot push through unbounded vote orders.
//
// Everything here is pure/in-memory on purpose: it runs before storage and can
// be unit-tested without a database.

import { MAX_VOTES_PER_TRANSACTION, VOTE_PRICE_KES } from "@shared/site";
import { recordAlertThrottled } from "./alerts";

export const MIN_VOTES_PER_TRANSACTION = 1;

/** Per-phone order attempts allowed inside one window. */
export const PHONE_INIT_WINDOW_MS = 10 * 60_000;
export const MAX_PHONE_INITS_PER_WINDOW = 6;

/** Votes a single paying number may buy in a day before we stop it. */
export const PHONE_DAILY_VOTE_CAP = 30_000;

/** Retrying the identical order this fast is a double-tap, not a real retry. */
export const DUPLICATE_ORDER_WINDOW_MS = 25_000;

/**
 * How long one number may hold a live (unanswered) M-Pesa prompt.
 *
 * Two prompts on the same phone at once is the only way this app can cause a
 * double debit: the fan approves both, M-Pesa takes the money twice, and the
 * duplicate can only be undone by the gateway/shortcode owner reversing one.
 * A fan who votes again *after* a prompt settles is never blocked — the mark is
 * cleared the moment the order is credited, refused, or reported failed.
 */
export const OUTSTANDING_PROMPT_MS = 90_000;

/** Orders allowed from one IP inside a window. */
export const IP_INIT_WINDOW_MS = 10 * 60_000;
export const MAX_IP_INITS_PER_WINDOW = 40;

/** Distinct paying numbers from one IP per hour — high values look like a SIM bank. */
export const IP_DISTINCT_PHONE_LIMIT = 40;
export const IP_FANOUT_WINDOW_MS = 60 * 60_000;

export interface VoteOrder {
  artistId: number;
  votesAdded: number;
  /** Normalized to 2547XXXXXXXX / 2541XXXXXXXX. */
  phone: string;
  amountKes: number;
}

export type VoteOrderResult =
  | { ok: true; order: VoteOrder }
  | { ok: false; status: number; message: string };

/**
 * Accepts the formats fans actually type (0712…, +254 712…, 712…) and returns
 * the 12-digit MSISDN M-Pesa expects, or "" when the number isn't a Kenyan
 * mobile number.
 */
export function normalizeVotePhone(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const digits = raw.replace(/\D/g, "");
  let local = "";
  if (digits.length === 12 && digits.startsWith("254")) local = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith("0")) local = digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("0")) local = digits.slice(1);
  else if (digits.length === 9) local = digits;
  else if (digits.length === 10 && (digits.startsWith("7") || digits.startsWith("1"))) local = digits;
  else return "";
  if (!/^[17]\d{8}$/.test(local)) return "";
  return `254${local}`;
}

/**
 * Validates a `/api/megapay/initialize` body. Rejects anything that would
 * otherwise reach storage as a non-integer or an absurd amount.
 */
export function parseVoteOrder(body: unknown): VoteOrderResult {
  const raw = (body ?? {}) as Record<string, unknown>;

  // Accept only numbers and plain digit strings. Anything else (`true`, `[3]`,
  // `{}` …) can coerce into a number and must be rejected by type, not by value.
  const asQuantity = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
    return null;
  };

  const artistId = asQuantity(raw.artistId);
  if (artistId === null || !Number.isInteger(artistId) || artistId <= 0) {
    return { ok: false, status: 400, message: "Invalid artist." };
  }

  const votesAdded = asQuantity(raw.votesAdded);
  if (votesAdded === null || !Number.isInteger(votesAdded)) {
    return { ok: false, status: 400, message: "Votes must be a whole number." };
  }
  if (votesAdded < MIN_VOTES_PER_TRANSACTION) {
    return { ok: false, status: 400, message: `You need at least ${MIN_VOTES_PER_TRANSACTION} vote.` };
  }
  if (votesAdded > MAX_VOTES_PER_TRANSACTION) {
    return {
      ok: false,
      status: 400,
      message: `Maximum ${MAX_VOTES_PER_TRANSACTION.toLocaleString()} votes per M-Pesa transaction.`,
    };
  }

  const phone = normalizeVotePhone(raw.phone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      message: "Enter a valid Safaricom M-Pesa number, e.g. 0712 345 678.",
    };
  }

  const amountKes = votesAdded * VOTE_PRICE_KES;
  if (!Number.isSafeInteger(amountKes)) {
    return { ok: false, status: 400, message: "That amount is too large." };
  }

  return { ok: true, order: { artistId, votesAdded, phone, amountKes } };
}

export interface VelocityInput {
  phone: string;
  ip: string;
  artistId: number;
  votesAdded: number;
  amountKes: number;
}

/**
 * In-memory velocity guard. One shared instance is used by the payment route;
 * tests construct their own so they don't interfere.
 */
export class VoteVelocityGuard {
  private phones = new Map<
    string,
    {
      inits: number[];
      dayStart: number;
      votesToday: number;
      last: { artistId: number; amountKes: number; at: number } | null;
    }
  >();

  private ipInits = new Map<string, number[]>();
  private ipPhones = new Map<string, Map<string, number>>();

  /**
   * Numbers with a prompt on screen right now, set by the payment route after
   * the gateway accepts a push. Deliberately separate from `check()` so the
   * pure rules stay testable without a lifecycle.
   */
  private prompts = new Map<string, number>();

  private static readonly MAX_TRACKED_PHONES = 20_000;

  constructor(
    private readonly limits = {
      phoneInitsPerWindow: MAX_PHONE_INITS_PER_WINDOW,
      phoneInitWindowMs: PHONE_INIT_WINDOW_MS,
      dailyVoteCap: PHONE_DAILY_VOTE_CAP,
      duplicateWindowMs: DUPLICATE_ORDER_WINDOW_MS,
      ipInitsPerWindow: MAX_IP_INITS_PER_WINDOW,
      ipInitWindowMs: IP_INIT_WINDOW_MS,
      outstandingPromptMs: OUTSTANDING_PROMPT_MS,
      ipDistinctPhoneLimit: IP_DISTINCT_PHONE_LIMIT,
      ipFanoutWindowMs: IP_FANOUT_WINDOW_MS,
    },
  ) {}

  /**
   * Checks an order against the limits and records it when it is allowed, so a
   * single call per payment attempt is enough.
   */
  check(input: VelocityInput, now = Date.now()): { allowed: true } | { allowed: false; status: number; message: string } {
    const { phone, ip, artistId, votesAdded, amountKes } = input;
    this.sweep(now);

    const state = this.phones.get(phone) ?? {
      inits: [],
      dayStart: now,
      votesToday: 0,
      last: null,
    };
    state.inits = state.inits.filter((t) => now - t < this.limits.phoneInitWindowMs);
    if (now - state.dayStart >= 24 * 60 * 60_000) {
      state.dayStart = now;
      state.votesToday = 0;
    }

    // A prompt still waiting on the fan's screen. Sending another one is how a
    // single vote becomes two M-Pesa charges and a reversal complaint.
    const promptAt = this.prompts.get(phone);
    if (promptAt !== undefined) {
      if (now - promptAt >= this.limits.outstandingPromptMs) {
        this.prompts.delete(phone);
      } else {
        recordAlertThrottled(
          "warning",
          "payment.prompt_outstanding",
          "Blocked a second M-Pesa prompt while the first was still awaiting approval",
          { phone: maskPhone(phone), artistId, amountKes, ip },
        );
        return {
          allowed: false,
          status: 429,
          message:
            "An M-Pesa prompt from this number is still waiting. Approve it on your phone, then try again in a few minutes.",
        };
      }
    }

    const ipWindow = (this.ipInits.get(ip) ?? []).filter((t) => now - t < this.limits.ipInitWindowMs);

    const remember = () => {
      state.inits.push(now);
      state.votesToday += votesAdded;
      state.last = { artistId, amountKes, at: now };
      this.phones.set(phone, state);
      ipWindow.push(now);
      this.ipInits.set(ip, ipWindow);
      const phonesForIp = this.ipPhones.get(ip) ?? new Map<string, number>();
      phonesForIp.set(phone, now);
      this.ipPhones.set(ip, phonesForIp);
    };

    if (state.last && state.last.artistId === artistId && state.last.amountKes === amountKes) {
      const sinceMs = now - state.last.at;
      if (sinceMs < this.limits.duplicateWindowMs) {
        recordAlertThrottled(
          "warning",
          "payment.duplicate_order",
          "Repeat vote order for the same nominee and amount within seconds of the last one",
          { phone: maskPhone(phone), artistId, amountKes, sinceMs, ip },
        );
        return {
          allowed: false,
          status: 429,
          message: "We already sent an M-Pesa prompt for this payment — check your phone before trying again.",
        };
      }
    }

    if (state.inits.length >= this.limits.phoneInitsPerWindow) {
      const retryAfterSec = Math.ceil(
        (this.limits.phoneInitWindowMs - (now - state.inits[0])) / 1000,
      );
      recordAlertThrottled(
        "warning",
        "payment.phone_velocity",
        "One paying number started too many M-Pesa orders in a short window",
        { phone: maskPhone(phone), attempts: state.inits.length, windowMs: this.limits.phoneInitWindowMs, ip },
      );
      return {
        allowed: false,
        status: 429,
        message: `Too many payment attempts on this number. Please wait about ${Math.ceil(retryAfterSec / 60)} minute(s) and try again.`,
      };
    }

    if (state.votesToday + votesAdded > this.limits.dailyVoteCap) {
      recordAlertThrottled(
        "critical",
        "payment.phone_daily_cap",
        "A paying number hit the daily vote ceiling",
        { phone: maskPhone(phone), votesToday: state.votesToday, votesAdded, cap: this.limits.dailyVoteCap },
      );
      return {
        allowed: false,
        status: 429,
        message: `This number has reached today's limit of ${this.limits.dailyVoteCap.toLocaleString()} votes. Contact support if this is unexpected.`,
      };
    }

    if (ipWindow.length >= this.limits.ipInitsPerWindow) {
      recordAlertThrottled(
        "warning",
        "payment.ip_velocity",
        "Too many M-Pesa orders from one IP address in a short window",
        { ip, attempts: ipWindow.length, windowMs: this.limits.ipInitWindowMs },
      );
      return {
        allowed: false,
        status: 429,
        message: "Too many payment attempts from this connection. Please try again later.",
      };
    }

    const phonesForIp = this.ipPhones.get(ip);
    if (phonesForIp) {
      const recent = Array.from(phonesForIp.entries()).filter(([, at]) => now - at < this.limits.ipFanoutWindowMs);
      const distinct = new Set(recent.map(([p]) => p));
      distinct.add(phone);
      if (distinct.size > this.limits.ipDistinctPhoneLimit) {
        // Observed, not blocked: shared networks (offices, hotspots) are legitimate.
        recordAlertThrottled(
          "critical",
          "payment.ip_fanout",
          "Unusually many different paying numbers from one IP — possible SIM farm",
          { ip, distinctNumbers: distinct.size, windowMs: this.limits.ipFanoutWindowMs },
        );
      }
    }

    remember();
    return { allowed: true };
  }

  /** Records that a prompt is now waiting on this number's phone. */
  markPromptSent(phone: string, now = Date.now()) {
    this.prompts.set(phone, now);
    if (this.prompts.size > VoteVelocityGuard.MAX_TRACKED_PHONES) {
      for (const [key, at] of Array.from(this.prompts.entries())) {
        if (now - at >= this.limits.outstandingPromptMs) this.prompts.delete(key);
      }
    }
  }

  /**
   * Clears the pending prompt once its order has an answer — credited, refused
   * by the gateway, or reported failed — so the fan is never locked out.
   */
  release(phone: string) {
    this.prompts.delete(phone);
  }

  /** Exposed for tests. */
  stateFor(phone: string) {
    return this.phones.get(phone) ?? null;
  }

  private sweep(now: number) {
    if (this.phones.size <= VoteVelocityGuard.MAX_TRACKED_PHONES && this.ipInits.size <= 5000) return;
    const dayAgo = now - 24 * 60 * 60_000;
    for (const [phone, state] of Array.from(this.phones.entries())) {
      if (state.last === null || state.last.at < dayAgo) this.phones.delete(phone);
    }
    for (const [ip, times] of Array.from(this.ipInits.entries())) {
      const kept = times.filter((t) => now - t < this.limits.ipInitWindowMs);
      if (kept.length === 0) this.ipInits.delete(ip);
      else this.ipInits.set(ip, kept);
    }
    for (const [ip, phones] of Array.from(this.ipPhones.entries())) {
      for (const [phone, at] of Array.from(phones.entries())) {
        if (now - at >= this.limits.ipFanoutWindowMs) phones.delete(phone);
      }
      if (phones.size === 0) this.ipPhones.delete(ip);
    }
  }
}

/** Never log or return a full MSISDN. */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return "***";
  return `${phone.slice(0, 5)}***${phone.slice(-2)}`;
}

/** Single shared guard for the payment route. */
export const voteVelocity = new VoteVelocityGuard();
