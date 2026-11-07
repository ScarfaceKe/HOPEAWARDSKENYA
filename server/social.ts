// ─── Social auto-posting (Zernio) ───────────────────────────────────────────
// Only nominees an admin marks as having an official poster are eligible. This
// module turns each one into one post across the Hope Awards Facebook Page,
// TikTok and YouTube, using the official Zernio API/SDK
// (https://github.com/zernio-dev/zernio-node). Facebook and TikTok get the
// still poster; YouTube gets a vertical video with a gospel instrumental.
// Instagram is deliberately excluded: it is not connected and must be left alone.
//
// Safety rules, learned from the WhatsApp automation:
//   • One poster at a time, never a burst.
//   • One row per artist is the ledger — the same poster cannot publish twice.
//   • An explicit pause survives restarts; a new artist is picked up later.
//   • The queue only runs on the production server. The shared preview must not
//     post to the real accounts while someone is working on the site.

import Zernio, { type CreatePostData } from "@zernio/node";
import { buildSocialCaption, socialMediaUrl, type SocialCaption } from "@shared/social-caption";
import { pool } from "./db";
import { buildPosterVideo, posterVideoFileName } from "./poster-video";

// Six posters per platform per day. Facebook (100/day) and TikTok (15/day)
// have plenty of room; YouTube is the constraint: one Data API video upload
// costs 1,600 units of the default 10,000/day quota, so six uploads use 9,600
// and leave room for the channel's normal activity.
export const SOCIAL_INTERVAL_MS = 4 * 60 * 60_000;
export const SOCIAL_RETRY_AFTER_MS = 2 * 60 * 60_000;
export const SOCIAL_MAX_ATTEMPTS = 3;
export const SOCIAL_PLATFORMS = ["facebook", "tiktok", "youtube"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * One stable key per artist makes a retry after a timeout safe: Zernio returns
 * the original post instead of publishing the same poster a second time. The
 * ledger already stops a second queue claim; this covers an ambiguous network
 * failure after Zernio accepted the request but before we recorded the result.
 */
export function socialIdempotencyKey(artistId: number): string {
  return `hope-awards-poster-${Math.trunc(artistId)}`;
}

export interface SocialPublishSummary {
  overall: "published" | "partial" | "queued" | "failed";
  publishedCount: number;
  failedCount: number;
  heldCount: number;
}

/**
 * Zernio's top-level status can say `published` while one platform result
 * failed. The per-platform results are the source of truth, so a mixed result
 * is always reported as partial instead of hiding the failed platform.
 */
export function summarizeSocialPublish(
  zernioStatus: unknown,
  platformEntries: { status?: unknown }[],
): SocialPublishSummary {
  const statuses = platformEntries.map((entry) => String(entry?.status ?? "unknown"));
  const publishedCount = statuses.filter((status) => status === "published").length;
  const failedCount = statuses.filter((status) => status === "failed" || status === "cancelled").length;
  const heldCount = statuses.filter((status) =>
    ["pending", "processing", "uploading", "scheduled", "publishing"].includes(status),
  ).length;

  const allPublished = statuses.length > 0 && publishedCount === statuses.length;
  let overall: SocialPublishSummary["overall"];
  if (allPublished || (statuses.length === 0 && zernioStatus === "published")) {
    overall = "published";
  } else if (publishedCount > 0) {
    overall = "partial";
  } else if (failedCount > 0) {
    overall = "failed";
  } else if (heldCount > 0 || zernioStatus === "scheduled" || zernioStatus === "publishing") {
    overall = "queued";
  } else if (zernioStatus === "published" || zernioStatus === "partial") {
    overall = "partial";
  } else {
    overall = "failed";
  }

  return { overall, publishedCount, failedCount, heldCount };
}

const PROFILE_NAME = "Hope Awards Kenya";
const PROFILE_DESCRIPTION = "Hope Awards Kenya Facebook Page, TikTok and YouTube";
const CONNECT_REDIRECT = "https://www.hopeawards.co.ke/admin?social=connected";

interface ClaimedPost {
  artistId: number;
  name: string;
  categoryName: string;
  mediaUrl: string;
  caption: SocialCaption;
  attempts: number;
}

interface SocialAccountRow {
  accountId: string;
  platform: SocialPlatform;
  username: string | null;
  displayName: string | null;
  isActive: boolean;
  needsReconnection: boolean;
}

export interface SocialAutomationState {
  enabled: boolean;
  /** When on, only nominees an admin marked as poster-ready enter the queue. */
  onlyWithPosters: boolean;
  profileId: string | null;
  lastPostAt: number | null;
}

export interface SocialRunResult {
  ok: boolean;
  claimed: boolean;
  posted: number;
  artistId?: number;
  artistName?: string;
  status?: string;
  reason?: string;
  error?: string;
  platforms?: { platform: string; status: string; url?: string | null; error?: string | null }[];
}

function zernioKey(): string | null {
  return process.env.ZERNIO_API_KEY?.trim() || null;
}

export function zernioConfigured(): boolean {
  return Boolean(zernioKey());
}

/**
 * Posting is a production action. The preview shares the production database
 * and the same Zernio accounts, so a developer clicking a button there must not
 * publish to the real Facebook, TikTok and YouTube accounts. Set the override
 * only for a staging install with its own social accounts.
 */
export function socialPostingAllowedInThisProcess(): boolean {
  return process.env.NODE_ENV === "production" || process.env.SOCIAL_ALLOW_DEV_POSTS === "true";
}

function zernioClient(): Zernio {
  const apiKey = zernioKey();
  if (!apiKey) throw new Error("ZERNIO_API_KEY is not configured.");
  return new Zernio({ apiKey });
}

/**
 * Zernio stores the rendered MP4 and hands back a public HTTPS URL that the
 * YouTube target can fetch. The file never needs to live on the app server.
 */
async function uploadPosterVideo(zernio: Zernio, artistId: number, video: Buffer): Promise<string> {
  const filename = posterVideoFileName(artistId);
  const presign = await zernio.media.getMediaPresignedUrl({
    body: { filename, contentType: "video/mp4", size: video.length },
  });
  const presignError = (presign as any).error;
  if (presignError) {
    const message =
      presignError?.error ||
      presignError?.message ||
      (typeof presignError === "string" ? presignError : "Zernio could not prepare the video upload.");
    throw new Error(String(message));
  }

  const uploadUrl = presign.data?.uploadUrl;
  const publicUrl = presign.data?.publicUrl;
  if (!uploadUrl || !publicUrl) throw new Error("Zernio did not return a video upload URL.");
  if (!/^https:\/\//i.test(uploadUrl) || !/^https:\/\//i.test(publicUrl)) {
    throw new Error("Zernio returned an insecure video URL.");
  }

  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: new Uint8Array(video),
    signal: AbortSignal.timeout(120_000),
  });
  if (!uploaded.ok) {
    const detail = (await uploaded.text().catch(() => "")).trim().slice(0, 300);
    throw new Error(`Zernio video upload failed (HTTP ${uploaded.status})${detail ? `: ${detail}` : "."}`);
  }

  return publicUrl;
}

export async function getSocialAutomationState(): Promise<SocialAutomationState> {
  try {
    const { rows } = await pool.query<{
      enabled: boolean;
      only_with_posters: boolean;
      profile_id: string | null;
      last_post_at: Date | null;
    }>("SELECT enabled, only_with_posters, profile_id, last_post_at FROM social_automation WHERE id = 1");
    const row = rows[0];
    if (!row) return { enabled: false, onlyWithPosters: true, profileId: null, lastPostAt: null };
    return {
      enabled: row.enabled === true,
      onlyWithPosters: row.only_with_posters !== false,
      profileId: row.profile_id ?? null,
      lastPostAt: row.last_post_at ? new Date(row.last_post_at).getTime() : null,
    };
  } catch (err) {
    console.error("[SOCIAL] Could not read the automation switch:", err);
    // Fail closed: if we cannot prove it is on, do not post, and keep the
    // official-poster-only filter on.
    return { enabled: false, onlyWithPosters: true, profileId: null, lastPostAt: null };
  }
}

export async function setSocialAutomationEnabled(enabled: boolean): Promise<SocialAutomationState> {
  await pool.query(
    `INSERT INTO social_automation (id, enabled, last_post_at, updated_at)
     VALUES (1, $1, NULL, NOW())
     ON CONFLICT (id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           last_post_at = CASE WHEN EXCLUDED.enabled THEN NULL ELSE social_automation.last_post_at END,
           updated_at = NOW()`,
    [enabled],
  );
  return getSocialAutomationState();
}

/**
 * The queue gate is separate from the pause switch: turning it off is an
 * explicit decision to allow every approved nominee's current photo through.
 * Fresh installs default to poster-only.
 */
export async function setSocialOnlyWithPosters(onlyWithPosters: boolean): Promise<SocialAutomationState> {
  await pool.query(
    `INSERT INTO social_automation (id, only_with_posters, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE
       SET only_with_posters = EXCLUDED.only_with_posters,
           updated_at = NOW()`,
    [onlyWithPosters],
  );
  return getSocialAutomationState();
}

async function saveProfileId(profileId: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO social_automation (id, profile_id, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET profile_id = EXCLUDED.profile_id, updated_at = NOW()`,
      [profileId],
    );
  } catch (err) {
    console.error("[SOCIAL] Could not save the Zernio profile id:", err);
  }
}

/**
 * A profile groups the awards' Facebook, TikTok and YouTube accounts. The env
 * override is useful when an operator already created one in the Zernio
 * dashboard; otherwise we look it up by name and create it once.
 */
export async function ensureSocialProfile(): Promise<string> {
  const fromEnv = process.env.ZERNIO_PROFILE_ID?.trim();
  if (fromEnv) return fromEnv;

  const state = await getSocialAutomationState();
  if (state.profileId) return state.profileId;

  const zernio = zernioClient();
  const listed = await zernio.profiles.listProfiles({ query: { name: PROFILE_NAME } });
  const existing = listed.data?.profiles?.find((p: any) => p.name === PROFILE_NAME && p._id);
  if (existing?._id) {
    await saveProfileId(existing._id);
    return existing._id;
  }

  const created = await zernio.profiles.createProfile({
    body: {
      name: PROFILE_NAME,
      description: PROFILE_DESCRIPTION,
      timezone: "Africa/Nairobi",
    },
  });
  const id = created.data?.profile?._id;
  if (!id) throw new Error("Zernio did not return a profile id.");
  await saveProfileId(id);
  return id;
}

export async function getSocialAccounts(profileId?: string): Promise<SocialAccountRow[]> {
  const zernio = zernioClient();
  const id = profileId ?? (await ensureSocialProfile());
  const response = await zernio.accounts.listAccounts({
    query: { profileId: id, category: "social" },
  });

  return (response.data?.accounts ?? [])
    .filter(
      (account: any) =>
        (SOCIAL_PLATFORMS as readonly string[]).includes(account.platform) &&
        account.isActive &&
        account.enabled !== false,
    )
    .map((account: any) => ({
      accountId: account._id,
      platform: account.platform as SocialPlatform,
      username: account.username ?? null,
      displayName: account.displayName ?? null,
      isActive: account.isActive,
      needsReconnection: account.needsReconnection === true,
    }));
}

export async function socialConnectUrl(platform: SocialPlatform): Promise<string> {
  const profileId = await ensureSocialProfile();
  const zernio = zernioClient();
  const response = await zernio.connect.getConnectUrl({
    path: { platform },
    query: {
      profileId,
      scopes: "posting",
      redirect_url: CONNECT_REDIRECT,
      welcome: true,
      brandName: "Hope Awards Kenya",
    },
  });
  const url = response.data?.authUrl;
  if (!url) throw new Error("Zernio did not return a connect URL.");
  if (!/^https:\/\//i.test(url)) throw new Error("Zernio returned an insecure connect URL.");
  return url;
}

async function remainingPosters(onlyWithPosters: boolean): Promise<number> {
  try {
    const { rows } = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM artists a
         LEFT JOIN social_posts s ON s.artist_id = a.id
        WHERE (s.id IS NULL OR (s.status = 'failed' AND s.attempts < $1))
          AND ((a.image_url LIKE '/%' AND a.image_url NOT LIKE '//%') OR a.image_url ILIKE 'https://%')
          AND ($2::boolean = FALSE OR a.poster_ready = TRUE)`,
      [SOCIAL_MAX_ATTEMPTS, onlyWithPosters],
    );
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

async function posterCounts(): Promise<{ ready: number; total: number }> {
  try {
    const { rows } = await pool.query<{ ready: number; total: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE poster_ready = TRUE)::int AS ready
         FROM artists`,
    );
    return { ready: rows[0]?.ready ?? 0, total: rows[0]?.total ?? 0 };
  } catch {
    return { ready: 0, total: 0 };
  }
}

async function nextPosterPreview(onlyWithPosters: boolean): Promise<
  | (ClaimedPost & { imageUrl: string })
  | null
> {
  try {
    const { rows } = await pool.query<{
      id: number;
      name: string;
      image_url: string;
      category_name: string;
    }>(
      `SELECT a.id, a.name, a.image_url, COALESCE(c.name, a.category) AS category_name
         FROM artists a
         LEFT JOIN categories c ON c.id = a.category
         LEFT JOIN social_posts s ON s.artist_id = a.id
        WHERE (s.id IS NULL OR (s.status = 'failed' AND s.attempts < $1))
          AND ((a.image_url LIKE '/%' AND a.image_url NOT LIKE '//%') OR a.image_url ILIKE 'https://%')
          AND ($2::boolean = FALSE OR a.poster_ready = TRUE)
        ORDER BY a.created_at ASC, a.id ASC
        LIMIT 1`,
      [SOCIAL_MAX_ATTEMPTS, onlyWithPosters],
    );
    const row = rows[0];
    if (!row) return null;
    const caption = buildSocialCaption({
      id: row.id,
      name: row.name,
      categoryName: row.category_name,
    });
    return {
      artistId: row.id,
      name: row.name,
      categoryName: row.category_name,
      imageUrl: row.image_url,
      mediaUrl: socialMediaUrl(row.image_url),
      caption,
      attempts: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Atomically claims the next artist. The automation row lock makes the 4-hour
 * gate and the unique artist row work together: two requests cannot claim two
 * different posters at the same moment.
 */
async function claimNextPoster(force: boolean): Promise<ClaimedPost | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const automation = await client.query<{
      enabled: boolean;
      only_with_posters: boolean;
      last_post_at: Date | null;
    }>("SELECT enabled, only_with_posters, last_post_at FROM social_automation WHERE id = 1 FOR UPDATE");
    const row = automation.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }
    if (!force && !row.enabled) {
      await client.query("ROLLBACK");
      return null;
    }
    if (!force && row.last_post_at) {
      const elapsed = Date.now() - new Date(row.last_post_at).getTime();
      if (elapsed < SOCIAL_INTERVAL_MS) {
        await client.query("ROLLBACK");
        return null;
      }
    }

    // A process killed mid-publish leaves a `posting` row. Put it back in the
    // retry pool after 20 minutes instead of losing that poster forever.
    await client.query(
      `UPDATE social_posts
          SET status = 'failed',
              error = 'The server stopped while this poster was publishing. Retrying automatically.',
              updated_at = NOW() - INTERVAL '4 hours'
        WHERE status = 'posting' AND updated_at < NOW() - INTERVAL '20 minutes'`,
    );

    // Only one poster may be in flight. The timer and a second admin tab must
    // not publish two different posters because both saw an empty slot.
    const inFlight = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM social_posts WHERE status = 'posting'",
    );
    if ((inFlight.rows[0]?.count ?? 0) > 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const { rows } = await client.query<{
      id: number;
      name: string;
      image_url: string;
      category_name: string;
    }>(
      `SELECT a.id, a.name, a.image_url, COALESCE(c.name, a.category) AS category_name
         FROM artists a
         LEFT JOIN categories c ON c.id = a.category
         LEFT JOIN social_posts s ON s.artist_id = a.id
        WHERE (s.id IS NULL
           OR (s.status = 'failed' AND s.attempts < $1
               AND ($2::boolean OR s.updated_at <= NOW() - ($3::bigint * INTERVAL '1 millisecond'))))
          AND ((a.image_url LIKE '/%' AND a.image_url NOT LIKE '//%') OR a.image_url ILIKE 'https://%')
          AND ($4::boolean = FALSE OR a.poster_ready = TRUE)
        ORDER BY a.created_at ASC, a.id ASC
        LIMIT 1
        FOR UPDATE OF a SKIP LOCKED`,
      [SOCIAL_MAX_ATTEMPTS, force, SOCIAL_RETRY_AFTER_MS, row.only_with_posters],
    );
    const artist = rows[0];
    if (!artist) {
      await client.query("COMMIT");
      return null;
    }

    const caption = buildSocialCaption({
      id: artist.id,
      name: artist.name,
      categoryName: artist.category_name,
    });
    const mediaUrl = socialMediaUrl(artist.image_url);

    const inserted = await client.query<{ attempts: number }>(
      `INSERT INTO social_posts (artist_id, status, caption, media_url, attempts, updated_at)
       VALUES ($1, 'posting', $2, $3, 1, NOW())
       ON CONFLICT (artist_id) DO UPDATE
         SET status = 'posting',
             caption = EXCLUDED.caption,
             media_url = EXCLUDED.media_url,
             error = NULL,
             attempts = social_posts.attempts + 1,
             updated_at = NOW()
         WHERE social_posts.status = 'failed' AND social_posts.attempts < $4
       RETURNING attempts`,
      [artist.id, caption.caption, mediaUrl, SOCIAL_MAX_ATTEMPTS],
    );

    if (!inserted.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "UPDATE social_automation SET last_post_at = NOW(), updated_at = NOW() WHERE id = 1",
    );
    await client.query("COMMIT");

    return {
      artistId: artist.id,
      name: artist.name,
      categoryName: artist.category_name,
      mediaUrl,
      caption,
      attempts: inserted.rows[0].attempts,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Publishes one claimed poster. The platform response is the source of truth;
 * we store each platform's status so a partial success is visible in the
 * admin panel instead of being reported as a generic failure.
 */
async function publishClaimedPost(
  post: ClaimedPost,
  accounts: SocialAccountRow[],
): Promise<SocialRunResult> {
  const zernio = zernioClient();
  const hasTikTok = accounts.some((a) => a.platform === "tiktok");
  const hasYouTube = accounts.some((a) => a.platform === "youtube");

  // YouTube cannot publish a still. Render the poster into a vertical video
  // with the gospel instrumental first, then give only the YouTube target that
  // custom video. If this fails while YouTube is connected we fail the whole
  // post rather than quietly leaving YouTube out; the ledger retries it.
  let youtubeVideoUrl: string | null = null;
  if (hasYouTube) {
    try {
      const video = await buildPosterVideo({ imageUrl: post.mediaUrl, artistId: post.artistId });
      youtubeVideoUrl = await uploadPosterVideo(zernio, post.artistId, video);
      console.log(`[SOCIAL] Rendered YouTube poster video for ${post.name} (${Math.round(video.length / 1024)} KB).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not render the poster video.";
      throw new Error(`YouTube poster video could not be prepared: ${message}`);
    }
  }

  const platforms: NonNullable<CreatePostData["body"]["platforms"]> = accounts.map((account) => {
    if (account.platform === "youtube") {
      if (!youtubeVideoUrl) throw new Error("The YouTube poster video is missing.");
      return {
        platform: "youtube",
        accountId: account.accountId,
        customContent: post.caption.caption,
        customMedia: [{
          type: "video" as const,
          url: youtubeVideoUrl,
          filename: posterVideoFileName(post.artistId),
          mimeType: "video/mp4",
        }],
        platformSpecificData: {
          title: post.caption.title,
          visibility: "public" as const,
          categoryId: "24", // Entertainment; the poster is an awards announcement.
          madeForKids: false,
        },
      };
    }
    return {
      platform: account.platform,
      accountId: account.accountId,
      ...(account.platform === "tiktok" ? { customContent: post.caption.title } : {}),
    };
  });

  const body: CreatePostData["body"] = {
    title: post.caption.title,
    content: post.caption.caption,
    mediaItems: [{ type: "image", url: post.mediaUrl }],
    platforms,
    publishNow: true,
    timezone: "Africa/Nairobi",
    metadata: { artistId: post.artistId, source: "hope-awards-poster" },
  };

  if (hasTikTok) {
    body.tiktokSettings = {
      privacyLevel: "PUBLIC_TO_EVERYONE",
      allowComment: true,
      mediaType: "photo",
      photoCoverIndex: 0,
      description: post.caption.caption,
      autoAddMusic: true,
      contentPreviewConfirmed: true,
      expressConsentGiven: true,
    };
  }

  const response = await zernio.posts.createPost({
    body,
    headers: { "Idempotency-Key": socialIdempotencyKey(post.artistId) },
  });
  const responseError = (response as any).error;
  if (responseError) {
    const message =
      responseError?.error ||
      responseError?.message ||
      (typeof responseError === "string" ? responseError : "Zernio rejected the post.");
    throw new Error(String(message));
  }
  const data = response.data as any;
  const platformEntries: any[] =
    data?.platformResults ??
    data?.post?.platforms ??
    [];

  const normalized = platformEntries.map((entry) => ({
    platform: String(entry.platform ?? ""),
    status: String(entry.status ?? "unknown"),
    url: entry.platformPostUrl ?? null,
    error: entry.error ?? entry.errorMessage ?? null,
  }));

  // A TikTok daily-cap hold is pending, not a failure: Zernio will publish it
  // when the window frees. Only report failure when no platform accepted it,
  // and never let the top-level status hide a failed platform.
  const { overall, publishedCount } = summarizeSocialPublish(data?.post?.status, normalized);
  const errorText =
    normalized
      .filter((p) => (p.status === "failed" || p.status === "cancelled") && p.error)
      .map((p) => `${p.platform}: ${p.error}`)
      .join(" · ") ||
    (overall === "failed" ? data?.error || data?.message || "Zernio did not publish the poster." : null);
  if (overall === "failed" && normalized.length > 0 && !normalized.some((p) => p.status === "failed" || p.status === "cancelled")) {
    console.warn("[SOCIAL] Zernio returned no publishable platform for the poster.");
  }

  await pool.query(
    `UPDATE social_posts
        SET zernio_post_id = $2,
            status = $3,
            platforms = $4,
            error = $5,
            posted_at = CASE WHEN $3 = 'published' THEN NOW() ELSE posted_at END,
            updated_at = NOW()
      WHERE artist_id = $1`,
    [
      post.artistId,
      data?.post?._id ?? null,
      overall,
      JSON.stringify(normalized),
      errorText,
    ],
  );

  return {
    ok: overall !== "failed",
    claimed: true,
    posted: publishedCount,
    artistId: post.artistId,
    artistName: post.name,
    status: overall,
    error: errorText ?? undefined,
    platforms: normalized,
  };
}

/** Marks a claimed poster failed if the request itself threw (network, auth...). */
async function markPostFailed(artistId: number, error: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE social_posts SET status = 'failed', error = $2, updated_at = NOW() WHERE artist_id = $1`,
      [artistId, error.slice(0, 1_000)],
    );
  } catch (err) {
    console.error("[SOCIAL] Could not record the failed poster:", err);
  }
}

/**
 * One queue step: claim the next poster and publish it. Called by the timer and
 * by the admin button. `force` is only for the explicit button — the automatic
 * timer never bypasses the 4-hour gate.
 */
export async function runSocialQueue(options: { force?: boolean } = {}): Promise<SocialRunResult> {
  if (!zernioConfigured()) {
    return { ok: false, claimed: false, posted: 0, reason: "not_configured" };
  }

  const state = await getSocialAutomationState();
  if (!state.enabled && !options.force) {
    return { ok: false, claimed: false, posted: 0, reason: "paused" };
  }

  let accounts: SocialAccountRow[];
  try {
    accounts = await getSocialAccounts(state.profileId ?? undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read Zernio accounts.";
    console.error("[SOCIAL] Could not read accounts:", message);
    return { ok: false, claimed: false, posted: 0, reason: "accounts", error: message };
  }

  if (accounts.length === 0) {
    return { ok: false, claimed: false, posted: 0, reason: "no_accounts" };
  }

  let claimed: ClaimedPost | null;
  try {
    claimed = await claimNextPoster(options.force === true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not claim a poster.";
    console.error("[SOCIAL] Could not claim the next poster:", message);
    return { ok: false, claimed: false, posted: 0, reason: "claim", error: message };
  }

  if (!claimed) {
    return { ok: true, claimed: false, posted: 0, reason: "nothing_due" };
  }

  try {
    return await publishClaimedPost(claimed, accounts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Zernio rejected the post.";
    console.error(`[SOCIAL] Poster for ${claimed.name} failed:`, message);
    await markPostFailed(claimed.artistId, message);
    return {
      ok: false,
      claimed: true,
      posted: 0,
      artistId: claimed.artistId,
      artistName: claimed.name,
      status: "failed",
      error: message,
    };
  }
}

export interface SocialStatus {
  configured: boolean;
  enabled: boolean;
  /** Official-poster-only queue filter. Defaults on for new installs. */
  onlyWithPosters: boolean;
  /** Nominees an admin confirmed have an official poster. */
  posterReadyCount: number;
  /** All approved nominees, whether or not they have an official poster. */
  posterTotalCount: number;
  profileId: string | null;
  lastPostAt: number | null;
  nextPostAt: number | null;
  intervalMinutes: number;
  remaining: number;
  accounts: SocialAccountRow[];
  missingPlatforms: SocialPlatform[];
  next: {
    artistId: number;
    name: string;
    categoryName: string;
    imageUrl: string;
    mediaUrl: string;
    caption: string;
    title: string;
  } | null;
  recent: {
    artistId: number;
    artistName: string;
    status: string;
    error: string | null;
    platforms: unknown[];
    zernioPostId: string | null;
    updatedAt: string | null;
  }[];
  error?: string;
  runsOnThisServer: boolean;
}

export async function getSocialStatus(): Promise<SocialStatus> {
  const state = await getSocialAutomationState();
  const intervalMinutes = Math.round(SOCIAL_INTERVAL_MS / 60_000);
  const counts = await posterCounts();
  const base: SocialStatus = {
    configured: zernioConfigured(),
    enabled: state.enabled,
    onlyWithPosters: state.onlyWithPosters,
    posterReadyCount: counts.ready,
    posterTotalCount: counts.total,
    profileId: state.profileId,
    lastPostAt: state.lastPostAt,
    nextPostAt: state.lastPostAt ? state.lastPostAt + SOCIAL_INTERVAL_MS : null,
    intervalMinutes,
    remaining: await remainingPosters(state.onlyWithPosters),
    accounts: [],
    missingPlatforms: [...SOCIAL_PLATFORMS],
    next: null,
    recent: [],
    runsOnThisServer: socialPostingAllowedInThisProcess(),
  };

  const preview = await nextPosterPreview(state.onlyWithPosters);
  if (preview) {
    base.next = {
      artistId: preview.artistId,
      name: preview.name,
      categoryName: preview.categoryName,
      imageUrl: preview.imageUrl,
      mediaUrl: preview.mediaUrl,
      caption: preview.caption.caption,
      title: preview.caption.title,
    };
  }

  try {
    const { rows } = await pool.query<any>(
      `SELECT s.artist_id, a.name AS artist_name, s.status, s.error, s.platforms,
              s.zernio_post_id, s.updated_at
         FROM social_posts s
         LEFT JOIN artists a ON a.id = s.artist_id
        ORDER BY s.updated_at DESC
        LIMIT 8`,
    );
    base.recent = rows.map((row: any) => ({
      artistId: row.artist_id,
      artistName: row.artist_name ?? "Unknown nominee",
      status: row.status,
      error: row.error ?? null,
      platforms: (() => {
        try {
          return typeof row.platforms === "string" ? JSON.parse(row.platforms) : row.platforms ?? [];
        } catch {
          return [];
        }
      })(),
      zernioPostId: row.zernio_post_id ?? null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));
  } catch (err) {
    console.error("[SOCIAL] Could not read recent social posts:", err);
  }

  if (!base.configured) {
    base.error = "Add ZERNIO_API_KEY in Settings → Environment to connect Facebook, TikTok and YouTube.";
    return base;
  }

  try {
    base.accounts = await getSocialAccounts();
    const connected = new Set(base.accounts.map((a) => a.platform));
    base.missingPlatforms = SOCIAL_PLATFORMS.filter((platform) => !connected.has(platform));
    base.profileId = await ensureSocialProfile();
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Could not reach Zernio.";
  }

  return base;
}

let socialTimer: NodeJS.Timeout | null = null;

/**
 * Production only. On boot, and then every five minutes, publish the next poster
 * if the queue is on and 4 hours have passed. Newly approved artists are
 * picked up on the next tick without an admin click.
 */
export function startSocialAutomation(): void {
  if (!socialPostingAllowedInThisProcess()) {
    console.log("[SOCIAL] Preview instance — auto-posting scheduler disabled.");
    return;
  }
  if (socialTimer) return;

  const tick = () => {
    void runSocialQueue()
      .then((result) => {
        if (result.claimed) {
          console.log(
            `[SOCIAL] ${result.status?.toUpperCase() ?? "POSTED"} ${result.artistName ?? ""} ` +
              `(${result.posted} platform${result.posted === 1 ? "" : "s"})`,
          );
        }
      })
      .catch((err) => console.error("[SOCIAL] Automatic queue failed:", err));
  };

  socialTimer = setInterval(tick, 5 * 60_000);
  socialTimer.unref?.();
  setTimeout(tick, 10_000).unref?.();
}
