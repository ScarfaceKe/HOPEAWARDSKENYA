// ─── WhatsApp Web session (Baileys) ─────────────────────────────────────────
// The awards' own WhatsApp number, linked once from the admin panel, sends every
// nominee their congratulation + voting link. No Meta approval, no template, no
// per-message cost — which is why this exists alongside the Cloud API path.
//
// Two things matter more than anything else here:
//
//   1. The session must survive a deploy. Render gives us an ephemeral disk, so
//      the Baileys auth keys live in Postgres (`whatsapp_auth`) and are reloaded
//      on boot. Re-pairing every restart would be unusable.
//   2. Nobody may be messaged twice by the automation. `nominee_notifications`
//      is the ledger: the sweep only picks nominees without a `sent` row, and a
//      bad number is retried a few times and then left alone.
//
// Baileys is an unofficial WhatsApp Web client. A number that spams strangers
// gets banned, so every automated run is throttled (a few seconds between sends,
// batch capped) instead of blasting the whole list at once.

// `makeWASocket` is imported by name on purpose. The production server is
// bundled to CommonJS with this package left external, and esbuild's Node
// interop sets `.default` to the whole module object — so a default import
// compiled to "(0, x.default)(…)" and failed at runtime with
// "(0, Ke.default) is not a function". The named export works in both builds.
import {
  Browsers,
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  makeWASocket,
  type AuthenticationCreds,
  type AuthenticationState,
  type ConnectionState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { pool } from "./db";
import { normalizeVotePhone } from "./vote-rules";
import {
  nomineesMissingLink,
  notifyNominee,
  setLiveWhatsAppTransport,
  type WhatsAppSendResult,
} from "./whatsapp";
import type { IStorage } from "./storage";

/** Silent by default: Baileys logs every protocol frame at `info`. */
const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL?.trim() || "silent" });

export type WhatsAppSessionState = "idle" | "connecting" | "qr" | "connected" | "closed";

export interface WhatsAppStatus {
  state: WhatsAppSessionState;
  connected: boolean;
  /** The linked number in 254… form, when known. */
  phone: string | null;
  /** WhatsApp profile name of the linked account. */
  name: string | null;
  /** Data URL for the pairing QR; only while `state === "qr"`. */
  qrDataUrl: string | null;
  /** Eight-character code the admin types into WhatsApp → Linked devices. */
  pairingCode: string | null;
  lastError: string | null;
  /** True once a session has been paired at least once (keys in the database). */
  hasSavedSession: boolean;
}

let sock: WASocket | null = null;
let sessionState: WhatsAppSessionState = "idle";
let latestQr: string | null = null;
let qrDataUrl: string | null = null;
let pairingCode: string | null = null;
let lastError: string | null = null;
let mePhone: string | null = null;
let meName: string | null = null;
let hasSavedSession = false;
let shouldReconnect = true;
let connecting: Promise<WhatsAppStatus> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let sweepRunning = false;
let storageRef: IStorage | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

// ─── Auth state, persisted in Postgres ──────────────────────────────────────

function queueWrite(work: () => Promise<void>): Promise<void> {
  writeChain = writeChain.then(work, work).catch((err) => {
    console.error("[WHATSAPP] Could not save the session keys:", err);
  });
  return writeChain as Promise<void>;
}

async function persistKeys(entries: [string, string][], removals: string[]): Promise<void> {
  if (entries.length === 0 && removals.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of entries) {
      await client.query(
        `INSERT INTO whatsapp_auth (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value],
      );
    }
    if (removals.length > 0) {
      await client.query("DELETE FROM whatsapp_auth WHERE key = ANY($1::text[])", [removals]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function buildAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const { rows } = await pool.query<{ key: string; value: string }>(
    "SELECT key, value FROM whatsapp_auth",
  );
  const store = new Map(rows.map((row) => [row.key, row.value] as const));

  const creds: AuthenticationCreds = store.has("creds")
    ? JSON.parse(store.get("creds") as string, BufferJSON.reviver)
    : initAuthCreds();

  hasSavedSession = store.has("creds");

  const state: AuthenticationState = {
    creds,
    keys: {
      get: (type, ids) => {
        const data: Record<string, any> = {};
        for (const id of ids) {
          const raw = store.get(`${type}-${id}`);
          if (raw) data[id] = JSON.parse(raw, BufferJSON.reviver);
        }
        return data;
      },
      set: async (data) => {
        const entries: [string, string][] = [];
        const removals: string[] = [];
        for (const [type, ids] of Object.entries(data)) {
          for (const [id, value] of Object.entries(ids ?? {})) {
            const key = `${type}-${id}`;
            if (value) {
              const raw = JSON.stringify(value, BufferJSON.replacer);
              store.set(key, raw);
              entries.push([key, raw]);
            } else {
              store.delete(key);
              removals.push(key);
            }
          }
        }
        await queueWrite(() => persistKeys(entries, removals));
      },
    },
  };

  return {
    state,
    saveCreds: async () => {
      const raw = JSON.stringify(creds, BufferJSON.replacer);
      store.set("creds", raw);
      await queueWrite(() => persistKeys([["creds", raw]], []));
    },
  };
}

async function clearAuthState(): Promise<void> {
  try {
    await pool.query("DELETE FROM whatsapp_auth");
  } catch (err) {
    console.error("[WHATSAPP] Could not clear the saved session:", err);
  }
  hasSavedSession = false;
}

// ─── Sending through the live socket ────────────────────────────────────────

function parsePhone(id: string | undefined | null): string | null {
  if (!id) return null;
  const digits = id.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits.length >= 9 ? digits : null;
}

async function sendViaSession(to: string, message: string): Promise<WhatsAppSendResult> {
  if (!sock || sessionState !== "connected") {
    return { ok: false, error: "The WhatsApp session is not connected right now." };
  }
  try {
    const sent = await Promise.race([
      sock.sendMessage(`${to}@s.whatsapp.net`, { text: message }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 20_000)),
    ]);
    return { ok: true, providerMessageId: sent?.key?.id ?? undefined };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "send failed";
    console.error(`[WHATSAPP] Baileys send to ${to} failed: ${reason}`);
    return { ok: false, error: reason };
  }
}

function registerTransport(): void {
  setLiveWhatsAppTransport({ name: "baileys", send: sendViaSession });
}

function unregisterTransport(): void {
  setLiveWhatsAppTransport(null);
}

// ─── Automation: everyone approved, nobody twice ─────────────────────────────

export interface SweepResult {
  sent: number;
  failed: number;
  skipped: number;
  attempted: number;
  remaining: number;
  connected: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends the congratulation + link to every approved nominee who has not had it
 * yet. Runs itself after the number is linked and on a timer afterwards, so
 * "already here" nominees are covered without an admin pressing anything.
 */
export async function runNomineeLinkSweep(
  storage: IStorage,
  options: { limit?: number } = {},
): Promise<SweepResult> {
  if (sweepRunning || sessionState !== "connected") {
    return { sent: 0, failed: 0, skipped: 0, attempted: 0, remaining: 0, connected: sessionState === "connected" };
  }

  sweepRunning = true;
  try {
    const [approved, notifications] = await Promise.all([
      storage.getRequests("approved"),
      storage.listNomineeNotifications(1000),
    ]);

    const alreadySent = new Set(
      notifications.filter((n) => n.status === "sent").map((n) => n.requestId),
    );
    const queue = nomineesMissingLink({
      approved,
      notifications,
      limit: options.limit ?? 20,
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const [index, request] of queue.entries()) {
      if (sessionState !== "connected") break; // battery/power save: never record a false send
      if (index > 0) await sleep(6_000 + Math.floor(Math.random() * 7_000));

      // An approval may have sent this one while the batch was sleeping. Check
      // again right before sending: nobody may receive two messages.
      if (await storage.hasSentNomineeNotification(request.id).catch(() => false)) continue;

      const notice = await notifyNominee(storage, {
        requestId: request.id,
        name: request.name,
        category: request.category,
        submitterPhone: request.submitterPhone,
      });
      if (notice.status === "sent") sent += 1;
      else if (notice.status === "failed") failed += 1;
      else if (notice.status === "skipped") skipped += 1;
    }

    const remaining = Math.max(0, approved.length - alreadySent.size - sent);
    if (sent > 0 || failed > 0) {
      console.log(
        `[WHATSAPP] Automatic run: ${sent} sent, ${failed} failed, ${remaining} still to go.`,
      );
    }
    return { sent, failed, skipped, attempted: queue.length, remaining, connected: sessionState === "connected" };
  } catch (err) {
    console.error("[WHATSAPP] Automatic run failed:", err);
    return { sent: 0, failed: 0, skipped: 0, attempted: 0, remaining: 0, connected: sessionState === "connected" };
  } finally {
    sweepRunning = false;
  }
}

function scheduleSweep(delayMs: number): void {
  if (!storageRef) return;
  const storage = storageRef;
  setTimeout(() => {
    void runNomineeLinkSweep(storage);
  }, delayMs).unref?.();
}

function startSweepLoop(): void {
  if (sweepTimer) return;
  // Every two minutes while connected. A run that is still going is skipped by
  // `sweepRunning`, so this can never double-send.
  sweepTimer = setInterval(() => {
    if (sessionState === "connected" && storageRef) void runNomineeLinkSweep(storageRef);
  }, 2 * 60 * 1000);
  sweepTimer.unref?.();
}

// ─── Connection lifecycle ───────────────────────────────────────────────────

function scheduleReconnect(): void {
  if (!shouldReconnect || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!shouldReconnect) return;
    void connectWhatsApp().catch((err) => {
      console.error("[WHATSAPP] Reconnect failed:", err);
    });
  }, 5_000);
  reconnectTimer.unref?.();
}

async function handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
  if (update.qr) {
    latestQr = update.qr;
    sessionState = "qr";
    // Do not clear `pairingCode` here: Baileys emits a fresh QR every ~20 s and
    // wiping the code would make it vanish from the admin panel mid-entry.
    try {
      qrDataUrl = await QRCode.toDataURL(update.qr, { margin: 1, width: 320 });
    } catch {
      qrDataUrl = null;
    }
  }

  if (update.connection === "connecting" && sessionState !== "qr") {
    sessionState = "connecting";
  }

  if (update.connection === "open") {
    sessionState = "connected";
    latestQr = null;
    qrDataUrl = null;
    pairingCode = null;
    lastError = null;
    mePhone = parsePhone(sock?.user?.id);
    meName = sock?.user?.name || null;
    hasSavedSession = true;
    registerTransport();
    console.log(`[WHATSAPP] Linked as ${mePhone ?? "unknown number"}. Sending automatically.`);
    // Give the socket a moment to settle before the first message goes out.
    scheduleSweep(8_000);
  }

  if (update.connection === "close") {
    unregisterTransport();
    sock = null;
    const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
      ?.output?.statusCode;

    // Re-linking needed: retrying these in a loop would only hammer WhatsApp
    // with dead credentials and keep the panel claiming a reconnect is coming.
    const needsRelink =
      statusCode === DisconnectReason.loggedOut ||
      statusCode === DisconnectReason.badSession ||
      statusCode === DisconnectReason.multideviceMismatch;

    if (needsRelink) {
      shouldReconnect = false;
      sessionState = "idle";
      mePhone = null;
      meName = null;
      latestQr = null;
      qrDataUrl = null;
      pairingCode = null;
      lastError = "The linked WhatsApp session ended. Link the awards number again.";
      await clearAuthState();
      console.log("[WHATSAPP] The device was unlinked or the session expired — link the number again.");
      return;
    }

    sessionState = "closed";

    if (statusCode === DisconnectReason.connectionReplaced) {
      // Two processes are using the same keys; reconnecting would make both
      // fight for the number and keep kicking each other.
      shouldReconnect = false;
      lastError = "Another WhatsApp session is using this number. Close it, then press connect again.";
      return;
    }

    if (statusCode === DisconnectReason.forbidden) {
      // 403 is WhatsApp refusing the number; retrying cannot fix that.
      shouldReconnect = false;
      lastError = "WhatsApp refused this number (403). Check it is not restricted, then link again.";
      return;
    }

    lastError = "The WhatsApp session dropped. Reconnecting…";
    scheduleReconnect();
  }
}

/**
 * Starts the socket. Safe to call repeatedly: while one connection is being
 * opened every caller shares it, and a live session is returned untouched.
 */
export async function connectWhatsApp(options: { phone?: string } = {}): Promise<WhatsAppStatus> {
  shouldReconnect = true;
  if (sessionState === "connected" && sock) {
    if (options.phone) await requestPairingCode(options.phone);
    return whatsAppStatus();
  }

  // A socket that is already waiting for a scan must be reused, not duplicated:
  // two sockets on the same keys race for the number and WhatsApp kicks one.
  if (sock && (sessionState === "connecting" || sessionState === "qr")) {
    if (options.phone) await requestPairingCodeWithRetry(options.phone);
    return whatsAppStatus();
  }
  if (connecting) {
    const status = await connecting;
    if (options.phone && sock && sessionState !== "connected") {
      await requestPairingCode(options.phone);
      return whatsAppStatus();
    }
    return status;
  }

  connecting = (async () => {
    sessionState = "connecting";
    lastError = null;
    try {
      const { state, saveCreds } = await buildAuthState();
      // Bounded: a slow version lookup must not hold the admin's request open.
      const version: Awaited<ReturnType<typeof fetchLatestBaileysVersion>>["version"] | undefined =
        await Promise.race([
          fetchLatestBaileysVersion()
            .then((result) => result.version)
            .catch(() => undefined),
          new Promise<undefined>((resolve) => setTimeout(resolve, 4_000)),
        ]);

      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        version,
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        shouldIgnoreJid: (jid) => jid.endsWith("@broadcast") || jid === "status@broadcast",
      });

      sock = socket;
      socket.ev.on("creds.update", saveCreds);
      socket.ev.on("connection.update", (update) => {
        void handleConnectionUpdate(update).catch((err) => {
          console.error("[WHATSAPP] Connection update failed:", err);
        });
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Could not start the WhatsApp session.";
      lastError = reason;
      sessionState = "idle";
      sock = null;
      console.error("[WHATSAPP] Could not start the session:", reason);
      connecting = null;
      throw new Error(reason);
    }

    // A pairing-code failure must not kill the socket: the QR is still a valid
    // way to link, so surface the error and leave the connection running.
    if (options.phone) {
      try {
        await requestPairingCodeWithRetry(options.phone);
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Could not request a pairing code.";
        connecting = null;
        throw err;
      }
    }

    connecting = null;
    return whatsAppStatus();
  })();

  return connecting;
}

/**
 * Baileys can reject a pairing request in the first second, before the socket
 * has finished opening. One retry after a short wait is enough in practice.
 */
async function requestPairingCodeWithRetry(phone: string): Promise<string> {
  try {
    return await requestPairingCode(phone);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!/not ready|connection closed|closed|timed out/i.test(message)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    return requestPairingCode(phone);
  }
}

/** Asks WhatsApp for the eight-character code shown in the admin panel. */
export async function requestPairingCode(phone: string): Promise<string> {
  const normalized = normalizeVotePhone(phone);
  if (!normalized) {
    throw new Error("Use a Kenyan WhatsApp number, for example 0712 345 678.");
  }
  if (!sock) {
    throw new Error("The WhatsApp session is not ready yet. Try again in a second.");
  }
  const code = await sock.requestPairingCode(normalized);
  pairingCode = code;
  sessionState = "qr";
  return code;
}

export function whatsAppStatus(): WhatsAppStatus {
  return {
    state: sessionState,
    connected: sessionState === "connected",
    phone: mePhone,
    name: meName,
    qrDataUrl,
    pairingCode,
    lastError,
    hasSavedSession,
  };
}

export function isWhatsAppConnected(): boolean {
  return sessionState === "connected" && sock !== null;
}

/** Unlinks the device and forgets the session, so a different number can be used. */
export async function logoutWhatsApp(): Promise<void> {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    await sock?.logout();
  } catch {
    // Already disconnected — the local cleanup below is what matters.
  }
  sock = null;
  unregisterTransport();
  await clearAuthState();
  sessionState = "idle";
  mePhone = null;
  meName = null;
  latestQr = null;
  qrDataUrl = null;
  pairingCode = null;
  lastError = null;
}

/**
 * Called once at boot: if a number was linked before, reconnect and start the
 * automatic run so nominees who were already on the site get their message
 * without anyone opening the dashboard.
 */
export async function startWhatsAppAutomation(storage: IStorage): Promise<void> {
  storageRef = storage;
  startSweepLoop();

  try {
    const { rows } = await pool.query<{ key: string }>(
      "SELECT key FROM whatsapp_auth WHERE key = 'creds' LIMIT 1",
    );
    hasSavedSession = rows.length > 0;
  } catch (err) {
    console.error("[WHATSAPP] Could not read the saved session:", err);
    return;
  }

  if (!hasSavedSession) {
    console.log("[WHATSAPP] No linked number yet — link one in Admin → WhatsApp automation.");
    return;
  }

  void connectWhatsApp().catch((err) => {
    console.error("[WHATSAPP] Automatic reconnect failed:", err instanceof Error ? err.message : err);
  });
}
