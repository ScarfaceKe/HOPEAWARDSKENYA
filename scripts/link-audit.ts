/**
 * Are links already in the wild pointing at nominees that no longer exist?
 *
 * A fan following an old poster, WhatsApp message or social post lands on
 * `/artist/<id>`. If that nominee has since been deleted, the page renders
 * "404 Artist not found" — which looks like the site is broken but is really a
 * stale link. This lists the deleted nominees that still have votes or published
 * captions pointing at them, so the volume of stale links is knowable.
 *
 * Read-only: one transaction, always rolled back.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in this environment.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");

  const { rows: missingVoted } = await client.query(`
    SELECT v.artist_id,
           count(*)              AS vote_rows,
           sum(v.votes_added)    AS votes,
           sum(v.amount_kes)     AS kes,
           min(v.created_at)     AS first_seen,
           max(v.created_at)     AS last_seen
    FROM votes v
    LEFT JOIN artists a ON a.id = v.artist_id
    WHERE a.id IS NULL
    GROUP BY v.artist_id
    ORDER BY votes DESC;
  `);

  console.log("DELETED NOMINEES THAT STILL HOLD VOTES");
  if (missingVoted.length === 0) {
    console.log("  none");
  } else {
    for (const r of missingVoted as Array<Record<string, any>>) {
      console.log(
        `  artist #${r.artist_id}  ${r.vote_rows} orders  ${r.votes} votes  ` +
          `KES ${r.kes}  (${String(r.first_seen).slice(0, 16)} -> ${String(r.last_seen).slice(0, 16)})`,
      );
    }
  }

  // Captions are what actually circulate on Facebook/TikTok/YouTube.
  const { rows: brokenPosts } = await client.query(`
    WITH links AS (
      SELECT sp.artist_id,
             sp.posted_at,
             sp.status,
             (regexp_match(coalesce(sp.caption, ''), '/artist/([0-9]+)'))[1]::int AS linked_artist_id
      FROM social_posts sp
    )
    SELECT l.artist_id, l.status, l.linked_artist_id, l.posted_at
    FROM links l
    LEFT JOIN artists a ON a.id = l.linked_artist_id
    WHERE l.linked_artist_id IS NOT NULL AND a.id IS NULL
    ORDER BY l.posted_at DESC NULLS LAST;
  `);

  console.log("\nPUBLISHED POSTS WHOSE CAPTION LINKS TO A DELETED NOMINEE");
  if (brokenPosts.length === 0) {
    console.log("  none");
  } else {
    for (const r of brokenPosts as Array<Record<string, any>>) {
      console.log(
        `  post for artist #${r.artist_id}  status=${r.status ?? "?"}  ` +
          `links to #${r.linked_artist_id} (missing)  posted=${r.posted_at ?? "never"}`,
      );
    }
  }

  // Deletion is audited, so a mistaken delete can be reversed. Anything the log
  // remembers (name, category) is enough to restore a nominee by hand.
  const ids = (missingVoted as Array<Record<string, any>>).map((r) => String(r.artist_id));
  if (ids.length > 0) {
    const { rows: trail } = await client.query(
      `SELECT created_at, action, entity, entity_id, summary
         FROM admin_audit_log
        WHERE entity_id = ANY($1::text[])
           OR summary ~* '(delete|remove|merg)'
        ORDER BY created_at ASC
        LIMIT 40`,
      [ids],
    );

    console.log("\nAUDIT TRAIL FOR THOSE NOMINEES");
    if (trail.length === 0) {
      console.log("  no audit rows — the deletion happened before auditing was added");
    } else {
      for (const r of trail as Array<Record<string, any>>) {
        console.log(
          `  ${String(r.created_at).slice(0, 16)}  ${r.action} ${r.entity}#${r.entity_id}  ${r.summary}`,
        );
      }
    }
  }

  const { rows: totals } = await client.query(`
    SELECT (SELECT count(*) FROM artists) AS artists,
           (SELECT count(*) FROM social_posts) AS posts,
           (SELECT count(*) FROM pending_payments) AS open_orders;
  `);
  console.log("\nSUMMARY", totals[0]);

  await client.query("ROLLBACK");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
