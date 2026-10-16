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

/** Largest number of votes the voting form accepts in one M-Pesa transaction. */
export const MAX_VOTES_PER_TRANSACTION = 10000;

/** Maximum photo size accepted with a nomination, in megabytes. */
export const NOMINATION_PHOTO_MAX_MB = 2;

/** Payment gateway that collects the KES mobile-money charges for votes. */
export const PAYMENT_PROVIDER = "MegaPay";
export const PAYMENT_PROVIDER_URL = "https://megapay.co.ke";

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
