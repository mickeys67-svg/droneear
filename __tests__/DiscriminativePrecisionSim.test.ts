/**
 * PRECISION SIMULATION — discriminative matching, end-to-end.
 *
 * Verification experiment — touches NO live app code. It replicates the
 * AudioClassifier pipeline exactly (1024-sample frames → 16-frame sliding
 * window → fingerprint → match → 2-of-3 temporal voting) and runs continuous
 * listening sessions through it, comparing TWO matchers on the IDENTICAL
 * sessions:
 *
 *   BASELINE       : matched if  droneSim >= 0.85          (current app)
 *   DISCRIMINATIVE : matched if  droneSim >= 0.70  AND
 *                                droneSim - bgSim >= 0.05  (lever 1, proposed)
 *
 * 8 randomized sessions (background → drone → background). Per session and
 * matcher we measure: drone detected, detection latency, background false
 * alarms. This precisely predicts how the app would behave WITH lever 1,
 * before any core change is made.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FFTProcessor } from '../src/core/audio/FFTProcessor';
import { MelSpectrogram } from '../src/core/audio/MelSpectrogram';
import { computeFingerprint, similarity, type Fingerprint } from '../src/core/ml/AcousticFingerprint';
import { FP_SAMPLE_RATE, FP_FFT_SIZE, FP_MEL_BINS, FP_FMIN, FP_FMAX } from '../src/core/ml/fingerprintConfig';

const AUDIO_ROOT = path.join(__dirname, '..', '..', 'audio-samples');
const FRAME = FP_FFT_SIZE;       // 1024-sample capture frame
const WINDOW = 16;               // AudioClassifier windowSizeFrames
const HOP = 8;                   // AudioClassifier hopSizeFrames
const VOTE_WINDOW = 3;           // temporalVotingWindow
const VOTES_NEEDED = 2;          // ceil(3 * 0.6)
const RUNS = 8;
const BG_SEC = 6;
const DRONE_SEC = 8;

// lever-1 parameters (from the cross-check experiment)
const BASELINE_THR = 0.85;
const DISC_FLOOR = 0.70;
const DISC_MARGIN = 0.05;

function decodeWav(buf: Buffer): Float32Array | null {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  let off = 12;
  let dataStart = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') { dataStart = off + 8; dataLen = size; break; }
    off += 8 + size + (size % 2);
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
function bestSim(fp: Fingerprint, refs: Fingerprint[]): number {
  let best = 0;
  for (const r of refs) { const s = similarity(fp, r); if (s > best) best = s; }
  return best;
}

describe('PRECISION SIMULATION — discriminative matching end-to-end', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('compares baseline vs discriminative over 8 sessions', () => {
    const fft = new FFTProcessor(FP_FFT_SIZE);
    const mel = new MelSpectrogram(FP_MEL_BINS, FP_FFT_SIZE, FP_SAMPLE_RATE, FP_FMIN, FP_FMAX);

    const fingerprintOfPcm = (pcm: Float32Array): Fingerprint | null => {
      const frames: Float32Array[] = [];
      for (let s = 0; s + FP_FFT_SIZE <= pcm.length; s += FP_FFT_SIZE / 2) {
        frames.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(pcm.subarray(s, s + FP_FFT_SIZE))));
      }
      return frames.length > 0 ? computeFingerprint(frames) : null;
    };
    const loadFps = (files: string[]): Fingerprint[] =>
      files.map((f) => {
        const pcm = decodeWav(fs.readFileSync(f));
        return pcm && pcm.length >= FP_FFT_SIZE ? fingerprintOfPcm(pcm) : null;
      }).filter((f): f is Fingerprint => f !== null);

    // Split clips: first half → reference library, second half → session material.
    const droneFiles = [...listWavs('yes_drone'), ...listWavs('bebop'), ...listWavs('membo')];
    const bgFiles = listWavs('unknown');
    const droneRefFiles = droneFiles.filter((_, i) => i % 2 === 0);
    const droneSessFiles = droneFiles.filter((_, i) => i % 2 === 1);
    const bgRefFiles = bgFiles.filter((_, i) => i % 2 === 0);
    const bgSessFiles = bgFiles.filter((_, i) => i % 2 === 1);

    const droneRefs = loadFps(droneRefFiles);
    const bgRefs = loadFps(bgRefFiles);

    // Build a session segment by concatenating random clips from a file pool.
    const segment = (pool: string[], seconds: number, rng: () => number): Float32Array => {
      const target = seconds * FP_SAMPLE_RATE;
      const out = new Float32Array(target);
      let pos = 0;
      while (pos < target) {
        const pcm = decodeWav(fs.readFileSync(pool[Math.floor(rng() * pool.length)]));
        if (!pcm) continue;
        const n = Math.min(pcm.length, target - pos);
        out.set(pcm.subarray(0, n), pos);
        pos += n;
      }
      return out;
    };

    type Matcher = (fp: Fingerprint) => boolean;
    const baseline: Matcher = (fp) => bestSim(fp, droneRefs) >= BASELINE_THR;
    const discriminative: Matcher = (fp) => {
      const d = bestSim(fp, droneRefs);
      const b = bestSim(fp, bgRefs);
      return d >= DISC_FLOOR && (d - b) >= DISC_MARGIN;
    };

    // Replicate AudioClassifier: per-frame mel accumulation, 16-frame window
    // every HOP frames, 2-of-3 temporal voting. Returns detection frame idxs.
    const runSession = (session: Float32Array, match: Matcher): number[] => {
      const melBuffer: Float32Array[] = [];
      const recent: boolean[] = [];
      const detections: number[] = [];
      let frameIdx = 0;
      for (let s = 0; s + FRAME <= session.length; s += FRAME) {
        melBuffer.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(session.subarray(s, s + FRAME))));
        if (melBuffer.length >= WINDOW) {
          const fp = computeFingerprint(melBuffer.slice(-WINDOW));
          const matched = fp ? match(fp) : false;
          recent.push(matched);
          if (recent.length > VOTE_WINDOW) recent.shift();
          melBuffer.splice(0, HOP);
          if (matched && recent.filter(Boolean).length >= VOTES_NEEDED) detections.push(frameIdx);
        }
        frameIdx++;
      }
      return detections;
    };

    const droneStart = Math.floor((BG_SEC * FP_SAMPLE_RATE) / FRAME);
    const droneEnd = Math.floor(((BG_SEC + DRONE_SEC) * FP_SAMPLE_RATE) / FRAME);

    const stats = {
      baseline: { detected: 0, latency: [] as number[], falseAlarms: 0, clean: 0 },
      disc: { detected: 0, latency: [] as number[], falseAlarms: 0, clean: 0 },
    };

    const out: string[] = [''];
    const hr = '═══════════════════════════════════════════════════════════';
    out.push(hr);
    out.push(' PRECISION SIMULATION — baseline vs discriminative (8 sessions)');
    out.push(`  session: ${BG_SEC}s background → ${DRONE_SEC}s drone → ${BG_SEC}s background`);
    out.push(`  drone ref=${droneRefs.length}  background ref=${bgRefs.length}`);
    out.push(hr);
    out.push(' run │ baseline (det/lat/false) │ discriminative (det/lat/false)');
    out.push(' ────┼──────────────────────────┼───────────────────────────────');

    for (let run = 0; run < RUNS; run++) {
      const rng = mulberry32(91 + run * 131);
      const session = new Float32Array([
        ...segment(bgSessFiles, BG_SEC, rng),
        ...segment(droneSessFiles, DRONE_SEC, rng),
        ...segment(bgSessFiles, BG_SEC, rng),
      ]);

      const cells: string[] = [];
      for (const [key, match] of [['baseline', baseline], ['disc', discriminative]] as const) {
        const dets = runSession(session, match);
        const inDrone = dets.filter((f) => f >= droneStart && f < droneEnd);
        const inBg = dets.filter((f) => f < droneStart || f >= droneEnd);
        const s = stats[key];
        if (inDrone.length > 0) {
          s.detected++;
          s.latency.push(Math.max(0, ((inDrone[0] - droneStart) * FRAME) / FP_SAMPLE_RATE));
        }
        s.falseAlarms += inBg.length;
        if (inBg.length === 0) s.clean++;
        const lat = inDrone.length > 0 ? `${(((inDrone[0] - droneStart) * FRAME) / FP_SAMPLE_RATE).toFixed(1)}s` : ' — ';
        cells.push(`${inDrone.length > 0 ? '✓' : '✗'} ${lat.padStart(5)} ${String(inBg.length).padStart(2)}fa`);
      }
      out.push(`  ${String(run + 1).padStart(2)} │   ${cells[0].padEnd(22)} │   ${cells[1]}`);
    }

    const summary = (key: 'baseline' | 'disc') => {
      const s = stats[key];
      const lat = s.latency.length ? (s.latency.reduce((a, b) => a + b, 0) / s.latency.length).toFixed(1) : '—';
      return `detected ${s.detected}/${RUNS}  mean-latency ${lat}s  ` +
        `total-false-alarms ${s.falseAlarms}  clean ${s.clean}/${RUNS}`;
    };
    out.push('');
    out.push(` BASELINE       : ${summary('baseline')}`);
    out.push(` DISCRIMINATIVE : ${summary('disc')}`);
    out.push('');
    out.push(` → false alarms ${stats.baseline.falseAlarms} → ${stats.disc.falseAlarms}` +
      `   clean sessions ${stats.baseline.clean}/${RUNS} → ${stats.disc.clean}/${RUNS}`);
    out.push(hr);
    out.push('');
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));

    expect(droneRefs.length).toBeGreaterThan(0);
    expect(bgRefs.length).toBeGreaterThan(0);
  }, 300000);
});
