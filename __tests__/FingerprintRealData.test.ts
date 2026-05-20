/**
 * Fingerprint matching — REAL DATA simulation.
 *
 * Runs the v1 acoustic fingerprint matcher against REAL drone recordings
 * from the public DroneAudioDataset (Sara Al-Emadi):
 *   - yes_drone : 222 mixed multirotor clips
 *   - bebop     : 111 Parrot Bebop clips
 *   - membo     : 111 Membo clips
 *   - unknown   : 208 ESC-50 / Speech non-drone clips
 *
 * Three simulations:
 *   A. STANDARD       — drone clips split 50/50 (reference / test); measures
 *                       overall recall + false-positive across a threshold sweep.
 *   B. CROSS-TYPE     — references built from yes_drone ONLY, then tested on
 *                       Bebop + Membo (drone types ABSENT from the reference
 *                       library). Answers: does a fingerprint generalise to an
 *                       unseen drone model? (critical for real-world coverage)
 *   C. PER-SOURCE     — recall per drone source at the calibrated 0.85 threshold.
 *
 * Audio lives outside the repo at ../audio-samples; the test skips cleanly
 * if absent.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FFTProcessor } from '../src/core/audio/FFTProcessor';
import { MelSpectrogram } from '../src/core/audio/MelSpectrogram';
import { computeFingerprint, similarity, type Fingerprint } from '../src/core/ml/AcousticFingerprint';

const AUDIO_ROOT = path.join(__dirname, '..', '..', 'audio-samples');
const SR = 16000;
const FFT_SIZE = 1024;
const HOP = 512;
const MEL_BINS = 64;
const V1_THRESHOLD = 0.85;

function decodeWav(buf: Buffer): Float32Array | null {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let offset = 12;
  let bitsPerSample = 16;
  let dataStart = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') bitsPerSample = buf.readUInt16LE(offset + 8 + 14);
    else if (id === 'data') { dataStart = offset + 8; dataLen = size; break; }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0 || bitsPerSample !== 16) return null;
  const end = Math.min(dataStart + dataLen, buf.length);
  const n = Math.floor((end - dataStart) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(dataStart + i * 2) / 32768;
  return out;
}

function listWavs(dir: string): string[] {
  const full = path.join(AUDIO_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter((f) => f.toLowerCase().endsWith('.wav'))
    .map((f) => path.join(full, f));
}

/** Best similarity of a fingerprint against a reference library. */
function bestSim(fp: Fingerprint, refs: Fingerprint[]): number {
  let best = 0;
  for (const ref of refs) {
    const s = similarity(fp, ref);
    if (s > best) best = s;
  }
  return best;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const recallAt = (scores: number[], thr: number) =>
  scores.length ? scores.filter((s) => s >= thr).length / scores.length : 0;

describe('Fingerprint matching — real DroneAudioDataset simulation', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('runs 3 matching simulations on real audio', () => {
    const fft = new FFTProcessor(FFT_SIZE);
    const mel = new MelSpectrogram(MEL_BINS, FFT_SIZE, SR, 125, 8000);

    const fingerprintOf = (file: string): Fingerprint | null => {
      const pcm = decodeWav(fs.readFileSync(file));
      if (!pcm || pcm.length < FFT_SIZE) return null;
      const frames: Float32Array[] = [];
      for (let s = 0; s + FFT_SIZE <= pcm.length; s += HOP) {
        frames.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(pcm.subarray(s, s + FFT_SIZE))));
      }
      return frames.length > 0 ? computeFingerprint(frames) : null;
    };
    const loadGroup = (dir: string): Fingerprint[] =>
      listWavs(dir).map(fingerprintOf).filter((f): f is Fingerprint => f !== null);

    // Compute every fingerprint once.
    const yesDrone = loadGroup('yes_drone');
    const bebop = loadGroup('bebop');
    const membo = loadGroup('membo');
    const nonDrone = loadGroup('unknown');

    const out: string[] = [''];
    const hr = '═══════════════════════════════════════════════════════════';
    out.push(hr);
    out.push(' FINGERPRINT MATCHING — REAL AUDIO SIMULATION');
    out.push(`  yes_drone=${yesDrone.length}  bebop=${bebop.length}  membo=${membo.length}  non-drone=${nonDrone.length}`);
    out.push(hr);

    // ── Simulation A — STANDARD (drone 50/50 split) ──
    const allDrone = [...yesDrone, ...bebop, ...membo];
    const refA: Fingerprint[] = [];
    const droneTestA: Fingerprint[] = [];
    allDrone.forEach((fp, i) => (i % 2 === 0 ? refA : droneTestA).push(fp));
    const droneScoresA = droneTestA.map((fp) => bestSim(fp, refA));
    const nonScoresA = nonDrone.map((fp) => bestSim(fp, refA));

    out.push('');
    out.push(' [A] STANDARD — mixed drone references, threshold sweep');
    out.push(`     ref=${refA.length}  drone-test=${droneTestA.length}  non-drone=${nonDrone.length}`);
    out.push(`     mean similarity: drone=${mean(droneScoresA).toFixed(3)}  non-drone=${mean(nonScoresA).toFixed(3)}`);
    out.push('     thr   recall   false-pos   bal.acc');
    let bestAcc = 0, bestThr = 0;
    for (const thr of [0.65, 0.75, 0.80, 0.85, 0.90]) {
      const r = recallAt(droneScoresA, thr);
      const fp = recallAt(nonScoresA, thr);
      const acc = (r + (1 - fp)) / 2;
      if (acc > bestAcc) { bestAcc = acc; bestThr = thr; }
      out.push(`     ${thr.toFixed(2)}   ${(r * 100).toFixed(0).padStart(3)}%     ${(fp * 100).toFixed(0).padStart(3)}%       ${(acc * 100).toFixed(0)}%`);
    }
    out.push(`     → best balanced accuracy ${(bestAcc * 100).toFixed(0)}% @ ${bestThr.toFixed(2)}`);

    // ── Simulation B — CROSS-TYPE generalization ──
    // References = yes_drone only. Test = Bebop + Membo (UNSEEN drone models).
    const droneTestB = [...bebop, ...membo];
    const crossScores = droneTestB.map((fp) => bestSim(fp, yesDrone));
    const nonScoresB = nonDrone.map((fp) => bestSim(fp, yesDrone));
    out.push('');
    out.push(' [B] CROSS-TYPE — ref = yes_drone only; test = UNSEEN Bebop+Membo');
    out.push(`     mean similarity: unseen-drone=${mean(crossScores).toFixed(3)}  non-drone=${mean(nonScoresB).toFixed(3)}`);
    out.push(`     recall on unseen drone types @0.85 = ${(recallAt(crossScores, V1_THRESHOLD) * 100).toFixed(0)}%`);
    out.push(`     false-positive @0.85               = ${(recallAt(nonScoresB, V1_THRESHOLD) * 100).toFixed(0)}%`);

    // ── Simulation C — PER-SOURCE recall @0.85 (mixed reference set A) ──
    out.push('');
    out.push(' [C] PER-SOURCE recall @0.85 (mixed reference library)');
    for (const [name, group] of [['yes_drone', yesDrone], ['bebop', bebop], ['membo', membo]] as const) {
      // exclude clips that are in refA to keep it a fair test
      const test = group.filter((_, i) => {
        const globalIdx = allDrone.indexOf(group[i]);
        return globalIdx % 2 !== 0;
      });
      const r = recallAt(test.map((fp) => bestSim(fp, refA)), V1_THRESHOLD);
      out.push(`     ${name.padEnd(10)} recall = ${(r * 100).toFixed(0)}%  (${test.length} clips)`);
    }

    out.push('');
    out.push(hr);
    out.push('');
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));

    expect(allDrone.length).toBeGreaterThan(0);
    expect(nonDrone.length).toBeGreaterThan(0);
  }, 180000);
});
