import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { buildPosterVideo } from "../server/poster-video";

test("a poster becomes a playable MP4 for YouTube", async () => {
  const video = await buildPosterVideo({
    imagePath: join(process.cwd(), "client/public/images/logo.png"),
    artistId: 42,
    durationSeconds: 2,
  });

  // MP4 starts with a size field, then the ISO base media file-type box.
  assert.equal(video.subarray(4, 8).toString("ascii"), "ftyp");
  assert.ok(video.length > 50_000, "the video should contain a real poster frame and audio");

  // A playable YouTube upload needs both a video and an audio track. Checking
  // the sample-entry atoms catches an accidental video-only render without
  // requiring a second ffprobe binary in the test environment.
  const atoms = video.toString("latin1");
  assert.match(atoms, /avc1/, "the MP4 should carry an H.264 video track");
  assert.match(atoms, /mp4a/, "the MP4 should carry the AAC gospel soundtrack");
});
