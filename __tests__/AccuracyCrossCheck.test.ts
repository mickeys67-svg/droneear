/**
 * CROSS-CHECK — winning config on held-out data.
 *
 * AccuracyOptimization swept 145 configs and reported 90.3% for the BEST one.
 * Picking the best-of-145 on a fixed set of 12 sessions can overfit to those
 * sessions. This test guards against that: it takes the SINGLE winning config
 * — no sweeping, no selection — and re-measures it on data that did NOT drive
 * the selection:
 *
 *   Check A — 16 fresh sessions built from NEW random seeds (same clip split).
 *   Check B — 16 fresh sessions with the reference / session clip split
 *             SWAPPED, so the reference library is different clips entirely.
 *
 * If balanced accuracy holds near 90% on both, the result is real. A large
 * drop would mean the 90.3% was sweep-overfit and the honest number is lower.
 *
 * Winning config (fixed): discriminative, floor 0.70, margin 0.00,
 * temporal voting 3-of-2. Touches no live app code.
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
const BG_SEC = 6;
const DRONE_SEC = 8;
const SESSIONS = 16;

// Winning config — FIXED. No sweep, no selection.
const CFG = { floor: 0.70, margin: 0.00, voteWindow: 3, votesNeeded: 2 };
const SWEEP_RESULT = 0.903; // what AccuracyOptimization reported for this config

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

describe('CROSS-CHECK — winning config on held-out data', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('re-measures the fixed winning config on fresh sessions', () => {
    const fft = new FFTProcessor(FP_FFT_SIZE);
    const mel = new MelSpectrogram(FP_MEL_BINS, FP_FFT_SIZE, FP_SAMPLE_RATE, FP_FMIN, FP_FMAX);

    const melOf = (pcm: Float32Array, hop: number): Float32Array[] => {
      const frames: Float32Array[] = [];
      for (let s = 0; s + FP_FFT_SIZE <= pcm.length; s += hop) {
        frames.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(pcm.subarray(s, s + FP_FFT_SIZE))));
      }
      return frames;
    };
    const refFp = (file: string): Fingerprint | null => {
      const pcm = decodeWav(fs.readFileSync(file));
      if (!pcm || pcm.length < FP_FFT_SIZE) return null;
      const frames = melOf(pcm, FP_FFT_SIZE / 2);
      return frames.length > 0 ? computeFingerprint(frames) : null;
    };
    const loadRefs = (files: string[]): Fingerprint[] =>
      files.map(refFp).filter((f): f is Fingerprint => f !== null);

    const droneFiles = [...listWavs('yes_drone'), ...listWavs('bebop'), ...listWavs('membo')];
    const bgFiles = listWavs('unknown');

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

    const droneStart = Math.floor((BG_SEC * FP_SAMPLE_RATE) / FRAME);
    const droneEnd = Math.floor(((BG_SEC + DRONE_SEC) * FP_SAMPLE_RATE) / FRAME);

    /** Run the FIXED winning config over freshly-built sessions. */
    const measure = (
      droneRefs: Fingerprint[], bgRefs: Fingerprint[],
      droneSess: string[], bgSess: string[], seedBase: number,
    ) => {
      let tp = 0, fn = 0, tn = 0, fp = 0;
      for (let run = 0; run < SESSIONS; run++) {
        const rng = mulberry32(seedBase + run * 263);
        const session = new Float32Array([
          ...segment(bgSess, BG_SEC, rng),
          ...segment(droneSess, DRONE_SEC, rng),
          ...segment(bgSess, BG_SEC, rng),
        ]);
        const frames = melOf(session, FRAME);
        const recent: boolean[] = [];
        for (let end = WINDOW; end <= frames.length; end += HOP) {
          const win = frames.slice(end - WINDOW, end);
          const fpv = computeFingerprint(win);
          if (!fpv) continue;
          const d = bestSim(fpv, droneRefs);
          const b = bestSim(fpv, bgRefs);
          const raw = d >= CFG.floor && (d - b) >= CFG.margin;
          recent.push(raw);
          if (recent.length > CFG.voteWindow) recent.shift();
          const detected = raw && recent.filter(Boolean).length >= CFG.votesNeeded;
          const mid = end - WINDOW / 2;
          const isDrone = mid >= droneStart && mid < droneEnd;
          if (isDrone) detected ? tp++ : fn++;
          else detected ? fp++ : tn++;
        }
      }
      const recall = tp / (tp + fn || 1);
      const spec = tn / (tn + fp || 1);
      return { balAcc: (recall + spec) / 2, recall, spec };
    };

    // Check A — standard split (refs = even clips), fresh session seeds.
    const aDroneRefs = loadRefs(droneFiles.filter((_, i) => i % 2 === 0));
    const aBgRefs = loadRefs(bgFiles.filter((_, i) => i % 2 === 0));
    const a = measure(
      aDroneRefs, aBgRefs,
      droneFiles.filter((_, i) => i % 2 === 1),
      bgFiles.filter((_, i) => i % 2 === 1),
      900000, // seeds NOT used by the optimization sweep
    );

    // Check B — SWAPPED split (refs = odd clips), fresh session seeds.
    const bDroneRefs = loadRefs(droneFiles.filter((_, i) => i % 2 === 1));
    const bBgRefs = loadRefs(bgFiles.filter((_, i) => i % 2 === 1));
    const b = measure(
      bDroneRefs, bBgRefs,
      droneFiles.filter((_, i) => i % 2 === 0),
      bgFiles.filter((_, i) => i % 2 === 0),
      1700000,
    );

    const out: string[] = [''];
    const hr = '═══════════════════════════════════════════════════════════';
    out.push(hr);
    out.push(' CROSS-CHECK — winning config on held-out data');
    out.push(`  fixed config: discriminative floor=${CFG.floor} margin=${CFG.margin}` +
      ` voting=${CFG.voteWindow}/${CFG.votesNeeded}`);
    out.push(`  ${SESSIONS} fresh sessions per check (seeds unused by the sweep)`);
    out.push(hr);
    out.push(` sweep reported            : ${(SWEEP_RESULT * 100).toFixed(1)}%`);
    out.push('');
    out.push(` Check A (standard split)  : bal.acc ${(a.balAcc * 100).toFixed(1)}%` +
      `   recall ${(a.recall * 100).toFixed(0)}%  specificity ${(a.spec * 100).toFixed(0)}%`);
    out.push(` Check B (swapped split)   : bal.acc ${(b.balAcc * 100).toFixed(1)}%` +
      `   recall ${(b.recall * 100).toFixed(0)}%  specificity ${(b.spec * 100).toFixed(0)}%`);
    out.push('');
    const mean = (a.balAcc + b.balAcc) / 2;
    const drop = SWEEP_RESULT - mean;
    out.push(` held-out mean             : ${(mean * 100).toFixed(1)}%   ` +
      `(${drop >= 0 ? '−' : '+'}${Math.abs(drop * 100).toFixed(1)} pts vs sweep)`);
    out.push('');
    out.push(' VERDICT:');
    if (mean >= 0.85 && Math.abs(drop) <= 0.05) {
      out.push('   ✅ CONFIRMED — holds on held-out data, target 85% met. Not overfit.');
    } else if (mean >= 0.85) {
      out.push('   ✅ target 85% met on held-out data, though the sweep number was');
      out.push('      slightly optimistic — use the held-out figure as the honest one.');
    } else {
      out.push('   ⚠️ held-out accuracy is below 85% — the sweep result was overfit;');
      out.push('      do NOT implement on the sweep number. Re-tune on more data.');
    }
    out.push(hr);
    out.push('');
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));

    expect(a.balAcc).toBeGreaterThan(0);
    expect(b.balAcc).toBeGreaterThan(0);
  }, 300000);
});
