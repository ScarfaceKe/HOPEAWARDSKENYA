import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { csrfHeaders, setCsrfToken } from "./csrf";

/**
 * Re-reads the session's CSRF token after the server rejects ours as stale
 * (which happens after a redeploy, a server restart, or the 24-hour cookie
 * expiry). `/api/admin/check` is a GET, so it is never itself CSRF-blocked.
 */
async function refreshCsrfToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/check", { credentials: "include" });
    if (!res.ok) return false;
    const data = await res.json();
    setCsrfToken(data?.csrfToken);
    return typeof data?.csrfToken === "string" && data.csrfToken.length > 0;
  } catch {
    return false;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * `fetch` that carries the session CSRF token on every write and, if the
 * server still rejects the request as stale, re-reads the token once and
 * replays the request.
 *
 * Anything in the admin panel that builds its own request instead of going
 * through `apiRequest` must use this: `server/csrf.ts` denies every non-safe
 * `/api` request that arrives without `x-csrf-token`, so a bare `fetch` POST
 * gets a 403 no matter what the payload says.
 */
export async function csrfFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET";
  const send = () =>
    fetch(input, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        ...(isMutation ? csrfHeaders() : {}),
      },
    });

  let res = await send();

  // Retry once with a fresh token so a stale session can't wedge the admin
  // panel (including signing out).
  if (isMutation && res.status === 403 && (await refreshCsrfToken())) {
    res = await send();
  }

  return res;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await csrfFetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
