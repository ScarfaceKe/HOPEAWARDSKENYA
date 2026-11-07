// ─── YouTube poster video ───────────────────────────────────────────────────
// YouTube has no "image post" API: an upload must be a video. This module turns
// the nominee's finished poster into a 20-second vertical video (1080x1920)
// with the synthesized gospel instrumental from gospel-audio.ts. Facebook and
// TikTok keep their normal still-poster path.
//
// ffmpeg is bundled through @ffmpeg-installer/ffmpeg, which ships a static
// binary in npm optional dependencies. Do not replace it with a shell command:
// the production host does not guarantee a system ffmpeg.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { createGospelWav, GOSPEL_AUDIO_DURATION_SECONDS } from "./gospel-audio";

const execFileAsync = promisify(execFile);
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export interface PosterVideoOptions {
  /** Public HTTPS poster URL. */
  imageUrl?: string;
  /** Local file used by tests; production passes imageUrl. */
  imagePath?: string;
  artistId: number;
  durationSeconds?: number;
}

export function posterVideoFileName(artistId: number): string {
  return `hope-awards-poster-${Math.trunc(artistId)}.mp4`;
}

async function loadPoster(options: PosterVideoOptions): Promise<Buffer> {
  if (options.imagePath) return readFile(options.imagePath);

  if (!options.imageUrl) throw new Error("The poster image URL is missing.");
  if (!/^https:\/\//i.test(options.imageUrl)) {
    throw new Error("The YouTube poster image must use a public HTTPS URL.");
  }

  const response = await fetch(options.imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Could not download the poster for YouTube (HTTP ${response.status}).`);
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_IMAGE_BYTES) {
    throw new Error("The poster is too large to turn into a YouTube video (max 15 MB).");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error("The poster image is empty.");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("The poster is too large to turn into a YouTube video (max 15 MB).");
  }
  return buffer;
}

function ffmpegError(error: unknown): Error {
  const detail = (error as { stderr?: string }).stderr?.trim();
  const message = error instanceof Error ? error.message : String(error);
  return new Error(detail ? `${message}: ${detail.slice(-700)}` : message);
}

/**
 * Renders the poster to an H.264/AAC MP4. The poster is centred over a blurred,
 * darkened copy of itself, so portrait and square uploads both fill 9:16
 * without stretching. The file is returned as a Buffer and uploaded to Zernio
 * by the caller; no video is kept on the host's ephemeral disk after this.
 */
export async function buildPosterVideo(options: PosterVideoOptions): Promise<Buffer> {
  const duration = Math.max(2, Math.min(60, options.durationSeconds ?? GOSPEL_AUDIO_DURATION_SECONDS));
  const workDir = await mkdtemp(join(tmpdir(), "hope-awards-video-"));

  try {
    const poster = await loadPoster(options);
    const posterPath = join(workDir, "poster.jpg");
    const audioPath = join(workDir, "gospel.wav");
    const outputPath = join(workDir, "poster.mp4");
    await writeFile(posterPath, poster);
    await writeFile(audioPath, createGospelWav(duration));

    const fadeOutAt = Math.max(0, duration - 0.9).toFixed(2);
    const filter = [
      `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,`,
      `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},`,
      "gblur=sigma=30,eq=brightness=-0.16:saturation=1.05[bg];",
      `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease[fg];`,
      "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,",
      "format=yuv420p,",
      // Do not fade in from black: YouTube often uses the first frame as the
      // automatic thumbnail, and the first frame should be the poster itself.
      `fade=t=out:st=${fadeOutAt}:d=0.9[v]`,
    ].join("");

    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-loop",
      "1",
      "-framerate",
      "30",
      "-i",
      posterPath,
      "-i",
      audioPath,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "1:a:0",
      "-t",
      String(duration),
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-profile:v",
      "high",
      "-level",
      "4.0",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      String(44_100),
      "-ac",
      "2",
      "-af",
      `afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutAt}:d=0.9`,
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    try {
      await execFileAsync(ffmpegInstaller.path, args, {
        timeout: 120_000,
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (error) {
      throw ffmpegError(error);
    }

    const rendered = await readFile(outputPath);
    if (rendered.length < 100_000) {
      throw new Error("ffmpeg produced an empty poster video.");
    }
    return rendered;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
