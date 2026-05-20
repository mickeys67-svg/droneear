/**
 * SUSTAINED-DETECTION TUNING — eliminate acoustic session false alarms.
 *
 * The full-flow simulation showed the acoustic stage false-fires during long
 * background periods: per-window specificity ~93% means a ~18s background
 * session (~64 windows) almost always produces one false match. The fix is a
 * SUSTAINED-DETECTION requirement — a real drone is present for seconds (many
 * matching windows), a false match is momentary (one or two windows).
 *
 * This experiment sweeps the temporal-voting window/threshold on PER-SESSION
 * metrics:
 *   - drone-session detection rate  (a detection fires during the drone segment)
 *   - background-session clean rate (NO detection fires in a pure-background session)
 *
 * Goal: a config with ~100% background-clean while keeping drone detection high.
 * Verification harness — no live app code modified.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FFTProcessor } from '../src/core/audio/FFTProcessor';
import { MelSpectrogram } from '../src/core/audio/MelSpectrogram';
import { computeFingerprint, similarity, type Fingerprint } from '../src/core/ml/AcousticFingerprint';
import { FP_SAMPLE_RATE, FP_FFT_SIZE, FP_MEL_BINS, FP_FMIN, FP_FMAX } from '../src/core/ml/fingerprintConfig';

const AUDIO_ROOT = path.join(__dirname, '..', '..', 'audio-samples');
const FRAME = FP_FFT_SIZE;
const WINDOW = 16;
const HOP = 8;
const N_SESSIONS = 14;
const BG_SEC = 6;
const DRONE_SEC = 8;
const BG_ONLY_SEC = 18;
const FLOOR = 0.70;
const MARGIN = 0.0;

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

describe('SUSTAINED-DETECTION TUNING', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('sweeps voting params on per-session metrics', () => {
    const fft = new FFTProcessor(FP_FFT_SIZE);
    const mel = new MelSpectrogram(FP_MEL_BINS, FP_FFT_SIZE, FP_SAMPLE_RATE, FP_FMIN, FP_FMAX);

    const melOf = (pcm: Float32Array, hop: number): Float32Array[] => {
      const fr: Float32Array[] = [];
      for (let s = 0; s + FP_FFT_SIZE <= pcm.length; s += hop) {
        fr.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(pcm.subarray(s, s + FP_FFT_SIZE))));
      }
      return fr;
    };
    const loadRefs = (files: string[]): Fingerprint[] =>
      files.map((f) => {
        const pcm = decodeWav(fs.readFileSync(f));
        if (!pcm || pcm.length < FP_FFT_SIZE) return null;
        const fr = melOf(pcm, FP_FFT_SIZE / 2);
        return fr.length > 0 ? computeFingerprint(fr) : null;
      }).filter((f): f is Fingerprint => f !== null);

    const droneFiles = [...listWavs('yes_drone'), ...listWavs('bebop'), ...listWavs('membo')];
    const bgFiles = listWavs('unknown');
    const droneRefs = loadRefs(droneFiles.filter((_, i) => i % 2 === 0));
    const bgRefs = loadRefs(bgFiles.filter((_, i) => i % 2 === 0));
    const droneSess = droneFiles.filter((_, i) => i % 2 === 1);
    const bgSess = bgFiles.filter((_, i) => i % 2 === 1);

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

    // Per-window raw discriminative match for one session.
    const rawMatches = (session: Float32Array): boolean[] => {
      const frames = melOf(session, FRAME);
      const res: boolean[] = [];
      for (let end = WINDOW; end <= frames.length; end += HOP) {
        const fp = computeFingerprint(frames.slice(end - WINDOW, end));
        if (!fp) { res.push(false); continue; }
        const d = bestSim(fp, droneRefs);
        const b = bestSim(fp, bgRefs);
        res.push(d >= FLOOR && (d - b) >= MARGIN);
      }
      return res;
    };

    // PRECOMPUTE per-window raw matches once.
    const droneStartW = Math.floor(((BG_SEC * FP_SAMPLE_RATE) / FRAME - WINDOW) / HOP);
    const droneEndW = Math.floor((((BG_SEC + DRONE_SEC) * FP_SAMPLE_RATE) / FRAME - WINDOW) / HOP);
    const droneSessionWindows: boolean[][] = [];
    const bgSessionWindows: boolean[][] = [];
    for (let r = 0; r < N_SESSIONS; r++) {
      const rngD = mulberry32(3100 + r * 71);
      droneSessionWindows.push(rawMatches(new Float32Array([
        ...segment(bgSess, BG_SEC, rngD),
        ...segment(droneSess, DRONE_SEC, rngD),
        ...segment(bgSess, BG_SEC, rngD),
      ])));
      const rngB = mulberry32(8800 + r * 91);
      bgSessionWindows.push(rawMatches(segment(bgSess, BG_ONLY_SEC, rngB)));
    }

    // Apply (W, V) sliding-vote; return window indices where a detection fires.
    const detectIdxs = (raw: boolean[], W: number, V: number): number[] => {
      const recent: boolean[] = [];
      const fired: number[] = [];
      for (let i = 0; i < raw.length; i++) {
        recent.push(raw[i]);
        if (recent.length > W) recent.shift();
        if (recent.filter(Boolean).length >= V) fired.push(i);
      }
      return fired;
    };

    const out: string[] = [''];
    const hr = '═══════════════════════════════════════════════════════════';
    out.push(hr);
    out.push(' SUSTAINED-DETECTION TUNING — per-session metrics');
    out.push(`  ${N_SESSIONS} drone sessions + ${N_SESSIONS} background-only sessions`);
    out.push(hr);
    out.push('  vote(W/V) │ drone-detect │ bg-clean │ mean-latency');
    out.push('  ──────────┼──────────────┼──────────┼─────────────');

    let best = { score: -1, W: 0, V: 0, dd: 0, bc: 0 };
    for (const W of [3, 5, 8, 12, 16, 20]) {
      for (const frac of [0.5, 0.6, 0.7, 0.8, 0.9]) {
        const V = Math.ceil(W * frac);
        let droneDetected = 0;
        let bgClean = 0;
        const lats: number[] = [];
        for (const raw of droneSessionWindows) {
          const fired = detectIdxs(raw, W, V).filter((i) => i >= droneStartW && i <= droneEndW);
          if (fired.length > 0) {
            droneDetected++;
            lats.push(((fired[0] - droneStartW) * HOP * FRAME) / FP_SAMPLE_RATE);
          }
        }
        for (const raw of bgSessionWindows) {
          if (detectIdxs(raw, W, V).length === 0) bgClean++;
        }
        const dd = droneDetected / N_SESSIONS;
        const bc = bgClean / N_SESSIONS;
        // score: prioritise background-clean, then drone-detection
        const score = bc * 2 + dd;
        if (score > best.score) best = { score, W, V, dd, bc };
        const lat = lats.length ? (lats.reduce((a, b) => a + b, 0) / lats.length).toFixed(1) : '—';
        out.push(`   ${String(W).padStart(2)}/${String(V).padStart(2)}   │    ${(dd * 100).toFixed(0).padStart(3)}%      │  ` +
          `${(bc * 100).toFixed(0).padStart(3)}%   │   ${lat}s`);
      }
    }
    out.push('');
    out.push(` BEST: vote ${best.W}/${best.V}  →  drone-detect ${(best.dd * 100).toFixed(0)}%  ` +
      `background-clean ${(best.bc * 100).toFixed(0)}%`);
    out.push(` (current app voting is 3/2 — see its row above for comparison)`);
    out.push(hr);
    out.push('');
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));

    expect(droneSessionWindows.length).toBe(N_SESSIONS);
  }, 300000);
});
