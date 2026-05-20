/**
 * Acoustic Fingerprint Matcher — v1 acoustic detection (discriminative).
 *
 * HONESTY CONTRACT:
 * This is reference-based matching. An incoming sound is compared against two
 * libraries of fingerprints extracted from REAL recordings — drone clips and
 * background clips. It is NOT a hand-tuned heuristic (which guessed at drone
 * acoustics and scored 0%), and it is NOT trained on synthetic audio (which
 * would learn synthetic artefacts). Its quality is bounded by the real
 * reference recordings supplied.
 *
 * A fingerprint is the *shape* of the average log-mel spectrum:
 *   1. average the log-mel frames over the analysis window  → steady spectrum
 *   2. subtract the mean                                    → shape, not level
 *   3. L2-normalise                                         → loudness-invariant
 * Matching is cosine similarity between unit vectors (= correlation of shapes).
 *
 * DISCRIMINATIVE DECISION (calibrated on real recordings, see fingerprintConfig
 * and the simulation tests):
 *     match  ⟺  droneSim >= FP_MATCH_FLOOR  AND  droneSim - bgSim >= FP_MATCH_MARGIN
 * Comparing the drone similarity against the BACKGROUND similarity — rather
 * than a fixed threshold alone — is what rejects drone-like background sounds
 * (helicopters, engines). It lifted balanced accuracy from 73.5% to ~89%.
 */

import { FP_MATCH_FLOOR, FP_MATCH_MARGIN } from './fingerprintConfig';

export interface Fingerprint {
  /** Mean-subtracted, L2-normalised average log-mel spectrum. */
  vector: number[];
}

export interface ReferenceFingerprint extends Fingerprint {
  /** Acoustic class / model label, e.g. "MULTIROTOR" or "BACKGROUND". */
  label: string;
  /** Identifier of the source recording the fingerprint was extracted from. */
  sourceId: string;
}

export interface FingerprintMatch {
  label: string;
  /** Cosine similarity to the closest drone reference, 0..1. */
  similarity: number;
}

/**
 * Compute a fingerprint from a window of log-mel frames.
 * Returns null when there are no frames.
 */
export function computeFingerprint(melFrames: Float32Array[]): Fingerprint | null {
  if (!melFrames || melFrames.length === 0) return null;
  const bins = melFrames[0].length;
  if (bins === 0) return null;

  // 1. Average spectrum across the window.
  const avg = new Float64Array(bins);
  for (const frame of melFrames) {
    const n = Math.min(frame.length, bins);
    for (let i = 0; i < n; i++) avg[i] += frame[i];
  }
  for (let i = 0; i < bins; i++) avg[i] /= melFrames.length;

  // 2. Subtract the mean → spectral shape (level-independent).
  let mean = 0;
  for (let i = 0; i < bins; i++) mean += avg[i];
  mean /= bins;

  // 3. L2-normalise → unit vector (loudness-invariant).
  const vector = new Array<number>(bins);
  let norm = 0;
  for (let i = 0; i < bins; i++) {
    const v = avg[i] - mean;
    vector[i] = v;
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm < 1e-9) {
    // Flat spectrum (silence) — a zero vector matches nothing.
    return { vector: new Array<number>(bins).fill(0) };
  }
  for (let i = 0; i < bins; i++) vector[i] /= norm;

  return { vector };
}

/**
 * Cosine similarity between two fingerprints. Both vectors are unit-length,
 * so this is their dot product; negative correlations are clamped to 0.
 */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  if (a.vector.length === 0 || a.vector.length !== b.vector.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.vector.length; i++) dot += a.vector[i] * b.vector[i];
  return dot > 0 ? Math.min(dot, 1) : 0;
}

function bestSimilarity(fp: Fingerprint, refs: ReferenceFingerprint[]): { sim: number; label: string } {
  let sim = 0;
  let label = '';
  for (const ref of refs) {
    const s = similarity(fp, ref);
    if (s > sim) { sim = s; label = ref.label; }
  }
  return { sim, label };
}

/**
 * Discriminative acoustic matcher — compares an incoming sound against drone
 * AND background reference libraries extracted from real recordings.
 */
export class AcousticFingerprintMatcher {
  private droneRefs: ReferenceFingerprint[] = [];
  private backgroundRefs: ReferenceFingerprint[] = [];
  private floor: number;
  private margin: number;

  constructor(floor: number = FP_MATCH_FLOOR, margin: number = FP_MATCH_MARGIN) {
    this.floor = clamp01(floor);
    this.margin = Math.max(0, margin);
  }

  /**
   * Load the reference libraries (extracted offline from real recordings).
   * Both a drone library and a background library are required for the
   * discriminative decision.
   */
  loadReferences(drone: ReferenceFingerprint[], background: ReferenceFingerprint[]): void {
    this.droneRefs = drone.filter((r) => r.vector.length > 0);
    this.backgroundRefs = background.filter((r) => r.vector.length > 0);
  }

  get droneReferenceCount(): number { return this.droneRefs.length; }
  get backgroundReferenceCount(): number { return this.backgroundRefs.length; }

  /** True once both reference libraries have been loaded. */
  get isReady(): boolean {
    return this.droneRefs.length > 0 && this.backgroundRefs.length > 0;
  }

  /**
   * Discriminative match for a window of log-mel frames. Returns the match
   * (with the drone similarity) when the sound is closer to a drone reference
   * than to a background reference by the calibrated margin, and clears the
   * floor — otherwise null (honest "no match", never a fabricated guess).
   */
  match(melFrames: Float32Array[]): FingerprintMatch | null {
    if (!this.isReady) return null;
    const fp = computeFingerprint(melFrames);
    if (!fp) return null;

    const drone = bestSimilarity(fp, this.droneRefs);
    const bg = bestSimilarity(fp, this.backgroundRefs);

    if (drone.sim >= this.floor && (drone.sim - bg.sim) >= this.margin) {
      return { label: drone.label || 'MULTIROTOR', similarity: drone.sim };
    }
    return null;
  }

  /**
   * Best drone-reference similarity regardless of the match decision — for the
   * debug / HEARING readout and threshold calibration.
   */
  bestSimilarity(melFrames: Float32Array[]): FingerprintMatch | null {
    if (this.droneRefs.length === 0) return null;
    const fp = computeFingerprint(melFrames);
    if (!fp) return null;
    const drone = bestSimilarity(fp, this.droneRefs);
    return { label: drone.label || 'MULTIROTOR', similarity: drone.sim };
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
