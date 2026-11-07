import test from "node:test";
import assert from "node:assert/strict";
import { createGospelWav, GOSPEL_AUDIO_DURATION_SECONDS } from "../server/gospel-audio";

test("the YouTube soundtrack is a real stereo WAV, not silence", () => {
  const wav = createGospelWav();
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(20), 1, "PCM format");
  assert.equal(wav.readUInt16LE(22), 2, "stereo");
  assert.equal(wav.readUInt32LE(24), 44_100);
  assert.equal(wav.readUInt32LE(40) / (44_100 * 4), GOSPEL_AUDIO_DURATION_SECONDS);

  let peak = 0;
  let energy = 0;
  let samples = 0;
  for (let i = 44; i < wav.length; i += 2) {
    const sample = wav.readInt16LE(i) / 32_768;
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
    samples += 1;
  }
  assert.ok(peak > 0.5 && peak <= 1, "the soundtrack must be audible but not clipped");
  assert.ok(Math.sqrt(energy / samples) > 0.05, "the soundtrack must not be silent");
});
