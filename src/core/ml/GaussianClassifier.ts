/**
 * Gaussian Probabilistic Classifier — v1.0
 *
 * Complements the rule-based ModelManager with a probabilistic approach.
 * Uses multivariate Gaussian distributions (diagonal covariance) for each
 * acoustic category, derived from drone acoustic research literature.
 *
 * Key differences from ModelManager (rule-based):
 * - Soft boundaries instead of hard thresholds (handles edge cases)
 * - Probability density rather than range matching
 * - Higher discrimination between overlapping categories
 * - baseConfidence not capped (can reach 0.95+)
 *
 * Same API contract as ModelManager:
 *   Input:  Float32Array[] (96 frames × 128 mel bins)
 *   Output: Map<AcousticPattern, number> (6 classes, sum ≈ 1.0)
 */

import type { AcousticPattern } from '../../types';

// ===== Feature vector definition =====

interface FeatureVector {
  centroid: number;          // Spectral centroid (mel bin 0-128)
  rolloff: number;           // 85% energy rolloff bin
  flatness: number;          // 0=tone, 1=noise
  harmonicScore: number;     // 0-1 harmonic match quality
  harmonicCount: number;     // Number of detected harmonics
  fundamental: number;       // Detected fundamental frequency (Hz)
  modStrength: number;       // Temporal modulation coefficient of variation
  modRegularity: number;     // Modulation periodicity (0-1)
  flux: number;              // Spectral flux (normalized)
  lowBandRatio: number;      // Low frequency energy ratio
  midBandRatio: number;      // Mid frequency energy ratio
  spectralContrast: number;  // Peak-valley difference (added feature)
}

const FEATURE_KEYS: (keyof FeatureVector)[] = [
  'centroid', 'rolloff', 'flatness', 'harmonicScore', 'harmonicCount',
  'fundamental', 'modStrength', 'modRegularity', 'flux',
  'lowBandRatio', 'midBandRatio', 'spectralContrast',
];

const NUM_FEATURES = FEATURE_KEYS.length;

// ===== Gaussian parameters per category =====
// Each entry: [mean, variance] for each feature dimension
// Derived from drone acoustic research (blade-pass frequencies, SPL profiles)

interface GaussianParams {
  mean: number[];
  variance: number[];
  prior: number; // Class prior probability
}

const GAUSSIAN_PARAMS: Record<AcousticPattern, GaussianParams> = {
  MULTIROTOR: {
    //         centroid  rolloff  flatness  harmScore  harmCount  fundamental  modStr  modReg  flux    lowBand  midBand  contrast
    mean:     [42,       55,      0.28,     0.55,      3.5,       250,         0.22,   0.55,   0.15,   0.25,    0.52,    0.45],
    variance: [120,      180,     0.025,    0.04,      1.5,       6000,        0.012,  0.05,   0.006,  0.008,   0.008,   0.04],
    prior: 0.30, // Most common drone type
  },
  SINGLE_ENGINE: {
    mean:     [30,       42,      0.22,     0.60,      4.0,       125,         0.18,   0.50,   0.10,   0.42,    0.40,    0.50],
    variance: [100,      150,     0.020,    0.04,      1.5,       4000,        0.010,  0.05,   0.004,  0.008,   0.008,   0.04],
    prior: 0.15,
  },
  SINGLE_ROTOR: {
    mean:     [35,       50,      0.18,     0.50,      4.5,       50,          0.12,   0.60,   0.08,   0.48,    0.35,    0.55],
    variance: [130,      200,     0.018,    0.05,      2.0,       800,         0.008,  0.06,   0.003,  0.010,   0.008,   0.05],
    prior: 0.10,
  },
  JET_PROPULSION: {
    mean:     [72,       95,      0.55,     0.15,      1.5,       800,         0.08,   0.15,   0.35,   0.10,    0.32,    0.25],
    variance: [200,      250,     0.040,    0.02,      1.0,       50000,       0.005,  0.03,   0.015,  0.005,   0.010,   0.03],
    prior: 0.05,
  },
  PROPELLER_FIXED: {
    mean:     [40,       58,      0.25,     0.45,      3.5,       180,         0.15,   0.45,   0.08,   0.33,    0.44,    0.42],
    variance: [110,      170,     0.022,    0.04,      1.5,       5000,        0.010,  0.05,   0.004,  0.008,   0.008,   0.04],
    prior: 0.10,
  },
  BACKGROUND: {
    mean:     [60,       80,      0.75,     0.08,      0.5,       0,           0.05,   0.10,   0.02,   0.33,    0.34,    0.15],
    variance: [400,      500,     0.060,    0.01,      0.5,       100,         0.003,  0.02,   0.001,  0.015,   0.015,   0.02],
    prior: 0.30,
  },
};

const OUTPUT_CLASSES: AcousticPattern[] = [
  'MULTIROTOR', 'SINGLE_ENGINE', 'SINGLE_ROTOR',
  'JET_PROPULSION', 'PROPELLER_FIXED', 'BACKGROUND',
];

// Mel bin to Hz
const MEL_MIN_HZ = 125;
const MEL_MAX_HZ = 8000;
function melBinToHz(bin: number): number {
  const melMin = 2595 * Math.log10(1 + MEL_MIN_HZ / 700);
  const melMax = 2595 * Math.log10(1 + MEL_MAX_HZ / 700);
  const mel = melMin + (bin / 128) * (melMax - melMin);
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

export class GaussianClassifier {
  private ready = false;

  async initialize(): Promise<void> {
    // Validate all params
    for (const cat of OUTPUT_CLASSES) {
      const p = GAUSSIAN_PARAMS[cat];
      if (p.mean.length !== NUM_FEATURES || p.variance.length !== NUM_FEATURES) {
        throw new Error(`Invalid Gaussian params for ${cat}`);
      }
    }
    this.ready = true;
  }

  get isReady(): boolean {
    return this.ready;
  }

  /**
   * Classify mel frames using Gaussian probability distributions.
   * Same signature as ModelManager.predict()
   */
  predict(melFrames: Float32Array[]): Map<AcousticPattern, number> {
    if (!this.ready || melFrames.length === 0) {
      return this.uniformPrediction();
    }

    try {
      // Step 1: Extract feature vector
      const features = this.extractFeatures(melFrames);

      // Step 2: Compute log-likelihood for each category
      const logLikelihoods = new Map<AcousticPattern, number>();
      let maxLL = -Infinity;

      for (const cat of OUTPUT_CLASSES) {
        const ll = this.logLikelihood(features, GAUSSIAN_PARAMS[cat]);
        logLikelihoods.set(cat, ll);
        if (ll > maxLL) maxLL = ll;
      }

      // Step 3: Convert to posterior probabilities (softmax of log-likelihoods)
      let expSum = 0;
      const expScores = new Map<AcousticPattern, number>();

      for (const [cat, ll] of logLikelihoods) {
        const exp = Math.exp(Math.max(-500, Math.min(500, ll - maxLL)));
        expScores.set(cat, exp);
        expSum += exp;
      }

      const result = new Map<AcousticPattern, number>();
      for (const [cat, exp] of expScores) {
        result.set(cat, expSum > 0 ? exp / expSum : 1 / OUTPUT_CLASSES.length);
      }

      return result;
    } catch {
      return this.uniformPrediction();
    }
  }

  // ===== Feature Extraction =====

  private extractFeatures(frames: Float32Array[]): FeatureVector {
    const numFrames = frames.length;
    const numBins = 128;

    // Average spectrum
    const avgSpectrum = new Float32Array(numBins);
    for (const frame of frames) {
      for (let i = 0; i < Math.min(frame.length, numBins); i++) {
        avgSpectrum[i] += frame[i] / numFrames;
      }
    }

    // Energy bands
    let lowE = 0, midE = 0, highE = 0;
    for (let i = 0; i < numBins; i++) {
      if (i < 43) lowE += avgSpectrum[i];
      else if (i < 86) midE += avgSpectrum[i];
      else highE += avgSpectrum[i];
    }
    const totalE = lowE + midE + highE + 1e-10;

    // Spectral centroid
    let cNum = 0, cDen = 0;
    for (let i = 0; i < numBins; i++) {
      cNum += i * avgSpectrum[i];
      cDen += avgSpectrum[i];
    }
    const centroid = cDen > 1e-10 ? cNum / cDen : 64;

    // Rolloff (85%)
    const rolloffThresh = totalE * 0.85;
    let rolloff = numBins - 1;
    let cumE = 0;
    for (let i = 0; i < numBins; i++) {
      cumE += avgSpectrum[i];
      if (cumE >= rolloffThresh) { rolloff = i; break; }
    }

    // Flatness
    let logSum = 0, linSum = 0, count = 0;
    for (let i = 0; i < numBins; i++) {
      const v = Math.max(Math.abs(avgSpectrum[i]), 1e-10);
      logSum += Math.log(v);
      linSum += v;
      count++;
    }
    const flatness = count > 0 && linSum > 0
      ? Math.exp(logSum / count) / (linSum / count)
      : 1.0;

    // Peak detection
    const peaks = this.findPeaks(avgSpectrum, 8);

    // Harmonic analysis
    const harmonic = this.analyzeHarmonics(peaks);

    // Spectral flux
    const flux = this.computeFlux(frames);

    // Temporal modulation
    const mod = this.analyzeModulation(frames);

    // Spectral contrast (mean peak-valley difference across sub-bands)
    const contrast = this.computeSpectralContrast(avgSpectrum);

    return {
      centroid,
      rolloff,
      flatness: isFinite(flatness) ? flatness : 1.0,
      harmonicScore: harmonic.score,
      harmonicCount: harmonic.count,
      fundamental: harmonic.fundamental,
      modStrength: mod.strength,
      modRegularity: mod.regularity,
      flux: isFinite(flux) ? flux : 0,
      lowBandRatio: lowE / totalE,
      midBandRatio: midE / totalE,
      spectralContrast: contrast,
    };
  }

  // ===== Gaussian Log-Likelihood =====

  private logLikelihood(features: FeatureVector, params: GaussianParams): number {
    let ll = Math.log(Math.max(params.prior, 1e-10)); // Log prior

    for (let i = 0; i < NUM_FEATURES; i++) {
      const key = FEATURE_KEYS[i];
      const x = features[key];
      const mu = params.mean[i];
      const sigma2 = Math.max(params.variance[i], 1e-10);

      // Log of Gaussian PDF: -0.5 * [log(2π) + log(σ²) + (x-μ)²/σ²]
      const diff = x - mu;
      ll += -0.5 * (Math.log(2 * Math.PI * sigma2) + (diff * diff) / sigma2);
    }

    return isFinite(ll) ? ll : -1e6;
  }

  // ===== Sub-Feature Extractors =====

  private findPeaks(spectrum: Float32Array, maxPeaks: number): Array<{ bin: number; mag: number; hz: number }> {
    const peaks: Array<{ bin: number; mag: number; hz: number }> = [];
    for (let i = 2; i < spectrum.length - 2; i++) {
      if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1] &&
          spectrum[i] > spectrum[i - 2] && spectrum[i] > spectrum[i + 2] &&
          spectrum[i] > 0.01) {
        peaks.push({ bin: i, mag: spectrum[i], hz: melBinToHz(i) });
      }
    }
    peaks.sort((a, b) => b.mag - a.mag);
    return peaks.slice(0, maxPeaks);
  }

  private analyzeHarmonics(peaks: Array<{ bin: number; mag: number; hz: number }>): { score: number; count: number; fundamental: number } {
    if (peaks.length < 2) return { score: 0, count: 0, fundamental: 0 };

    let bestScore = 0, bestCount = 0, bestF0 = 0;

    for (const cand of peaks.slice(0, 4)) {
      const f0 = cand.hz;
      if (f0 < 20) continue;

      let count = 1;
      for (let h = 2; h <= 6; h++) {
        const target = f0 * h;
        const tol = f0 * 0.15;
        if (peaks.some(p => Math.abs(p.hz - target) < tol)) count++;
      }

      const score = (count / 6) * (cand.mag > 0.05 ? 1.0 : 0.5);
      if (score > bestScore) {
        bestScore = score;
        bestCount = count;
        bestF0 = f0;
      }
    }

    return { score: bestScore, count: bestCount, fundamental: bestF0 };
  }

  private computeFlux(frames: Float32Array[]): number {
    if (frames.length < 2) return 0;
    const numBins = 128;
    let total = 0;

    for (let f = 1; f < frames.length; f++) {
      let frameFlux = 0;
      for (let i = 0; i < Math.min(frames[f].length, numBins); i++) {
        const diff = (frames[f][i] || 0) - (frames[f - 1][i] || 0);
        if (diff > 0) frameFlux += diff;
      }
      total += frameFlux;
    }

    return total / (frames.length - 1) / numBins;
  }

  private analyzeModulation(frames: Float32Array[]): { strength: number; regularity: number } {
    if (frames.length < 10) return { strength: 0, regularity: 0 };

    const energies = frames.map(f => {
      let e = 0;
      for (let i = 0; i < f.length; i++) e += f[i] * f[i];
      return Math.sqrt(e / f.length);
    });

    const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
    const variance = energies.reduce((s, e) => s + (e - mean) ** 2, 0) / energies.length;
    const strength = Math.sqrt(variance) / (mean + 1e-10);

    // Autocorrelation for regularity
    let bestCorr = 0, bestLag = 0;
    const maxLag = Math.min(energies.length / 2, 48);
    for (let lag = 2; lag < maxLag; lag++) {
      let corr = 0, norm = 0;
      for (let i = 0; i < energies.length - lag; i++) {
        corr += (energies[i] - mean) * (energies[i + lag] - mean);
        norm += (energies[i] - mean) ** 2;
      }
      const normalized = norm > 0 ? corr / norm : 0;
      if (normalized > bestCorr) { bestCorr = normalized; bestLag = lag; }
    }

    let regularity = 0;
    if (bestLag > 0 && bestCorr > 0.1) {
      let matchCount = 0;
      for (let k = 2; k <= 4; k++) {
        const multiLag = bestLag * k;
        if (multiLag >= energies.length) break;
        let c = 0, n = 0;
        for (let i = 0; i < energies.length - multiLag; i++) {
          c += (energies[i] - mean) * (energies[i + multiLag] - mean);
          n += (energies[i] - mean) ** 2;
        }
        if (n > 0 && c / n > bestCorr * 0.5) matchCount++;
      }
      regularity = matchCount / 3;
    }

    return { strength: isFinite(strength) ? strength : 0, regularity };
  }

  /**
   * Spectral Contrast — mean peak-to-valley ratio across 6 sub-bands.
   * Higher contrast = more tonal content (drones), lower = noise-like.
   */
  private computeSpectralContrast(spectrum: Float32Array): number {
    const numBands = 6;
    const bandSize = Math.floor(spectrum.length / numBands);
    let totalContrast = 0;

    for (let b = 0; b < numBands; b++) {
      const start = b * bandSize;
      const end = Math.min(start + bandSize, spectrum.length);
      let peak = -Infinity, valley = Infinity;

      for (let i = start; i < end; i++) {
        if (spectrum[i] > peak) peak = spectrum[i];
        if (spectrum[i] < valley) valley = spectrum[i];
      }

      if (isFinite(peak) && isFinite(valley)) {
        totalContrast += Math.max(0, peak - valley);
      }
    }

    return totalContrast / numBands;
  }

  private uniformPrediction(): Map<AcousticPattern, number> {
    const result = new Map<AcousticPattern, number>();
    const uniform = 1 / OUTPUT_CLASSES.length;
    for (const cat of OUTPUT_CLASSES) result.set(cat, uniform);
    return result;
  }
}
