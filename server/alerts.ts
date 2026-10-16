// ─── Security & anomaly alerts ──────────────────────────────────────────────
// A single place for "something looks wrong" events: payment anomalies, CSRF
// rejections, forged callbacks, admin lockouts. Every alert is kept in a small
// in-memory ring buffer so the admin panel can show the last few, logged to
// stdout so hosting logs capture it, and forwarded to ALERT_WEBHOOK_URL when
// that env var is configured (Slack-compatible { text } payload).

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertEntry {
  id: number;
  at: string;
  severity: AlertSeverity;
  /** Short machine-ish category, e.g. "payment.velocity". */
  kind: string;
  message: string;
  context?: Record<string, unknown>;
}

const BUFFER_MAX = 200;
const alerts: AlertEntry[] = [];
let nextId = 1;

function webhookUrl(): string | undefined {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || !/^https:\/\//i.test(url)) return undefined;
  return url;
}

async function forwardToWebhook(entry: AlertEntry) {
  const url = webhookUrl();
  if (!url) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[${entry.severity.toUpperCase()}] Hope Awards · ${entry.kind}: ${entry.message}${
          entry.context ? ` — ${JSON.stringify(entry.context)}` : ""
        }`,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`[ALERT-WEBHOOK] Failed to forward alert ${entry.id}:`, err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Record an alert. Never throws — alerting must not be able to break a request.
 */
export function recordAlert(
  severity: AlertSeverity,
  kind: string,
  message: string,
  context?: Record<string, unknown>,
): AlertEntry {
  const entry: AlertEntry = {
    id: nextId++,
    at: new Date().toISOString(),
    severity,
    kind,
    message,
    context,
  };

  alerts.push(entry);
  if (alerts.length > BUFFER_MAX) alerts.splice(0, alerts.length - BUFFER_MAX);

  const line = `[ALERT][${severity.toUpperCase()}] ${kind}: ${message}`;
  if (severity === "critical") console.error(line, context ?? "");
  else if (severity === "warning") console.warn(line, context ?? "");
  else console.log(line, context ?? "");

  if (severity !== "info") {
    forwardToWebhook(entry).catch(() => {});
  }

  return entry;
}

/** Most recent alerts first. */
export function getRecentAlerts(limit = 50): AlertEntry[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  return alerts.slice(-Math.min(limit, BUFFER_MAX)).reverse();
}

export function countAlertsSince(sinceMs: number): number {
  return alerts.filter((a) => Date.parse(a.at) >= sinceMs).length;
}

const lastAlertAt = new Map<string, number>();

/**
 * Same as `recordAlert`, but at most one alert per `kind` per `throttleMs`.
 * Used on hot paths so a burst of abuse produces one alert, not thousands.
 * Returns null when the alert was throttled away.
 */
export function recordAlertThrottled(
  severity: AlertSeverity,
  kind: string,
  message: string,
  context?: Record<string, unknown>,
  throttleMs = 60_000,
): AlertEntry | null {
  const now = Date.now();
  const last = lastAlertAt.get(kind) ?? 0;
  if (now - last < throttleMs) return null;
  lastAlertAt.set(kind, now);
  return recordAlert(severity, kind, message, context);
}
