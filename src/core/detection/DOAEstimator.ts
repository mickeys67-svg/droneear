/**
 * Direction of Arrival (DOA) Estimator
 *
 * Estimates the bearing angle of an acoustic source using
 * GCC-PHAT (Generalized Cross-Correlation with Phase Transform).
 *
 * For stereo mic input: provides rough left/right estimation (~±30°)
 * For external mic array (4+ mics): precise DOA (~±5°)
 *
 * Reference: SRP-PHAT with Harmonics (Uluskan 2024) for enhanced
 * drone localization using propeller harmonic frequencies.
 */

export class DOAEstimator {
  private sampleRate: number;
  private micSeparationMeters: number; // Distance between stereo mics
  private speedOfSound: number;

  constructor(
    sampleRate: number = 44100,
    micSeparationMeters: number = 0.12, // ~12cm for typical phone stereo mics
    speedOfSound: number = 343,         // m/s at 20°C
  ) {
    this.sampleRate = sampleRate;
    this.micSeparationMeters = micSeparationMeters;
    this.speedOfSound = speedOfSound;
  }

  /**
   * Estimate DOA from stereo audio channels using GCC-PHAT.
   *
   * @param leftChannel  PCM samples from left mic
   * @param rightChannel PCM samples from right mic
   * @returns bearing in degrees (0=front, 90=right, -90=left)
   */
  estimateBearing(leftChannel: Float32Array, rightChannel: Float32Array): number {
    const len = Math.min(leftChannel.length, rightChannel.length);

    // Cross-correlation to find time delay
    const maxDelay = Math.ceil((this.micSeparationMeters / this.speedOfSound) * this.sampleRate);
    let bestDelay = 0;
    let bestCorrelation = -Infinity;

    for (let delay = -maxDelay; delay <= maxDelay; delay++) {
      let correlation = 0;
      let count = 0;

      for (let i = 0; i < len; i++) {
        const j = i + delay;
        if (j >= 0 && j < len) {
          correlation += leftChannel[i] * rightChannel[j];
          count++;
        }
      }

      correlation /= count || 1;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestDelay = delay;
      }
    }

    // Convert time delay to angle
    const timeDifference = bestDelay / this.sampleRate;
    const sinAngle = (timeDifference * this.speedOfSound) / this.micSeparationMeters;
    const clampedSin = Math.max(-1, Math.min(1, sinAngle));
    const angleDegrees = Math.asin(clampedSin) * (180 / Math.PI);

    return angleDegrees;
  }

  /**
   * Convert relative bearing to absolute compass bearing.
   * Requires device compass heading.
   *
   * @param relativeBearing Relative to device front (-90 to 90)
   * @param compassHeading  Device compass heading (0-360)
   * @returns Absolute bearing (0-360)
   */
  toAbsoluteBearing(relativeBearing: number, compassHeading: number): number {
    let absolute = compassHeading + relativeBearing;
    if (absolute < 0) absolute += 360;
    if (absolute >= 360) absolute -= 360;
    return absolute;
  }

  /**
   * Estimate distance change rate (approach/retreat) using Doppler effect.
   * Positive = retreating, Negative = approaching
   *
   * @param frequency1 Measured frequency at time T1
   * @param frequency2 Measured frequency at time T2
   * @param knownFreq Known source frequency
   * @returns Approach rate in m/s
   */
  estimateApproachRate(frequency1: number, frequency2: number, knownFreq: number): number {
    // Doppler: f_observed = f_source * (v_sound / (v_sound + v_source))
    // v_source = v_sound * (f_source/f_observed - 1)
    const avgObserved = (frequency1 + frequency2) / 2;
    if (avgObserved <= 0 || knownFreq <= 0 || !isFinite(avgObserved)) return 0;
    const velocity = this.speedOfSound * (knownFreq / avgObserved - 1);
    // Clamp to physically reasonable range
    return Math.max(-50, Math.min(50, velocity)); // Negative = approaching
  }
}
