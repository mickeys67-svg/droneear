/**
 * Pure JavaScript FFT implementation for real-time audio analysis.
 * Uses Cooley-Tukey radix-2 DIT algorithm.
 *
 * In production, this should be replaced with a native TurboModule
 * using KissFFT (C++) or vDSP (iOS) for 10x+ performance.
 */

export class FFTProcessor {
  private fftSize: number;
  private halfSize: number;
  private cosTable: Float32Array;
  private sinTable: Float32Array;
  private windowFunction: Float32Array;

  constructor(fftSize: number = 2048) {
    if ((fftSize & (fftSize - 1)) !== 0) {
      throw new Error('FFT size must be a power of 2');
    }
    this.fftSize = fftSize;
    this.halfSize = fftSize / 2;

    // Pre-compute twiddle factors
    this.cosTable = new Float32Array(this.halfSize);
    this.sinTable = new Float32Array(this.halfSize);
    for (let i = 0; i < this.halfSize; i++) {
      this.cosTable[i] = Math.cos((2 * Math.PI * i) / fftSize);
      this.sinTable[i] = Math.sin((2 * Math.PI * i) / fftSize);
    }

    // Hann window for spectral leakage reduction
    this.windowFunction = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      this.windowFunction[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }
  }

  /**
   * Apply window function to input signal.
   */
  applyWindow(signal: Float32Array): Float32Array {
    const windowed = new Float32Array(signal.length);
    const len = Math.min(signal.length, this.fftSize);
    for (let i = 0; i < len; i++) {
      windowed[i] = signal[i] * this.windowFunction[i];
    }
    return windowed;
  }

  /**
   * Compute FFT magnitude spectrum.
   * Returns array of length fftSize/2 + 1 (DC to Nyquist).
   */
  computeMagnitudeSpectrum(signal: Float32Array): Float32Array {
    const windowed = this.applyWindow(signal);
    const { real, imag } = this.fft(windowed);

    const magnitudes = new Float32Array(this.halfSize + 1);
    for (let i = 0; i <= this.halfSize; i++) {
      magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    return magnitudes;
  }

  /**
   * Compute power spectrum in dB.
   */
  computePowerSpectrum(signal: Float32Array): Float32Array {
    const magnitudes = this.computeMagnitudeSpectrum(signal);
    const power = new Float32Array(magnitudes.length);
    for (let i = 0; i < magnitudes.length; i++) {
      power[i] = 20 * Math.log10(Math.max(magnitudes[i], 1e-10));
    }
    return power;
  }

  /**
   * Find dominant frequency peaks.
   * Returns array of [frequency, magnitude] pairs sorted by magnitude.
   */
  findPeaks(magnitudes: Float32Array, sampleRate: number, numPeaks: number = 5): Array<{ freq: number; mag: number }> {
    const freqResolution = sampleRate / this.fftSize;
    const peaks: Array<{ freq: number; mag: number }> = [];

    for (let i = 2; i < magnitudes.length - 2; i++) {
      if (
        magnitudes[i] > magnitudes[i - 1] &&
        magnitudes[i] > magnitudes[i + 1] &&
        magnitudes[i] > magnitudes[i - 2] &&
        magnitudes[i] > magnitudes[i + 2]
      ) {
        peaks.push({ freq: i * freqResolution, mag: magnitudes[i] });
      }
    }

    return peaks.sort((a, b) => b.mag - a.mag).slice(0, numPeaks);
  }

  /**
   * Cooley-Tukey FFT (in-place, radix-2).
   */
  private fft(input: Float32Array): { real: Float32Array; imag: Float32Array } {
    const n = this.fftSize;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    // Bit-reversal permutation
    for (let i = 0; i < n; i++) {
      real[this.reverseBits(i, Math.log2(n))] = input[i];
    }

    // Butterfly operations
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const tableStep = n / size;

      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const idx = j * tableStep;
          const tReal = real[i + j + halfSize] * this.cosTable[idx] + imag[i + j + halfSize] * this.sinTable[idx];
          const tImag = -real[i + j + halfSize] * this.sinTable[idx] + imag[i + j + halfSize] * this.cosTable[idx];

          real[i + j + halfSize] = real[i + j] - tReal;
          imag[i + j + halfSize] = imag[i + j] - tImag;
          real[i + j] += tReal;
          imag[i + j] += tImag;
        }
      }
    }

    return { real, imag };
  }

  private reverseBits(x: number, bits: number): number {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (x & 1);
      x >>= 1;
    }
    return result;
  }

  get size(): number {
    return this.fftSize;
  }
}
