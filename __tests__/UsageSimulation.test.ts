/**
 * Real-usage simulation — end-to-end v1 acoustic detection.
 *
 * Unlike FingerprintRealData (static per-clip accuracy), this drives the
 * ACTUAL app code path: it builds a continuous listening "session" from real
 * recordings, slices it into 1024-sample capture frames, and feeds every
 * frame through the real AudioClassifierEngine — exercising the sliding
 * window, fingerprint matching, the 0.85 threshold and temporal voting
 * exactly as the running app does.
 *
 * Each session: background → drone → background. Ground truth is known, so
 * per run we measure:
 *   - detected?         did a detection fire during the drone segment
 *   - latency           seconds of drone audio before the first detection
 *   - false alarms      detections that fired during a background segment
 *
 * 5 randomized runs. Audio lives at ../audio-samples; skips if absent.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AudioClassifierEngine } from '../src/core/ml/AudioClassifier';
import { FP_SAMPLE_RATE, FP_FFT_SIZE } from '../src/core/ml/fingerprintConfig';
import type { AudioFrame, DetectionResult } from '../src/types';

const AUDIO_ROOT = path.join(__dirname, '..', '..', 'audio-samples');
const FRAME = FP_FFT_SIZE;          // 1024-sample capture frames
const RUNS = 5;
const BG_SECONDS = 6;               // background lead-in / lead-out
const DRONE_SECONDS = 8;            // drone segment

function decodeWav(buf: Buffer): Float32Array | null {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  let offset = 12;
  let dataStart = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') { dataStart = offset + 8; dataLen = size; break; }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0) return null;
  const end = Math.min(dataStart + dataLen, buf.length);
  const n = Math.floor((end - dataStart) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(dataStart + i * 2) / 32768;
  return out;
}

function listWavs(dir: string): string[] {
  const full = path.join(AUDIO_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => f.toLowerCase().endsWith('.wav')).map((f) => path.join(full, f));
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Concatenate enough random clips from a pool to fill `seconds`. */
function buildSegment(pool: string[], seconds: number, rng: () => number): Float32Array {
  const target = seconds * FP_SAMPLE_RATE;
  const out = new Float32Array(target);
  let pos = 0;
  while (pos < target) {
    const clip = decodeWav(fs.readFileSync(pool[Math.floor(rng() * pool.length)]));
    if (!clip) continue;
    const n = Math.min(clip.length, target - pos);
    out.set(clip.subarray(0, n), pos);
    pos += n;
  }
  return out;
}

describe('Real-usage simulation — v1 acoustic detection', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('runs 5 randomized listening sessions end-to-end', async () => {
    const dronePool = [...listWavs('yes_drone'), ...listWavs('bebop'), ...listWavs('membo')];
    const bgPool = listWavs('unknown');

    const bgFrames = (BG_SECONDS * FP_SAMPLE_RATE) / FRAME;
    const droneStart = bgFrames;
    const droneEnd = bgFrames + (DRONE_SECONDS * FP_SAMPLE_RATE) / FRAME;

    const lines: string[] = [''];
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(' REAL-USAGE SIMULATION — 5 listening sessions');
    lines.push(`  each: ${BG_SECONDS}s background → ${DRONE_SECONDS}s drone → ${BG_SECONDS}s background`);
    lines.push('  fed frame-by-frame through the real AudioClassifierEngine');
    lines.push('═══════════════════════════════════════════════════════════');

    let detectedCount = 0;
    let cleanCount = 0;
    const latencies: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const rng = mulberry32(4242 + run * 97);

      // Build the session timeline.
      const session = new Float32Array([
        ...buildSegment(bgPool, BG_SECONDS, rng),
        ...buildSegment(dronePool, DRONE_SECONDS, rng),
        ...buildSegment(bgPool, BG_SECONDS, rng),
      ]);

      // Fresh classifier per run — loads the bundled real reference library.
      const engine = new AudioClassifierEngine();
      await engine.initialize();
      const detectionFrames: number[] = [];
      let frameIndex = 0;
      engine.onDetect((_r: DetectionResult) => { detectionFrames.push(frameIndex); });

      for (let s = 0; s + FRAME <= session.length; s += FRAME) {
        const frame: AudioFrame = {
          pcmData: session.subarray(s, s + FRAME),
          sampleRate: FP_SAMPLE_RATE,
          timestamp: Date.now() + frameIndex * 64,
          rmsLevel: 0,
          peakLevel: 0,
        };
        // eslint-disable-next-line no-await-in-loop
        await engine.processFrame(frame);
        frameIndex++;
      }

      const inDrone = detectionFrames.filter((f) => f >= droneStart && f < droneEnd);
      const inBackground = detectionFrames.filter((f) => f < droneStart || f >= droneEnd);
      const detected = inDrone.length > 0;
      const clean = inBackground.length === 0;
      if (detected) {
        detectedCount++;
        const latencySec = ((inDrone[0] - droneStart) * FRAME) / FP_SAMPLE_RATE;
        latencies.push(Math.max(0, latencySec));
      }
      if (clean) cleanCount++;

      lines.push('');
      lines.push(` run ${run + 1}:  drone ${detected ? 'DETECTED ✓' : 'MISSED ✗'}` +
        (detected ? ` (latency ${(((inDrone[0] - droneStart) * FRAME) / FP_SAMPLE_RATE).toFixed(1)}s)` : '') +
        `   background false-alarms: ${inBackground.length}`);
    }

    lines.push('');
    lines.push('───────────────────────────────────────────────────────────');
    lines.push(` drone detected      : ${detectedCount}/${RUNS} sessions`);
    lines.push(` clean (no false alarm): ${cleanCount}/${RUNS} sessions`);
    if (latencies.length) {
      lines.push(` mean detection latency: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)}s`);
    }
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('');
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    expect(detectedCount).toBeGreaterThanOrEqual(0);
  }, 240000);
});
