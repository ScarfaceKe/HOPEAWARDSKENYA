import { pool } from "./db";

// ─── WhatsApp automation limits ─────────────────────────────────────────────
// An unofficial WhatsApp Web session that sends in bursts gets restricted.
// These are deliberately conservative: one small batch an hour, with a real
// gap between messages. The admin can pause everything, and the pause survives
// restarts/deploys because it lives in Postgres, not memory.

/** Nominees messaged in one batch. */
export const WHATSAPP_BATCH_SIZE = 5;
/** Minimum gap between two messages in the same batch (plus jitter). */
export const WHATSAPP_MESSAGE_GAP_MS = 60_000;
/** Minimum gap between two batches, whichever button/timer starts them. */
export const WHATSAPP_RUN_INTERVAL_MS = 60 * 60_000;

export interface WhatsAppAutomationState {
  paused: boolean;
  /** Epoch ms of the last claimed batch, or null if none has ever run. */
  lastRunAt: number | null;
}

/**
 * Reads the persistent switch. A missing row or a database error counts as
 * paused: when we cannot prove sending is allowed, we do not send.
 */
export async function getWhatsAppAutomationState(): Promise<WhatsAppAutomationState> {
  try {
    const { rows } = await pool.query<{ paused: boolean; last_run_at: Date | null }>(
      "SELECT paused, last_run_at FROM whatsapp_automation WHERE id = 1",
    );
    const row = rows[0];
    if (!row) return { paused: true, lastRunAt: null };
    return {
      paused: row.paused !== false,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at).getTime() : null,
    };
  } catch (err) {
    console.error("[WHATSAPP] Could not read the automation switch:", err);
    return { paused: true, lastRunAt: null };
  }
}

export async function isWhatsAppAutomationPaused(): Promise<boolean> {
  return (await getWhatsAppAutomationState()).paused;
}

export async function setWhatsAppAutomationPaused(paused: boolean): Promise<WhatsAppAutomationState> {
  await pool.query(
    `INSERT INTO whatsapp_automation (id, paused, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET paused = EXCLUDED.paused, updated_at = NOW()`,
    [paused],
  );
  return getWhatsAppAutomationState();
}

/**
 * Atomically takes the next hourly slot. This is the only place that decides a
 * batch may start, so the timer, the admin button and the Cloud API batch
 * cannot stack on top of each other. `last_run_at` is stamped when the slot is
 * claimed — a crash mid-batch cannot reopen the gate early.
 */
export async function claimWhatsAppBatch(): Promise<boolean> {
  const intervalSeconds = Math.floor(WHATSAPP_RUN_INTERVAL_MS / 1000);
  try {
    const result = await pool.query(
      `UPDATE whatsapp_automation
          SET last_run_at = NOW()
        WHERE id = 1
          AND paused = FALSE
          AND (last_run_at IS NULL OR last_run_at <= NOW() - ($1::int * INTERVAL '1 second'))`,
      [intervalSeconds],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    console.error("[WHATSAPP] Could not claim a send slot:", err);
    return false;
  }
}
