import { pool } from "./db";
import { CATEGORIES } from "@shared/schema";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        genre TEXT NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        total_votes INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        bio TEXT
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL,
        amount_kes INTEGER NOT NULL,
        votes_added INTEGER NOT NULL,
        paystack_reference TEXT NOT NULL,
        voter_phone TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        submitter_name TEXT NOT NULL,
        submitter_phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploaded_images (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
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

    // The gateway's own transaction id, so a payment whose callback was lost can
    // still be confirmed against MegaPay and credited (see the status route).
    await client.query(`
      ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS gateway_request_id TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        group_name TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        summary TEXT NOT NULL,
        ip TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Seed the built-in categories exactly once. Seeding only when the table is
    // empty means a restart never resurrects a category an admin deleted, and an
    // edit to this list never overwrites the live table.
    const seeded = await client.query(`SELECT COUNT(*)::int AS count FROM categories`);
    if (Number(seeded.rows[0]?.count ?? 0) === 0) {
      for (const [index, category] of CATEGORIES.entries()) {
        await client.query(
          `INSERT INTO categories (id, name, group_name, display_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [category.id, category.name, category.group, index],
        );
      }
      console.log(`[migrate] Seeded ${CATEGORIES.length} award categories.`);
    }

    // Create indexes
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
    // `created_at` powers the "new this week" rail on the discovery page. Nominees
    // published before this column existed are back-dated 30 days so they are not
    // reported as brand new; anything inserted from here on gets the real time.
    await client.query(`
      ALTER TABLE artists ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
    `);
    await client.query(`
      UPDATE artists SET created_at = NOW() - INTERVAL '30 days' WHERE created_at IS NULL;
    `);
    await client.query(`
      ALTER TABLE artists ALTER COLUMN created_at SET DEFAULT NOW();
    `);
    await client.query(`
      ALTER TABLE artists ALTER COLUMN created_at SET NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS artists_created_at_idx
        ON artists (created_at DESC);
    `);
    await client.query(`
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_phone TEXT;
    `);
    await client.query(`
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS gateway_request_id TEXT;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS votes_artist_id_idx
        ON votes (artist_id);
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
    await client.query(`
      CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
        ON admin_audit_log (created_at DESC);
    `);
    console.log("[migrate] Tables and DB indexes applied.");
  } catch (err) {
    console.error("[migrate] Migration error (non-fatal):", err);
  } finally {
    client.release();
  }
}
