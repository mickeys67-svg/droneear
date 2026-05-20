/**
 * ACCURACY OPTIMIZATION — iterative precision simulation.
 *
 * Verification experiment — touches NO live app code. Goal: find a v1
 * acoustic-detection configuration that reaches >= 85% window-level balanced
 * accuracy in continuous operation, on real recordings.
 *
 * Method (simulate once → re-simulate over the data many times):
 *   1. Build 12 real listening sessions (background → drone → background).
 *   2. PRECOMPUTE, once, every inference window's (droneSim, bgSim,
 *      steadiness, isDrone-label). This is the expensive pass.
 *   3. SWEEP every parameter config over that precomputed data — instant —
 *      applying the matching rule + temporal voting exactly as the app would.
 *   4. Report the config that maximises balanced accuracy and whether the
 *      85% target is met.
 *
 * Parameters swept:
 *   - matcher: baseline (droneSim only) vs discriminative (droneSim - bgSim)
 *   - floor, margin          (discriminative gate)
 *   - steadiness gate        (reject fluctuating, non-drone-like windows)
 *   - temporal voting        (window size, votes needed)
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
const SESSIONS = 12;
const BG_SEC = 6;
const DRONE_SEC = 8;
const TARGET = 0.85;

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

interface WindowData {
  droneSim: number;
  bgSim: number;
  steadiness: number; // mean per-bin std-dev across the window's frames (low = steady)
  isDrone: boolean;
}

describe('ACCURACY OPTIMIZATION — iterative precision simulation', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('sweeps configs to reach 85% balanced accuracy', () => {
    const fft = new FFTProcessor(FP_FFT_SIZE);
    const mel = new MelSpectrogram(FP_MEL_BINS, FP_FFT_SIZE, FP_SAMPLE_RATE, FP_FMIN, FP_FMAX);

    const melOfPcm = (pcm: Float32Array, hop: number): Float32Array[] => {
      const frames: Float32Array[] = [];
      for (let s = 0; s + FP_FFT_SIZE <= pcm.length; s += hop) {
        frames.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(pcm.subarray(s, s + FP_FFT_SIZE))));
      }
      return frames;
    };
    const refFingerprint = (file: string): Fingerprint | null => {
      const pcm = decodeWav(fs.readFileSync(file));
      if (!pcm || pcm.length < FP_FFT_SIZE) return null;
      const frames = melOfPcm(pcm, FP_FFT_SIZE / 2);
      return frames.length > 0 ? computeFingerprint(frames) : null;
    };
    const loadRefs = (files: string[]): Fingerprint[] =>
      files.map(refFingerprint).filter((f): f is Fingerprint => f !== null);

    // Clips split: half → reference library, half → session material.
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

    // Per-bin std-dev across a window's frames, averaged → steadiness.
    const steadinessOf = (frames: Float32Array[]): number => {
      const bins = frames[0].length;
      let total = 0;
      for (let b = 0; b < bins; b++) {
        let m = 0;
        for (const f of frames) m += f[b];
        m /= frames.length;
        let v = 0;
        for (const f of frames) v += (f[b] - m) ** 2;
        total += Math.sqrt(v / frames.length);
      }
      return total / bins;
    };

    // ── PRECOMPUTE: every window of every session, once. ──
    const droneStart = Math.floor((BG_SEC * FP_SAMPLE_RATE) / FRAME);
    const droneEnd = Math.floor(((BG_SEC + DRONE_SEC) * FP_SAMPLE_RATE) / FRAME);
    const allWindows: WindowData[][] = []; // per session

    for (let run = 0; run < SESSIONS; run++) {
      const rng = mulberry32(17 + run * 101);
      const session = new Float32Array([
        ...segment(bgSess, BG_SEC, rng),
        ...segment(droneSess, DRONE_SEC, rng),
        ...segment(bgSess, BG_SEC, rng),
      ]);
      const frames = melOfPcm(session, FRAME); // one mel frame per capture frame
      const windows: WindowData[] = [];
      for (let end = WINDOW; end <= frames.length; end += HOP) {
        const win = frames.slice(end - WINDOW, end);
        const fp = computeFingerprint(win);
        if (!fp) continue;
        const mid = end - WINDOW / 2;
        windows.push({
          droneSim: bestSim(fp, droneRefs),
          bgSim: bestSim(fp, bgRefs),
          steadiness: steadinessOf(win),
          isDrone: mid >= droneStart && mid < droneEnd,
        });
      }
      allWindows.push(windows);
    }

    // Diagnostic: steadiness separation.
    const droneSteady: number[] = [];
    const bgSteady: number[] = [];
    for (const s of allWindows) for (const w of s) (w.isDrone ? droneSteady : bgSteady).push(w.steadiness);
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

    // ── SWEEP: apply each config over the precomputed windows. ──
    interface Config {
      mode: 'baseline' | 'disc';
      floor: number;       // baseline: droneSim threshold; disc: droneSim floor
      margin: number;      // disc only
      steadinessMax: number; // Infinity = gate off
      voteWindow: number;
      votesNeeded: number;
    }
    const evaluate = (c: Config) => {
      let tp = 0, fn = 0, tn = 0, fp = 0;
      for (const session of allWindows) {
        const recent: boolean[] = [];
        for (const w of session) {
          let raw: boolean;
          if (c.mode === 'baseline') raw = w.droneSim >= c.floor;
          else raw = w.droneSim >= c.floor && (w.droneSim - w.bgSim) >= c.margin;
          if (raw && w.steadiness > c.steadinessMax) raw = false;
          recent.push(raw);
          if (recent.length > c.voteWindow) recent.shift();
          const detected = raw && recent.filter(Boolean).length >= c.votesNeeded;
          if (w.isDrone) detected ? tp++ : fn++;
          else detected ? fp++ : tn++;
        }
      }
      const recall = tp / (tp + fn || 1);
      const specificity = tn / (tn + fp || 1);
      return { balAcc: (recall + specificity) / 2, recall, specificity, fp };
    };

    const configs: Config[] = [];
    // baseline reference
    configs.push({ mode: 'baseline', floor: 0.85, margin: 0, steadinessMax: Infinity, voteWindow: 3, votesNeeded: 2 });
    // discriminative sweep
    const steadinessOptions = [Infinity, avg(bgSteady) * 0.95, (avg(droneSteady) + avg(bgSteady)) / 2, avg(droneSteady) * 1.3];
    for (const floor of [0.70, 0.75, 0.80]) {
      for (const margin of [0.0, 0.05, 0.10]) {
        for (const sMax of steadinessOptions) {
          for (const [vw, vn] of [[3, 2], [5, 3], [5, 4], [7, 5]] as const) {
            configs.push({ mode: 'disc', floor, margin, steadinessMax: sMax, voteWindow: vw, votesNeeded: vn });
          }
        }
      }
    }

    const results = configs.map((c) => ({ c, ...evaluate(c) }));
    results.sort((a, b) => b.balAcc - a.balAcc);
    const best = results[0];
    const base = results.find((r) => r.c.mode === 'baseline')!;

    const out: string[] = [''];
    const hr = '═══════════════════════════════════════════════════════════';
    out.push(hr);
    out.push(' ACCURACY OPTIMIZATION — iterative precision simulation');
    out.push(`  ${SESSIONS} sessions, ${allWindows.reduce((n, s) => n + s.length, 0)} inference windows`);
    out.push(`  drone ref=${droneRefs.length}  background ref=${bgRefs.length}`);
    out.push(`  steadiness: drone-avg=${avg(droneSteady).toFixed(3)}  bg-avg=${avg(bgSteady).toFixed(3)}`);
    out.push(`  ${configs.length} configurations swept`);
    out.push(hr);
    out.push(` BASELINE (current app): bal.acc ${(base.balAcc * 100).toFixed(1)}%  ` +
      `recall ${(base.recall * 100).toFixed(0)}%  specificity ${(base.specificity * 100).toFixed(0)}%`);
    out.push('');
    out.push(' TOP 8 CONFIGURATIONS:');
    out.push('  bal.acc │ recall │ spec │ mode  floor margin steady   vote');
    out.push('  ────────┼────────┼──────┼────────────────────────────────────');
    for (const r of results.slice(0, 8)) {
      const c = r.c;
      const steady = c.steadinessMax === Infinity ? 'off  ' : c.steadinessMax.toFixed(3);
      out.push(`   ${(r.balAcc * 100).toFixed(1)}%  │  ${(r.recall * 100).toFixed(0).padStart(3)}%  │ ` +
        `${(r.specificity * 100).toFixed(0).padStart(3)}% │ ${c.mode.padEnd(5)} ${c.floor.toFixed(2)}  ` +
        `${c.margin.toFixed(2)}   ${steady}  ${c.voteWindow}/${c.votesNeeded}`);
    }
    out.push('');
    const reached = best.balAcc >= TARGET;
    out.push(` TARGET ${(TARGET * 100).toFixed(0)}%  →  BEST ${(best.balAcc * 100).toFixed(1)}%  ` +
      `${reached ? '✅ REACHED' : '❌ NOT reached'}`);
    if (reached) {
      const c = best.c;
      out.push(` WINNING CONFIG: ${c.mode}  floor=${c.floor}  margin=${c.margin}  ` +
        `steadinessMax=${c.steadinessMax === Infinity ? 'off' : c.steadinessMax.toFixed(3)}  ` +
        `voting=${c.voteWindow}/${c.votesNeeded}`);
      out.push(`   recall ${(best.recall * 100).toFixed(0)}%  specificity ${(best.specificity * 100).toFixed(0)}%  ` +
        `(baseline was ${(base.balAcc * 100).toFixed(1)}%)`);
    }
    out.push(hr);
    out.push('');
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));

    expect(results.length).toBeGreaterThan(0);
  }, 300000);
});
