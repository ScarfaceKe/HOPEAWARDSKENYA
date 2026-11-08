// ─── Manual vote adjustments ─────────────────────────────────────────────────
// Manual entries are deliberately a two-step admin action: the global switch
// has to be on, and only then does the panel (and the API) accept a number. The
// switch lives in Postgres so a reload, a restart or a deploy cannot quietly
// turn it back on or leave the controls visible when the server would reject
// the request.
//
// Entries change a nominee's ranking tally, but never the paid site-wide
// total: that total is read from the `votes` ledger, and a manual entry never
// creates a payment row.

import { pool } from "./db";
import { MAX_MANUAL_VOTES_PER_ADDITION } from "@shared/site";

export interface ManualVoteSettings {
  enabled: boolean;
}

/** Re-exported so the route and the panel quote the same ceiling. */
export { MAX_MANUAL_VOTES_PER_ADDITION };

/**
 * Fail closed: if the setting cannot be read, the add controls are treated as
 * off. An unavailable database must never look like permission to change votes.
 */
export async function getManualVoteSettings(): Promise<ManualVoteSettings> {
  try {
    const { rows } = await pool.query<{ enabled: boolean }>(
      "SELECT enabled FROM manual_vote_settings WHERE id = 1",
    );
    return { enabled: rows[0]?.enabled === true };
  } catch (err) {
    console.error("[MANUAL VOTES] Could not read the switch:", err);
    return { enabled: false };
  }
}

export async function setManualVoteSettings(enabled: boolean): Promise<ManualVoteSettings> {
  await pool.query(
    `INSERT INTO manual_vote_settings (id, enabled, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           updated_at = NOW()`,
    [enabled],
  );
  return { enabled };
}
