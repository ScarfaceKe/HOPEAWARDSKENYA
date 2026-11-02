// ─── WhatsApp phone-linking codes ───────────────────────────────────────────
// Baileys hands back the eight raw characters (e.g. ABCD1234). WhatsApp shows
// the same code grouped 4-4 with a dash on the phone's "Link with phone number"
// screen; the dash is presentation only and is never typed. Keep the formatting
// and the short validity window in one place so the admin panel and the server
// cannot disagree about either.

/**
 * How long a linking code is usable, and how long the Baileys socket is kept
 * alive while waiting for it. WhatsApp decides the real cutoff on its servers
 * (observed around three minutes); this is the window we show and support.
 */
export const PAIRING_CODE_TTL_MS = 3 * 60_000;

/** `ABCD1234` -> `ABCD-1234`, matching what WhatsApp displays on the phone. */
export function formatPairingCode(code: string): string {
  const compact = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : code;
}

/**
 * Seconds left before the code should be replaced. Returns null when the
 * server has not reported when the current code was issued.
 */
export function pairingCodeSecondsLeft(
  issuedAt: number | null | undefined,
  now = Date.now(),
): number | null {
  if (!issuedAt) return null;
  return Math.max(0, Math.ceil((issuedAt + PAIRING_CODE_TTL_MS - now) / 1000));
}
