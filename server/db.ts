// Process-level error handlers — must be first in the bundle
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message || err);
  console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
  process.exit(1);
});

console.log("[boot] Starting Hope Awards Kenya server...");
console.log("[boot] NODE_ENV:", process.env.NODE_ENV || "(not set)");
console.log("[boot] DATABASE_URL set:", !!process.env.DATABASE_URL);
console.log("[boot] MEGAPAY_API_KEY set:", !!process.env.MEGAPAY_API_KEY);
console.log("[boot] SESSION_SECRET set:", !!process.env.SESSION_SECRET);
console.log("[boot] ADMIN_PASSWORD set:", !!process.env.ADMIN_PASSWORD);
console.log("[boot] PORT:", process.env.PORT || "(not set, default 5000)");

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error(
    "[FATAL] DATABASE_URL must be set. Did you forget to provision a database?"
  );
  process.exit(1);
}

// SSL is configured via the `ssl` option below, which works for Render, Railway,
// and other managed Postgres providers that use self-signed certificates.
// Do NOT append sslmode= to the connection string — it can conflict with the
// Pool-level ssl option and cause DEPTH_ZERO_SELF_SIGNED_CERT errors.
console.log("[db] Connecting to database with SSL...");

/**
 * Pool sizing is a database-cost decision, not a performance knob.
 *
 * Neon bills compute time, and every connection held by this process is a
 * connection the database server has to keep ready. The app is one Express
 * process with short queries (a few dozen per request at most), so five
 * connections cover a busy voting night; twenty only made the idle footprint
 * larger. `idleTimeoutMillis` is deliberately short: an unused client should go
 * back to the pool quickly and the pool should shrink to nothing when the site
 * is quiet, so Neon has something to scale down.
 *
 * The statement/query timeouts stop a single runaway query (a missing index, a
 * lock wait) from burning compute for minutes on end.
 */
const poolMax = (() => {
  const parsed = Number(process.env.DB_POOL_MAX ?? 5);
  if (!Number.isFinite(parsed) || parsed < 1) return 5;
  return Math.min(Math.trunc(parsed), 20);
})();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 8_000,
  statement_timeout: 15_000,
  query_timeout: 20_000,
  allowExitOnIdle: true,
  application_name: "hopeawardskenya",
  ssl: { rejectUnauthorized: false },
});

console.log(`[db] Pool size: ${poolMax} (override with DB_POOL_MAX).`);

/**
 * A dead idle client must never take the process down (server/db.ts installs an
 * uncaughtException handler that exits). The pool discards the client itself;
 * the next query opens a fresh one, and the background jobs back off instead of
 * retrying in a tight loop.
 */
pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

/** True for the errors a database outage actually produces. */
export function isDatabaseUnavailable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code ?? "";
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "57P01" || // admin_shutdown
    code === "57P03" || // cannot_connect_now
    code === "53300" || // too_many_connections
    code === "08000" ||
    code === "08003" ||
    code === "08006"
  );
}

export const db = drizzle(pool, { schema });
