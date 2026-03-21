/**
 * Mel Spectrogram and MFCC feature extraction.
 *
 * Converts raw FFT magnitude spectrum into perceptually-weighted
 * mel-scaled representation suitable for ML model input.
 *
 * Reference: 128 mel bands, 125Hz-8kHz (drone frequency range)
 */

export class MelSpectrogram {
  private numMelBins: number;
  private fftSize: number;
  private sampleRate: number;
  private fMin: number;
  private fMax: number;
  private melFilterbank: Float32Array[];
  private numMfccCoeffs: number;
  private dctMatrix: Float32Array[];

  // Reusable buffers to avoid per-frame allocations
  private melFrameBuffer: Float32Array;
  private mfccBuffer: Float32Array;
  private normalizeBuffer: Float32Array;

  constructor(
    numMelBins: number = 128,
    fftSize: number = 2048,
    sampleRate: number = 44100,
    fMin: number = 125,
    fMax: number = 8000,
    numMfccCoeffs: number = 30,
  ) {
    this.numMelBins = numMelBins;
    this.fftSize = fftSize;
    this.sampleRate = sampleRate;
    this.fMin = fMin;
    this.fMax = fMax;
    this.numMfccCoeffs = numMfccCoeffs;

    // Pre-compute mel filterbank
    this.melFilterbank = this.createMelFilterbank();

    // Pre-compute DCT matrix for MFCC
    this.dctMatrix = this.createDCTMatrix();

    // Pre-allocate reusable buffers
    this.melFrameBuffer = new Float32Array(numMelBins);
    this.mfccBuffer = new Float32Array(numMfccCoeffs);
    this.normalizeBuffer = new Float32Array(numMelBins);
  }

  /**
   * Convert FFT magnitude spectrum to mel spectrogram (single frame).
   */
  computeMelFrame(magnitudeSpectrum: Float32Array): Float32Array {
    const melFrame = this.melFrameBuffer;

    for (let m = 0; m < this.numMelBins; m++) {
      let sum = 0;
      const filter = this.melFilterbank[m];
      const len = Math.min(filter.length, magnitudeSpectrum.length);
      for (let k = 0; k < len; k++) {
        const mag = magnitudeSpectrum[k];
        sum += (Number.isFinite(mag) ? mag : 1e-10) * filter[k];
      }
      // Log mel energy (add small epsilon to avoid log(0))
      melFrame[m] = Math.log(Math.max(sum, 1e-10));
    }

    // Return a copy since buffer is reused
    return new Float32Array(melFrame);
  }

  /**
   * Compute MFCC from mel spectrogram frame.
   * Returns 30 cepstral coefficients (optimal for drone classification per research).
   */
  computeMFCC(melFrame: Float32Array): Float32Array {
    const mfcc = this.mfccBuffer;

    for (let i = 0; i < this.numMfccCoeffs; i++) {
      let sum = 0;
      const row = this.dctMatrix[i];
      for (let j = 0; j < this.numMelBins; j++) {
        sum += melFrame[j] * row[j];
      }
      mfcc[i] = sum;
    }

    return new Float32Array(mfcc);
  }

  /**
   * Normalize mel frame to zero mean and unit variance.
   */
  normalize(frame: Float32Array): Float32Array {
    if (frame.length === 0) return frame;
    const mean = frame.reduce((a, b) => a + b, 0) / frame.length;
    let variance = 0;
    for (let i = 0; i < frame.length; i++) {
      variance += (frame[i] - mean) ** 2;
    }
    variance /= frame.length;
    const std = Math.max(Math.sqrt(variance + 1e-8), 1e-8);

    const normalized = this.normalizeBuffer.length === frame.length
      ? this.normalizeBuffer
      : new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      normalized[i] = (frame[i] - mean) / std;
    }
    return new Float32Array(normalized);
  }

  /**
   * Build a sliding window mel spectrogram from multiple frames.
   * Output shape: [numFrames, numMelBins] — suitable for CNN input.
   */
  buildSpectrogram(frames: Float32Array[]): Float32Array[] {
    return frames.map((frame) => this.normalize(this.computeMelFrame(frame)));
  }

  // ===== Internal Helpers =====

  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  private melToHz(mel: number): number {
    return 700 * (10 ** (mel / 2595) - 1);
  }

  private createMelFilterbank(): Float32Array[] {
    const numFFTBins = this.fftSize / 2 + 1;
    const melMin = this.hzToMel(this.fMin);
    const melMax = this.hzToMel(this.fMax);

    // Evenly spaced mel points
    const melPoints = new Float32Array(this.numMelBins + 2);
    for (let i = 0; i < this.numMelBins + 2; i++) {
      melPoints[i] = melMin + (i * (melMax - melMin)) / (this.numMelBins + 1);
    }

    // Convert to Hz and then to FFT bin indices
    const binIndices = new Float32Array(this.numMelBins + 2);
    for (let i = 0; i < this.numMelBins + 2; i++) {
      const hz = this.melToHz(melPoints[i]);
      binIndices[i] = Math.floor(((this.fftSize + 1) * hz) / this.sampleRate);
    }

    // Create triangular filters
    const filterbank: Float32Array[] = [];
    for (let m = 0; m < this.numMelBins; m++) {
      const filter = new Float32Array(numFFTBins);
      const start = Math.floor(binIndices[m]);
      const center = Math.floor(binIndices[m + 1]);
      const end = Math.floor(binIndices[m + 2]);

      // Rising slope
      for (let k = start; k < center && k < numFFTBins; k++) {
        filter[k] = center !== start ? (k - start) / (center - start) : 1.0;
      }

      // Falling slope
      for (let k = center; k <= end && k < numFFTBins; k++) {
        filter[k] = end !== center ? (end - k) / (end - center) : 1.0;
      }

      filterbank.push(filter);
    }

    return filterbank;
  }

  private createDCTMatrix(): Float32Array[] {
    const matrix: Float32Array[] = [];
    for (let i = 0; i < this.numMfccCoeffs; i++) {
      const row = new Float32Array(this.numMelBins);
      for (let j = 0; j < this.numMelBins; j++) {
        row[j] = Math.cos((Math.PI * i * (j + 0.5)) / this.numMelBins);
      }
      matrix.push(row);
    }
    return matrix;
  }
}
