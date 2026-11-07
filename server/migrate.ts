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
        payment_reference TEXT NOT NULL,
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
      CREATE TABLE IF NOT EXISTS nominee_notifications (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL,
        artist_id INTEGER,
        phone TEXT NOT NULL,
        link TEXT NOT NULL,
        message TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'whatsapp',
        status TEXT NOT NULL,
        provider TEXT,
        provider_message_id TEXT,
        error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMP
      );
    `);

    // Baileys keeps its WhatsApp Web keys here so a linked number survives a
    // deploy (Render's disk is ephemeral). Deleting a row here unlinks a device.
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_auth (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // The automation switch and rate gate. Defaulting to paused on a fresh
    // install is deliberate: no message goes out until the first successful
    // link, which auto-starts the queue once. After that an explicit pause or
    // resume wins, and the row survives deploys so a pause stays in force.
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_automation (
        id INTEGER PRIMARY KEY,
        paused BOOLEAN NOT NULL DEFAULT TRUE,
        last_run_at TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE whatsapp_automation ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP;
    `);
    // False until an admin presses pause/resume or the first successful link
    // auto-starts the queue. That one-time start must not override a later
    // explicit pause when the session reconnects.
    await client.query(`
      ALTER TABLE whatsapp_automation ADD COLUMN IF NOT EXISTS auto_started BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    await client.query(`
      INSERT INTO whatsapp_automation (id, paused) VALUES (1, TRUE)
      ON CONFLICT (id) DO NOTHING;
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

    // The votes table once used a previous provider's name for our own order
    // reference. Rename the column in place so live rows keep their history.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'votes' AND column_name = 'paystack_reference'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'votes' AND column_name = 'payment_reference'
        ) THEN
          ALTER TABLE votes RENAME COLUMN paystack_reference TO payment_reference;
        END IF;
      END $$;
    `);
    await client.query(`
      ALTER INDEX IF EXISTS votes_paystack_reference_unique
        RENAME TO votes_payment_reference_unique;
    `);

    // Create indexes
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS votes_payment_reference_unique
        ON votes (payment_reference);
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
    // Social posting must never treat an ordinary profile photo as an official
    // poster. Only an admin-confirmed row is eligible while the filter is on.
    await client.query(`
      ALTER TABLE artists ADD COLUMN IF NOT EXISTS poster_ready BOOLEAN NOT NULL DEFAULT FALSE;
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
    // Every order now shares the collection account number as its reference, so
    // the gateway's transaction id is the key a callback maps back to an order.
    await client.query(`
      CREATE INDEX IF NOT EXISTS votes_gateway_request_id_idx
        ON votes (gateway_request_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pending_payments_gateway_request_id_idx
        ON pending_payments (gateway_request_id);
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
    // "Has this nominee been messaged?" is asked per request, newest first.
    await client.query(`
      CREATE INDEX IF NOT EXISTS nominee_notifications_request_id_idx
        ON nominee_notifications (request_id, created_at DESC);
    `);

    // Social auto-posting through Zernio. One row per artist keeps the poster
    // queue idempotent: a crash after publishing can never post the same poster
    // twice, and the queue can resume exactly where it stopped.
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_automation (
        id INTEGER PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        only_with_posters BOOLEAN NOT NULL DEFAULT TRUE,
        profile_id TEXT,
        last_post_at TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE social_automation
        ADD COLUMN IF NOT EXISTS only_with_posters BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    await client.query(`
      INSERT INTO social_automation (id, enabled) VALUES (1, FALSE)
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_posts (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL UNIQUE,
        zernio_post_id TEXT,
        status TEXT NOT NULL DEFAULT 'posting',
        platforms TEXT,
        caption TEXT NOT NULL,
        media_url TEXT NOT NULL,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        posted_at TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS social_posts_status_idx
        ON social_posts (status, updated_at DESC);
    `);

    // The admin's manual-vote switch. Off by default: an admin must explicitly
    // open the add-vote controls before the server will accept an addition.
    await client.query(`
      CREATE TABLE IF NOT EXISTS manual_vote_settings (
        id INTEGER PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      INSERT INTO manual_vote_settings (id, enabled) VALUES (1, FALSE)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("[migrate] Tables and DB indexes applied.");
  } catch (err) {
    console.error("[migrate] Migration error (non-fatal):", err);
  } finally {
    client.release();
  }
}
