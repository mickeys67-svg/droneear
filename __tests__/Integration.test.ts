/**
 * Integration test: Full audio processing pipeline
 * Audio → FFT → Mel Spectrogram → ML Inference
 */

import { FFTProcessor } from '../src/core/audio/FFTProcessor';
import { MelSpectrogram } from '../src/core/audio/MelSpectrogram';
import { KalmanFilter2D } from '../src/core/detection/KalmanFilter';
import { DOAEstimator } from '../src/core/detection/DOAEstimator';
import { SEVERITY_THRESHOLDS } from '../src/constants/micConfig';

describe('Integration: Full Pipeline', () => {
  const fftSize = 2048;
  const sampleRate = 44100;
  const fft = new FFTProcessor(fftSize);
  const mel = new MelSpectrogram(128, fftSize, sampleRate, 125, 8000);

  // Generate synthetic drone audio (multiple harmonics)
  function generateDroneAudio(
    fundamentalFreq: number,
    numHarmonics: number,
    duration: number, // in samples
  ): Float32Array {
    const audio = new Float32Array(duration);
    for (let i = 0; i < duration; i++) {
      let sample = 0;
      for (let h = 1; h <= numHarmonics; h++) {
        sample += (1.0 / h) * Math.sin(2 * Math.PI * fundamentalFreq * h * i / sampleRate);
      }
      audio[i] = sample * 0.3; // Normalize
    }
    return audio;
  }

  describe('Audio → FFT → Mel pipeline', () => {
    it('should process synthetic drone audio through the FFT + Mel front-end', () => {
      // Generate drone-like audio (~200Hz fundamental with harmonics).
      const droneAudio = generateDroneAudio(200, 8, fftSize);
      expect(droneAudio.length).toBe(fftSize);

      // FFT
      const spectrum = fft.computeMagnitudeSpectrum(droneAudio);
      expect(spectrum.length).toBe(fftSize / 2 + 1);

      // Drone harmonics should appear in the spectrum.
      const peaks = fft.findPeaks(spectrum, sampleRate, 10);
      expect(peaks.length).toBeGreaterThanOrEqual(1);
      expect(peaks.some((p) => p.freq < 2000)).toBe(true);

      // Mel spectrogram + normalization.
      const melFrame = mel.computeMelFrame(spectrum);
      expect(melFrame.length).toBe(128);
      const normalized = mel.normalize(melFrame);
      expect(normalized.length).toBe(128);
      const mean = normalized.reduce((a, b) => a + b) / normalized.length;
      expect(Math.abs(mean)).toBeLessThan(0.01);

      // MFCC.
      expect(mel.computeMFCC(melFrame).length).toBe(30);
    });
  });

  describe('Threat Tracking Pipeline', () => {
    it('should track approaching object with Kalman filter', () => {
      const kf = new KalmanFilter2D(1.0, 0.5, 5);

      // Simulate drone approaching from 1000m North at 20m/s
      let state = kf.init(0, 1000);

      for (let t = 0; t < 20; t++) {
        state = kf.predict(state);
        // Add measurement noise (±10m)
        const mx = (Math.random() - 0.5) * 20;
        const my = 1000 - (t + 1) * 20 + (Math.random() - 0.5) * 20;
        state = kf.update(state, mx, my);
      }

      // After 20 seconds at 20m/s, should be near 600m
      expect(state.y).toBeLessThan(700);
      expect(state.y).toBeGreaterThan(400);

      // Velocity should be approximately 0, -20
      expect(state.vy).toBeLessThan(-5);

      // ETA should be positive (approaching)
      const eta = kf.predictETA(state);
      expect(eta).not.toBeNull();
      expect(eta!).toBeGreaterThan(0);
    });
  });

  describe('DOA + Kalman Integration', () => {
    it('should convert bearing+distance to Kalman measurement', () => {
      const bearing = 45; // NE
      const distance = 500;

      const { x, y } = KalmanFilter2D.polarToCartesian(bearing, distance);

      // 45° should give equal x and y
      expect(x).toBeCloseTo(distance * Math.sin(Math.PI / 4), 0);
      expect(y).toBeCloseTo(distance * Math.cos(Math.PI / 4), 0);

      // Feed into Kalman
      const kf = new KalmanFilter2D();
      let state = kf.init(x, y);
      state = kf.predict(state);
      state = kf.update(state, x - 5, y - 5); // Slight approach

      expect(state.x).toBeDefined();
      expect(state.y).toBeDefined();
    });
  });

  describe('Constants Validation', () => {
    it('should have valid severity thresholds in descending order', () => {
      expect(SEVERITY_THRESHOLDS.CRITICAL).toBeGreaterThan(SEVERITY_THRESHOLDS.HIGH);
      expect(SEVERITY_THRESHOLDS.HIGH).toBeGreaterThan(SEVERITY_THRESHOLDS.MEDIUM);
      expect(SEVERITY_THRESHOLDS.MEDIUM).toBeGreaterThan(SEVERITY_THRESHOLDS.LOW);
    });

    it('should have thresholds between 0 and 1', () => {
      for (const val of Object.values(SEVERITY_THRESHOLDS)) {
        expect(val).toBeGreaterThan(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Performance', () => {
    it('should process FFT + Mel in under 50ms per frame', () => {
      const audio = generateDroneAudio(200, 4, fftSize);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const spectrum = fft.computeMagnitudeSpectrum(audio);
        mel.computeMelFrame(spectrum);
      }
      const elapsed = performance.now() - start;

      const perFrame = elapsed / 100;
      console.log(`  FFT + Mel per frame: ${perFrame.toFixed(2)}ms`);
      expect(perFrame).toBeLessThan(50); // Must be under 50ms for real-time
    });

  });
});
