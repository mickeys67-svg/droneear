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
  // Pre-allocated buffers to avoid GC pressure in hot path
  private _windowed: Float32Array;
  private _real: Float32Array;
  private _imag: Float32Array;
  private _magnitudes: Float32Array;

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

    // Pre-allocate reusable buffers (avoids ~5 allocations per frame)
    this._windowed = new Float32Array(fftSize);
    this._real = new Float32Array(fftSize);
    this._imag = new Float32Array(fftSize);
    this._magnitudes = new Float32Array(this.halfSize + 1);
  }

  /**
   * Apply window function to input signal.
   */
  applyWindow(signal: Float32Array): Float32Array {
    const len = Math.min(signal.length, this.fftSize);
    for (let i = 0; i < len; i++) {
      this._windowed[i] = signal[i] * this.windowFunction[i];
    }
    // Zero-fill remainder if signal is shorter than fftSize
    for (let i = len; i < this.fftSize; i++) {
      this._windowed[i] = 0;
    }
    return this._windowed;
  }

  /**
   * Compute FFT magnitude spectrum.
   * Returns array of length fftSize/2 + 1 (DC to Nyquist).
   */
  computeMagnitudeSpectrum(signal: Float32Array): Float32Array {
    this.applyWindow(signal);
    this.fftInPlace(this._windowed);

    for (let i = 0; i <= this.halfSize; i++) {
      this._magnitudes[i] = Math.sqrt(this._real[i] * this._real[i] + this._imag[i] * this._imag[i]);
    }
    return this._magnitudes;
  }

  /**
   * Compute power spectrum in dB.
   */
  computePowerSpectrum(signal: Float32Array): Float32Array {
    this.computeMagnitudeSpectrum(signal);
    // Reuse _magnitudes buffer — convert to dB in-place
    const power = new Float32Array(this._magnitudes.length);
    for (let i = 0; i < this._magnitudes.length; i++) {
      power[i] = 20 * Math.log10(Math.max(this._magnitudes[i], 1e-10));
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
  /**
   * In-place FFT using pre-allocated _real/_imag buffers.
   * Results are written to this._real and this._imag.
   */
  private fftInPlace(input: Float32Array): void {
    const n = this.fftSize;
    const real = this._real;
    const imag = this._imag;

    // Clear imag buffer
    imag.fill(0);

    // Bit-reversal permutation
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i++) {
      real[this.reverseBits(i, bits)] = input[i];
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
