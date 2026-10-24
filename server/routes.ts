import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import { pool } from "./db";
import { storage, CATEGORY_CAP, VOTING_START, VOTING_END } from "./storage";
import { apiCache, imgCache, TTL_API, TTL_IMG } from "./cache";
import { api } from "@shared/routes";
import { insertRequestSchema, CATEGORIES, type ArtistResponse, type AwardCategoryOption, type PendingPayment } from "@shared/schema";
import { DISCOVERY_TAGS, categoriesWithTag, type DiscoveryTagId } from "@shared/categoryContent";
import { PENDING_PAYMENT_RETENTION_DAYS, VOTE_PRICE_KES } from "@shared/site";
import { z } from "zod";
import crypto from "crypto";
import { recordAlert, recordAlertThrottled, getRecentAlerts } from "./alerts";
import { parseVoteOrder, voteVelocity, maskPhone, normalizeVotePhone } from "./vote-rules";
import { classifySettlement } from "./payment-proof";
import { issueCsrfToken, requireCsrf } from "./csrf";
import { verifyTotp, twoFactorEnabled, enrollmentSecret, otpauthUri } from "./totp";

const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const uploadAttempts = new Map<string, { count: number; windowStart: number }>();
const MAX_PUBLIC_UPLOADS_PER_WINDOW = 10;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(store: Map<string, { count: number; windowStart: number }>, ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

const tokenIssuanceAttempts = new Map<string, { count: number; windowStart: number }>();
const MAX_TOKEN_REQUESTS_PER_WINDOW = 10;

const uploadTokens = new Map<string, number>();
const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of Array.from(uploadTokens.entries())) {
    if (now > expiry) uploadTokens.delete(token);
  }
}, 5 * 60 * 1000).unref();

const SAFE_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

function detectImageMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

function getLoginState(ip: string) {
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 0, lockedUntil: null });
  }
  return loginAttempts.get(ip)!;
}

function sanitizeCsvCell(value: any): string {
  const s = value == null ? "" : String(value);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    return "\t" + s;
  }
  return s;
}

/**
 * The live category list. The `categories` table is the source of truth; the
 * build-time list is only a fallback for a database hiccup, so a category an
 * admin added still exists even if the table cannot be read.
 */
async function loadCategories(): Promise<AwardCategoryOption[]> {
  try {
    const rows = await storage.listCategories();
    if (rows.length > 0) return rows.map(({ id, name, group }) => ({ id, name, group }));
  } catch (err) {
    console.error("[categories] Falling back to the built-in list:", err);
  }
  return CATEGORIES.map(({ id, name, group }) => ({ id, name, group }));
}

async function categoryExists(categoryId: string): Promise<boolean> {
  const list = await loadCategories();
  return list.some((c) => c.id === categoryId);
}

/** "Best Gospel Song 2026" → "best-gospel-song-2026". */
function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

function suggestAlternatives(
  currentCategoryId: string,
  capacity: Record<string, number>,
  categoryList: AwardCategoryOption[],
): { id: string; name: string; remaining: number }[] {
  const current = categoryList.find((c) => c.id === currentCategoryId);
  if (!current) return [];
  const available = categoryList
    .filter((c) => c.id !== currentCategoryId && (capacity[c.id] || 0) < CATEGORY_CAP)
    .map((c) => ({ id: c.id, name: c.name, group: c.group, remaining: CATEGORY_CAP - (capacity[c.id] || 0) }));
  const sameGroup = available.filter((c) => c.group === current.group).sort((a, b) => b.remaining - a.remaining);
  const otherGroup = available.filter((c) => c.group !== current.group).sort((a, b) => b.remaining - a.remaining);
  return [...sameGroup, ...otherGroup].slice(0, 3).map(({ id, name, remaining }) => ({ id, name, remaining }));
}

const isProduction = process.env.NODE_ENV === "production";

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const uploadPublic = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const MAX_UPLOAD_TABLE_ROWS = 500;
const ORPHAN_TTL_MS = 2 * 60 * 60 * 1000;
const ORPHAN_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    csrfToken?: string;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isAdmin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

/** Constant-time string compare, so neither length nor content leaks. */
function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function requestIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Writes an admin action to the audit log. Fire-and-forget: an audit write must
 * never fail the action it is describing, but failures are logged loudly.
 */
function audit(
  req: Request,
  action: string,
  entity: string,
  entityId: string | number | null,
  summary: string,
) {
  storage
    .logAdminAction({ action, entity, entityId, summary, ip: requestIp(req) })
    .catch((err) => console.error("[AUDIT] Failed to write audit entry:", err));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const base = "https://hopeawards.co.ke";
      const urls: string[] = [];
      const push = (loc: string, priority: string, changefreq: string) => {
        urls.push(
          `<url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
        );
      };
      push(`${base}/`, "1.0", "daily");
      push(`${base}/nominate`, "0.9", "weekly");
      push(`${base}/discover`, "0.8", "daily");
      push(`${base}/about`, "0.7", "monthly");
      push(`${base}/terms`, "0.5", "monthly");
      push(`${base}/privacy`, "0.5", "monthly");
      for (const c of await loadCategories()) {
        push(`${base}/category/${c.id}`, "0.8", "daily");
      }
      try {
        const artists = await storage.getArtists();
        for (const a of artists) {
          push(`${base}/artist/${a.id}`, "0.6", "daily");
        }
      } catch (e) {
        console.error("sitemap: failed to load artists", e);
      }
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.join("\n") +
        `\n</urlset>\n`;
      res
        .status(200)
        .set({
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        })
        .send(xml);
    } catch (err) {
      res.status(500).send("Sitemap unavailable");
    }
  });

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error("WARNING: SESSION_SECRET not set. Sessions will not persist across restarts.");
  }

  const SessionStore = MemoryStore(session);

  app.use(
    session({
      store: new SessionStore({
        checkPeriod: 86400000,
      }),
      secret: sessionSecret || crypto.randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // CSRF: deny-by-default for every non-safe /api request. Only the public
  // forms and the server-to-server MegaPay callback are exempt (see ./csrf).
  app.use(requireCsrf);

  app.post("/api/admin/login", (req, res) => {
    const ip = requestIp(req);
    const state = getLoginState(ip);
    const now = Date.now();

    if (state.lockedUntil !== null && now < state.lockedUntil) {
      const retryAfterSec = Math.ceil((state.lockedUntil - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ message: "Too many failed attempts. Try again later." });
    }

    if (state.lockedUntil !== null && now >= state.lockedUntil) {
      state.count = 0;
      state.lockedUntil = null;
    }

    const { password, code } = (req.body ?? {}) as { password?: unknown; code?: unknown };
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ message: "Admin password not configured" });
    }

    const totpSecret = twoFactorEnabled() ? String(process.env.ADMIN_TOTP_SECRET) : null;

    const fail = (message: string, status = 401) => {
      state.count += 1;
      if (state.count >= MAX_LOGIN_ATTEMPTS) {
        state.lockedUntil = now + LOCKOUT_DURATION_MS;
        recordAlert("critical", "admin.login_lockout", "Admin login locked out after repeated failed attempts", {
          ip,
          attempts: state.count,
          lockoutMinutes: LOCKOUT_DURATION_MS / 60000,
        });
      }
      const remaining = MAX_LOGIN_ATTEMPTS - state.count;
      if (remaining <= 0) {
        res.setHeader("Retry-After", String(Math.ceil(LOCKOUT_DURATION_MS / 1000)));
        return res.status(429).json({ message: "Too many failed attempts. Try again later." });
      }
      return res.status(status).json({
        message,
        attemptsRemaining: remaining,
        twoFactorRequired: !!totpSecret,
      });
    };

    const passwordOk = typeof password === "string" && timingSafeEquals(password, adminPassword);
    if (!passwordOk) {
      return fail("Wrong password");
    }

    if (totpSecret) {
      if (typeof code !== "string" || code.replace(/\s/g, "") === "") {
        // Not a credential failure: the admin simply hasn't entered a code yet.
        return res.status(401).json({
          message: "Enter the 6-digit code from your authenticator app.",
          twoFactorRequired: true,
        });
      }
      if (!verifyTotp(totpSecret, code)) {
        recordAlertThrottled("warning", "admin.totp_failed", "Admin login rejected: wrong two-factor code", { ip });
        return fail("Wrong authentication code.");
      }
    }

    state.count = 0;
    state.lockedUntil = null;
    // Regenerate the session on login (session-fixation defence) and hand the
    // caller the fresh CSRF token that goes with the new session id.
    return req.session.regenerate((err) => {
      if (err) {
        console.error("[ADMIN] Session regenerate failed:", err);
        return res.status(500).json({ message: "Could not start a secure session. Try again." });
      }
      req.session.isAdmin = true;
      const csrfToken = issueCsrfToken(req);
      audit(req, "login", "admin", null, totpSecret ? "Admin signed in with password + 2FA" : "Admin signed in with password");
      res.json({ success: true, csrfToken, twoFactorRequired: !!totpSecret });
    });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/admin/check", (req, res) => {
    res.json({
      isAdmin: !!req.session.isAdmin,
      twoFactorRequired: twoFactorEnabled(),
      csrfToken: issueCsrfToken(req),
    });
  });

  const noCache = (_req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
  };

  app.get(api.artists.list.path, async (req, res) => {
    const category = req.query.category as string | undefined;
    const isAdmin = !!(req.session as any)?.isAdmin;
    const cacheKey = `artists:${category ?? "all"}`;

    if (!isAdmin) {
      const cached = apiCache.get<any[]>(cacheKey);
      if (cached) {
        res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
        return res.json(cached);
      }
    }

    let results;
    if (category) {
      results = await storage.getArtistsByCategory(category);
    } else {
      results = await storage.getArtists();
    }
    const sorted = results.sort((a, b) => a.displayOrder - b.displayOrder);

    if (isAdmin) return res.json(sorted);

    const publicView = sorted.map(({ totalVotes: _v, ...rest }) => rest);
    apiCache.set(cacheKey, publicView, TTL_API);
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(publicView);
  });

  app.post("/api/admin/shuffle-nominees", requireAdmin, async (req, res) => {
    await storage.shuffleNominees();
    apiCache.clear();
    audit(req, "shuffle", "artists", null, "Randomised nominee display order within every category");
    res.json({ message: "Nominees shuffled. Order randomised within each category." });
  });

  app.get("/api/admin/alerts", requireAdmin, noCache, (_req, res) => {
    res.json(getRecentAlerts(100));
  });

  app.get("/api/admin/audit", requireAdmin, noCache, async (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    res.json(await storage.getAdminAuditLog(limit));
  });

  /**
   * Enrolment helper: hands an authenticated admin a fresh TOTP secret to scan.
   * Once ADMIN_TOTP_SECRET is set on the host, the secret is never returned again.
   */
  app.get("/api/admin/2fa", requireAdmin, noCache, (_req, res) => {
    if (twoFactorEnabled()) {
      return res.json({ enabled: true });
    }
    // Stable per process — see enrollmentSecret().
    const secret = enrollmentSecret();
    res.json({ enabled: false, secret, uri: otpauthUri(secret) });
  });

  app.get("/api/stats/total-votes", async (_req, res) => {
    const total = await storage.getTotalVotesCast();
    res.set("Cache-Control", "public, max-age=30");
    res.json({ total });
  });

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    const revenue = await storage.getTotalRevenue();
    res.json(revenue);
  });

  app.patch("/api/artists/:id/bio", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const bio = typeof req.body.bio === "string" ? req.body.bio : "";
    if (isNaN(id)) return res.status(400).json({ message: "Invalid artist id" });
    const updated = await storage.updateArtistBio(id, bio);
    apiCache.del(`artist:${id}`);
    audit(req, "update_bio", "artist", id, `Set bio for ${updated.name} (${bio.length} characters)`);
    res.json(updated);
  });

  app.patch("/api/artists/:id/votes", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const add = Number(req.body.add);
    if (!Number.isInteger(add) || add <= 0) {
      return res.status(400).json({ message: "add must be a positive whole number — you can only add votes, not deduct." });
    }
    const artist = await storage.addVotesToArtist(id, add);
    audit(req, "add_votes", "artist", id, `Manually added ${add} vote(s) to ${artist.name}`);
    recordAlertThrottled(
      "warning",
      "admin.manual_votes",
      "Votes were added by hand in the admin panel",
      { artistId: id, artist: artist.name, votes: add, ip: requestIp(req) },
      60_000,
    );
    res.json(artist);
  });

  app.patch("/api/admin/artists/:id", requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid artist id" });
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const imageUrl = typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!imageUrl) return res.status(400).json({ message: "Image URL is required" });
    try {
      const updated = await storage.updateArtist(id, { name, imageUrl });
      apiCache.clear();
      audit(req, "update", "artist", id, `Updated nominee details for ${updated.name}`);
      return res.json(updated);
    } catch (err: any) {
      return res.status(404).json({ message: err.message || "Artist not found" });
    }
  });

  app.get("/api/artists/search", requireAdmin, async (req, res) => {
    const q = (req.query.q as string || "").toLowerCase();
    const category = req.query.category as string | undefined;
    let results;
    if (category) {
      results = await storage.getArtistsByCategory(category);
    } else {
      results = await storage.getArtists();
    }
    if (q) {
      results = results.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.genre.toLowerCase().includes(q)
      );
    }
    res.json(results);
  });

  const NEW_NOMINEE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  /** Public nominee search: query text, award group, region/language tag, recency. */
  app.get("/api/discover", async (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase().slice(0, 60);
    const tag = String(req.query.tag ?? "").trim();
    const group = String(req.query.group ?? "").trim();
    const sort = req.query.sort === "newest" ? "newest" : q ? "name" : "curated";
    const limitRaw = Number(req.query.limit ?? 60);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 120) : 60;

    if (tag && !DISCOVERY_TAGS.some((t) => t.id === tag)) {
      return res.status(400).json({ message: "Unknown filter" });
    }
    const categoryList = await loadCategories();
    const groupNames = new Set<string>(categoryList.map((c) => c.group as string));
    if (group && !groupNames.has(group)) {
      return res.status(400).json({ message: "Unknown award group" });
    }

    let pool = apiCache.get<ArtistResponse[]>("artists:public");
    if (!pool) {
      const all = await storage.getArtists();
      pool = all.map(({ totalVotes: _v, ...rest }) => rest as ArtistResponse);
      apiCache.set("artists:public", pool, TTL_API);
    }

    const categoryById = new Map<string, AwardCategoryOption>(categoryList.map((c) => [c.id, c] as const));
    const allowedCategories = tag ? new Set<string>(categoriesWithTag(tag as DiscoveryTagId)) : null;
    const now = Date.now();

    const matched = pool
      .map((artist) => ({
        ...artist,
        categoryName: categoryById.get(artist.category)?.name ?? artist.category,
        group: categoryById.get(artist.category)?.group ?? "",
        isNew: artist.createdAt ? now - new Date(artist.createdAt).getTime() < NEW_NOMINEE_WINDOW_MS : false,
      }))
      .filter((artist) => {
        if (allowedCategories && !allowedCategories.has(artist.category)) return false;
        if (group && artist.group !== group) return false;
        if (!q) return true;
        return (
          artist.name.toLowerCase().includes(q) ||
          (artist.genre ?? "").toLowerCase().includes(q) ||
          artist.categoryName.toLowerCase().includes(q)
        );
      });

    const byNewest = (a: { createdAt: any }, b: { createdAt: any }) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();

    const results = [...matched];
    if (sort === "newest") results.sort(byNewest);
    else if (sort === "name") results.sort((a, b) => a.name.localeCompare(b.name));
    else
      results.sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      );

    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json({
      total: matched.length,
      results: results.slice(0, limit),
      newest: [...matched].sort(byNewest).slice(0, 8),
      newThisWeekCount: matched.filter((a) => a.isNew).length,
    });
  });

  app.get(api.artists.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const isAdmin = !!(req.session as any)?.isAdmin;
    const cacheKey = `artist:${id}`;

    if (!isAdmin) {
      const cached = apiCache.get<any>(cacheKey);
      if (cached) {
        res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
        return res.json(cached);
      }
    }

    const artist = await storage.getArtist(id);
    if (!artist) return res.status(404).json({ message: "Artist not found" });

    if (isAdmin) return res.json(artist);

    const { totalVotes: _v, ...rest } = artist;
    apiCache.set(cacheKey, rest, TTL_API);
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(rest);
  });

  app.post(api.artists.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.artists.create.input.parse(req.body);
      if (!(await categoryExists(input.category))) {
        return res.status(400).json({ message: "Invalid category", field: "category" });
      }
      const approvedCount = await storage.countApprovedByCategory(input.category);
      if (approvedCount >= CATEGORY_CAP) {
        return res.status(409).json({
          message: `This category is already full (${CATEGORY_CAP}/${CATEGORY_CAP} nominees). Remove someone first or move this nominee to the waitlist.`,
          categoryFull: true,
        });
      }
      const artist = await storage.createArtist(input);
      apiCache.clear();
      audit(req, "create", "artist", artist.id, `Added ${artist.name} to ${input.category}`);
      res.status(201).json(artist);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // ── Award categories ────────────────────────────────────────────────────
  // The public list the whole site renders, including any category an admin
  // added. Cached briefly so a burst of visitors does not hit the table.
  app.get("/api/categories", async (_req, res) => {
    const cached = apiCache.get<AwardCategoryOption[]>("categories");
    if (cached) {
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
      return res.json(cached);
    }
    const result = await loadCategories();
    apiCache.set("categories", result, TTL_API);
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.json(result);
  });

  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    const body = (req.body ?? {}) as { name?: unknown; group?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const group =
      typeof body.group === "string" && body.group.trim() ? body.group.trim().replace(/\s+/g, " ") : "";

    if (name.length < 3 || name.length > 120) {
      return res.status(400).json({
        message: "Give the category a name between 3 and 120 characters.",
        field: "name",
      });
    }
    if (group.length < 2 || group.length > 60) {
      return res.status(400).json({
        message: "Give the award group a name between 2 and 60 characters.",
        field: "group",
      });
    }

    const id = categorySlug(name);
    if (id.length < 3) {
      return res.status(400).json({
        message: "That name needs at least one letter or number.",
        field: "name",
      });
    }

    const existing = await storage.getCategory(id).catch(() => undefined);
    if (existing) {
      return res.status(409).json({
        message: `"${existing.name}" already exists. Pick a different name.`,
        field: "name",
      });
    }

    try {
      const created = await storage.createCategory({ id, name, group });
      apiCache.clear();
      audit(req, "create", "category", created.id, `Added award category ${created.name} (${created.group})`);
      res.status(201).json(created);
    } catch (err: any) {
      // 23505 = unique violation: two admins saved the same name at once.
      if (err?.code === "23505") {
        return res.status(409).json({ message: "That category already exists.", field: "name" });
      }
      throw err;
    }
  });

  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const category = await storage.getCategory(id).catch(() => undefined);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const counts = await storage.countNomineesInCategory(id);
    if (counts.artists > 0 || counts.requests > 0) {
      const parts: string[] = [];
      if (counts.artists > 0) parts.push(`${counts.artists} live nominee${counts.artists === 1 ? "" : "s"}`);
      if (counts.requests > 0) parts.push(`${counts.requests} nomination${counts.requests === 1 ? "" : "s"}`);
      return res.status(409).json({
        message: `“${category.name}” still holds ${parts.join(" and ")}. Move them to another category first.`,
      });
    }

    await storage.deleteCategory(id);
    apiCache.clear();
    audit(req, "delete", "category", id, `Deleted award category ${category.name}`);
    res.json({ success: true });
  });

  app.get("/api/categories/capacity", async (_req, res) => {
    const cached = apiCache.get<any>("capacity");
    if (cached) {
      res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      return res.json(cached);
    }
    const counts = await storage.countAllApprovedByCategory();
    const result = (await loadCategories()).map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group,
      approved: counts[c.id] || 0,
      cap: CATEGORY_CAP,
      isFull: (counts[c.id] || 0) >= CATEGORY_CAP,
    }));
    apiCache.set("capacity", result, TTL_API);
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(result);
  });

  app.delete("/api/artists/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const artist = await storage.getArtist(id);
    await storage.deleteArtist(id);
    apiCache.clear();
    audit(req, "delete", "artist", id, `Removed ${artist?.name ?? `artist #${id}`} from the competition`);
    res.json({ success: true });
  });

  const handleImageUpload = async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const fileBuffer = req.file.buffer;
      const detectedMime = detectImageMimeType(fileBuffer);
      if (!detectedMime) {
        return res.status(400).json({ message: "Uploaded file is not a valid image" });
      }
      const base64Data = fileBuffer.toString("base64");
      const ext = detectedMime.split("/")[1].replace("jpeg", "jpg");
      const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
      await storage.saveUploadedImage(filename, detectedMime, base64Data);
      res.json({ imageUrl: `/api/uploaded-images/${filename}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Upload failed" });
    }
  };

  const publicUploadRateLimit = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(uploadAttempts, ip, MAX_PUBLIC_UPLOADS_PER_WINDOW, UPLOAD_WINDOW_MS)) {
      return res.status(429).json({ message: "Too many uploads. Please try again later." });
    }

    const token = Array.isArray(req.headers["x-upload-token"])
      ? req.headers["x-upload-token"][0]
      : req.headers["x-upload-token"];
    if (!token) {
      return res.status(403).json({ message: "Upload token required" });
    }
    const expiry = uploadTokens.get(token);
    if (!expiry || Date.now() > expiry) {
      uploadTokens.delete(token);
      return res.status(403).json({ message: "Invalid or expired upload token" });
    }
    uploadTokens.delete(token);

    try {
      const total = await storage.countUploadedImages();
      if (total >= MAX_UPLOAD_TABLE_ROWS) {
        return res.status(503).json({ message: "Upload service temporarily unavailable. Please try again later." });
      }
    } catch {
    }
    next();
  };

  const runOrphanCleanup = async () => {
    try {
      const deleted = await storage.deleteOrphanedUploads(ORPHAN_TTL_MS);
      if (deleted > 0) {
        console.log(`[upload-cleanup] Removed ${deleted} orphaned upload(s)`);
      }
    } catch (err) {
      console.error("[upload-cleanup] Cleanup error:", err);
    }

    // Retention: vote orders that were started and never paid for hold the fan's
    // phone number, so they are purged once they can no longer be reconciled.
    // The window is shared with the Privacy Policy (shared/site.ts).
    try {
      const purged = await storage.purgeAbandonedPendingPayments(
        PENDING_PAYMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      if (purged > 0) {
        console.log(
          `[retention] Purged ${purged} abandoned pending payment record(s) older than ${PENDING_PAYMENT_RETENTION_DAYS} days`,
        );
        recordAlert(
          "info",
          "payment.pending_purged",
          `Purged ${purged} abandoned pending payment record(s) past the ${PENDING_PAYMENT_RETENTION_DAYS}-day retention window`,
          { purged, retentionDays: PENDING_PAYMENT_RETENTION_DAYS },
        );
      }
    } catch (err) {
      console.error("[retention] Pending-payment purge failed:", err);
    }
  };

  runOrphanCleanup();
  setInterval(runOrphanCleanup, ORPHAN_CLEANUP_INTERVAL_MS).unref();

  app.post("/api/upload-token", (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(tokenIssuanceAttempts, ip, MAX_TOKEN_REQUESTS_PER_WINDOW, UPLOAD_WINDOW_MS)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    uploadTokens.set(token, Date.now() + UPLOAD_TOKEN_TTL_MS);
    res.json({ token });
  });

  app.post("/api/upload", requireAdmin, upload.single("image"), handleImageUpload);
  app.post("/api/upload-public", publicUploadRateLimit, uploadPublic.single("image"), handleImageUpload);

  app.get("/api/uploaded-images/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const cacheKey = `img:${filename}`;
      const cached = imgCache.get<{ buffer: Buffer; mimeType: string }>(cacheKey);

      let buffer: Buffer;
      let safeMime: string;

      if (cached) {
        buffer = cached.buffer;
        safeMime = cached.mimeType;
      } else {
        const image = await storage.getUploadedImage(filename);
        if (!image) return res.status(404).json({ message: "Image not found" });
        buffer = Buffer.from(image.data, "base64");
        safeMime = SAFE_IMAGE_MIME[image.mimeType] ?? "application/octet-stream";
        imgCache.set(cacheKey, { buffer, mimeType: safeMime }, TTL_IMG);
      }

      res.set("Content-Type", safeMime);
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Content-Disposition", "inline");
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    } catch {
      res.status(500).json({ message: "Failed to serve image" });
    }
  });

  // ── Liveness / readiness ────────────────────────────────────────────────
  // Uptime monitors and Render's health check need a URL that tells the truth.
  // The SPA catch-all answers *every* unknown path with the app shell, so
  // without this route `/api/health` returns 200 HTML even when Postgres is
  // gone. 200 = app + database reachable, 503 = degraded. Deliberately exposes
  // no timing information about the voting window.
  app.get("/api/health", noCache, async (_req, res) => {
    const startedAt = Date.now();
    try {
      const categories = await storage.listCategories();
      res.status(200).json({
        status: "ok",
        database: "ok",
        categories: categories.length,
        dbLatencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch (err) {
      console.error("[health] Database check failed:", err);
      res.status(503).json({
        status: "degraded",
        database: "unreachable",
        uptimeSeconds: Math.round(process.uptime()),
      });
    }
  });

  app.get("/api/payment-config", (_req, res) => {
    return res.json({ provider: "megapay" });
  });

  /**
   * The one and only place a paid order turns into votes.
   *
   * Idempotent by construction: `votes.paystack_reference` is unique, and
   * `storage.createVote` runs the insert and the nominee's total in one
   * transaction, so a callback, a status poll and a retry arriving at the same
   * moment credit the order exactly once. Every caller must hold proof of
   * payment before calling — this function never asks the gateway.
   */
  async function creditPendingOrder(pending: PendingPayment, source: string) {
    const vote = await storage.createVote({
      artistId: pending.artistId,
      votesAdded: pending.votesAdded,
      amountKes: pending.amountKes,
      paystackReference: pending.reference,
      gatewayRequestId: pending.gatewayRequestId ?? null,
      voterPhone: pending.voterPhone ?? null,
    });
    await storage.deletePendingPayment(pending.reference).catch(() => {});
    apiCache.clear();
    const artist = await storage.getArtist(pending.artistId);
    console.log(
      `[VOTE CREDITED] source=${source}, ref=${pending.reference}, artist=${pending.artistId}, votes=${pending.votesAdded}, amount=${pending.amountKes}KES, total=${artist?.totalVotes ?? "?"}`,
    );
    return { vote, totalVotes: artist?.totalVotes ?? 0 };
  }

  /**
   * Asks MegaPay what actually happened to an order, so a lost callback can
   * never mean "fan paid, vote never counted". `ResultCode: 0` on its own only
   * means "request accepted", so proof of payment requires a completed
   * transaction status or an M-Pesa receipt.
   *
   * Results are cached for a few seconds because the vote dialog polls.
   */
  const gatewayStatusCache = new Map<string, { at: number; value: GatewayStatus }>();
  type GatewayStatus = {
    paid: boolean;
    failed: boolean;
    amountMismatch: boolean;
    reason: string;
    amount: number | null;
  };

  async function fetchGatewayStatus(order: {
    reference: string;
    gatewayRequestId: string | null;
    amountKes: number;
  }): Promise<GatewayStatus | null> {
    const apiKey = process.env.MEGAPAY_API_KEY;
    const email = process.env.MEGAPAY_EMAIL || "";
    if (!apiKey || !email || !order.gatewayRequestId) return null;

    const cached = gatewayStatusCache.get(order.reference);
    if (cached && Date.now() - cached.at < 4000) return cached.value;

    try {
      const response = await fetch("https://megapay.co.ke/backend/v1/transactionstatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          email,
          transaction_request_id: order.gatewayRequestId,
        }),
      });
      const data: any = await response.json().catch(() => ({}));

      const statusText = String(data.TransactionStatus ?? data.transaction_status ?? "").toLowerCase();
      const code = String(data.TransactionCode ?? data.transaction_code ?? "");
      const amountRaw = Number(data.TransactionAmount ?? data.transaction_amount ?? data.Amount);
      const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null;

      // One rule for both the callback and this lookup: only a real receipt or a
      // completed status means the money settled.
      const settlement = classifySettlement(data);
      const paid = settlement === "paid";
      const failed = settlement === "failed";

      const value: GatewayStatus = {
        paid,
        failed,
        amountMismatch: paid && amount !== null && amount !== order.amountKes,
        reason: /cancel/.test(statusText)
          ? "The M-Pesa request was cancelled on your phone — you have not been charged."
          : failed
            ? "The M-Pesa payment was declined — you have not been charged."
            : String(data.ResultDesc ?? data.errorMessage ?? ""),
        amount,
      };

      // Keep the map from growing for the life of the process.
      if (gatewayStatusCache.size > 500) gatewayStatusCache.clear();
      gatewayStatusCache.set(order.reference, { at: Date.now(), value });
      return value;
    } catch (err: any) {
      console.error(`[MEGAPAY STATUS] Lookup failed for ref ${order.reference}:`, err?.message || err);
      return null;
    }
  }

  app.post("/api/megapay/initialize", async (req, res) => {
    const now = Date.now();

    if (now < VOTING_START) {
      return res.status(403).json({ message: "Voting has not started yet. Voting opens 25th October 2026 at 12:00 AM (midnight) EAT." });
    }
    if (now > VOTING_END) {
      return res.status(403).json({ message: "Voting has closed. Thank you for participating in Hope Awards Kenya 2026." });
    }

    const parsed = parseVoteOrder(req.body);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ message: parsed.message });
    }
    const { artistId, votesAdded, phone, amountKes } = parsed.order;

    const artist = await storage.getArtist(artistId);
    if (!artist) {
      return res.status(404).json({ message: "Nominee not found" });
    }

    const voterIp = requestIp(req);
    const velocity = voteVelocity.check({ phone, ip: voterIp, artistId, votesAdded, amountKes });
    if (!velocity.allowed) {
      return res.status(velocity.status).json({ message: velocity.message });
    }

    const megapayApiKey = process.env.MEGAPAY_API_KEY;
    const megapayEmail = process.env.MEGAPAY_EMAIL || "";
    if (!megapayApiKey || !megapayEmail) {
      console.error("[MEGAPAY] Payment gateway is missing credentials (MEGAPAY_API_KEY / MEGAPAY_EMAIL)");
      recordAlertThrottled(
        "critical",
        "payment.gateway_unconfigured",
        "MegaPay credentials are missing — fans cannot pay for votes",
        { ip: voterIp },
      );
      return res.status(500).json({ message: "Payment system not configured" });
    }

    const reference = `hopeawards-${artistId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Persist the order *before* charging: the callback can only record a vote
    // for a pending payment it can find, so a failed insert must fail the request
    // (an unrecorded order means the fan pays and gets nothing).
    try {
      await storage.createPendingPayment(reference, artistId, votesAdded, amountKes, phone);
    } catch (err) {
      console.error("[PENDING] Failed to save pending payment:", err);
      recordAlertThrottled(
        "critical",
        "payment.pending_insert_failed",
        "Could not record a pending vote order before charging the fan",
        { reference, artistId, votesAdded },
      );
      return res.status(500).json({ message: "Could not start the payment. Please try again." });
    }

    try {
      const response = await fetch("https://megapay.co.ke/backend/v1/initiatestk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: megapayApiKey,
          email: megapayEmail,
          amount: String(amountKes),
          msisdn: phone,
          reference,
        }),
      });

      const data = await response.json();

      console.log(
        `[MEGAPAY-RESPONSE] ref=${reference}, votes=${votesAdded}, amount=${amountKes}KES, msisdn=${maskPhone(phone)}, response=${JSON.stringify(data)}`,
      );

      // MegaPay returns { success: true, ResultCode: "0" } on success
      if (data.success !== true && data.ResultCode !== "0") {
        console.warn(`[MEGAPAY-ERROR] ref=${reference}, ResultCode=${data.ResultCode}, message=${data.message}`);
        await storage.deletePendingPayment(reference).catch(() => {});
        return res.status(400).json({ message: data.message || "Failed to initiate M-Pesa payment", megapayResponse: data });
      }

      // Store the gateway's transaction id so this order can still be confirmed
      // directly with MegaPay if its callback never reaches us.
      const gatewayRequestId = data.transaction_request_id || data.CheckoutRequestID;
      if (gatewayRequestId) {
        await storage
          .setPendingGatewayRequestId(reference, String(gatewayRequestId))
          .catch((err) => console.error("[PENDING] Could not store gateway request id:", err));
      }

      return res.json({
        checkout_id: gatewayRequestId,
        reference,
        status: "pending",
        message: "STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.",
      });
    } catch (err: any) {
      console.error("MegaPay init error:", err);
      await storage.deletePendingPayment(reference).catch(() => {});
      recordAlertThrottled(
        "critical",
        "payment.gateway_error",
        "MegaPay STK initiation failed — fans cannot complete vote payments",
        { reference, error: String(err?.message ?? err) },
      );
      return res.status(500).json({ message: "Payment initialization failed" });
    }
  });

  /**
   * Admin-only live test of the M-Pesa STK push.
   *
   * Sends a real prompt to the number the admin types, so the gateway
   * credentials and the reachability of MegaPay can be proven instead of
   * inferred. It deliberately creates **no** pending payment: the callback can
   * only record a vote for a pending order it can find, so a test payment can
   * never add to a nominee's public total. Successful test payments arrive with
   * a `hopetest-` reference and are logged by the callback, not counted.
   */
  const lastStkTestAt = new Map<string, number>();
  app.post("/api/admin/test-stk", requireAdmin, async (req, res) => {
    const ip = requestIp(req);
    const now = Date.now();

    if (now - (lastStkTestAt.get(ip) ?? 0) < 20_000) {
      return res.status(429).json({ message: "Wait a few seconds before sending another test prompt." });
    }

    const phone = normalizeVotePhone((req.body ?? {}).phone);
    if (!phone) {
      return res.status(400).json({ message: "Enter a valid Safaricom M-Pesa number, e.g. 0712 345 678." });
    }

    const megapayApiKey = process.env.MEGAPAY_API_KEY;
    const megapayEmail = process.env.MEGAPAY_EMAIL || "";
    if (!megapayApiKey || !megapayEmail) {
      return res.status(500).json({
        message: "MegaPay credentials are missing on the server (MEGAPAY_API_KEY / MEGAPAY_EMAIL).",
      });
    }

    lastStkTestAt.set(ip, now);
    const reference = `hopetest-${now}-${crypto.randomBytes(3).toString("hex")}`;
    const amountKes = VOTE_PRICE_KES;

    try {
      const response = await fetch("https://megapay.co.ke/backend/v1/initiatestk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: megapayApiKey,
          email: megapayEmail,
          amount: String(amountKes),
          msisdn: phone,
          reference,
        }),
      });

      const data: any = await response.json().catch(() => ({}));
      const accepted = data.success === true || data.ResultCode === "0";

      console.log(
        `[STK TEST] ref=${reference}, amount=${amountKes}KES, msisdn=${maskPhone(phone)}, http=${response.status}, response=${JSON.stringify(data)}`,
      );
      audit(
        req,
        "payment.stk_test",
        "payment",
        reference,
        `Sent a live ${amountKes} KES STK test to ${maskPhone(phone)} — ${accepted ? "gateway accepted" : "gateway refused"}`,
      );

      return res.json({
        ok: accepted,
        reference,
        amountKes,
        phone: maskPhone(phone),
        httpStatus: response.status,
        gateway: data,
        message: accepted
          ? "MegaPay accepted the request. Check the phone for the M-Pesa prompt."
          : data.message || data.errorMessage || "MegaPay refused the request.",
      });
    } catch (err: any) {
      console.error("[STK TEST] MegaPay request failed:", err?.message || err);
      audit(
        req,
        "payment.stk_test",
        "payment",
        reference,
        `Live ${amountKes} KES STK test to ${maskPhone(phone)} could not reach MegaPay`,
      );
      return res.status(502).json({
        ok: false,
        reference,
        amountKes,
        phone: maskPhone(phone),
        message: `Could not reach MegaPay: ${err?.message || "network error"}`,
      });
    }
  });

  /**
   * The truth about one order, for the vote dialog that is waiting on it.
   *
   * Three outcomes, and only one of them says "you voted":
   *  - `recorded` — a row exists in `votes`, so the fan's votes are on the board.
   *  - `failed`   — M-Pesa cancelled/rejected it; no money moved, no vote owed.
   *  - `pending`  — no proof either way yet (the fan may not have entered their
   *                 PIN), so the client keeps waiting instead of congratulating.
   *
   * The callback is no longer the only way a vote can land: if the callback is
   * lost (the free instance asleep, a gateway retry that never came), this route
   * asks MegaPay for the transaction result and credits the order itself. So a
   * fan cannot be charged for a vote that never counts.
   */
  app.get("/api/megapay/status/:reference", async (req, res) => {
    const reference = String(req.params.reference);

    // References are ours (hopeawards-…) or admin tests (hopetest-…); anything
    // else cannot be in the table, and unrecognised input is not echoed back.
    if (!/^[a-z0-9-]{8,100}$/i.test(reference)) {
      return res.status(404).json({ status: "unknown", message: "Payment not found" });
    }

    try {
      const existing = await storage.getVoteByReference(reference);
      if (existing) {
        const existingArtist = await storage.getArtist(existing.artistId);
        return res.json({
          status: "recorded",
          vote: existing,
          votesAdded: existing.votesAdded,
          totalVotes: existingArtist?.totalVotes ?? 0,
        });
      }

      const pending = await storage.getPendingPayment(reference);
      if (!pending) {
        return res.status(404).json({ status: "unknown", message: "Payment not found" });
      }

      const gateway = await fetchGatewayStatus({
        reference: pending.reference,
        gatewayRequestId: pending.gatewayRequestId ?? null,
        amountKes: pending.amountKes,
      });

      if (gateway?.paid) {
        if (gateway.amountMismatch) {
          recordAlertThrottled(
            "critical",
            "payment.callback_amount_mismatch",
            "MegaPay reports a completed payment for a different amount — vote not recorded",
            { reference, claimedAmount: gateway.amount, expected: pending.amountKes },
          );
          return res.json({
            status: "pending",
            message: "MegaPay is still confirming this payment. Do not pay again — we are checking it.",
          });
        }

        if (Date.now() > VOTING_END) {
          recordAlertThrottled(
            "critical",
            "payment.late_after_close",
            "Payment completed after the enforced voting close — refund needed, no vote recorded",
            { reference, votes: pending.votesAdded, amountKes: pending.amountKes },
          );
          return res.json({
            status: "closed",
            message: "Voting has closed. If you were charged, contact us and we will refund you.",
          });
        }

        const credited = await creditPendingOrder(pending, "status-reconcile");
        console.log(`[MEGAPAY RECONCILE] Callback was missing — credited ref=${reference} from the gateway status`);
        return res.json({
          status: "recorded",
          reconciled: true,
          vote: credited.vote,
          votesAdded: credited.vote.votesAdded,
          totalVotes: credited.totalVotes,
        });
      }

      if (gateway?.failed) {
        return res.json({
          status: "failed",
          message: gateway.reason || "The M-Pesa payment was cancelled or declined. You have not been charged.",
        });
      }

      return res.json({
        status: "pending",
        message: "Waiting for you to approve the M-Pesa prompt on your phone.",
      });
    } catch (err: any) {
      console.error("MegaPay status check error:", err);
      return res.status(500).json({ message: "Status check failed" });
    }
  });

  /**
   * Callback bodies carry the fan's MSISDN. Mask phone-like fields before the
   * body reaches the logs or the alert buffer (which the admin panel renders),
   * keeping the field names so a payload can still be debugged.
   */
  function redactCallbackBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== "object") return {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (/msisdn|phone/i.test(key) && (typeof value === "string" || typeof value === "number")) {
        out[key] = maskPhone(String(value));
      } else if (value && typeof value === "object") {
        out[key] = "(nested)";
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  /**
   * Source authentication for the MegaPay callback. Anyone who can reach this
   * URL could otherwise claim a payment succeeded, so we require either the
   * shared secret (header `x-megapay-signature` / `?secret=`) or a request from
   * an approved IP in MEGAPAY_CALLBACK_IPS. When neither is configured we still
   * accept — so voting keeps working — but alert loudly that it is unverified.
   */
  const callbackSecret = () => process.env.MEGAPAY_CALLBACK_SECRET?.trim() || "";
  const callbackIps = () =>
    (process.env.MEGAPAY_CALLBACK_IPS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  function callbackSourceAllowed(req: Request): boolean {
    const expectedSecret = callbackSecret();
    const allowedIps = callbackIps();
    if (!expectedSecret && allowedIps.length === 0) return true;

    const ip = requestIp(req);
    const provided = String(
      req.headers["x-megapay-signature"] ?? req.headers["x-callback-token"] ?? req.query.secret ?? "",
    );
    if (expectedSecret && provided && timingSafeEquals(expectedSecret, provided)) return true;
    if (allowedIps.includes(ip)) return true;
    return false;
  }

  app.post("/api/megapay/callback", async (req, res) => {
    // MegaPay callback for STK Push payment results
    // MegaPay may send reference as 'reference', 'transaction_request_id', or nested in other fields
    const callbackIp = requestIp(req);

    if (!callbackSourceAllowed(req)) {
      recordAlertThrottled(
        "critical",
        "payment.callback_unauthenticated",
        "Rejected a MegaPay callback that presented neither the shared secret nor an approved IP",
        { ip: callbackIp, body: redactCallbackBody(req.body) },
        30_000,
      );
      return res.status(403).json({ status: "forbidden" });
    }

    if (!callbackSecret() && callbackIps().length === 0) {
      recordAlertThrottled(
        "warning",
        "payment.callback_unverified",
        "MegaPay callbacks are not authenticated — set MEGAPAY_CALLBACK_SECRET or MEGAPAY_CALLBACK_IPS",
        { ip: callbackIp },
        6 * 60 * 60_000,
      );
    }

    console.log(`[MEGAPAY CALLBACK RECEIVED] ip=${callbackIp} body=${JSON.stringify(redactCallbackBody(req.body))}`);
    
    // MegaPay PascalCase: TransactionReference, ResponseCode, etc.
    const reference = req.body.reference 
      || req.body.TransactionReference
      || req.body.transaction_reference
      || req.body.transaction_request_id 
      || req.body.data?.reference 
      || req.body.data?.TransactionReference
      || req.body.data?.transaction_request_id;
    const status = req.body.status || req.body.ResultCode || req.body.ResponseCode;
    const result_code = req.body.result_code ?? req.body.ResultCode ?? req.body.ResponseCode;
    const result_desc = req.body.result_desc || req.body.ResponseDescription || req.body.message;

    if (!reference) {
      console.warn(`[MEGAPAY CALLBACK] No reference found in callback body:`, JSON.stringify(redactCallbackBody(req.body)));
      recordAlertThrottled(
        "warning",
        "payment.callback_unparseable",
        "A callback arrived with no recognisable payment reference",
        { ip: callbackIp, body: redactCallbackBody(req.body) },
      );
      // Return 200 to MegaPay so it doesn't retry
      return res.status(200).json({ status: "ok" });
    }

    console.log(`[MEGAPAY CALLBACK] ref=${reference}, status=${status}, result_code=${result_code}, desc=${result_desc}`);

    // Admin live test (POST /api/admin/test-stk): real money may have moved, but
    // a test never creates a vote and must never raise the "no matching pending
    // order" alarm that a forged callback would.
    if (reference.startsWith("hopetest-")) {
      console.log(`[STK TEST CALLBACK] ref=${reference}, status=${status}, result_code=${result_code}, desc=${result_desc}`);
      return res.status(200).json({ status: "test_ok" });
    }

    // One settlement rule for both routes: `ResultCode: 0` means the STK request
    // was accepted, not that the fan paid. Only a real receipt or a completed
    // status earns a vote.
    const settlement = classifySettlement(req.body);

    const alreadyCredited = await storage.getVoteByReference(reference);
    if (alreadyCredited) {
      // A payment that settles and is then reversed must lose its vote: the fan
      // saw "vote added", and Safaricom took the money back a minute later.
      if (settlement === "failed") {
        const voided = await storage.voidVoteByReference(reference).catch((err) => {
          console.error(`[MEGAPAY CALLBACK] Could not void reversed vote ${reference}:`, err);
          return undefined;
        });
        if (voided) {
          apiCache.clear();
          recordAlert(
            "critical",
            "payment.reversed_after_credit",
            "MegaPay reported a payment as failed after its vote was recorded — the vote was removed",
            {
              reference,
              artistId: voided.artistId,
              votes: voided.votesAdded,
              amountKes: voided.amountKes,
              ip: callbackIp,
            },
          );
          console.log(`[MEGAPAY CALLBACK] Vote voided after reversal: ref=${reference}, votes=${voided.votesAdded}`);
        }
        return res.status(200).json({ status: voided ? "reversed" : "already_recorded" });
      }
      return res.status(200).json({ status: "already_recorded" });
    }

    if (settlement === "failed") {
      console.log(`[MEGAPAY CALLBACK] Payment did not settle: ref=${reference}, desc=${result_desc}`);
      recordAlertThrottled(
        "warning",
        "payment.callback_failed",
        "MegaPay reported a payment that did not go through — no vote recorded",
        { reference, ip: callbackIp },
      );
      return res.status(200).json({ status: "failed" });
    }

    if (settlement === "pending") {
      // "Success. Request accepted for processing" is not payment. The status
      // route confirms with MegaPay and credits when the money actually lands.
      console.log(`[MEGAPAY CALLBACK] Accepted but not settled: ref=${reference} — awaiting confirmation`);
      return res.status(200).json({ status: "awaiting_settlement" });
    }

    if (settlement === "paid") {
      try {
        // The pending order is authoritative for artist, votes and amount —
        // never the reference string or the callback body.
        const pending = await storage.getPendingPayment(reference);
        if (!pending) {
          recordAlertThrottled(
            "warning",
            "payment.callback_unknown_reference",
            "Callback claimed a successful payment with no matching pending order",
            { reference, ip: callbackIp },
          );
          return res.status(200).json({ status: "no_pending" });
        }

        // If MegaPay echoes an amount, it must match what we charged.
        const claimedAmount = Number(
          req.body.amount ?? req.body.Amount ?? req.body.TransAmount ?? req.body.transaction_amount,
        );
        if (Number.isFinite(claimedAmount) && claimedAmount > 0 && claimedAmount !== pending.amountKes) {
          recordAlertThrottled(
            "critical",
            "payment.callback_amount_mismatch",
            "Callback amount does not match the pending order — vote not recorded",
            { reference, claimedAmount, expected: pending.amountKes, ip: callbackIp },
          );
          return res.status(200).json({ status: "amount_mismatch" });
        }

        const claimedPhone = normalizeVotePhone(
          req.body.Msisdn ?? req.body.msisdn ?? req.body.phone ?? "",
        );
        if (claimedPhone && pending.voterPhone && claimedPhone !== pending.voterPhone) {
          recordAlertThrottled(
            "warning",
            "payment.callback_phone_mismatch",
            "Callback paying number differs from the number that started the order",
            { reference, ip: callbackIp, expected: maskPhone(pending.voterPhone), got: maskPhone(claimedPhone) },
          );
        }

        if (Date.now() > VOTING_END) {
          recordAlertThrottled(
            "critical",
            "payment.late_after_close",
            "Payment completed after the enforced voting close — refund needed, no vote recorded",
            { reference, votes: pending.votesAdded, amountKes: pending.amountKes },
          );
          return res.status(200).json({ status: "rejected" });
        }

        const voterPhone = req.body.Msisdn || req.body.msisdn || req.body.phone || pending.voterPhone;

        // Same credit path as the status route, so the two can race without ever
        // crediting the order twice.
        const credited = await creditPendingOrder(
          { ...pending, voterPhone: (voterPhone as string | null) ?? pending.voterPhone },
          "callback",
        );
        console.log(`[MEGAPAY CALLBACK] Vote recorded: ref=${reference}, artist=${pending.artistId}, votes=${credited.vote.votesAdded}, amount=${pending.amountKes}KES, phone=${maskPhone(String(credited.vote.voterPhone ?? ""))}`);
      } catch (err: any) {
        console.error(`[MEGAPAY CALLBACK CRITICAL] Vote creation failed for ref ${reference}:`, err);
        return res.status(500).json({ status: "error" });
      }
    }

    res.status(200).json({ status: "ok" });
  });

  app.post("/api/requests", async (req, res) => {
    try {
      const input = insertRequestSchema.parse(req.body);
      if (!(await categoryExists(input.category))) {
        return res.status(400).json({ message: "Invalid category", field: "category" });
      }
      const phoneDigits = (input.submitterPhone || "").replace(/\D/g, "");
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        return res.status(400).json({
          message: "Please enter a valid phone number (7–15 digits, numbers only).",
          field: "submitterPhone",
        });
      }
      input.submitterPhone = phoneDigits;
      const approvedCount = await storage.countApprovedByCategory(input.category);
      const isFull = approvedCount >= CATEGORY_CAP;

      if (isFull) {
        const capacity = await storage.countAllApprovedByCategory();
        const suggested = suggestAlternatives(input.category, capacity, await loadCategories());
        const request = await storage.createRequest(input, "waitlist");
        return res.status(202).json({
          request,
          waitlisted: true,
          message: `This category is already full (${CATEGORY_CAP} nominees). You've been added to the waitlist — the admin will reach out if a spot opens up.`,
          suggested,
        });
      }

      const request = await storage.createRequest(input, "pending");
      res.status(201).json({ request, waitlisted: false });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get("/api/requests/:id/public", noCache, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const r = await storage.getRequest(id);
    if (!r || r.status !== "approved") return res.status(404).json({ message: "Not found" });
    res.json({
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl,
      category: r.category,
      status: r.status,
    });
  });

  app.get("/api/requests", requireAdmin, async (req, res) => {
    const status = req.query.status as string | undefined;
    const results = await storage.getRequests(status);
    res.json(results);
  });

  app.get("/api/requests/export.csv", requireAdmin, async (_req, res) => {
    const allRows = await storage.getRequests();
    const rows = allRows.filter(r => r.status === "approved");
    const categoryNames = new Map((await loadCategories()).map((c) => [c.id, c.name] as const));
    const catName = (id: string) => categoryNames.get(id) || id;
    const esc = (v: any) => {
      const s = sanitizeCsvCell(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["id","name","category","status","phone","whatsapp_link","submitted_at"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const phoneDigits = (r.submitterPhone || "").replace(/\D/g, "");
      const intl = phoneDigits.replace(/^0/, "254");
      const wa = phoneDigits ? `https://wa.me/${intl}` : "";
      lines.push([
        r.id,
        r.name,
        catName(r.category),
        r.status,
        r.submitterPhone || "",
        wa,
        r.createdAt ? new Date(r.createdAt).toISOString() : "",
      ].map(esc).join(","));
    }
    const csv = lines.join("\r\n") + "\r\n";
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="hope-awards-nominees-${today}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(csv);
  });

  app.get("/api/my-votes", async (req, res) => {
    const phone = (req.query.phone as string || "").replace(/\D/g, "");
    if (!phone || phone.length < 7) {
      return res.json([]);
    }
    const voteRecords = await storage.getVotesByPhone(phone);
    if (!voteRecords.length) return res.json([]);

    const artistIds = [...new Set(voteRecords.map((v) => v.artistId))];
    const artistMap = new Map<number, ArtistResponse>();
    await Promise.all(
      artistIds.map(async (id) => {
        const a = await storage.getArtist(id);
        if (a) artistMap.set(id, a);
      })
    );

    const result = voteRecords
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .map((v) => {
        const artist = artistMap.get(v.artistId);
        return {
          id: v.id,
          artistId: v.artistId,
          artistName: artist?.name ?? "Unknown",
          artistCategory: artist?.category ?? "",
          votesAdded: v.votesAdded,
          amountKes: v.amountKes,
          createdAt: v.createdAt,
        };
      });

    return res.json(result);
  });

  app.get("/api/my-status", requireAdmin, noCache, async (req, res) => {
    const phone = (req.query.phone as string || "").trim();
    if (!phone || phone.length < 6) {
      return res.json([]);
    }
    const myReqs = await storage.getRequestsByPhone(phone);
    const result = await Promise.all(
      myReqs.map(async (r) => {
        let artistId: number | null = null;
        if (r.status === "approved") {
          const artist = await storage.findArtistByNameCategory(r.name, r.category);
          if (artist) artistId = artist.id;
        }
        return {
          requestId: r.id,
          name: r.name,
          category: r.category,
          status: r.status,
          createdAt: r.createdAt,
          artistId,
        };
      })
    );
    res.json(result);
  });

  app.patch("/api/requests/:id", requireAdmin, async (req, res) => {
    const { status, category } = req.body;
    const id = Number(req.params.id);

    if (status === undefined && category === undefined) {
      return res.status(400).json({ message: "Provide status and/or category to update" });
    }

    if (status !== undefined && !["approved", "rejected", "pending", "waitlist"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (category !== undefined) {
      if (!(await categoryExists(String(category)))) {
        return res.status(400).json({ message: "Invalid category" });
      }
      // Fetch current request so we can (a) honor the cap correctly, (b) move the artist row if approved.
      const existing = await storage.getRequest(id);
      if (!existing) {
        return res.status(404).json({ message: "Request not found" });
      }
      const currentlyApproved = existing.status === "approved";
      const willBeApproved = status === "approved" || (status === undefined && currentlyApproved);
      if (willBeApproved) {
        const approvedCount = await storage.countApprovedByCategory(category);
        if (approvedCount >= CATEGORY_CAP) {
          return res.status(409).json({
            message: `Cannot move — destination category is already full (${CATEGORY_CAP}/${CATEGORY_CAP}). Pick a different category, or set status to waitlist/pending first.`,
            categoryFull: true,
          });
        }
      }
      await storage.updateRequestCategory(id, category);
      audit(req, "move_category", "request", id, `Moved nomination ${existing.name} from ${existing.category} to ${category}`);
      // If this nominee is already a published artist (approved), keep the public gallery in sync
      // by moving the artist row to the new category too.
      if (currentlyApproved && existing.category !== category) {
        const artist = await storage.findArtistByNameCategory(existing.name, existing.category);
        if (artist) {
          await storage.updateArtistCategory(artist.id, category);
        }
      }
    }

    let updated;
    if (status !== undefined) {
      const before = await storage.getRequest(id);
      updated = await storage.updateRequestStatus(id, status);
      if (updated && before && before.status !== status) {
        audit(req, `nomination_${status}`, "request", id, `Nomination ${updated.name} went from ${before.status} to ${status}`);
      }
    } else {
      updated = await storage.getRequest(id);
    }

    if (!updated) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.json(updated);
  });

  // ─── Admin: view and force-recover stuck pending payments ─────────────────
  app.get("/api/admin/pending-payments", requireAdmin, async (_req, res) => {
    const pending = await storage.getAllPendingPayments();
    res.json(pending);
  });

  app.post("/api/admin/pending-payments/:reference/recover", requireAdmin, async (req, res) => {
    const reference = String(req.params.reference);
    const megapayApiKey = process.env.MEGAPAY_API_KEY;
    if (!megapayApiKey) return res.status(500).json({ message: "Payment system not configured" });

    const existing = await storage.getVoteByReference(reference);
    if (existing) {
      await storage.deletePendingPayment(reference);
      return res.json({ status: "already_recorded", vote: existing });
    }

    const pending = (await storage.getAllPendingPayments()).find(p => p.reference === reference);
    if (!pending) return res.status(404).json({ message: "Pending payment not found" });

    try {
      // MegaPay handles payment verification via callback
      // This endpoint just manually records the vote if payment was successful
      const vote = await storage.createVoteForce({
        artistId: pending.artistId,
        votesAdded: pending.votesAdded,
        amountKes: pending.amountKes,
        paystackReference: reference,
        voterPhone: pending.voterPhone,
      });
      await storage.deletePendingPayment(reference);
      apiCache.clear();
      audit(
        req,
        "recover_payment",
        "pending_payment",
        reference,
        `Force-recorded a vote for ${pending.votesAdded} vote(s) on artist #${pending.artistId} after a stuck payment`,
      );
      recordAlertThrottled(
        "warning",
        "admin.manual_recovery",
        "A payment was force-recovered by hand — confirm the M-Pesa statement matches",
        { reference, artistId: pending.artistId, votes: pending.votesAdded, amountKes: pending.amountKes, ip: requestIp(req) },
        60_000,
      );
      console.log(`[ADMIN-RECOVER] Force-recovered: ref=${reference}, artist=${pending.artistId}, votes=${pending.votesAdded}`);
      return res.json({ status: "recovered", vote });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Recovery failed" });
    }
  });

  app.delete("/api/admin/pending-payments/:reference", requireAdmin, async (req, res) => {
    const reference = String(req.params.reference);
    await storage.deletePendingPayment(reference);
    audit(req, "dismiss_payment", "pending_payment", reference, "Dismissed a pending payment record");
    res.json({ status: "deleted" });
  });

  /** The last two weeks of credited votes, so a reversal can be undone by hand. */
  app.get("/api/admin/recent-votes", requireAdmin, noCache, async (_req, res) => {
    const recent = await storage.getVotesSince(14 * 24 * 60 * 60 * 1000);
    const artistsById = new Map((await storage.getArtists()).map((a) => [a.id, a]));
    const rows = recent
      .slice()
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 40)
      .map((vote) => ({
        reference: vote.paystackReference,
        artistId: vote.artistId,
        artistName: artistsById.get(vote.artistId)?.name ?? `Artist #${vote.artistId}`,
        category: artistsById.get(vote.artistId)?.category ?? "",
        votesAdded: vote.votesAdded,
        amountKes: vote.amountKes,
        createdAt: vote.createdAt,
      }));
    res.json(rows);
  });

  /**
   * Takes back a vote whose payment did not survive (Safaricom reversal). Only
   * works on a real credited vote, so it can never invent or shave arbitrary
   * numbers — it deletes the ledger row and gives the votes back.
   */
  app.post("/api/admin/votes/:reference/void", requireAdmin, async (req, res) => {
    const reference = String(req.params.reference);
    const voided = await storage.voidVoteByReference(reference);
    if (!voided) {
      return res.status(404).json({ message: "No recorded vote for that reference" });
    }
    apiCache.clear();
    audit(
      req,
      "void_vote",
      "vote",
      reference,
      `Removed ${voided.votesAdded} vote(s) from artist #${voided.artistId} after a reversed payment`,
    );
    recordAlert(
      "warning",
      "admin.void_vote",
      "An admin removed a vote credited to a payment that was reversed",
      { reference, artistId: voided.artistId, votes: voided.votesAdded, ip: requestIp(req) },
    );
    console.log(`[ADMIN-VOID] ref=${reference}, artist=${voided.artistId}, votes=${voided.votesAdded}`);
    res.json({ status: "voided", vote: voided });
  });

  // ─── Background recovery: catch abandoned payments ────────────────────────
  // Runs 2 minutes after startup, then every 5 minutes.
  // For every pending_payment older than 5 minutes, logs for manual review —
  // MegaPay handles payment confirmation via callback.
  async function recoverPendingPayments() {
    const megapayApiKey = process.env.MEGAPAY_API_KEY;
    if (!megapayApiKey) return;
    try {
      const pending = await storage.getOldPendingPayments(5 * 60 * 1000);
      if (pending.length === 0) return;
      console.log(`[RECOVERY] Checking ${pending.length} pending payment(s)...`);
      for (const p of pending) {
        try {
          const existing = await storage.getVoteByReference(p.reference);
          if (existing) {
            await storage.deletePendingPayment(p.reference);
            continue;
          }

          // A fan who paid and closed the tab must still get their votes: ask the
          // gateway directly rather than waiting for a callback that was lost.
          const gateway = await fetchGatewayStatus({
            reference: p.reference,
            gatewayRequestId: p.gatewayRequestId ?? null,
            amountKes: p.amountKes,
          });
          if (gateway?.paid && !gateway.amountMismatch && Date.now() <= VOTING_END) {
            const credited = await creditPendingOrder(p, "background-reconcile");
            console.log(
              `[RECOVERY] Credited a paid order whose callback never arrived: ref=${p.reference}, votes=${credited.vote.votesAdded}`,
            );
            continue;
          }

          console.log(
            `[RECOVERY] Old pending payment: ref=${p.reference}, artist=${p.artistId}, gateway=${gateway?.paid ? "paid-mismatch" : "unconfirmed"}, created=${p.createdAt}`,
          );
        } catch (err) {
          console.error(`[RECOVERY] Error processing pending payment ${p.reference}:`, err);
        }
      }
    } catch (err) {
      console.error("[RECOVERY] Background recovery error:", err);
    }
  }

  // ─── Background: undo votes whose payments were reversed ─────────────────
  // A payment can settle, credit a vote, and then be reversed by Safaricom a
  // minute later (which is exactly what a screenshot of "vote added" followed by
  // an M-Pesa reversal looks like). Re-check recently credited votes against the
  // gateway and take the vote back if the money did not stay.
  const reverifiedReferences = new Set<string>();
  async function reconcileRecentVotes() {
    const apiKey = process.env.MEGAPAY_API_KEY;
    if (!apiKey) return;
    try {
      const recent = await storage.getVotesSince(60 * 60 * 1000);
      for (const vote of recent) {
        if (!vote.gatewayRequestId || reverifiedReferences.has(vote.paystackReference)) continue;
        const status = await fetchGatewayStatus({
          reference: vote.paystackReference,
          gatewayRequestId: vote.gatewayRequestId,
          amountKes: vote.amountKes,
        });
        // Only stop checking once the gateway has given a definite answer.
        if (!status) continue;
        if (status.failed) {
          reverifiedReferences.add(vote.paystackReference);
          const voided = await storage.voidVoteByReference(vote.paystackReference).catch(() => undefined);
          if (voided) {
            apiCache.clear();
            recordAlert(
              "critical",
              "payment.reversed_after_credit",
              "A vote was removed because MegaPay reports its payment was reversed",
              { reference: vote.paystackReference, artistId: vote.artistId, votes: vote.votesAdded, amountKes: vote.amountKes },
            );
            console.log(`[RECONCILE] Reversed payment — vote voided: ref=${vote.paystackReference}, votes=${vote.votesAdded}`);
          }
        } else if (status.paid) {
          reverifiedReferences.add(vote.paystackReference);
        }
      }
      if (reverifiedReferences.size > 5000) reverifiedReferences.clear();
    } catch (err) {
      console.error("[RECONCILE] Recent-vote reconciliation failed:", err);
    }
  }

  setTimeout(() => {
    recoverPendingPayments();
    setInterval(recoverPendingPayments, 5 * 60 * 1000).unref();
    reconcileRecentVotes();
    setInterval(reconcileRecentVotes, 3 * 60 * 1000).unref();
  }, 2 * 60 * 1000).unref();

  return httpServer;
}
