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

// Ensure SSL is always enabled for PostgreSQL connections (Render, Railway, etc.)
const connectionString = process.env.DATABASE_URL.includes("sslmode=")
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL.includes("?")
    ? `${process.env.DATABASE_URL}&sslmode=require`
    : `${process.env.DATABASE_URL}?sslmode=require`;

console.log("[db] Connecting to database with SSL...");

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });
