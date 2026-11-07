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
// gets banned, so every automated run is throttled (5 per batch, about a minute
// between sends, at most one batch an hour) and the whole automation can be
// paused from the admin panel. The pause lives in `whatsapp_automation`, so a
// restriction cannot be undone by a deploy restarting the process.

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
import type { PoolClient } from "pg";
import { PAIRING_CODE_TTL_MS } from "../shared/pairing";
import { pool } from "./db";
import {
  WHATSAPP_BATCH_SIZE,
  WHATSAPP_MESSAGE_GAP_MS,
  autoStartWhatsAppAutomationOnce,
  claimWhatsAppBatch,
  isWhatsAppAutomationPaused,
} from "./whatsapp-control";
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
  /** When the current code was issued, so the panel can show its expiry. */
  pairingCodeIssuedAt: number | null;
  lastError: string | null;
  /** True once a session has been paired at least once (keys in the database). */
  hasSavedSession: boolean;
  /** True while a nominee batch is being sent right now. */
  sweepRunning: boolean;
}

let sock: WASocket | null = null;
let sessionState: WhatsAppSessionState = "idle";
let latestQr: string | null = null;
let qrDataUrl: string | null = null;
let pairingCode: string | null = null;
let pairingCodeIssuedAt: number | null = null;
let lastError: string | null = null;
let mePhone: string | null = null;
let meName: string | null = null;
let hasSavedSession = false;
let shouldReconnect = true;
let connecting: Promise<WhatsAppStatus> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let sweepKickTimer: NodeJS.Timeout | null = null;
let sweepRunning = false;
let storageRef: IStorage | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

// Only one process may hold the WhatsApp session. During a Render deploy the
// old and new instances overlap for a few seconds; without this lock both open
// a socket on the same credentials and WhatsApp replaces one of them. The
// preview is also kept out entirely: it shares this database, and a background
// socket there would fight the live awards number.
const WHATSAPP_LEADER_LOCK = 726_202_611;
let leaderClient: PoolClient | null = null;
let leadershipRetryTimer: NodeJS.Timeout | null = null;
let replacementRetries = 0;
let restrictionRetries = 0;

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
      limit: options.limit ?? WHATSAPP_BATCH_SIZE,
    });

    if (queue.length === 0) {
      return { sent: 0, failed: 0, skipped: 0, attempted: 0, remaining: 0, connected: sessionState === "connected" };
    }

    // One batch per hour, shared by the timer, the admin button and the Cloud
    // API path. The claim is atomic and also refuses while paused.
    if (!(await claimWhatsAppBatch())) {
      return { sent: 0, failed: 0, skipped: 0, attempted: 0, remaining: approved.length - alreadySent.size, connected: sessionState === "connected" };
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const [index, request] of queue.entries()) {
      if (sessionState !== "connected") break; // battery/power save: never record a false send
      // A pause pressed while the batch is sleeping must stop the very next send.
      if (await isWhatsAppAutomationPaused()) break;
      if (index > 0) await sleep(WHATSAPP_MESSAGE_GAP_MS + Math.floor(Math.random() * 10_000));

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
  // A reconnect can schedule another kick before the first one fires. Keep one
  // pending kick so two sweeps do not race for the same batch slot.
  if (sweepKickTimer) clearTimeout(sweepKickTimer);
  sweepKickTimer = setTimeout(() => {
    sweepKickTimer = null;
    void runNomineeLinkSweep(storage);
  }, delayMs);
  sweepKickTimer.unref?.();
}

function startSweepLoop(): void {
  if (sweepTimer) return;
  // Check every 15 minutes; the atomic claim inside the sweep allows at most
  // one batch an hour. Polling more often than the gate means the next batch
  // starts close to the hour rather than up to another hour late.
  sweepTimer = setInterval(() => {
    if (sessionState === "connected" && storageRef) void runNomineeLinkSweep(storageRef);
  }, 15 * 60_000);
  sweepTimer.unref?.();
}

// ─── Connection lifecycle ───────────────────────────────────────────────────

/**
 * The production server owns the awards number. The shared preview runs the
 * same code against the same database, so it must never open a background
 * socket: two clients on one WhatsApp session keep replacing each other. An
 * explicit override exists for a staging install with its own database.
 */
function automationAllowedInThisProcess(): boolean {
  return process.env.NODE_ENV === "production" || process.env.WHATSAPP_ALLOW_DEV_SESSION === "true";
}

/**
 * Takes a PostgreSQL session-level lock. The lock disappears automatically if
 * this process dies, so a deploy hands the number to the new instance without
 * either side needing a manual reconnect. Returns false while another process
 * still owns the session.
 */
async function ensureLeadership(): Promise<boolean> {
  if (leaderClient) return true;
  if (!automationAllowedInThisProcess()) return false;

  let client: PoolClient | null = null;
  try {
    const leaseClient = await pool.connect();
    client = leaseClient;
    const { rows } = await leaseClient.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [WHATSAPP_LEADER_LOCK],
    );
    if (!rows[0]?.locked) {
      leaseClient.release();
      return false;
    }

    leaderClient = leaseClient;
    leaseClient.on("error", () => {
      if (leaderClient !== leaseClient) return;
      leaderClient = null;
      console.error("[WHATSAPP] Lost the database lease that keeps this instance in charge.");
      // The client is checked out of the pool, so destroy it explicitly: a dead
      // lease connection must not leak one of the pool's slots on every drop.
      try {
        leaseClient.release(true);
      } catch {
        // It was already released by the driver.
      }
      lastError = "The WhatsApp session is changing servers. Reconnecting automatically…";
      shouldReconnect = false;
      try {
        sock?.end(undefined);
      } catch {
        // The socket is already gone.
      }
      sock = null;
      sessionState = "closed";
      scheduleLeadershipRetry();
    });
    console.log("[WHATSAPP] This instance owns the live WhatsApp session.");
    return true;
  } catch (err) {
    client?.release();
    console.error("[WHATSAPP] Could not acquire the session lease:", err);
    return false;
  }
}

function scheduleLeadershipRetry(): void {
  if (leadershipRetryTimer || !storageRef) return;
  leadershipRetryTimer = setTimeout(() => {
    leadershipRetryTimer = null;
    if (storageRef) void startWhatsAppAutomation(storageRef);
  }, 15_000);
  leadershipRetryTimer.unref?.();
}

function scheduleReconnect(delayMs = 5_000): void {
  if (!shouldReconnect || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!shouldReconnect) return;
    void connectWhatsApp().catch((err) => {
      console.error("[WHATSAPP] Reconnect failed:", err);
      // If another instance is still finishing a deploy, try again rather than
      // leaving the admin with a dead session and a manual reconnect button.
      if (shouldReconnect) scheduleReconnect(15_000);
    });
  }, delayMs);
  reconnectTimer.unref?.();
}

async function handleConnectionUpdate(
  update: Partial<ConnectionState>,
  source: WASocket,
): Promise<void> {
  // A socket that has been replaced must never mutate the live state. A late
  // close from an old connection used to null out the new one and schedule a
  // second, competing socket — which is exactly how a readable code turns into
  // a connection error.
  if (sock !== source) return;

  if (update.qr) {
    latestQr = update.qr;
    sessionState = "qr";
    // Do not clear `pairingCode` here: Baileys emits a fresh QR every ~20 s and
    // wiping the code would make it vanish from the admin panel mid-entry.
    try {
      const dataUrl = await QRCode.toDataURL(update.qr, { margin: 1, width: 320 });
      if (sock !== source) return;
      qrDataUrl = dataUrl;
    } catch {
      if (sock === source) qrDataUrl = null;
    }
  }

  if (sock !== source) return;

  if (update.connection === "connecting" && sessionState !== "qr") {
    sessionState = "connecting";
  }

  if (update.connection === "open") {
    sessionState = "connected";
    latestQr = null;
    qrDataUrl = null;
    pairingCode = null;
    pairingCodeIssuedAt = null;
    lastError = null;
    mePhone = parsePhone(source.user?.id);
    meName = source.user?.name || null;
    // Whether this connection came from credentials saved before this open.
    // Only a genuinely fresh link may auto-start the queue; an existing install
    // that was paused before this deploy must stay paused on reconnect.
    const wasAlreadyLinked = hasSavedSession;
    hasSavedSession = true;
    replacementRetries = 0;
    restrictionRetries = 0;
    registerTransport();
    console.log(`[WHATSAPP] Linked as ${mePhone ?? "unknown number"}. Sending automatically.`);

    if (wasAlreadyLinked) {
      // Reconnect (or a server restart): keep the admin's stored switch as-is
      // and just give the socket a moment to settle before the next batch.
      scheduleSweep(8_000);
    } else {
      // A fresh install links the number and starts sending without a second
      // button press. An explicit pause/resume press sets `auto_started`, so
      // this can never undo an admin's later choice. Wait for that one-time
      // switch before asking for a batch, then give the socket a moment.
      void autoStartWhatsAppAutomationOnce()
        .then((started) => {
          if (sock !== source || sessionState !== "connected") return;
          if (started) console.log("[WHATSAPP] First link: automatic sending started.");
          scheduleSweep(8_000);
        })
        .catch((err) => {
          console.error("[WHATSAPP] Could not prepare the first automatic batch:", err);
          if (sock === source && sessionState === "connected") scheduleSweep(8_000);
        });
    }
  }

  if (update.connection === "close") {
    if (sock !== source) return;
    unregisterTransport();
    sock = null;
    // The code can only be completed over this socket. Once it is gone the
    // digits are dead; keeping them on screen would make the admin type into
    // a void.
    pairingCode = null;
    pairingCodeIssuedAt = null;
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
      pairingCodeIssuedAt = null;
      lastError = "The linked WhatsApp session ended. Link the awards number again.";
      await clearAuthState();
      console.log("[WHATSAPP] The device was unlinked or the session expired — link the number again.");
      return;
    }

    sessionState = "closed";

    if (statusCode === DisconnectReason.connectionReplaced) {
      // The old instance of a deploy can hold the number for a moment. Retry
      // ourselves instead of asking the admin to press connect; the database
      // lease stops two live instances from doing this forever.
      replacementRetries += 1;
      if (replacementRetries <= 5) {
        lastError = "WhatsApp moved the session. Reconnecting automatically…";
        scheduleReconnect(60_000);
      } else {
        shouldReconnect = false;
        lastError =
          "WhatsApp keeps replacing this session. Close WhatsApp Web on the other device, then press connect.";
      }
      return;
    }

    if (statusCode === DisconnectReason.forbidden) {
      // A restriction is a temporary 403, not a dead credential. Try again at a
      // deliberately slow interval instead of forcing the admin to re-link;
      // stop after roughly a day so a permanently blocked number cannot loop.
      restrictionRetries += 1;
      if (restrictionRetries <= 12) {
        lastError = "WhatsApp is temporarily refusing this number. It will retry automatically.";
        scheduleReconnect(2 * 60 * 60_000);
      } else {
        shouldReconnect = false;
        lastError = "WhatsApp is still refusing this number. Check the restriction, then press connect.";
      }
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
  if (!automationAllowedInThisProcess()) {
    throw new Error(
      "WhatsApp automation runs on the production server. This preview cannot hold the awards number because it would disconnect the live session.",
    );
  }
  if (!(await ensureLeadership())) {
    throw new Error("Another app instance is taking over the WhatsApp session. Try again in a few seconds.");
  }
  // A manual reconnect supersedes a pending automatic one.
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sessionState === "connected" && sock) {
    if (options.phone) await requestPairingCode(options.phone);
    return whatsAppStatus();
  }

  // A socket that is already waiting for a scan must be reused, not duplicated:
  // two sockets on the same keys race for the number and WhatsApp kicks one.
  if (sock && (sessionState === "connecting" || sessionState === "qr")) {
    if (options.phone) await requestPairingCodeSafely(options.phone);
    return whatsAppStatus();
  }
  if (connecting) {
    const status = await connecting;
    if (options.phone && sock && sessionState !== "connected") {
      await requestPairingCodeSafely(options.phone);
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
        // Keep the linking socket alive long enough to open WhatsApp and type
        // the code. Baileys rotates a QR every `qrTimeout` and closes the
        // socket when WhatsApp's refs run out; the default (60 s, then 20 s)
        // ended slow attempts before the phone could finish. With three
        // minutes per ref the admin has the full code lifetime, and a fresh
        // code can be requested without rebuilding the connection.
        qrTimeout: PAIRING_CODE_TTL_MS,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        shouldIgnoreJid: (jid) => jid.endsWith("@broadcast") || jid === "status@broadcast",
      });

      sock = socket;
      socket.ev.on("creds.update", saveCreds);
      socket.ev.on("connection.update", (update) => {
        void handleConnectionUpdate(update, socket).catch((err) => {
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
        await requestPairingCodeSafely(options.phone);
      } catch (err) {
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
 * Baileys can reject a pairing request before the socket has finished its
 * handshake ("Connection Closed", 428). A few short retries are usually
 * enough; more than that just holds the admin's request open.
 */
async function requestPairingCodeWithRetry(phone: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestPairingCode(phone);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : "";
      if (!/not ready|connection closed|closed|timed out/i.test(message) || attempt === 2) throw err;
      await sleep(1_500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not request a pairing code.");
}

/** Shows the admin a sentence they can act on, and logs the raw failure. */
async function requestPairingCodeSafely(phone: string): Promise<string> {
  try {
    return await requestPairingCodeWithRetry(phone);
  } catch (err) {
    console.error("[WHATSAPP] Pairing code request failed:", err);
    const raw = err instanceof Error ? err.message : "";
    lastError = /not ready|connection closed|closed|timed out|QR refs|stream errored/i.test(raw)
      ? "WhatsApp dropped the connection before the code was ready. Press GET PAIRING CODE again in a moment."
      : raw || "Could not request a pairing code. Try again.";
    throw new Error(lastError);
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
  pairingCodeIssuedAt = Date.now();
  lastError = null;
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
    pairingCodeIssuedAt,
    lastError,
    hasSavedSession,
    sweepRunning,
  };
}

export function isWhatsAppConnected(): boolean {
  return sessionState === "connected" && sock !== null;
}

/** Unlinks the device and forgets the session, so a different number can be used. */
export async function logoutWhatsApp(): Promise<void> {
  if (!automationAllowedInThisProcess()) {
    throw new Error("WhatsApp automation runs on the production server; this preview cannot unlink the live number.");
  }
  if (!(await ensureLeadership())) {
    throw new Error("Another app instance is taking over the WhatsApp session. Try again in a few seconds.");
  }
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
  pairingCodeIssuedAt = null;
  lastError = null;
}

/**
 * Called once at boot: if a number was linked before, reconnect and start the
 * automatic run so nominees who were already on the site get their message
 * without anyone opening the dashboard.
 */
export async function startWhatsAppAutomation(storage: IStorage): Promise<void> {
  storageRef = storage;

  if (!automationAllowedInThisProcess()) {
    lastError = "WhatsApp runs on the production server. This preview will not touch the live session.";
    console.log("[WHATSAPP] Preview instance — automatic session disabled to protect the production number.");
    return;
  }

  if (!(await ensureLeadership())) {
    lastError = "Another app instance owns the WhatsApp session. Taking over automatically…";
    console.log("[WHATSAPP] Waiting for the previous server instance to release the WhatsApp session.");
    scheduleLeadershipRetry();
    return;
  }

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
    if (shouldReconnect) scheduleReconnect(15_000);
  });
}
