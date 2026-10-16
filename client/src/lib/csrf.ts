// Holds the session-bound CSRF token handed out by /api/admin/check and
// /api/admin/login. Admin writes send it as `x-csrf-token`; the server rejects
// any cookie-authenticated mutation that arrives without it.

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null | undefined) {
  csrfToken = token && token.length > 0 ? token : null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

/** Header object to spread into a mutating request. */
export function csrfHeaders(): Record<string, string> {
  return csrfToken ? { "x-csrf-token": csrfToken } : {};
}
