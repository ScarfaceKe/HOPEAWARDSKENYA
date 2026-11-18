/**
 * Operator diagnostic: why is the database answering instead of serving?
 *
 * Connects with DATABASE_URL and reports the server's own words — host class,
 * database name, version, and the full error (code + message) when a trivial
 * query fails. Prints no credentials: only the error text and non-secret
 * identity fields the server returns.
 *
 * Usage: npx tsx scripts/db-diagnose.ts
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in this environment.");
  process.exit(1);
}

// Host name only (no user, no password, no database path).
let host = "(unparseable)";
try {
  host = new URL(url).hostname;
} catch {
  /* leave as-is */
}

const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 10_000,
  // Keep the driver quiet about the connection string.
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

console.log(`target host : ${host}`);

try {
  await client.connect();
  console.log("connected   : yes");

  const who = await client.query(
    `select current_database() as db,
            current_user   as usr,
            split_part(version(), ' ', 2) as server_version`,
  );
  console.log("database    :", who.rows[0].db);
  console.log("role        :", who.rows[0].usr);
  console.log("pg version  :", who.rows[0].server_version);

  const counts = await client.query(
    `select (select count(*) from artists)      as artists,
            (select count(*) from votes)        as votes,
            (select count(*) from categories)   as categories`,
  );
  console.log("rows        :", counts.rows[0]);
} catch (error) {
  const e = error as { code?: string; message?: string; detail?: string; hint?: string };
  console.error("FAILED      :", e.message);
  if (e.code) console.error("code        :", e.code);
  if (e.detail) console.error("detail      :", e.detail);
  if (e.hint) console.error("hint        :", e.hint);
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
