// ─── Hope Awards Kenya — shared site facts ───────────────────────────────────
// Organiser identity, contact channels, prices and legal metadata live here so
// the About, Terms & Conditions and Privacy Policy pages can never contradict
// each other (or the rest of the site) about who we are or what a vote costs.

export const ORGANISER = "Hope Awards Kenya";
export const EDITION = "3rd Edition";
export const EDITION_YEAR = 2026;

export const SITE_URL = "https://hopeawards.co.ke";

/** Official support line — the number printed across the site and socials. */
export const SUPPORT_PHONE_DISPLAY = "0740 413 458";
export const SUPPORT_PHONE_INTL = "254740413458";
export const SUPPORT_WHATSAPP = `https://wa.me/${SUPPORT_PHONE_INTL}`;

export const SOCIALS = {
  instagram: { label: "Instagram", handle: "@hopeawardske", url: "https://instagram.com/hopeawardske" },
  tiktok: { label: "TikTok", handle: "@hopeawardske", url: "https://tiktok.com/@hopeawardske" },
  youtube: { label: "YouTube", handle: "@hopeawardske", url: "https://youtube.com/@hopeawardske" },
  facebook: {
    label: "Facebook",
    handle: "Hope Awards Kenya",
    url: "https://www.facebook.com/search/top?q=Hope%20Awards%20Kenya",
  },
} as const;

/** Price of a single fan vote, in Kenyan shillings. */
export const VOTE_PRICE_KES = 10;

/**
 * The USSD code fans dial to vote without data.
 * Public, printed on posters — never put a private code here.
 */
export const USSD_SHORTCODE = "*246*2345#";

/**
 * The code a fan types on USSD to pick a nominee. Derived from the artist id so
 * it is stable forever and needs no extra column, zero-padded to three digits
 * (`42` always reads as `042`, and ids past 999 simply grow to four digits).
 */
export function ussdNomineeCode(artistId: number): string {
  return String(Math.max(0, Math.trunc(artistId))).padStart(3, "0");
}

/** Parses what the fan typed back to an artist id, or null. */
export function parseUssdNomineeCode(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d{1,4}$/.test(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Largest number of votes the voting form accepts in one M-Pesa transaction. */
export const MAX_VOTES_PER_TRANSACTION = 10000;

/** Maximum photo size accepted with a nomination, in megabytes. */
export const NOMINATION_PHOTO_MAX_MB = 2;

/** Payment gateway that collects the KES mobile-money charges for votes. */
export const PAYMENT_PROVIDER = "MegaPay";
export const PAYMENT_PROVIDER_URL = "https://megapay.co.ke";

/**
 * The collection account the money must land in.
 *
 * Fans pay paybill 522533 (KCB) and the bank posts the payment to whatever
 * account number travels with it. MegaPay has no account number of its own for
 * this merchant — it forwards the `reference` we send straight through as the
 * account number. Sending our order id there ("hopeawards-43-…") posts to an
 * account that does not exist, and KCB returns the money to the payer.
 *
 * So every order sends THIS account number as its reference. Our own order id
 * stays in the database and is matched again through the gateway's
 * `transaction_request_id`, which is unique per order.
 *
 * Not a secret: it is the same number printed on our payment instructions.
 */
export const COLLECTION_PAYBILL = "522533";
export const COLLECTION_ACCOUNT_NUMBER = "8035572";

/**
 * The account number to send with every payment. An explicit override (the
 * `MEGAPAY_ACCOUNT_NUMBER` env var) wins; a blank override never disables the
 * rule, because sending no account is what returned every payment to the payer.
 */
export function collectionAccountNumber(override?: string | null): string {
  const value = (override ?? "").trim();
  return value || COLLECTION_ACCOUNT_NUMBER;
}

/** Number of days a fan has to flag a payment that never produced votes. */
export const PAYMENT_CLAIM_WINDOW_DAYS = 14;

/**
 * How long an unconfirmed vote order (started but never paid) is kept before
 * the server purges it. Mirrored in the Privacy Policy, so the policy's
 * retention promise and the cleanup job can never drift apart.
 */
export const PENDING_PAYMENT_RETENTION_DAYS = 180;

/** Effective date shown on the About, Terms and Privacy pages. */
export const LEGAL_LAST_UPDATED = "16 October 2026";
