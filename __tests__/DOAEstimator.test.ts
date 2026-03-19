import { DOAEstimator } from '../src/core/detection/DOAEstimator';

describe('DOAEstimator', () => {
  const doa = new DOAEstimator(44100, 0.12, 343);

  // ===== Bearing Estimation =====
  describe('estimateBearing', () => {
    it('should return ~0 degrees for equal channels', () => {
      const len = 1024;
      const signal = new Float32Array(len);
      for (let i = 0; i < len; i++) signal[i] = Math.sin(2 * Math.PI * 500 * i / 44100);

      const bearing = doa.estimateBearing(signal, signal); // Same signal = 0° (front)
      expect(Math.abs(bearing)).toBeLessThan(5);
    });

    it('should detect directional offset when right channel is delayed', () => {
      const len = 1024;
      const left = new Float32Array(len);
      const right = new Float32Array(len);

      // Right channel delayed = source closer to left mic
      const delaySamples = 5;
      for (let i = 0; i < len; i++) {
        const sig = Math.sin(2 * Math.PI * 500 * i / 44100);
        left[i] = sig;
        right[i] = i >= delaySamples ? Math.sin(2 * Math.PI * 500 * (i - delaySamples) / 44100) : 0;
      }

      const bearing = doa.estimateBearing(left, right);
      expect(Math.abs(bearing)).toBeGreaterThan(5); // Should detect offset
    });

    it('should produce opposite sign for opposite delays', () => {
      const len = 1024;
      const delaySamples = 5;

      // Case A: left leads
      const leftA = new Float32Array(len);
      const rightA = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        leftA[i] = Math.sin(2 * Math.PI * 500 * i / 44100);
        rightA[i] = i >= delaySamples ? Math.sin(2 * Math.PI * 500 * (i - delaySamples) / 44100) : 0;
      }

      // Case B: right leads (swap channels)
      const bearingA = doa.estimateBearing(leftA, rightA);
      const bearingB = doa.estimateBearing(rightA, leftA);

      // Should be opposite signs
      expect(bearingA * bearingB).toBeLessThan(0);
    });

    it('should return angle within valid range [-90, 90]', () => {
      const left = new Float32Array(512);
      const right = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        left[i] = Math.random() * 2 - 1;
        right[i] = Math.random() * 2 - 1;
      }

      const bearing = doa.estimateBearing(left, right);
      expect(bearing).toBeGreaterThanOrEqual(-90);
      expect(bearing).toBeLessThanOrEqual(90);
    });

    it('should handle silence without NaN', () => {
      const silence = new Float32Array(256).fill(0);
      const bearing = doa.estimateBearing(silence, silence);
      expect(isNaN(bearing)).toBe(false);
    });
  });

  // ===== Absolute Bearing =====
  describe('toAbsoluteBearing', () => {
    it('should add compass heading to relative bearing', () => {
      expect(doa.toAbsoluteBearing(0, 90)).toBe(90);    // Front, facing East
      expect(doa.toAbsoluteBearing(30, 0)).toBe(30);     // 30° right, facing North
    });

    it('should wrap past 360', () => {
      expect(doa.toAbsoluteBearing(30, 350)).toBe(20);   // 350+30 = 380 → 20
    });

    it('should wrap negative values', () => {
      expect(doa.toAbsoluteBearing(-30, 10)).toBe(340);  // 10-30 = -20 → 340
    });
  });

  // ===== Doppler Approach Rate =====
  describe('estimateApproachRate', () => {
    it('should detect approaching object (higher observed freq)', () => {
      // Object approaching: observed frequency > source frequency
      const rate = doa.estimateApproachRate(1050, 1050, 1000);
      expect(rate).toBeLessThan(0); // Negative = approaching
    });

    it('should detect retreating object (lower observed freq)', () => {
      // Object retreating: observed frequency < source frequency
      const rate = doa.estimateApproachRate(950, 950, 1000);
      expect(rate).toBeGreaterThan(0); // Positive = retreating
    });

    it('should return ~0 for stationary source', () => {
      const rate = doa.estimateApproachRate(1000, 1000, 1000);
      expect(Math.abs(rate)).toBeLessThan(1);
    });
  });
});
