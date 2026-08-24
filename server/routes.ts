import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import multer from "multer";
import path from "path";
import { pool } from "./db";
import { storage, CATEGORY_CAP, VOTING_START, VOTING_END } from "./storage";
import { apiCache, imgCache, TTL_API, TTL_IMG } from "./cache";
import { api } from "@shared/routes";
import { insertRequestSchema, CATEGORIES, type ArtistResponse } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

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

function suggestAlternatives(currentCategoryId: string, capacity: Record<string, number>): { id: string; name: string; remaining: number }[] {
  const current = CATEGORIES.find((c) => c.id === currentCategoryId);
  if (!current) return [];
  const available = CATEGORIES
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
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isAdmin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
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
      for (const c of CATEGORIES) {
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

  const PgStore = connectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        pool,
        createTableIfMissing: true,
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

  app.post("/api/admin/login", (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
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

    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ message: "Admin password not configured" });
    }

    if (password === adminPassword) {
      state.count = 0;
      state.lockedUntil = null;
      req.session.isAdmin = true;
      return res.json({ success: true });
    }

    state.count += 1;
    if (state.count >= MAX_LOGIN_ATTEMPTS) {
      state.lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    const remaining = MAX_LOGIN_ATTEMPTS - state.count;
    if (remaining <= 0) {
      res.setHeader("Retry-After", String(Math.ceil(LOCKOUT_DURATION_MS / 1000)));
      return res.status(429).json({ message: "Too many failed attempts. Try again later." });
    }
    return res.status(401).json({ message: "Wrong password", attemptsRemaining: remaining });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/admin/check", (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
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

  app.post("/api/admin/shuffle-nominees", requireAdmin, async (_req, res) => {
    await storage.shuffleNominees();
    apiCache.clear();
    res.json({ message: "Nominees shuffled. Order randomised within each category." });
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
    const id = parseInt(req.params.id, 10);
    const bio = typeof req.body.bio === "string" ? req.body.bio : "";
    if (isNaN(id)) return res.status(400).json({ message: "Invalid artist id" });
    const updated = await storage.updateArtistBio(id, bio);
    apiCache.del(`artist:${id}`);
    res.json(updated);
  });

  app.patch("/api/artists/:id/votes", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const add = Number(req.body.add);
    if (!Number.isInteger(add) || add <= 0) {
      return res.status(400).json({ message: "add must be a positive whole number — you can only add votes, not deduct." });
    }
    const artist = await storage.addVotesToArtist(id, add);
    res.json(artist);
  });

  app.patch("/api/admin/artists/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid artist id" });
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const imageUrl = typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!imageUrl) return res.status(400).json({ message: "Image URL is required" });
    try {
      const updated = await storage.updateArtist(id, { name, imageUrl });
      apiCache.clear();
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
      const approvedCount = await storage.countApprovedByCategory(input.category);
      if (approvedCount >= CATEGORY_CAP) {
        return res.status(409).json({
          message: `This category is already full (${CATEGORY_CAP}/${CATEGORY_CAP} nominees). Remove someone first or move this nominee to the waitlist.`,
          categoryFull: true,
        });
      }
      const artist = await storage.createArtist(input);
      apiCache.clear();
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

  app.get("/api/categories/capacity", async (_req, res) => {
    const cached = apiCache.get<any>("capacity");
    if (cached) {
      res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      return res.json(cached);
    }
    const counts = await storage.countAllApprovedByCategory();
    const result = CATEGORIES.map((c) => ({
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
    await storage.deleteArtist(Number(req.params.id));
    apiCache.clear();
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

    const token = req.headers["x-upload-token"] as string | undefined;
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

  app.get("/api/payment-config", (_req, res) => {
    return res.json({ provider: "megapay" });
  });

  app.post("/api/megapay/initialize", async (req, res) => {
    const now = Date.now();

    if (now < VOTING_START) {
      return res.status(403).json({ message: "Voting has not started yet. Voting opens 1st June 2026 at 8:00 PM EAT." });
    }
    if (now > VOTING_END) {
      return res.status(403).json({ message: "Voting has closed. Thank you for participating in Hope Awards Kenya 2026." });
    }

    const { artistId, votesAdded, phone } = req.body;

    if (!artistId || !votesAdded || votesAdded < 1) {
      return res.status(400).json({ message: "Invalid vote data" });
    }

    const artist = await storage.getArtist(Number(artistId));
    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    const amountKes = votesAdded * 10;
    const reference = `musicawards-${artistId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const megapayApiKey = process.env.MEGAPAY_API_KEY;
    if (!megapayApiKey) {
      return res.status(500).json({ message: "Payment system not configured" });
    }

    try {
      const normalizedPhone = phone?.replace(/\D/g, "") || "";
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ message: "Valid phone number required for M-Pesa payment" });
      }

      // Save pending record before calling MegaPay
      storage.createPendingPayment(
        reference, Number(artistId), Number(votesAdded), amountKes, normalizedPhone
      ).catch(err => console.error("[PENDING] Failed to save pending payment:", err));

      const response = await fetch("https://megapay.co.ke/backend/v1/initiatestk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: megapayApiKey,
          phone: normalizedPhone,
          amount: amountKes,
          reference,
          callback: `${req.protocol}://${req.get("host")}/api/megapay/callback`,
        }),
      });

      const data = await response.json();

      if (data.status !== "success") {
        storage.deletePendingPayment(reference).catch(() => {});
        return res.status(400).json({ message: data.message || "Failed to initiate M-Pesa payment" });
      }

      return res.json({
        checkout_id: data.checkout_id,
        reference,
        status: "pending",
        message: "STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.",
      });
    } catch (err: any) {
      console.error("MegaPay init error:", err);
      storage.deletePendingPayment(reference).catch(() => {});
      return res.status(500).json({ message: "Payment initialization failed" });
    }
  });

  app.get("/api/megapay/status/:reference", async (req, res) => {
    const { reference } = req.params;

    const existing = await storage.getVoteByReference(reference);
    if (existing) {
      const existingArtist = await storage.getArtist(existing.artistId);
      return res.json({ status: "already_recorded", vote: existing, totalVotes: existingArtist?.totalVotes ?? 0 });
    }

    const megapayApiKey = process.env.MEGAPAY_API_KEY;
    if (!megapayApiKey) {
      return res.status(500).json({ message: "Payment system not configured" });
    }

    try {
      // Check pending payment status from our DB
      const pending = (await storage.getAllPendingPayments()).find(p => p.reference === reference);
      if (!pending) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // For MegaPay STK Push, the callback handles payment confirmation
      // This endpoint just checks if the vote was recorded
      return res.json({ status: "pending", message: "Payment is being processed. You will receive an M-Pesa prompt on your phone." });
    } catch (err: any) {
      console.error("MegaPay status check error:", err);
      return res.status(500).json({ message: "Status check failed" });
    }
  });

  app.post("/api/megapay/callback", async (req, res) => {
    // MegaPay callback for STK Push payment results
    const { reference, status, checkout_id, result_code, result_desc } = req.body;

    if (!reference) {
      return res.status(400).json({ message: "Missing reference" });
    }

    console.log(`[MEGAPAY CALLBACK] ref=${reference}, status=${status}, result_code=${result_code}`);

    if (status === "success" || result_code === "0") {
      try {
        const existing = await storage.getVoteByReference(reference);
        if (existing) {
          return res.status(200).json({ status: "already_recorded" });
        }

        // Extract artistId and votes from reference: musicawards-{artistId}-{ts}-{hex}
        const refParts = reference.split("-");
        const artistId = Number(refParts[1]);

        if (!artistId || isNaN(artistId)) {
          console.error(`[MEGAPAY CALLBACK] Could not determine artistId for ref ${reference}`);
          return res.status(200).json({ status: "ignored" });
        }

        if (Date.now() > VOTING_END) {
          console.warn(`[MEGAPAY CALLBACK] Rejecting late payment ${reference} — voting window has closed.`);
          return res.status(200).json({ status: "rejected" });
        }

        // Get pending payment to get votes and amount
        const pendingPayments = await storage.getAllPendingPayments();
        const pending = pendingPayments.find(p => p.reference === reference);
        if (!pending) {
          console.error(`[MEGAPAY CALLBACK] No pending payment found for ref ${reference}`);
          return res.status(200).json({ status: "no_pending" });
        }

        const voterPhone = req.body.phone || pending.voterPhone;

        await storage.createVote({
          artistId,
          votesAdded: pending.votesAdded,
          amountKes: pending.amountKes,
          paystackReference: reference,
          voterPhone: voterPhone ?? null,
        });
        storage.deletePendingPayment(reference).catch(() => {});
        console.log(`[MEGAPAY CALLBACK] Vote recorded: ref=${reference}, artist=${artistId}, votes=${pending.votesAdded}, amount=${pending.amountKes}KES`);
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
        const suggested = suggestAlternatives(input.category, capacity);
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
    const id = parseInt(req.params.id, 10);
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
    const catName = (id: string) => CATEGORIES.find(c => c.id === id)?.name || id;
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
      const isValidCategory = CATEGORIES.some((c) => c.id === category);
      if (!isValidCategory) {
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
      updated = await storage.updateRequestStatus(id, status);
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
    const { reference } = req.params;
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
      console.log(`[ADMIN-RECOVER] Force-recovered: ref=${reference}, artist=${pending.artistId}, votes=${pending.votesAdded}`);
      return res.json({ status: "recovered", vote });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Recovery failed" });
    }
  });

  app.delete("/api/admin/pending-payments/:reference", requireAdmin, async (req, res) => {
    await storage.deletePendingPayment(req.params.reference);
    res.json({ status: "deleted" });
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
          // MegaPay handles payment via callback - we just log old pending payments
          console.log(`[RECOVERY] Old pending payment: ref=${p.reference}, artist=${p.artistId}, created=${p.createdAt}`);
        } catch (err) {
          console.error(`[RECOVERY] Error processing pending payment ${p.reference}:`, err);
        }
      }
    } catch (err) {
      console.error("[RECOVERY] Background recovery error:", err);
    }
  }

  setTimeout(() => {
    recoverPendingPayments();
    setInterval(recoverPendingPayments, 5 * 60 * 1000);
  }, 2 * 60 * 1000);

  return httpServer;
}
