import { MelSpectrogram } from '../src/core/audio/MelSpectrogram';

describe('MelSpectrogram', () => {
  const mel = new MelSpectrogram(128, 2048, 44100, 125, 8000, 30);

  // ===== Mel Frame Computation =====
  describe('computeMelFrame', () => {
    it('should return correct number of mel bins', () => {
      const spectrum = new Float32Array(1025).fill(0.01); // fftSize/2 + 1
      const frame = mel.computeMelFrame(spectrum);
      expect(frame.length).toBe(128);
    });

    it('should return negative values (log energy of small inputs)', () => {
      const spectrum = new Float32Array(1025).fill(0.001);
      const frame = mel.computeMelFrame(spectrum);
      // log(small number) should be negative
      frame.forEach(v => expect(v).toBeLessThan(0));
    });

    it('should handle zero spectrum without NaN/Infinity', () => {
      const spectrum = new Float32Array(1025).fill(0);
      const frame = mel.computeMelFrame(spectrum);
      frame.forEach(v => {
        expect(isNaN(v)).toBe(false);
        expect(isFinite(v)).toBe(true);
      });
    });

    it('should produce higher energy for louder input', () => {
      const quiet = new Float32Array(1025).fill(0.01);
      const loud = new Float32Array(1025).fill(1.0);

      const quietFrame = mel.computeMelFrame(quiet);
      const loudFrame = mel.computeMelFrame(loud);

      // Average energy should be higher for loud signal
      const quietAvg = quietFrame.reduce((a, b) => a + b) / quietFrame.length;
      const loudAvg = loudFrame.reduce((a, b) => a + b) / loudFrame.length;
      expect(loudAvg).toBeGreaterThan(quietAvg);
    });
  });

  // ===== MFCC =====
  describe('computeMFCC', () => {
    it('should return correct number of coefficients', () => {
      const frame = new Float32Array(128).fill(-5); // Log mel energy
      const mfcc = mel.computeMFCC(frame);
      expect(mfcc.length).toBe(30);
    });

    it('should produce finite values', () => {
      const frame = new Float32Array(128);
      for (let i = 0; i < 128; i++) frame[i] = -10 + Math.random() * 5;
      const mfcc = mel.computeMFCC(frame);
      mfcc.forEach(v => {
        expect(isNaN(v)).toBe(false);
        expect(isFinite(v)).toBe(true);
      });
    });

    it('should have largest first coefficient (energy)', () => {
      const frame = new Float32Array(128).fill(-2);
      const mfcc = mel.computeMFCC(frame);
      // First MFCC (c0) represents overall energy, should be largest magnitude
      expect(Math.abs(mfcc[0])).toBeGreaterThan(Math.abs(mfcc[15]));
    });
  });

  // ===== Normalization =====
  describe('normalize', () => {
    it('should produce zero mean', () => {
      const frame = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const norm = mel.normalize(frame);
      const mean = norm.reduce((a, b) => a + b) / norm.length;
      expect(mean).toBeCloseTo(0, 5);
    });

    it('should produce unit variance', () => {
      const frame = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const norm = mel.normalize(frame);
      const mean = norm.reduce((a, b) => a + b) / norm.length;
      let variance = 0;
      for (let i = 0; i < norm.length; i++) variance += (norm[i] - mean) ** 2;
      variance /= norm.length;
      expect(variance).toBeCloseTo(1, 1);
    });

    it('should handle constant input (zero variance)', () => {
      const frame = new Float32Array(128).fill(5);
      const norm = mel.normalize(frame);
      // Should not produce NaN (epsilon prevents div by zero)
      norm.forEach(v => {
        expect(isNaN(v)).toBe(false);
        expect(isFinite(v)).toBe(true);
      });
    });
  });

  // ===== Hz-Mel Conversion (implicit) =====
  describe('frequency range coverage', () => {
    it('should cover drone frequency range (125-8000Hz)', () => {
      // Create spectrum with energy only in drone band
      const spectrum = new Float32Array(1025).fill(0);
      // Place energy at ~1000Hz: bin = 1000 * 2048 / 44100 ≈ 46
      spectrum[46] = 1.0;

      const frame = mel.computeMelFrame(spectrum);
      // At least one mel bin should have significant energy
      const maxEnergy = Math.max(...frame);
      expect(maxEnergy).toBeGreaterThan(-20); // Not extremely quiet
    });
  });
});
