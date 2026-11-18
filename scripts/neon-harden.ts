/**
 * Applies and verifies the Neon guardrails this project depends on, through the
 * Neon Management API rather than the console.
 *
 *   npx tsx scripts/neon-harden.ts            # report only, change nothing
 *   npx tsx scripts/neon-harden.ts --apply    # apply the guardrails
 *
 * What it enforces:
 *   1. Compute ceiling  — autoscaling between 0.25 and 0.5 CU. Without a ceiling
 *      a burst can scale to the plan maximum and multiply the bill.
 *   2. Restore window   — history_retention_seconds raised to the plan maximum
 *      the project can hold (Scale allows 30 days; a project keeps its old value
 *      through a plan upgrade, which is how a paid account can still be sitting
 *      on the Free plan's 6 hours).
 *   3. Spending alert   — an email notification at 80% and 100% of a monthly
 *      dollar threshold. Alert only: unlike a consumption quota it never
 *      suspends the compute, so it cannot cause a blackout mid-vote.
 *
 * Requires NEON_API_KEY (organization admin for the spending limit). Prints no
 * credentials. Every change is read back and reported.
 */
const API = "https://console.neon.tech/api/v2";

const PROJECT_NAME = "hope-awards";
/** The live production compute, identified from `neon.endpoint_id` in SQL. */
const ENDPOINT_ID = "ep-hidden-dust-b45pfklq";
const TARGET_MIN_CU = 0.25;
const TARGET_MAX_CU = 0.5;
const TARGET_HISTORY_SECONDS = 30 * 24 * 60 * 60; // 30 days — Scale's maximum
const SPENDING_LIMIT_CENTS = 2_000; // $20; alerts at $16 and $20

const apply = process.argv.includes("--apply");

const key = process.env.NEON_API_KEY;

/**
 * Shape of the credential, never its value. Neon API keys are `napi_` + 40ish
 * base64url characters. A pasted connection string, a truncated key or a value
 * with a stray newline all fail authentication identically, so this is what
 * distinguishes "wrong thing pasted" from "key revoked" — without printing the
 * secret into a terminal or a log.
 */
function describeKey(value: string): string {
  const notes: string[] = [`${value.length} chars`];
  notes.push(value.startsWith("napi_") ? "napi_ prefix ok" : "MISSING napi_ prefix");
  if (/\s/.test(value)) notes.push("contains whitespace");
  if (/["']/.test(value)) notes.push("contains a quote character");
  if (/^(postgres|postgresql):\/\//i.test(value)) notes.push("this is a connection string, not an API key");
  return notes.join(", ");
}
if (!key) {
  console.error(
    "NEON_API_KEY is not set in this environment.\n" +
      "Add it under Workspace environment variables (Settings -> Environment), not\n" +
      "only under Production — production values are not visible to these commands.",
  );
  process.exit(1);
}

/** Narrowed once, because TypeScript does not carry the guard into closures. */
const apiKey: string = key;

async function call<T = any>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  let parsed: any = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    const detail = parsed?.message ?? parsed?.error ?? text.slice(0, 300);
    throw new Error(`${init.method ?? "GET"} ${path} -> HTTP ${res.status}: ${detail}`);
  }
  return parsed as T;
}

const days = (seconds: number | null | undefined) =>
  seconds === null || seconds === undefined
    ? "not set"
    : `${Math.round((seconds / 86_400) * 10) / 10} day(s) (${seconds}s)`;

async function main() {
  console.log(`mode        : ${apply ? "APPLY" : "report only (pass --apply)"}`);
  console.log(`key         : ${describeKey(apiKey)}`);

  // ── Locate the project ────────────────────────────────────────────────
  const { projects } = await call<{ projects: Array<{ id: string; name: string }> }>("/projects");
  const project = projects.find((p) => p.name === PROJECT_NAME);
  if (!project) {
    console.error(
      `No project named "${PROJECT_NAME}". Projects on this key: ` +
        projects.map((p) => p.name).join(", "),
    );
    process.exit(1);
  }
  console.log(`project     : ${project.name} (${project.id})`);

  const before = await call<{
    project: {
      name: string;
      history_retention_seconds: number;
      owner_id: string;
      default_endpoint_settings?: { autoscaling_limit_min_cu?: number; autoscaling_limit_max_cu?: number };
    };
  }>(`/projects/${project.id}`);
  const org = before.project.owner_id;

  const { endpoints } = await call<{
    endpoints: Array<{
      id: string;
      type: string;
      autoscaling_limit_min_cu: number;
      autoscaling_limit_max_cu: number;
      suspend_timeout_seconds?: number;
    }>;
  }>(`/projects/${project.id}/endpoints`);
  const endpoint = endpoints.find((e) => e.id === ENDPOINT_ID) ?? endpoints[0];
  if (!endpoint) {
    console.error("No compute endpoint found on this project.");
    process.exit(1);
  }

  console.log(
    `compute     : ${endpoint.id} (${endpoint.type}) ` +
      `${endpoint.autoscaling_limit_min_cu} <-> ${endpoint.autoscaling_limit_max_cu} CU` +
      (endpoint.suspend_timeout_seconds !== undefined
        ? `, suspends after ${Math.round(endpoint.suspend_timeout_seconds / 60)} min`
        : ""),
  );
  console.log(`restore     : ${days(before.project.history_retention_seconds)}`);
  console.log(`org         : ${org}`);

  const capOk =
    endpoint.autoscaling_limit_min_cu === TARGET_MIN_CU &&
    endpoint.autoscaling_limit_max_cu === TARGET_MAX_CU;
  console.log(`\n1. compute ceiling ${TARGET_MIN_CU}-${TARGET_MAX_CU} CU : ${capOk ? "OK" : "NEEDS CHANGE"}`);

  if (apply && !capOk) {
    await call(`/projects/${project.id}/endpoints/${endpoint.id}`, {
      method: "PATCH",
      body: {
        endpoint: {
          autoscaling_limit_min_cu: TARGET_MIN_CU,
          autoscaling_limit_max_cu: TARGET_MAX_CU,
        },
      },
    });
    console.log("   applied.");
  }

  // ── Restore window ────────────────────────────────────────────────────
  const historyOk = before.project.history_retention_seconds >= TARGET_HISTORY_SECONDS;
  console.log(
    `2. restore window >= ${days(TARGET_HISTORY_SECONDS)} : ${historyOk ? "OK" : "NEEDS CHANGE"}`,
  );
  if (apply && !historyOk) {
    await call(`/projects/${project.id}`, {
      method: "PATCH",
      body: { project: { history_retention_seconds: TARGET_HISTORY_SECONDS } },
    });
    console.log("   applied.");
  }

  // ── Spending alert (alert-only; never suspends computes) ──────────────
  let limit: number | null = null;
  try {
    const current = await call<{ spending_limit_cents?: number }>(
      `/organizations/${org}/billing/spending_limit`,
    );
    limit = current.spending_limit_cents ?? null;
  } catch (err) {
    console.log(`3. spending alert : could not read (${(err as Error).message})`);
  }

  if (limit !== null || apply) {
    const alertOk = limit !== null && limit > 0;
    console.log(
      `3. spending alert at $${(SPENDING_LIMIT_CENTS / 100).toFixed(0)} ` +
        `(emails at 80%/100%) : ${alertOk ? `OK ($${((limit ?? 0) / 100).toFixed(2)})` : "NEEDS CHANGE"}`,
    );
    if (apply && !alertOk) {
      try {
        await call(`/organizations/${org}/billing/spending_limit`, {
          method: "PUT",
          body: { spending_limit_cents: SPENDING_LIMIT_CENTS },
        });
        console.log("   applied.");
      } catch (err) {
        console.log(`   NOT applied — needs an organization admin key: ${(err as Error).message}`);
      }
    }
  }

  // ── Read everything back, so the report is evidence, not intent ───────
  if (apply) {
    const afterProject = await call<{ project: { history_retention_seconds: number } }>(
      `/projects/${project.id}`,
    );
    const { endpoints: afterEndpoints } = await call<{
      endpoints: Array<{
        id: string;
        autoscaling_limit_min_cu: number;
        autoscaling_limit_max_cu: number;
      }>;
    }>(`/projects/${project.id}/endpoints`);
    const afterEndpoint = afterEndpoints.find((e) => e.id === endpoint.id);

    console.log("\nVERIFIED AFTER APPLY");
    console.log(
      `  compute : ${afterEndpoint?.autoscaling_limit_min_cu} <-> ` +
        `${afterEndpoint?.autoscaling_limit_max_cu} CU`,
    );
    console.log(`  restore : ${days(afterProject.project.history_retention_seconds)}`);
    try {
      const finalLimit = await call<{ spending_limit_cents?: number }>(
        `/organizations/${org}/billing/spending_limit`,
      );
      console.log(
        `  alert   : $${(((finalLimit.spending_limit_cents ?? 0) / 100).toFixed(2))}`,
      );
    } catch {
      console.log("  alert   : (not readable with this key)");
    }
  }
}

main().catch((err) => {
  console.error("failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
