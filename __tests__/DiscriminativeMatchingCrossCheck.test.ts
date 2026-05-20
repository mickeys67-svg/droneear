/**
 * CROSS-CHECK — discriminative matching (accuracy lever 1).
 *
 * This is a verification experiment, NOT an app change. It touches no live
 * code: it only imports the existing computeFingerprint/similarity helpers
 * and measures, on the real DroneAudioDataset clips, whether adding a
 * BACKGROUND reference set genuinely reduces false positives.
 *
 *   Baseline      : detect if  best drone-similarity >= 0.85
 *   Discriminative: detect if  droneSim >= floor  AND  droneSim - bgSim >= margin
 *                   (bgSim = best similarity against background references)
 *
 * If the measured numbers confirm the predicted improvement, THEN the change
 * is worth making in AcousticFingerprint/AudioClassifier — as a separate,
 * reviewed step. If they don't, the idea is dropped. No impromptu edits.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FFTProcessor } from '../src/core/audio/FFTProcessor';
import { MelSpectrogram } from '../src/core/audio/MelSpectrogram';
import { computeFingerprint, similarity, type Fingerprint } from '../src/core/ml/AcousticFingerprint';
import { FP_SAMPLE_RATE, FP_FFT_SIZE, FP_HOP, FP_MEL_BINS, FP_FMIN, FP_FMAX } from '../src/core/ml/fingerprintConfig';

const AUDIO_ROOT = path.join(__dirname, '..', '..', 'audio-samples');
const BASELINE_THRESHOLD = 0.85;

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

function bestSim(fp: Fingerprint, refs: Fingerprint[]): number {
  let best = 0;
  for (const r of refs) {
    const s = similarity(fp, r);
    if (s > best) best = s;
  }
  return best;
}

describe('CROSS-CHECK — discriminative matching (lever 1)', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('measures false-positive reduction from background references', () => {
    const fft = new FFTProcessor(FP_FFT_SIZE);
    const mel = new MelSpectrogram(FP_MEL_BINS, FP_FFT_SIZE, FP_SAMPLE_RATE, FP_FMIN, FP_FMAX);

    const fingerprintOf = (file: string): Fingerprint | null => {
      const pcm = decodeWav(fs.readFileSync(file));
      if (!pcm || pcm.length < FP_FFT_SIZE) return null;
      const frames: Float32Array[] = [];
      for (let s = 0; s + FP_FFT_SIZE <= pcm.length; s += FP_HOP) {
        frames.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(pcm.subarray(s, s + FP_FFT_SIZE))));
      }
      return frames.length > 0 ? computeFingerprint(frames) : null;
    };
    const load = (dir: string): Fingerprint[] =>
      listWavs(dir).map(fingerprintOf).filter((f): f is Fingerprint => f !== null);

    const drone = [...load('yes_drone'), ...load('bebop'), ...load('membo')];
    const nonDrone = load('unknown');

    // Split each class 50/50 → reference half + test half.
    const droneRef: Fingerprint[] = [];
    const droneTest: Fingerprint[] = [];
    drone.forEach((fp, i) => (i % 2 === 0 ? droneRef : droneTest).push(fp));
    const bgRef: Fingerprint[] = [];
    const bgTest: Fingerprint[] = [];
    nonDrone.forEach((fp, i) => (i % 2 === 0 ? bgRef : bgTest).push(fp));

    // Pre-compute drone/bg similarity for every test clip.
    const droneTestScores = droneTest.map((fp) => ({ d: bestSim(fp, droneRef), b: bestSim(fp, bgRef) }));
    const bgTestScores = bgTest.map((fp) => ({ d: bestSim(fp, droneRef), b: bestSim(fp, bgRef) }));

    const out: string[] = [''];
    const hr = '═══════════════════════════════════════════════════════════';
    out.push(hr);
    out.push(' CROSS-CHECK — discriminative matching (lever 1)');
    out.push(`  drone ref=${droneRef.length} test=${droneTest.length}` +
      `   background ref=${bgRef.length} test=${bgTest.length}`);
    out.push(hr);

    // ── Baseline: drone-similarity vs fixed threshold ──
    const baseRecall = droneTestScores.filter((s) => s.d >= BASELINE_THRESHOLD).length / droneTestScores.length;
    const baseFP = bgTestScores.filter((s) => s.d >= BASELINE_THRESHOLD).length / bgTestScores.length;
    out.push('');
    out.push(` BASELINE (droneSim >= ${BASELINE_THRESHOLD})`);
    out.push(`   recall ${(baseRecall * 100).toFixed(0)}%   false-positive ${(baseFP * 100).toFixed(0)}%` +
      `   bal.acc ${(((baseRecall + (1 - baseFP)) / 2) * 100).toFixed(0)}%`);

    // ── Discriminative: droneSim >= floor AND droneSim - bgSim >= margin ──
    out.push('');
    out.push(' DISCRIMINATIVE (droneSim >= floor AND droneSim - bgSim >= margin)');
    out.push('   floor │ margin │ recall │ false-pos │ bal.acc');
    out.push('   ──────┼────────┼────────┼───────────┼────────');
    let best = { acc: 0, floor: 0, margin: 0, recall: 0, fp: 0 };
    for (const floor of [0.70, 0.75, 0.80]) {
      for (const margin of [0.0, 0.05, 0.10, 0.15, 0.20]) {
        const pass = (s: { d: number; b: number }) => s.d >= floor && (s.d - s.b) >= margin;
        const recall = droneTestScores.filter(pass).length / droneTestScores.length;
        const fp = bgTestScores.filter(pass).length / bgTestScores.length;
        const acc = (recall + (1 - fp)) / 2;
        if (acc > best.acc) best = { acc, floor, margin, recall, fp };
        out.push(`   ${floor.toFixed(2)} │  ${margin.toFixed(2)}  │  ${(recall * 100).toFixed(0).padStart(3)}% │` +
          `    ${(fp * 100).toFixed(0).padStart(3)}%   │  ${(acc * 100).toFixed(0)}%`);
      }
    }
    out.push('');
    out.push(` BEST discriminative: floor ${best.floor.toFixed(2)} margin ${best.margin.toFixed(2)}` +
      ` → recall ${(best.recall * 100).toFixed(0)}%  false-pos ${(best.fp * 100).toFixed(0)}%  bal.acc ${(best.acc * 100).toFixed(0)}%`);
    out.push('');
    out.push(' VERDICT:');
    const fpDrop = baseFP - best.fp;
    const accGain = best.acc - (baseRecall + (1 - baseFP)) / 2;
    out.push(`   false-positive ${(baseFP * 100).toFixed(0)}% → ${(best.fp * 100).toFixed(0)}%` +
      `  (${fpDrop >= 0 ? '−' : '+'}${Math.abs(fpDrop * 100).toFixed(0)} pts)`);
    out.push(`   balanced accuracy ${accGain >= 0 ? '+' : ''}${(accGain * 100).toFixed(0)} pts`);
    out.push(`   → lever 1 ${accGain > 0.02 ? 'CONFIRMED — worth implementing' : 'NOT confirmed — drop it'}`);
    out.push(hr);
    out.push('');
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));

    expect(droneTest.length).toBeGreaterThan(0);
    expect(bgTest.length).toBeGreaterThan(0);
  }, 180000);
});
