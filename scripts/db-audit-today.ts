/**
 * Read-only audit of the vote ledger.
 *
 * Answers the two questions the Neon compute incident left open:
 *
 *   1. Were today's paid votes actually recorded? (per-hour counts in EAT, plus
 *      yesterday and the all-time total for comparison)
 *   2. Did any customer pay without getting their votes? (open pending orders,
 *      oldest first, and orders whose reference already has a credited vote)
 *
 * It runs inside `BEGIN TRANSACTION READ ONLY`, issues SELECTs only, and masks
 * phone numbers — a dump of voters' numbers must never end up in a terminal log
 * or a pasted ticket.
 *
 *   npx tsx scripts/db-audit-today.ts
 *
 * For the audit itself, a Neon role with `SELECT`-only grants (or a read replica)
 * is the right connection string: nothing here needs write access.
 *
 * TIMEZONE NOTE — `votes.created_at` and `pending_payments.created_at` are
 * `timestamp WITHOUT time zone` filled by `defaultNow()`, and the database
 * session runs in GMT, so the stored wall-clock value is UTC. Converting needs
 * BOTH steps: `AT TIME ZONE 'UTC'` first (naive -> instant), then
 * `AT TIME ZONE 'Africa/Nairobi'` (instant -> EAT wall-clock). One step alone
 * silently shifts every figure by three hours and moves the day boundary.
 */
import { Client } from "pg";

/**
 * Stored naive UTC -> EAT wall-clock. Two explicit forms (bare column and the
 * `v.` alias) instead of string-rewriting one expression: rewriting SQL by
 * substring is the kind of thing that breaks quietly when the expression grows.
 */
const eatOf = (column: string) =>
  `((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi')`;
const EAT = eatOf("created_at");
const EAT_V = eatOf("v.created_at");

/** 2547***134 — enough to identify a row, never enough to contact a voter. */
function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

const n = (value: unknown): number => Number(value ?? 0) || 0;
const kes = (value: unknown): string => `KES ${n(value).toLocaleString("en-KE")}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Nothing to audit.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    application_name: "hopeawards-audit",
    statement_timeout: 20_000,
    query_timeout: 25_000,
  });

  await client.connect();

  try {
    // Read-only, enforced by the server rather than by trusting this file.
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '20s'");

    const one = async <T extends Record<string, unknown>>(sql: string): Promise<T> => {
      const { rows } = await client.query(sql);
      return (rows[0] ?? {}) as T;
    };

    console.log("\n=== Vote ledger audit (all times Africa/Nairobi, UTC+3) ===\n");

    // ── Today vs yesterday vs all-time ──────────────────────────────────────
    const summary = await one<{
      today_count: string;
      today_votes: string;
      today_amount: string;
      today_first: string | null;
      today_last: string | null;
      yday_count: string;
      yday_votes: string;
      all_count: string;
      all_votes: string;
      all_amount: string;
      joined_votes: string;
      dup_refs: string;
    }>(`
      WITH ledger AS (
        SELECT v.*, ${EAT_V} AS created_eat
        FROM votes v
      ), today AS (
        SELECT (now() AT TIME ZONE 'Africa/Nairobi')::date AS d
      )
      SELECT
        count(*) FILTER (WHERE created_eat::date = (SELECT d FROM today))            AS today_count,
        coalesce(sum(votes_added) FILTER (WHERE created_eat::date = (SELECT d FROM today)), 0) AS today_votes,
        coalesce(sum(amount_kes) FILTER (WHERE created_eat::date = (SELECT d FROM today)), 0)   AS today_amount,
        to_char(min(created_eat) FILTER (WHERE created_eat::date = (SELECT d FROM today)), 'YYYY-MM-DD HH24:MI') AS today_first,
        to_char(max(created_eat) FILTER (WHERE created_eat::date = (SELECT d FROM today)), 'YYYY-MM-DD HH24:MI') AS today_last,
        count(*) FILTER (WHERE created_eat::date = (SELECT d FROM today) - 1)         AS yday_count,
        coalesce(sum(votes_added) FILTER (WHERE created_eat::date = (SELECT d FROM today) - 1), 0) AS yday_votes,
        count(*)                                                                       AS all_count,
        coalesce(sum(votes_added), 0)                                                  AS all_votes,
        coalesce(sum(amount_kes), 0)                                                   AS all_amount,
        count(*) - count(DISTINCT payment_reference)                                    AS dup_refs,
        -- The public total INNER JOINs artists, so votes for a deleted nominee are
        -- in the ledger but not in the number the site shows.
        (SELECT coalesce(sum(v.votes_added), 0) FROM votes v JOIN artists a ON a.id = v.artist_id) AS joined_votes
      FROM ledger;
    `);

    console.log("TODAY (EAT)");
    console.log(`  paid votes credited : ${n(summary.today_count)} rows / ${n(summary.today_votes)} votes`);
    console.log(`  money               : ${kes(summary.today_amount)}`);
    console.log(`  first / last vote   : ${summary.today_first ?? "—"} → ${summary.today_last ?? "—"}`);
    console.log("YESTERDAY (EAT)");
    console.log(`  paid votes credited : ${n(summary.yday_count)} rows / ${n(summary.yday_votes)} votes`);
    console.log("ALL TIME");
    console.log(`  paid votes credited : ${n(summary.all_count)} rows / ${n(summary.all_votes)} votes / ${kes(summary.all_amount)}`);
    console.log(`  public total (join) : ${n(summary.joined_votes)} votes  ← what /api/stats/total-votes reports`);
    const orphanVotes = n(summary.all_votes) - n(summary.joined_votes);
    if (orphanVotes !== 0) {
      console.log(`  not in public total : ${orphanVotes} votes belong to nominee ids that no longer exist`);
    }
    console.log(`  duplicate references: ${n(summary.dup_refs)} ${n(summary.dup_refs) === 0 ? "(correct — the unique index is doing its job)" : "(INVESTIGATE)"}`);

    // ── Today, hour by hour ────────────────────────────────────────────────
    const { rows: hours } = await client.query(`
      SELECT to_char(date_trunc('hour', (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi'), 'HH24:00') AS hour_eat,
             count(*)         AS rows,
             sum(votes_added) AS votes,
             sum(amount_kes)  AS amount
      FROM votes
      WHERE ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi')::date
            = (now() AT TIME ZONE 'Africa/Nairobi')::date
      GROUP BY 1
      ORDER BY 1;
    `);

    console.log("\nTODAY BY HOUR (EAT)");
    if (hours.length === 0) {
      console.log("  no votes recorded today");
    } else {
      for (const h of hours) {
        const bar = "█".repeat(Math.min(40, Math.max(1, Math.round(n(h.votes) / 2))));
        console.log(`  ${h.hour_eat}  ${String(n(h.rows)).padStart(3)} rows  ${String(n(h.votes)).padStart(4)} votes  ${kes(h.amount).padStart(12)}  ${bar}`);
      }
    }

    // ── The money question: paid but not credited? ─────────────────────────
    const { rows: stuck } = await client.query(`
      SELECT p.reference,
             p.artist_id,
             p.votes_added,
             p.amount_kes,
             p.voter_phone,
             p.gateway_request_id IS NOT NULL AS has_gateway_id,
             round(EXTRACT(EPOCH FROM (now() - p.created_at)) / 60)::int AS age_minutes,
             (v.payment_reference IS NOT NULL) AS already_credited
      FROM pending_payments p
      LEFT JOIN votes v ON v.payment_reference = p.reference
      ORDER BY p.created_at ASC
      LIMIT 50;
    `);

    console.log("\nOPEN PENDING ORDERS (oldest first)");
    if (stuck.length === 0) {
      console.log("  none — every started payment has been resolved");
    } else {
      for (const p of stuck as Array<Record<string, any>>) {
        const flag = p.already_credited
          ? "credited (litter row, safe to clear)"
          : n(p.age_minutes) >= 5
            ? "STUCK >5min — verify with the gateway"
            : "fresh";
        console.log(
          `  ${p.reference}  ${String(n(p.age_minutes)).padStart(4)}m  ${kes(p.amount_kes)}  ` +
            `${p.votes_added} votes  artist ${p.artist_id}  ${maskPhone(p.voter_phone)}  ` +
            `gw=${p.has_gateway_id ? "yes" : "NO"}  → ${flag}`,
        );
      }
    }

    const buckets = await one<{ fresh: string; mid: string; stale: string }>(`
      SELECT count(*) FILTER (WHERE now() - created_at <  interval '5 minutes')  AS fresh,
             count(*) FILTER (WHERE now() - created_at >= interval '5 minutes'
                                AND now() - created_at <  interval '2 hours')    AS mid,
             count(*) FILTER (WHERE now() - created_at >= interval '2 hours')    AS stale
      FROM pending_payments;
    `);
    console.log(
      `\n  age buckets: <5min ${n(buckets.fresh)} · 5min–2h ${n(buckets.mid)} · >2h ${n(buckets.stale)}`,
    );

    // ── The newest rows, so the tail of today is visible ───────────────────
    const { rows: latest } = await client.query(`
      SELECT to_char((v.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi', 'HH24:MI:SS') AS at_eat,
             v.payment_reference,
             v.artist_id,
             a.name AS artist_name,
             v.votes_added,
             v.amount_kes,
             v.voter_phone,
             v.gateway_request_id IS NOT NULL AS has_gateway_id
      FROM votes v
      LEFT JOIN artists a ON a.id = v.artist_id
      WHERE ((v.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi')::date
            = (now() AT TIME ZONE 'Africa/Nairobi')::date
      ORDER BY v.created_at DESC
      LIMIT 15;
    `);

    console.log("\nNEWEST VOTES TODAY (EAT)");
    if (latest.length === 0) {
      console.log("  none");
    } else {
      for (const v of latest as Array<Record<string, any>>) {
        console.log(
          `  ${v.at_eat}  ${v.payment_reference}  ${v.artist_name ?? `artist #${v.artist_id} (missing)`}  ` +
            `${v.votes_added} votes  ${kes(v.amount_kes)}  ${maskPhone(v.voter_phone)}  ` +
            `gw=${v.has_gateway_id ? "yes" : "NO"}`,
        );
      }
    }

    // ── Integrity: money that moved without the arithmetic to match ────────
    // Cheap invariants that catch a half-written credit after an outage: a vote
    // row with no gateway id was never confirmed by MegaPay, and a row whose
    // amount is not `votes * 10` means the charge and the credit disagree.
    const integrity = await one<{ no_gateway: string; bad_amount: string; not_whole: string }>(`
      SELECT count(*) FILTER (WHERE gateway_request_id IS NULL)                     AS no_gateway,
             count(*) FILTER (WHERE amount_kes <> votes_added * 10)                 AS bad_amount,
             count(*) FILTER (WHERE votes_added <= 0 OR votes_added <> trunc(votes_added)) AS not_whole
      FROM votes;
    `);
    console.log("\nINTEGRITY (all time)");
    console.log(`  rows with no gateway id   : ${n(integrity.no_gateway)}  (should be 0)`);
    console.log(`  rows where amount ≠ 10×votes : ${n(integrity.bad_amount)}  (should be 0)`);
    console.log(`  rows with a non-whole vote count : ${n(integrity.not_whole)}  (should be 0)`);

    if (n(integrity.no_gateway) > 0) {
      const { rows: unconfirmed } = await client.query(`
        SELECT v.payment_reference, v.artist_id, v.votes_added, v.amount_kes,
               to_char((v.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi',
                       'YYYY-MM-DD HH24:MI') AS created_eat
        FROM votes v
        WHERE v.gateway_request_id IS NULL
        ORDER BY v.created_at DESC
        LIMIT 20;
      `);
      for (const row of unconfirmed as Array<Record<string, any>>) {
        console.log(
          `    ${row.created_eat} EAT  ${row.payment_reference}  artist ${row.artist_id}  ` +
            `${row.votes_added} votes  ${kes(row.amount_kes)}`,
        );
      }
    }

    await client.query("ROLLBACK");
    console.log("\n=== Audit complete (read-only transaction rolled back) ===\n");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Audit failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
