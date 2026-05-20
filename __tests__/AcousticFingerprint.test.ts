/**
 * Unit tests for the AcousticFingerprintMatcher engine logic.
 *
 * These verify the matcher's CONTRACT (fingerprint math, threshold gating,
 * empty-reference behaviour) — not real-world accuracy. Real-world accuracy
 * is measured separately in FingerprintRealData.test.ts against actual
 * drone recordings.
 */

import {
  computeFingerprint,
  similarity,
  AcousticFingerprintMatcher,
  type ReferenceFingerprint,
} from '../src/core/ml/AcousticFingerprint';

function frames(values: number[], count: number): Float32Array[] {
  return Array.from({ length: count }, () => Float32Array.from(values));
}

describe('AcousticFingerprint', () => {
  describe('computeFingerprint', () => {
    it('returns null for empty input', () => {
      expect(computeFingerprint([])).toBeNull();
    });

    it('produces a unit-length, zero-mean vector', () => {
      const fp = computeFingerprint(frames([1, 2, 3, 4, 5, 6, 7, 8], 4));
      expect(fp).not.toBeNull();
      const v = fp!.vector;
      const sum = v.reduce((a, b) => a + b, 0);
      const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
      expect(Math.abs(sum)).toBeLessThan(1e-6);   // mean-subtracted
      expect(norm).toBeCloseTo(1, 5);             // L2-normalised
    });

    it('returns a zero vector for a flat (silent) spectrum', () => {
      const fp = computeFingerprint(frames([0.5, 0.5, 0.5, 0.5], 3));
      expect(fp!.vector.every((x) => x === 0)).toBe(true);
    });
  });

  describe('similarity', () => {
    it('is 1 for identical shapes', () => {
      const a = computeFingerprint(frames([1, 2, 3, 4, 5, 6, 7, 8], 2))!;
      expect(similarity(a, a)).toBeCloseTo(1, 5);
    });

    it('clamps anti-correlated shapes to 0', () => {
      const a = computeFingerprint(frames([1, 2, 3, 4, 5, 6, 7, 8], 2))!;
      const b = computeFingerprint(frames([8, 7, 6, 5, 4, 3, 2, 1], 2))!;
      expect(similarity(a, b)).toBe(0);
    });
  });

  describe('AcousticFingerprintMatcher (discriminative)', () => {
    // Two clearly different spectral shapes: a symmetric "drone" hump and a
    // rising "background" ramp (poorly correlated with the hump).
    const droneShape = [1, 3, 5, 7, 7, 5, 3, 1];
    const bgShape = [1, 2, 3, 4, 5, 6, 7, 8];
    const droneRefs: ReferenceFingerprint[] = [
      { ...computeFingerprint(frames(droneShape, 2))!, label: 'MULTIROTOR', sourceId: 'drone-1' },
    ];
    const bgRefs: ReferenceFingerprint[] = [
      { ...computeFingerprint(frames(bgShape, 2))!, label: 'BACKGROUND', sourceId: 'bg-1' },
    ];

    it('is not ready until both reference libraries are loaded', () => {
      const m = new AcousticFingerprintMatcher();
      expect(m.isReady).toBe(false);
      expect(m.match(frames(droneShape, 2))).toBeNull();
    });

    it('matches drone-like input (closer to drone than background ref)', () => {
      const m = new AcousticFingerprintMatcher();
      m.loadReferences(droneRefs, bgRefs);
      expect(m.isReady).toBe(true);
      const result = m.match(frames(droneShape, 3));
      expect(result).not.toBeNull();
      expect(result!.label).toBe('MULTIROTOR');
      expect(result!.similarity).toBeCloseTo(1, 5);
    });

    it('rejects background-like input (closer to background ref)', () => {
      const m = new AcousticFingerprintMatcher();
      m.loadReferences(droneRefs, bgRefs);
      // Identical to the background reference → droneSim - bgSim is negative.
      expect(m.match(frames(bgShape, 3))).toBeNull();
    });

    it('bestSimilarity reports the drone similarity regardless of match', () => {
      const m = new AcousticFingerprintMatcher();
      m.loadReferences(droneRefs, bgRefs);
      const best = m.bestSimilarity(frames(bgShape, 3));
      expect(best).not.toBeNull();
      expect(best!.similarity).toBeGreaterThanOrEqual(0);
      expect(best!.similarity).toBeLessThan(0.70);
    });
  });
});
