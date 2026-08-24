import { pool } from "./db";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS votes_paystack_reference_unique
        ON votes (paystack_reference);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS artists_category_idx
        ON artists (category);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS artists_total_votes_idx
        ON artists (total_votes DESC);
    `);
    await client.query(`
      ALTER TABLE artists ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio TEXT;
    `);
    await client.query(`
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_phone TEXT;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS votes_artist_id_idx
        ON votes (artist_id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_payments (
        id SERIAL PRIMARY KEY,
        reference TEXT UNIQUE NOT NULL,
        artist_id INTEGER NOT NULL,
        votes_added INTEGER NOT NULL,
        amount_kes INTEGER NOT NULL,
        voter_phone TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pending_payments_created_at_idx
        ON pending_payments (created_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS requests_status_idx
        ON requests (status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS uploaded_images_filename_idx
        ON uploaded_images (filename);
    `);
    console.log("[migrate] DB indexes applied.");
  } catch (err) {
    console.error("[migrate] Index migration error (non-fatal):", err);
  } finally {
    client.release();
  }
}
