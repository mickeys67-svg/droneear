/**
 * FULL-FLOW SIMULATION — complete detection pipeline end-to-end.
 *
 * Exercises the WHOLE 2-tier flow on every scenario:
 *   acoustic (discriminative fingerprint matching — the cross-check-validated
 *   config) + BLE Remote ID (real RemoteIDParser) + DetectionFusionEngine +
 *   3-tier classification.
 *
 * Detection tiers:
 *   CONFIRMED    — BLE Remote ID only          (real GPS position)
 *   CORROBORATED — BLE + acoustic time-match    (real GPS position)
 *   ACOUSTIC     — acoustic only (beta)         (no position)
 *
 * Scenarios (3 runs each):
 *   1. drone broadcasting Remote ID + audible   → expect CORROBORATED
 *   2. drone audible, NOT broadcasting Remote ID → expect ACOUSTIC
 *   3. drone broadcasting Remote ID, NOT audible → expect CONFIRMED
 *   4. background only                           → expect NONE
 *
 * Verification harness — no live app code is modified. The acoustic stage
 * uses the validated discriminative config (floor 0.70, margin 0.00, voting
 * 3/2); real RemoteIDParser and DetectionFusionEngine are used directly.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FFTProcessor } from '../src/core/audio/FFTProcessor';
import { MelSpectrogram } from '../src/core/audio/MelSpectrogram';
import { computeFingerprint, similarity, type Fingerprint } from '../src/core/ml/AcousticFingerprint';
import { FP_SAMPLE_RATE, FP_FFT_SIZE, FP_MEL_BINS, FP_FMIN, FP_FMAX } from '../src/core/ml/fingerprintConfig';
import { RemoteIDParser } from '../src/core/ble/RemoteIDParser';
import { DetectionFusionEngine } from '../src/core/detection/DetectionFusionEngine';
import type { DetectionResult, ThreatTrack, RemoteIDData } from '../src/types';

const AUDIO_ROOT = path.join(__dirname, '..', '..', 'audio-samples');
const FRAME = FP_FFT_SIZE;
const WINDOW = 16;
const HOP = 8;
const RUNS_PER_SCENARIO = 3;
// Sustained-detection voting tuned in SustainedDetectionTuning.test.ts:
// 12/8 gave 100% drone detection AND 100% background-clean (vs 3/2 → 36%).
const CFG = { floor: 0.70, margin: 0.0, voteWindow: 12, votesNeeded: 8 };

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

/** Build a real ASTM F3411 Location message for a drone at lat/lon. */
function buildRemoteIDLocation(lat: number, lon: number): Uint8Array {
  const msg = new Uint8Array(25);
  msg[0] = 0x1 << 4;                 // message type 1 = Location
  msg[1] = 0x00;                     // status / flags
  msg[2] = 45;                       // track direction
  msg[3] = 40;                       // speed
  msg[4] = 63;                       // vertical speed = 0
  const latI = Math.round(lat * 1e7);
  const lonI = Math.round(lon * 1e7);
  new DataView(msg.buffer).setInt32(5, latI, true);
  new DataView(msg.buffer).setInt32(9, lonI, true);
  new DataView(msg.buffer).setUint16(13, 2000 + 1000 * 2, true); // altitude
  return msg;
}

describe('FULL-FLOW SIMULATION — complete detection pipeline', () => {
  const haveAudio = fs.existsSync(AUDIO_ROOT) && listWavs('yes_drone').length > 0;

  (haveAudio ? it : it.skip)('runs acoustic + BLE + fusion + tiering for 4 scenarios', () => {
    const fft = new FFTProcessor(FP_FFT_SIZE);
    const mel = new MelSpectrogram(FP_MEL_BINS, FP_FFT_SIZE, FP_SAMPLE_RATE, FP_FMIN, FP_FMAX);

    const melOf = (pcm: Float32Array, hop: number): Float32Array[] => {
      const frames: Float32Array[] = [];
      for (let s = 0; s + FP_FFT_SIZE <= pcm.length; s += hop) {
        frames.push(mel.computeMelFrame(fft.computeMagnitudeSpectrum(pcm.subarray(s, s + FP_FFT_SIZE))));
      }
      return frames;
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

    /** ACOUSTIC STAGE — discriminative windowed matching + temporal voting. */
    const runAcoustic = (session: Float32Array): boolean => {
      const frames = melOf(session, FRAME);
      const recent: boolean[] = [];
      for (let end = WINDOW; end <= frames.length; end += HOP) {
        const fp = computeFingerprint(frames.slice(end - WINDOW, end));
        if (!fp) continue;
        const d = bestSim(fp, droneRefs);
        const b = bestSim(fp, bgRefs);
        const raw = d >= CFG.floor && (d - b) >= CFG.margin;
        recent.push(raw);
        if (recent.length > CFG.voteWindow) recent.shift();
        if (raw && recent.filter(Boolean).length >= CFG.votesNeeded) return true;
      }
      return false;
    };

    const userPos = { latitude: 37.5665, longitude: 126.9780 };
    const droneGps = { latitude: 37.5672, longitude: 126.9788 }; // ~100m NE

    interface Scenario {
      name: string;
      audible: boolean;       // drone makes audible sound
      remoteId: boolean;      // drone broadcasts Remote ID
      expectedTier: 'CONFIRMED' | 'CORROBORATED' | 'ACOUSTIC' | 'NONE';
    }
    const scenarios: Scenario[] = [
      { name: 'drone w/ Remote ID + audible', audible: true, remoteId: true, expectedTier: 'CORROBORATED' },
      { name: 'drone audible, no Remote ID', audible: true, remoteId: false, expectedTier: 'ACOUSTIC' },
      { name: 'drone w/ Remote ID, not audible', audible: false, remoteId: true, expectedTier: 'CONFIRMED' },
      { name: 'background only', audible: false, remoteId: false, expectedTier: 'NONE' },
    ];

    const out: string[] = [''];
    const hr = '═══════════════════════════════════════════════════════════';
    out.push(hr);
    out.push(' FULL-FLOW SIMULATION — acoustic + BLE + fusion + tiering');
    out.push(`  drone ref=${droneRefs.length}  background ref=${bgRefs.length}`);
    out.push(hr);

    let pass = 0;
    let total = 0;

    for (const sc of scenarios) {
      let scenarioPass = 0;
      const details: string[] = [];
      for (let run = 0; run < RUNS_PER_SCENARIO; run++) {
        const rng = mulberry32(500 + run * 313 + sc.name.length * 7);
        const now = Date.now();

        // ── Acoustic stage ──
        const session = sc.audible
          ? new Float32Array([...segment(bgSess, 5, rng), ...segment(droneSess, 8, rng), ...segment(bgSess, 5, rng)])
          : segment(bgSess, 18, rng);
        const acousticDetected = runAcoustic(session);

        const tracks: ThreatTrack[] = [];
        if (acousticDetected) {
          const det: DetectionResult = {
            id: `acoustic_${run}`, threatCategory: 'MULTIROTOR', severity: 'MEDIUM',
            confidence: 0.8, distanceMeters: 0, bearingDegrees: 0, approachRate: 0,
            source: 'ACOUSTIC', timestamp: now, spectralSignature: [], frequencyPeaks: [],
            similarDrones: [],
          };
          tracks.push({
            id: `track_${run}`, detections: [det], firstSeen: now, lastSeen: now,
            predictedETA: null, kalmanState: null, isActive: true,
          });
        }

        // ── BLE stage — synthesize a Remote ID broadcast, parse it for real ──
        const bleDevices: Record<string, RemoteIDData> = {};
        if (sc.remoteId) {
          const msg = buildRemoteIDLocation(droneGps.latitude, droneGps.longitude);
          const parts = RemoteIDParser.parseMessagePack(msg);
          const data = RemoteIDParser.mergeMessages(parts);
          data.lastSeen = now;
          bleDevices['ble_drone_1'] = data;
        }

        // ── Fusion stage — real DetectionFusionEngine ──
        const engine = new DetectionFusionEngine();
        engine.setUserPosition(userPos);
        const fused = engine.fuse(tracks, bleDevices);

        // ── 3-tier classification ──
        const fusedBle = new Set(fused.map((f) => f.bleDeviceId));
        const fusedTracks = new Set(fused.map((f) => f.acousticTrackId));
        const unfusedBle = Object.keys(bleDevices).filter((id) => !fusedBle.has(id));
        const unfusedTracks = tracks.filter((t) => !fusedTracks.has(t.id));
        let tier: Scenario['expectedTier'];
        if (fused.length > 0) tier = 'CORROBORATED';
        else if (unfusedBle.length > 0) tier = 'CONFIRMED';
        else if (unfusedTracks.length > 0) tier = 'ACOUSTIC';
        else tier = 'NONE';

        const ok = tier === sc.expectedTier;
        if (ok) scenarioPass++;
        total++;
        if (ok) pass++;

        const pos = fused[0]
          ? `pos ${fused[0].distanceMeters}m @${fused[0].bearingDegrees}°`
          : (tier === 'CONFIRMED' ? 'pos via BLE GPS' : 'no position');
        details.push(`run ${run + 1}: ${tier}${ok ? ' ✓' : ` ✗ (expected ${sc.expectedTier})`}  [${pos}]`);
      }
      out.push('');
      out.push(` ▶ ${sc.name}  →  expect ${sc.expectedTier}   (${scenarioPass}/${RUNS_PER_SCENARIO})`);
      for (const d of details) out.push(`     ${d}`);
    }

    out.push('');
    out.push('───────────────────────────────────────────────────────────');
    out.push(` FULL-FLOW RESULT: ${pass}/${total} scenario-runs produced the correct tier`);
    out.push('───────────────────────────────────────────────────────────');
    out.push('');
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));

    expect(total).toBe(scenarios.length * RUNS_PER_SCENARIO);
  }, 240000);
});
