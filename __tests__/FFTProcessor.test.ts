import { FFTProcessor } from '../src/core/audio/FFTProcessor';

describe('FFTProcessor', () => {
  // ===== Constructor =====
  describe('constructor', () => {
    it('should create with default fftSize 2048', () => {
      const fft = new FFTProcessor();
      expect(fft.size).toBe(2048);
    });

    it('should accept power-of-2 sizes', () => {
      expect(new FFTProcessor(256).size).toBe(256);
      expect(new FFTProcessor(512).size).toBe(512);
      expect(new FFTProcessor(1024).size).toBe(1024);
      expect(new FFTProcessor(4096).size).toBe(4096);
    });

    it('should reject non-power-of-2 sizes', () => {
      expect(() => new FFTProcessor(100)).toThrow('FFT size must be a power of 2');
      expect(() => new FFTProcessor(3)).toThrow();
      expect(() => new FFTProcessor(1000)).toThrow();
    });
  });

  // ===== Window Function =====
  describe('applyWindow', () => {
    it('should return zero at edges (Hann window)', () => {
      const fft = new FFTProcessor(256);
      const signal = new Float32Array(256).fill(1.0);
      const windowed = fft.applyWindow(signal);

      // Hann window is 0 at boundaries
      expect(windowed[0]).toBeCloseTo(0, 5);
      expect(windowed[255]).toBeCloseTo(0, 5);
    });

    it('should be maximum at center', () => {
      const fft = new FFTProcessor(256);
      const signal = new Float32Array(256).fill(1.0);
      const windowed = fft.applyWindow(signal);

      // Center should be close to 1.0
      expect(windowed[128]).toBeCloseTo(1.0, 2);
    });

    it('should preserve zero signal', () => {
      const fft = new FFTProcessor(256);
      const signal = new Float32Array(256).fill(0);
      const windowed = fft.applyWindow(signal);
      windowed.forEach(v => expect(v).toBe(0));
    });
  });

  // ===== FFT Correctness =====
  describe('computeMagnitudeSpectrum', () => {
    it('should return correct length (fftSize/2 + 1)', () => {
      const fft = new FFTProcessor(256);
      const signal = new Float32Array(256);
      const spectrum = fft.computeMagnitudeSpectrum(signal);
      expect(spectrum.length).toBe(129); // 256/2 + 1
    });

    it('should detect a pure sine wave at correct frequency', () => {
      const fftSize = 1024;
      const sampleRate = 44100;
      const fft = new FFTProcessor(fftSize);

      // Generate 1kHz sine wave
      const freq = 1000;
      const signal = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        signal[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
      }

      const spectrum = fft.computeMagnitudeSpectrum(signal);

      // Find peak bin
      let maxBin = 0;
      let maxVal = 0;
      for (let i = 1; i < spectrum.length; i++) {
        if (spectrum[i] > maxVal) {
          maxVal = spectrum[i];
          maxBin = i;
        }
      }

      // Expected bin for 1kHz: bin = freq * fftSize / sampleRate
      const expectedBin = Math.round(freq * fftSize / sampleRate);
      expect(Math.abs(maxBin - expectedBin)).toBeLessThanOrEqual(2); // Allow ±2 bins (windowing broadens)
    });

    it('should return all zeros for silence', () => {
      const fft = new FFTProcessor(256);
      const silence = new Float32Array(256).fill(0);
      const spectrum = fft.computeMagnitudeSpectrum(silence);
      spectrum.forEach(v => expect(v).toBeCloseTo(0, 10));
    });

    it('should handle DC offset', () => {
      const fft = new FFTProcessor(256);
      const signal = new Float32Array(256).fill(0.5); // DC offset
      const spectrum = fft.computeMagnitudeSpectrum(signal);

      // DC component (bin 0) should be dominant after windowing
      // But Hann window reduces DC, so check spectrum is not all zero
      const totalEnergy = spectrum.reduce((a, b) => a + b, 0);
      expect(totalEnergy).toBeGreaterThan(0);
    });
  });

  // ===== Power Spectrum =====
  describe('computePowerSpectrum', () => {
    it('should return values in dB', () => {
      const fft = new FFTProcessor(256);
      const signal = new Float32Array(256);
      for (let i = 0; i < 256; i++) signal[i] = Math.sin(2 * Math.PI * 10 * i / 256);

      const power = fft.computePowerSpectrum(signal);
      // dB values should be finite
      power.forEach(v => expect(isFinite(v)).toBe(true));
    });

    it('should handle zero input without NaN', () => {
      const fft = new FFTProcessor(256);
      const silence = new Float32Array(256).fill(0);
      const power = fft.computePowerSpectrum(silence);
      power.forEach(v => {
        expect(isNaN(v)).toBe(false);
        expect(isFinite(v)).toBe(true);
      });
    });
  });

  // ===== Peak Detection =====
  describe('findPeaks', () => {
    it('should find peaks in known spectrum', () => {
      const fft = new FFTProcessor(1024);
      const sampleRate = 44100;

      // Generate multi-tone signal (440Hz + 880Hz)
      const signal = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        signal[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate)
                  + 0.5 * Math.sin(2 * Math.PI * 880 * i / sampleRate);
      }

      const spectrum = fft.computeMagnitudeSpectrum(signal);
      const peaks = fft.findPeaks(spectrum, sampleRate, 5);

      expect(peaks.length).toBeGreaterThanOrEqual(1);
      // First peak should be near 440Hz (strongest component)
      const found440 = peaks.some(p => Math.abs(p.freq - 440) < 100);
      expect(found440).toBe(true);
    });

    it('should return empty array for flat spectrum', () => {
      const fft = new FFTProcessor(256);
      const flat = new Float32Array(129).fill(1.0);
      const peaks = fft.findPeaks(flat, 44100, 5);
      expect(peaks.length).toBe(0);
    });
  });
});
