/**
 * Microphone Quality Monitor
 *
 * Real-time analysis of audio input quality:
 * - SNR (Signal-to-Noise Ratio) estimation
 * - Wind noise detection (low-frequency energy spike)
 * - Clipping detection (sample saturation)
 * - Ambient noise level classification
 */

export type MicQuality = 'GOOD' | 'FAIR' | 'POOR';
export type MicWarning = 'WIND' | 'NOISE' | 'CLIPPING' | null;

export interface MicQualityReport {
  quality: MicQuality;
  snrDb: number;
  noiseFloorDb: number;
  clippingRatio: number;
  windDetected: boolean;
  warning: MicWarning;
}

// Sliding window for noise floor estimation
const NOISE_HISTORY_SIZE = 50;
const WIND_THRESHOLD = 0.6; // Ratio of low-freq energy to total
const CLIPPING_THRESHOLD = 0.95; // Sample value near max
const CLIPPING_RATIO_ALERT = 0.01; // 1% of samples clipping

export class MicQualityMonitor {
  private noiseFloorHistory: number[] = [];
  private estimatedNoiseFloor = 0.001;

  /**
   * Analyze an audio frame and return quality report.
   */
  analyze(pcmData: Float32Array): MicQualityReport {
    if (pcmData.length === 0) {
      return {
        quality: 'POOR',
        snrDb: 0,
        noiseFloorDb: -60,
        clippingRatio: 0,
        windDetected: false,
        warning: null,
      };
    }

    const rms = this.calculateRMS(pcmData);

    // Update noise floor (track minimum RMS over time)
    this.noiseFloorHistory.push(rms);
    if (this.noiseFloorHistory.length > NOISE_HISTORY_SIZE) {
      this.noiseFloorHistory.shift();
    }
    let minVal = this.noiseFloorHistory[0] ?? 0.001;
    for (let i = 1; i < this.noiseFloorHistory.length; i++) {
      if (this.noiseFloorHistory[i] < minVal) minVal = this.noiseFloorHistory[i];
    }
    this.estimatedNoiseFloor = minVal || 0.001;

    // SNR estimation
    const snrDb = 20 * Math.log10(Math.max(rms, 1e-10) / Math.max(this.estimatedNoiseFloor, 1e-10));
    const noiseFloorDb = 20 * Math.log10(Math.max(this.estimatedNoiseFloor, 1e-10));

    // Wind detection: check if low-frequency energy dominates
    const windDetected = this.detectWind(pcmData);

    // Clipping detection
    let clippedSamples = 0;
    for (let i = 0; i < pcmData.length; i++) {
      if (Math.abs(pcmData[i]) > CLIPPING_THRESHOLD) {
        clippedSamples++;
      }
    }
    const clippingRatio = clippedSamples / pcmData.length;

    // Determine warning
    let warning: MicWarning = null;
    if (clippingRatio > CLIPPING_RATIO_ALERT) {
      warning = 'CLIPPING';
    } else if (windDetected) {
      warning = 'WIND';
    } else if (this.estimatedNoiseFloor > 0.05) {
      warning = 'NOISE';
    }

    // Quality classification
    let quality: MicQuality;
    if (snrDb > 20 && !windDetected && clippingRatio < CLIPPING_RATIO_ALERT) {
      quality = 'GOOD';
    } else if (snrDb > 10 && clippingRatio < 0.05) {
      quality = 'FAIR';
    } else {
      quality = 'POOR';
    }

    return {
      quality,
      snrDb: Math.round(snrDb * 10) / 10,
      noiseFloorDb: Math.round(noiseFloorDb * 10) / 10,
      clippingRatio: Math.round(clippingRatio * 1000) / 1000,
      windDetected,
      warning,
    };
  }

  /**
   * Detect wind noise by checking low-frequency energy ratio.
   * Wind produces strong energy below ~200Hz with characteristic fluctuation.
   */
  private detectWind(pcmData: Float32Array): boolean {
    // Simple heuristic: compute energy in first 10% of spectrum vs total
    // This approximates low-frequency dominance without full FFT
    const windowSize = Math.min(256, pcmData.length);
    let lowEnergy = 0;
    let totalEnergy = 0;

    // Use difference signal as wind proxy (wind = correlated low-freq noise)
    for (let i = 1; i < windowSize; i++) {
      const diff = pcmData[i] - pcmData[i - 1];
      const val = pcmData[i] * pcmData[i];
      totalEnergy += val;

      // Low frequency approximation: if consecutive samples are very similar,
      // the energy is low-frequency dominant
      if (Math.abs(diff) < 0.05 && Math.abs(pcmData[i]) > 0.1) {
        lowEnergy += val;
      }
    }

    if (totalEnergy < 1e-10) return false;
    return (lowEnergy / totalEnergy) > WIND_THRESHOLD;
  }

  private calculateRMS(pcm: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) {
      sum += pcm[i] * pcm[i];
    }
    return Math.sqrt(sum / pcm.length);
  }

  reset(): void {
    this.noiseFloorHistory = [];
    this.estimatedNoiseFloor = 0.001;
  }
}
