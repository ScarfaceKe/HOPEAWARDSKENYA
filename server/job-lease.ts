import crypto from "crypto";
import { pool } from "./db";

/**
 * One short row per background job, written only while the job is actually
 * running. It is the only thing that stops two Render instances from running
 * the same payment sweep at the same time (two gateway calls for one order, two
 * upload purges, two posters).
 *
 * Deliberately NOT a PostgreSQL advisory lock: an advisory lock needs a session
 * held open for the lifetime of the process, and a permanently checked-out
 * connection is one of the things that keeps a Neon compute from ever going
 * quiet. This lease is written and forgotten — the next pass takes it over once
 * the previous lease expires.
 */

/** Identifies this process; a redeployed instance gets a new one automatically. */
const OWNER_ID = `${process.pid}-${crypto.randomBytes(4).toString("hex")}`;

/**
 * Tries to become the runner of `name` for the next `ttlMs`. Returns true when
 * this process may run the job. The TTL is short (a pass, not an interval) so a
 * crashed instance never blocks the job for longer than one run.
 */
export async function acquireJobLease(name: string, ttlMs: number): Promise<boolean> {
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO job_leases (name, owner, expires_at)
       VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 millisecond'))
       ON CONFLICT (name) DO UPDATE
         SET owner = EXCLUDED.owner,
             expires_at = EXCLUDED.expires_at
       WHERE job_leases.owner = EXCLUDED.owner
          OR job_leases.expires_at < NOW()`,
      [name, OWNER_ID, Math.max(5_000, Math.trunc(ttlMs))],
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    // FAIL OPEN, deliberately. The lease exists to avoid duplicate work, not to
    // gate payment recovery: if the table is missing (a migration that logged a
    // non-fatal error) or the world is briefly odd, running the pass once more is
    // far better than silently never recovering a paid order. Credits remain
    // idempotent through `votes.payment_reference`'s unique index.
    console.error(
      `[job-lease] Could not take the lease for "${name}" — running the pass anyway:`,
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}
