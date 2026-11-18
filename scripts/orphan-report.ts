/**
 * Who are the deleted nominees that still hold paid votes, and is there a
 * surviving row the same artist lives under now?
 *
 * The public total sums `votes` joined to `artists`, so a vote whose nominee row
 * was deleted is real money that still appears in no total and in nobody's
 * ranking. This report exists to decide, per nominee, between restoring it,
 * merging the votes into the surviving duplicate, or writing them off.
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

const kes = (n: unknown) => `KES ${Number(n ?? 0).toLocaleString("en-KE")}`;
const num = (n: unknown) => Number(n ?? 0);
const eat = (d: unknown) =>
  d ? new Date(d as string).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "?";

await client.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");

  const { rows: orphans } = await client.query(`
    SELECT v.artist_id,
           count(*)           AS orders,
           sum(v.votes_added) AS votes,
           sum(v.amount_kes)  AS kes,
           min(v.created_at)  AS first_at,
           max(v.created_at)  AS last_at
    FROM votes v
    LEFT JOIN artists a ON a.id = v.artist_id
    WHERE a.id IS NULL
    GROUP BY v.artist_id
    ORDER BY sum(v.votes_added) DESC;
  `);

  if (orphans.length === 0) {
    console.log("No orphaned votes: every vote points at an existing nominee.");
  }

  for (const o of orphans as Array<Record<string, any>>) {
    const id = String(o.artist_id);

    const { rows: trail } = await client.query(
      `SELECT action, summary, created_at
         FROM admin_audit_log
        WHERE entity = 'artist' AND entity_id = $1
        ORDER BY created_at ASC
        LIMIT 5`,
      [id],
    );

    // "Added KYALO FRESHII to upcoming-male-artist" is how the create row reads.
    const created = trail.find((t: any) => t.action === "create") as any;
    const parsed = created
      ? /^Added (.+?) to ([\w-]+)\s*$/i.exec(String(created.summary))
      : null;
    const name = parsed?.[1]?.trim() ?? null;
    const category = parsed?.[2]?.trim() ?? null;

    console.log(`\n=== nominee #${id} — ${name ?? "(name not in the audit log)"}`);
    if (category) console.log(`    category : ${category}`);
    console.log(
      `    votes    : ${num(o.votes)} votes across ${num(o.orders)} paid orders, ${kes(o.kes)}`,
    );
    console.log(`    paid     : ${eat(o.first_at)} → ${eat(o.last_at)}`);

    if (name) {
      // The same act under a different row: same name, ideally same category.
      const { rows: candidates } = await client.query(
        `SELECT a.id, a.name, a.category, a.total_votes,
                (SELECT count(*) FROM votes v WHERE v.artist_id = a.id) AS vote_rows
           FROM artists a
          WHERE a.name ILIKE $1 OR a.name ILIKE $2
          ORDER BY (a.category = $3) DESC, a.id ASC
          LIMIT 5`,
        [name, `${name.split(/\s+/)[0]}%`, category ?? ""],
      );
      if (candidates.length === 0) {
        console.log("    survivor : none — no current nominee has this name");
      } else {
        console.log("    survivor : possible match(es)");
        for (const c of candidates as Array<Record<string, any>>) {
          console.log(
            `      #${c.id} ${c.name} [${c.category}] tally=${c.total_votes} ` +
              `vote_rows=${c.vote_rows}${c.category === category ? "  <- same category" : ""}`,
          );
        }
      }
    }

    const deleteRow = trail.find((t: any) => /delete|remove/i.test(String(t.action)));
    if (deleteRow) {
      console.log(`    deleted  : ${String(deleteRow.summary)}`);
    } else {
      console.log("    deleted  : no delete row in the audit log");
    }
  }

  const { rows: totals } = await client.query(`
    SELECT (SELECT count(*) FROM votes) AS ledger_rows,
           (SELECT coalesce(sum(votes_added),0) FROM votes) AS ledger_votes,
           (SELECT coalesce(sum(v.amount_kes),0) FROM votes v
              JOIN artists a ON a.id = v.artist_id) AS paid_joined_kes,
           (SELECT count(*) FROM artists) AS artists;
  `);
  console.log("\nTOTALS", totals[0]);

  await client.query("ROLLBACK");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
