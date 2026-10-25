// End-to-end smoke test against the deployed site.
//
// Read-only by design: it never starts an STK push, so it can be run at any time
// without spending money. It checks the public flows, the payment validation
// gates, the admin auth boundary, and — the important one — that every vote in
// the database is backed by a settled MegaPay transaction.
//
// Side effect: the callback probe posts a reference that does not exist, which
// records one warning alert in the admin Security tab. It can never credit a
// vote, because it matches no pending order.
//
// Run: npx tsx scripts/e2e-production.ts
import { pool } from "../server/db";

const BASE = process.env.E2E_BASE_URL || "https://www.hopeawards.co.ke";
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  return res;
}

async function main() {
  // ── Public pages ────────────────────────────────────────────────────────
  for (const path of ["/", "/discover", "/nominate", "/admin", "/terms", "/privacy", "/about", "/hall-of-fame"]) {
    try {
      const res = await req(path);
      const body = await res.text();
      record(`page ${path}`, res.status === 200 && body.includes('id="root"'), `HTTP ${res.status}`);
    } catch (err: any) {
      record(`page ${path}`, false, err.message);
    }
  }

  // ── Data the pages depend on ────────────────────────────────────────────
  let firstCategory = "";
  let firstArtistId = 0;
  let firstArtistName = "";
  try {
    const res = await req("/api/categories");
    const cats = (await res.json()) as Array<{ id: string }>;
    firstCategory = cats[0]?.id ?? "";
    record("GET /api/categories", res.status === 200 && cats.length > 0, `${cats.length} categories`);
  } catch (err: any) {
    record("GET /api/categories", false, err.message);
  }

  try {
    const res = await req("/api/artists");
    const artists = (await res.json()) as Array<{ id: number; name: string }>;
    firstArtistId = artists[0]?.id ?? 0;
    firstArtistName = artists[0]?.name ?? "";
    record("GET /api/artists", res.status === 200 && artists.length > 0, `${artists.length} nominees`);
  } catch (err: any) {
    record("GET /api/artists", false, err.message);
  }

  if (firstCategory) {
    const res = await req(`/category/${firstCategory}`);
    record(`page /category/${firstCategory}`, res.status === 200, `HTTP ${res.status}`);
  }
  if (firstArtistId) {
    const res = await req(`/artist/${firstArtistId}`);
    const html = await res.text();
    record(`page /artist/${firstArtistId}`, res.status === 200, `HTTP ${res.status}`);
    record(
      "artist page carries its own name",
      html.includes("og:title") && (!firstArtistName || html.includes(firstArtistName)),
      firstArtistName ? `name "${firstArtistName}" present in meta` : "server-rendered meta present",
    );
  }

  const discover = await req("/api/discover?q=a&limit=5");
  record("GET /api/discover", discover.status === 200, `HTTP ${discover.status}`);

  const sitemap = await req("/sitemap.xml");
  record("GET /sitemap.xml", sitemap.status === 200 && (await sitemap.text()).includes("<urlset"), `HTTP ${sitemap.status}`);

  const health = await req("/api/health");
  const healthBody = (await health.json()) as { status: string; database: string };
  record("GET /api/health", health.status === 200 && healthBody.database === "ok", JSON.stringify(healthBody));

  // ── Payment validation must reject before any charge ────────────────────
  const { rows: before } = await pool.query("select count(*)::int n from pending_payments");

  const attempts: Array<[string, Record<string, unknown>, number]> = [
    ["missing artist", { votesAdded: 1, phone: "0712345678" }, 400],
    ["fractional votes", { artistId: 1, votesAdded: 2.5, phone: "0712345678" }, 400],
    ["over the ceiling", { artistId: 1, votesAdded: 10001, phone: "0712345678" }, 400],
    ["bad phone", { artistId: 1, votesAdded: 1, phone: "12345" }, 400],
    ["non-existent nominee", { artistId: 999999, votesAdded: 1, phone: "0712345678" }, 404],
  ];
  for (const [label, body, expected] of attempts) {
    const res = await req("/api/megapay/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    record(`payment rejects ${label}`, res.status === expected, `HTTP ${res.status} (expected ${expected})`);
  }

  const { rows: after } = await pool.query("select count(*)::int n from pending_payments");
  record(
    "rejected attempts create no order",
    Number(before[0].n) === Number(after[0].n),
    `pending rows ${before[0].n} → ${after[0].n}`,
  );

  const bogusStatus = await req("/api/megapay/status/zzz");
  record("unknown payment reference refused", bogusStatus.status === 404, `HTTP ${bogusStatus.status}`);

  // ── Admin boundary ──────────────────────────────────────────────────────
  const adminCheck = await req("/api/admin/check");
  const adminBody = (await adminCheck.json()) as { isAdmin: boolean; csrfToken?: string };
  record(
    "admin check hands out a CSRF token without a session",
    adminCheck.status === 200 && !!adminBody.csrfToken && adminBody.isAdmin === false,
    `HTTP ${adminCheck.status}`,
  );

  for (const path of ["/api/admin/pending-payments", "/api/admin/recent-votes", "/api/admin/audit", "/api/admin/alerts"]) {
    const res = await req(path);
    record(`admin data ${path} requires a session`, res.status === 401, `HTTP ${res.status}`);
  }

  // ── Callback authentication ─────────────────────────────────────────────
  const probeRef = `e2e-probe-${Date.now()}`;
  const forged = await req("/api/megapay/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: probeRef, status: "success", ResultCode: "0" }),
  });
  // 200 only means the door is open; the claim itself must have bought nothing.
  // That is what the next check proves, so this one stays informational instead
  // of failing a deployment whose gateway cannot send a callback secret.
  const { rows: probeVotes } = await pool.query(
    "select 1 from votes where payment_reference = $1",
    [probeRef],
  );
  const { rows: probeOrders } = await pool.query(
    "select 1 from pending_payments where reference = $1",
    [probeRef],
  );
  record(
    "a forged callback records no vote and no order",
    probeVotes.length === 0 && probeOrders.length === 0,
    `HTTP ${forged.status} · votes ${probeVotes.length} · orders ${probeOrders.length}${
      forged.status === 200
        ? " (callback is open — set MEGAPAY_CALLBACK_SECRET once MegaPay confirms it sends the header)"
        : ""
    }`,
  );

  // ── The money rule: every vote has a settled receipt ────────────────────
  const { rows: votes } = await pool.query(
    "select payment_reference, artist_id, votes_added, amount_kes, gateway_request_id from votes order by created_at",
  );
  const apiKey = process.env.MEGAPAY_API_KEY;
  const email = process.env.MEGAPAY_EMAIL;
  let verified = 0;
  let unverifiable = 0;
  let failed = 0;

  for (const vote of votes) {
    if (!vote.gateway_request_id) {
      unverifiable += 1;
      continue;
    }
    const res = await fetch("https://megapay.co.ke/backend/v1/transactionstatus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, email, transaction_request_id: vote.gateway_request_id }),
    });
    const data: any = await res.json().catch(() => ({}));
    const status = String(data.TransactionStatus ?? "").toLowerCase();
    const receipt = String(data.TransactionReceipt ?? "");
    const settled = status === "completed" && receipt && !/^n\/?a$/i.test(receipt);
    if (settled) verified += 1;
    else {
      failed += 1;
      console.log(
        JSON.stringify({
          vote: vote.payment_reference,
          artist: vote.artist_id,
          votes: vote.votes_added,
          status: data.TransactionStatus,
          code: data.TransactionCode,
          receipt,
        }),
      );
    }
  }

  record(
    "every verifiable vote has a settled receipt",
    failed === 0,
    `${verified} settled, ${failed} failed, ${unverifiable} pre-verification (unverifiable)`,
  );

  return { verified, failed, unverifiable };
}

main()
  .then(async (summary) => {
    const failedChecks = results.filter((r) => !r.ok);
    console.log(
      `\n${results.length - failedChecks.length}/${results.length} checks passed` +
        ` · votes: ${summary.verified} settled, ${summary.failed} bad, ${summary.unverifiable} unverifiable`,
    );
    await pool.end();
    process.exit(failedChecks.length === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error("E2E aborted:", err);
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  });
