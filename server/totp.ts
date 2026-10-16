// ─── TOTP (RFC 6238) — admin second factor ──────────────────────────────────
// Implemented with node:crypto so we don't pull in another dependency for ~40
// lines of well-specified maths. Verified against the RFC 6238 SHA-1 test
// vectors in `server/__tests__` style checks run during development.

import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decodes an RFC 4648 base32 secret (spaces and padding tolerated). */
export function decodeBase32(secret: string): Buffer {
  const cleaned = secret.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
  if (!cleaned) return Buffer.alloc(0);
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** Fresh 20-byte base32 secret for enrolling a new authenticator. */
export function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  let out = "";
  for (let i = 0; i < bytes.length; i += 5) {
    const chunk = bytes.subarray(i, i + 5);
    const bits = Array.from(chunk)
      .map((b) => b.toString(2).padStart(8, "0"))
      .join("");
    for (let b = 0; b < bits.length; b += 5) {
      const group = bits.slice(b, b + 5).padEnd(5, "0");
      out += BASE32_ALPHABET[parseInt(group, 2)];
    }
  }
  return out.slice(0, 32);
}

let enrollmentSecretCache: string | null = null;

/**
 * The secret shown on the admin Security tab while two-factor is still off.
 * Memoised for the life of the process: if we handed out a new secret on every
 * request, an admin who scanned one, looked away, and came back would configure
 * the second one and lock themselves out with the code from the first.
 */
export function enrollmentSecret(): string {
  if (!enrollmentSecretCache) enrollmentSecretCache = generateSecret();
  return enrollmentSecretCache;
}

export function generateTotp(
  secret: string,
  timeMs = Date.now(),
  { digits = 6, period = 30 }: { digits?: number; period?: number } = {},
): string {
  const key = decodeBase32(secret);
  if (key.length === 0) throw new Error("Empty TOTP secret");
  const counter = Math.floor(timeMs / 1000 / period);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a 6-digit code, allowing `window` steps of clock drift on either
 * side (1 step = 30s).
 */
export function verifyTotp(
  secret: string,
  token: string,
  timeMs = Date.now(),
  window = 1,
): boolean {
  const candidate = (token ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;
  let key: Buffer;
  try {
    key = decodeBase32(secret);
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotp(secret, timeMs + offset * 30_000);
    if (timingSafeEqualStrings(expected, candidate)) return true;
  }
  return false;
}

/** True when a usable second factor is configured on the server. */
export function twoFactorEnabled(): boolean {
  const secret = process.env.ADMIN_TOTP_SECRET?.trim();
  if (!secret) return false;
  try {
    return decodeBase32(secret).length > 0;
  } catch {
    return false;
  }
}

/**
 * Builds an otpauth:// URI so the admin can scan the secret into Google
 * Authenticator / Authy. Used by the setup helper, not by the login route.
 */
export function otpauthUri(secret: string, account = "admin", issuer = "Hope Awards Kenya"): string {
  // The otpauth label is `issuer:account`, URI-encoded — but the colon between
  // them is the separator and stays literal (that is the form apps display and
  // the one every documented example uses).
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({ secret, issuer, period: "30", digits: "6", algorithm: "SHA1" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
