// ─── CSRF protection for cookie-authenticated writes ────────────────────────
// The admin panel is authenticated by a session cookie, so every mutating
// request that relies on that cookie must present a session-bound token in the
// `x-csrf-token` header. The token is issued with the session and handed to the
// client by `/api/admin/check`; it is never stored in a readable cookie, so a
// cross-site page cannot forge it.
//
// Deny-by-default: the middleware covers every non-safe `/api` request and only
// the explicitly public / server-to-server endpoints below are exempt. A new
// admin route is therefore protected without anyone remembering to add it.

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { recordAlertThrottled } from "./alerts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Public forms and server-to-server callbacks that must work without a session
 * (they are not authenticated by cookie, so there is nothing to forge):
 *  - /api/admin/login        sign-in itself, protected by the password + 2FA
 *  - /api/requests           public nomination form
 *  - /api/upload-token       public upload token issuance (rate limited)
 *  - /api/upload-public      nomination photo upload (needs an upload token)
 *  - /api/megapay/initialize fan starts an M-Pesa vote payment
 *  - /api/megapay/callback   MegaPay server callback (authenticated by secret/IP)
 *  - /api/ussd/callback      MobileSasa USSD step (authenticated by HMAC signature)
 */
export const CSRF_EXEMPT_PATHS = new Set([
  "/api/admin/login",
  "/api/requests",
  "/api/upload-token",
  "/api/upload-public",
  "/api/megapay/initialize",
  "/api/megapay/callback",
  "/api/ussd/callback",
]);

export const CSRF_HEADER = "x-csrf-token";

/** Reads the token for this session, creating it if this is the first request. */
export function issueCsrfToken(req: Request): string {
  const session = req.session as (Request["session"] & { csrfToken?: string }) | undefined;
  if (!session) return "";
  if (!session.csrfToken) {
    session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return session.csrfToken;
}

function tokenMatches(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const expected = issueCsrfToken(req);
  const provided = String(req.headers[CSRF_HEADER] ?? "");
  if (tokenMatches(expected, provided)) return next();

  recordAlertThrottled(
    "warning",
    "security.csrf_rejected",
    "Blocked a cookie-authenticated write without a valid CSRF token",
    {
      path: req.path,
      method: req.method,
      ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
      origin: req.headers.origin ?? null,
    },
    30_000,
  );

  return res.status(403).json({
    message: "Security token missing or expired. Reload the page and try again.",
  });
}
