// ─── Gospel soundtrack for the YouTube poster videos ────────────────────────
// YouTube needs a video file, not a still poster. Every poster video gets a
// short original gospel instrumental: organ-style chords, a pentatonic melody,
// bass and a light backbeat. It is synthesized here instead of shipping a
// recording, so there is no third-party music licence and no Content ID claim.
//
// The arrangement is deliberately simple: eight bars in G at 96 BPM, exactly
// 20 seconds. The poster remains the focus; the music only gives the upload a
// real soundtrack.

export const GOSPEL_AUDIO_SAMPLE_RATE = 44_100;
export const GOSPEL_AUDIO_DURATION_SECONDS = 20;

const TAU = Math.PI * 2;
const BPM = 96;
const BEAT_SECONDS = 60 / BPM;
const BAR_BEATS = 4;

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function noteEnvelope(time: number, duration: number, attack: number, release: number): number {
  if (time < 0 || time >= duration) return 0;
  const attackGain = attack <= 0 ? 1 : Math.min(1, time / attack);
  const releaseGain = release <= 0 ? 1 : Math.min(1, (duration - time) / release);
  return Math.max(0, Math.min(attackGain, releaseGain));
}

function panGains(pan: number): [number, number] {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function addOrgan(
  left: Float32Array,
  right: Float32Array,
  startSeconds: number,
  durationSeconds: number,
  midi: number,
  gain: number,
  pan = 0,
): void {
  const start = Math.max(0, Math.floor(startSeconds * GOSPEL_AUDIO_SAMPLE_RATE));
  const end = Math.min(left.length, Math.floor((startSeconds + durationSeconds) * GOSPEL_AUDIO_SAMPLE_RATE));
  if (end <= start) return;

  const frequency = midiToFrequency(midi);
  const [leftGain, rightGain] = panGains(pan);
  const vibratoRate = 4.7 + (midi % 5) * 0.12;

  for (let i = start; i < end; i++) {
    const time = i / GOSPEL_AUDIO_SAMPLE_RATE - startSeconds;
    const envelope = noteEnvelope(time, durationSeconds, 0.045, 0.28);
    const vibrato = 1 + 0.0022 * Math.sin(TAU * vibratoRate * time + midi);
    const phase = TAU * frequency * time * vibrato;
    // A drawbar-organ shape: strong fundamental, softer octave and quint.
    const wave =
      Math.sin(phase) +
      0.42 * Math.sin(phase * 2.002 + 0.3) +
      0.18 * Math.sin(phase * 3.001 + 0.7) +
      0.08 * Math.sin(phase * 4.004 + 0.2) +
      0.16 * Math.sin(phase * 0.999 + 0.5);
    const sample = wave * envelope * gain;
    left[i] += sample * leftGain;
    right[i] += sample * rightGain;
  }
}

function addBass(
  left: Float32Array,
  right: Float32Array,
  startSeconds: number,
  durationSeconds: number,
  midi: number,
  gain: number,
): void {
  const start = Math.max(0, Math.floor(startSeconds * GOSPEL_AUDIO_SAMPLE_RATE));
  const end = Math.min(left.length, Math.floor((startSeconds + durationSeconds) * GOSPEL_AUDIO_SAMPLE_RATE));
  if (end <= start) return;

  const frequency = midiToFrequency(midi);
  for (let i = start; i < end; i++) {
    const time = i / GOSPEL_AUDIO_SAMPLE_RATE - startSeconds;
    const envelope = noteEnvelope(time, durationSeconds, 0.018, 0.18);
    const phase = TAU * frequency * time;
    const sample = (Math.sin(phase) + 0.28 * Math.sin(phase * 2)) * envelope * gain;
    left[i] += sample;
    right[i] += sample;
  }
}

function addKick(left: Float32Array, right: Float32Array, atSeconds: number): void {
  const start = Math.max(0, Math.floor(atSeconds * GOSPEL_AUDIO_SAMPLE_RATE));
  const end = Math.min(left.length, start + Math.floor(0.22 * GOSPEL_AUDIO_SAMPLE_RATE));
  for (let i = start; i < end; i++) {
    const time = i / GOSPEL_AUDIO_SAMPLE_RATE - atSeconds;
    const decay = Math.exp(-time * 17);
    const phase = TAU * (48 * time + (58 * (1 - Math.exp(-time * 18))) / 18);
    const sample = Math.sin(phase) * decay * 0.13;
    left[i] += sample;
    right[i] += sample;
  }
}

function addSnare(left: Float32Array, right: Float32Array, atSeconds: number, noise: () => number): void {
  const start = Math.max(0, Math.floor(atSeconds * GOSPEL_AUDIO_SAMPLE_RATE));
  const end = Math.min(left.length, start + Math.floor(0.18 * GOSPEL_AUDIO_SAMPLE_RATE));
  for (let i = start; i < end; i++) {
    const time = i / GOSPEL_AUDIO_SAMPLE_RATE - atSeconds;
    const decay = Math.exp(-time * 32);
    const body = Math.sin(TAU * 185 * time) * 0.035;
    const sample = (noise() * 0.075 + body) * decay;
    left[i] += sample;
    right[i] += sample;
  }
}

function addHat(left: Float32Array, right: Float32Array, atSeconds: number, noise: () => number): void {
  const start = Math.max(0, Math.floor(atSeconds * GOSPEL_AUDIO_SAMPLE_RATE));
  const end = Math.min(left.length, start + Math.floor(0.06 * GOSPEL_AUDIO_SAMPLE_RATE));
  let previous = 0;
  for (let i = start; i < end; i++) {
    const time = i / GOSPEL_AUDIO_SAMPLE_RATE - atSeconds;
    const current = noise();
    const highPassed = current - previous * 0.92;
    previous = current;
    const sample = highPassed * Math.exp(-time * 100) * 0.025;
    left[i] += sample * 0.8;
    right[i] += sample;
  }
}

function applyReverb(channel: Float32Array, delaySeconds: number, feedback: number): void {
  const delay = Math.max(1, Math.floor(delaySeconds * GOSPEL_AUDIO_SAMPLE_RATE));
  for (let i = delay; i < channel.length; i++) {
    channel[i] += channel[i - delay] * feedback;
  }
}

function toWav(left: Float32Array, right: Float32Array): Buffer {
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const scale = peak > 0 ? 0.9 / peak : 1;
  const dataSize = left.length * 2 * 2; // stereo, 16-bit
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // stereo
  buffer.writeUInt32LE(GOSPEL_AUDIO_SAMPLE_RATE, 24);
  buffer.writeUInt32LE(GOSPEL_AUDIO_SAMPLE_RATE * 4, 28); // byte rate
  buffer.writeUInt16LE(4, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  for (let i = 0; i < left.length; i++) {
    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.round(clamp(left[i] * scale) * 32_767), offset);
    buffer.writeInt16LE(Math.round(clamp(right[i] * scale) * 32_767), offset + 2);
  }

  return buffer;
}

/**
 * Writes the 20-second instrumental to a stereo 16-bit WAV buffer. ffmpeg reads
 * it as the audio track of the poster video; nothing is read from disk.
 */
export function createGospelWav(durationSeconds = GOSPEL_AUDIO_DURATION_SECONDS): Buffer {
  const samples = Math.max(1, Math.round(Math.max(0.5, durationSeconds) * GOSPEL_AUDIO_SAMPLE_RATE));
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);

  // The four-bar phrases resolve to G, so the loop feels finished without a
  // hard cut. Bass roots and voicings stay in G major / E minor.
  const progression = [
    { bass: 43, notes: [55, 59, 62, 66] }, // Gmaj7
    { bass: 43, notes: [55, 59, 62, 65] }, // G7
    { bass: 48, notes: [48, 55, 60, 64] }, // C
    { bass: 40, notes: [52, 55, 60, 64] }, // C/E
    { bass: 43, notes: [55, 59, 62, 66] }, // Gmaj7
    { bass: 40, notes: [52, 55, 59, 62] }, // Em7
    { bass: 45, notes: [57, 60, 64, 67] }, // Am7
    { bass: 38, notes: [50, 57, 60, 62, 66] }, // D7
  ];

  const totalBeats = samples / GOSPEL_AUDIO_SAMPLE_RATE / BEAT_SECONDS;

  // Pads and bass.
  for (let bar = 0; bar < progression.length; bar++) {
    const chord = progression[bar];
    const barStart = bar * BAR_BEATS * BEAT_SECONDS;
    if (barStart >= durationSeconds) break;

    for (const [index, note] of chord.notes.entries()) {
      addOrgan(left, right, barStart, 2.35, note, 0.026, (index - 1.5) * 0.22);
    }
    addBass(left, right, barStart, 1.05, chord.bass, 0.105);
    addBass(left, right, barStart + 2 * BEAT_SECONDS, 0.92, chord.bass, 0.075);

    // The short off-beat organ comps are what make it read as gospel rather
    // than a sustained hymn pad.
    for (const beat of [1.5, 2.5, 3.5]) {
      const at = barStart + beat * BEAT_SECONDS;
      for (const [index, note] of chord.notes.slice(0, 3).entries()) {
        addOrgan(left, right, at, 0.24, note, 0.014, (index - 1) * 0.28);
      }
    }
  }

  // An original pentatonic melody. It sits above the chords rather than trying
  // to reproduce a copyrighted gospel recording.
  const melody: Array<[number, number, number]> = [
    [0.5, 0.55, 74], [1.25, 0.7, 71], [2.1, 1.15, 67],
    [4.5, 0.55, 74], [5.25, 0.7, 76], [6.1, 1.15, 74],
    [8.5, 0.55, 72], [9.25, 0.7, 71], [10.1, 1.15, 69],
    [12.5, 0.55, 71], [13.25, 0.7, 69], [14.1, 1.15, 67],
    [16.5, 0.55, 74], [17.25, 0.7, 79], [18.1, 1.15, 76],
    [20.5, 0.55, 74], [21.25, 0.7, 71], [22.1, 1.15, 69],
    [24.5, 0.55, 72], [25.25, 0.7, 74], [26.1, 1.15, 76],
    [28.5, 1.25, 74], [30.1, 1.15, 71],
  ];

  for (const [beat, lengthBeats, midi] of melody) {
    const at = beat * BEAT_SECONDS;
    if (at >= durationSeconds) break;
    const duration = Math.min(lengthBeats * BEAT_SECONDS, durationSeconds - at);
    addOrgan(left, right, at, duration, midi, 0.075, 0.12);
    // A quiet third below gives the line a choir-ish weight.
    addOrgan(left, right, at, duration, midi - 3, 0.028, -0.14);
  }

  // A simple, deterministic noise source keeps every render identical.
  let seed = 0x5eed1234;
  const noise = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  // Light gospel backbeat: kick on 1 and 3, snare on 2 and 4, hats on eighths.
  for (let beat = 0; beat < totalBeats; beat += 0.5) {
    const inBar = beat % BAR_BEATS;
    const at = beat * BEAT_SECONDS;
    if (Math.abs(inBar) < 1e-9 || Math.abs(inBar - 2) < 1e-9) {
      addKick(left, right, at);
    }
    if (Math.abs(inBar - 1) < 1e-9 || Math.abs(inBar - 3) < 1e-9) {
      addSnare(left, right, at, noise);
    }
    addHat(left, right, at, noise);
  }

  // A short room sound glues the organ and percussion together.
  applyReverb(left, 0.115, 0.16);
  applyReverb(right, 0.129, 0.15);

  return toWav(left, right);
}
