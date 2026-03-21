/**
 * Real-time Audio Classifier
 *
 * Orchestrates the full pipeline:
 * Audio Frame → FFT → Mel Spectrogram → ML Inference → Detection Result
 *
 * Implements sliding window with temporal smoothing (3-frame voting)
 * to reduce false positives.
 */

import { FFTProcessor } from '../audio/FFTProcessor';
import { MelSpectrogram } from '../audio/MelSpectrogram';
import { ModelManager } from './ModelManager';
import { DOAEstimator } from '../detection/DOAEstimator';
import { getTopSimilarDrones } from '../DroneDatabase';
import { SEVERITY_THRESHOLDS, DRONE_FREQUENCY_RANGES } from '../../constants/micConfig';
import type {
  AudioFrame,
  DetectionResult,
  ThreatCategory,
  ThreatSeverity,
  SpectralData,
  InferenceMetrics,
} from '../../types';

interface ClassifierConfig {
  fftSize: number;
  numMelBins: number;
  windowSizeFrames: number;   // Number of mel frames per inference window
  hopSizeFrames: number;       // Overlap between windows
  confidenceThreshold: number;
  temporalVotingWindow: number; // Number of consecutive detections to confirm
}

const DEFAULT_CONFIG: ClassifierConfig = {
  fftSize: 2048,
  numMelBins: 128,
  windowSizeFrames: 96,        // ~2 seconds of context at 44.1kHz
  hopSizeFrames: 48,           // 50% overlap
  confidenceThreshold: 0.75,
  temporalVotingWindow: 3,
};

export class AudioClassifierEngine {
  private fft: FFTProcessor;
  private mel: MelSpectrogram;
  private model: ModelManager;
  private config: ClassifierConfig;

  // Sliding window buffer
  private melBuffer: Float32Array[] = [];
  private recentPredictions: Array<{ category: ThreatCategory; confidence: number }> = [];

  // Metrics
  private doaEstimator: DOAEstimator;

  // DOA tracking
  private doaChannels = 1; // 1=mono, 2=stereo (set by DroneMonitor based on profile)
  private lastDominantFreq = 0;
  private lastBearing = 0;
  private compassHeading = 0; // Updated via setCompassHeading()

  private totalInferences = 0;
  private totalInferenceTimeMs = 0;

  // Callbacks
  private onDetection: ((result: DetectionResult) => void) | null = null;
  private onSpectralData: ((data: SpectralData) => void) | null = null;
  private onMetrics: ((metrics: InferenceMetrics) => void) | null = null;

  constructor(config: Partial<ClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fft = new FFTProcessor(this.config.fftSize);
    this.mel = new MelSpectrogram(
      this.config.numMelBins,
      this.config.fftSize,
      44100, // Default, updated on first frame
      125,   // fMin: drone frequency lower bound
      8000,  // fMax: drone frequency upper bound
    );
    this.model = new ModelManager();
    this.doaEstimator = new DOAEstimator(44100, 0.12, 343);
  }

  /**
   * Update compass heading for absolute bearing calculation.
   */
  setCompassHeading(heading: number): void {
    this.compassHeading = heading;
  }

  /**
   * Set stereo channel count (from device profile).
   * Determines if DOA bearing estimation is possible.
   */
  setStereoChannels(channels: number): void {
    this.doaChannels = channels;
  }

  /**
   * Initialize the classifier (loads ML model).
   */
  async initialize(): Promise<void> {
    await this.model.loadModel();
  }

  /**
   * Process a single audio frame through the full pipeline.
   * Call this for every audio buffer received from AudioCapture.
   */
  async processFrame(frame: AudioFrame): Promise<DetectionResult | null> {
    const pipelineStart = performance.now();

    // Step 1: FFT
    const magnitudeSpectrum = this.fft.computeMagnitudeSpectrum(frame.pcmData);

    // Step 2: Find frequency peaks (for spectral data callback)
    const peaks = this.fft.findPeaks(magnitudeSpectrum, frame.sampleRate, 10);

    // Step 3: Mel spectrogram
    const melFrame = this.mel.computeMelFrame(magnitudeSpectrum);
    const normalizedMel = this.mel.normalize(melFrame);

    // Emit spectral data for visualization
    const spectralData: SpectralData = {
      melSpectrogram: normalizedMel,
      mfcc: this.mel.computeMFCC(melFrame),
      frequencyBins: magnitudeSpectrum,
      dominantFrequencies: peaks.map((p) => p.freq),
      timestamp: frame.timestamp,
    };
    this.onSpectralData?.(spectralData);

    // Step 4: Accumulate mel frames in sliding window (cap to prevent unbounded growth)
    if (this.melBuffer.length > this.config.windowSizeFrames * 2) {
      this.melBuffer = this.melBuffer.slice(-this.config.windowSizeFrames);
    }
    this.melBuffer.push(normalizedMel);

    // Only run inference when we have enough frames
    if (this.melBuffer.length < this.config.windowSizeFrames) {
      return null;
    }

    // Step 5: ML Inference
    const inferenceStart = performance.now();
    const windowFrames = this.melBuffer.slice(-this.config.windowSizeFrames);
    const predictions = await this.model.predict(windowFrames);
    const inferenceTimeMs = performance.now() - inferenceStart;

    // Advance sliding window
    this.melBuffer.splice(0, this.config.hopSizeFrames);

    // Step 6: Find best prediction
    let bestCategory: ThreatCategory = 'AMBIENT';
    let bestConfidence = 0;
    for (const [category, confidence] of predictions) {
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestCategory = category;
      }
    }

    // Step 7: Temporal smoothing (voting)
    this.recentPredictions.push({ category: bestCategory, confidence: bestConfidence });
    if (this.recentPredictions.length > this.config.temporalVotingWindow) {
      this.recentPredictions.shift();
    }

    // Track metrics
    this.totalInferences++;
    this.totalInferenceTimeMs += inferenceTimeMs;

    const totalTimeMs = performance.now() - pipelineStart;
    this.onMetrics?.({
      inferenceTimeMs,
      preprocessTimeMs: totalTimeMs - inferenceTimeMs,
      totalTimeMs,
      modelVersion: this.model.info?.version || 'unknown',
      delegate: 'CPU',
    });

    // Step 8: Apply confidence threshold and temporal voting
    if (bestCategory === 'AMBIENT' || bestConfidence < this.config.confidenceThreshold) {
      return null;
    }

    // Check temporal consistency
    const votingThreshold = Math.ceil(this.config.temporalVotingWindow * 0.6);
    const votes = this.recentPredictions.filter((p) => p.category === bestCategory).length;
    if (votes < votingThreshold) {
      return null; // Not enough consecutive detections
    }

    // Step 9: DOA bearing estimation
    // Only possible with stereo profile (channels=2) — interleaved L/R samples
    let bearing = 0;
    if (this.doaChannels === 2 && frame.pcmData.length >= 512 && frame.pcmData.length % 2 === 0) {
      // De-interleave stereo: [L0,R0,L1,R1,...] → separate channels
      const halfLen = frame.pcmData.length / 2;
      const leftCh = new Float32Array(halfLen);
      const rightCh = new Float32Array(halfLen);
      for (let i = 0; i < halfLen; i++) {
        leftCh[i] = frame.pcmData[i * 2];
        rightCh[i] = frame.pcmData[i * 2 + 1];
      }
      const relativeBearing = this.doaEstimator.estimateBearing(leftCh, rightCh);
      bearing = this.doaEstimator.toAbsoluteBearing(relativeBearing, this.compassHeading);
      this.lastBearing = bearing;
    } else {
      // Mono: keep last known bearing (no DOA possible)
      bearing = this.lastBearing;
    }

    // Step 10: Approach rate via Doppler on dominant frequency
    let approachRate = 0;
    const dominantFreq = peaks.length > 0 ? peaks[0].freq : 0;
    if (this.lastDominantFreq > 0 && dominantFreq > 0) {
      const knownFreq = this.getExpectedFrequency(bestCategory);
      if (knownFreq > 0) {
        approachRate = this.doaEstimator.estimateApproachRate(
          this.lastDominantFreq, dominantFreq, knownFreq
        );
        // Clamp to reasonable range (-50 to 50 m/s)
        approachRate = Math.max(-50, Math.min(50, approachRate));
      }
    }
    this.lastDominantFreq = dominantFreq;

    // Step 11: Build detection result
    const severity = this.classifySeverity(bestConfidence);
    const result: DetectionResult = {
      id: `det_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      threatCategory: bestCategory,
      severity,
      confidence: bestConfidence,
      distanceMeters: this.estimateDistance(bestCategory, frame.rmsLevel),
      bearingDegrees: isFinite(bearing) ? Math.round(bearing) : 0,
      approachRate: isFinite(approachRate) ? Math.round(approachRate * 10) / 10 : 0,
      timestamp: frame.timestamp,
      spectralSignature: Array.from(normalizedMel),
      frequencyPeaks: peaks.map((p) => p.freq),
      similarDrones: getTopSimilarDrones(bestCategory, 5),
    };

    this.onDetection?.(result);
    return result;
  }

  /**
   * Register detection callback.
   */
  onDetect(callback: (result: DetectionResult) => void): void {
    this.onDetection = callback;
  }

  /**
   * Register spectral data callback (for visualization).
   */
  onSpectral(callback: (data: SpectralData) => void): void {
    this.onSpectralData = callback;
  }

  /**
   * Register metrics callback (for performance monitoring).
   */
  onInferenceMetrics(callback: (metrics: InferenceMetrics) => void): void {
    this.onMetrics = callback;
  }

  /**
   * Update confidence threshold.
   */
  setConfidenceThreshold(threshold: number): void {
    this.config.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Reset internal buffers.
   */
  reset(): void {
    this.melBuffer = [];
    this.recentPredictions = [];
  }

  get averageInferenceMs(): number {
    return this.totalInferences > 0 ? this.totalInferenceTimeMs / this.totalInferences : 0;
  }

  get modelStatus() {
    return this.model.currentStatus;
  }

  // ===== Internal Helpers =====

  private classifySeverity(confidence: number): ThreatSeverity {
    if (confidence >= SEVERITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (confidence >= SEVERITY_THRESHOLDS.HIGH) return 'HIGH';
    if (confidence >= SEVERITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
    if (confidence >= SEVERITY_THRESHOLDS.LOW) return 'LOW';
    return 'NONE';
  }

  /**
   * Estimate distance based on Sound Pressure Level (SPL).
   * Uses known drone noise profiles and inverse square law.
   *
   * Reference SPL at 1m:
   * - Multirotor: ~70 dB
   * - Single-engine: ~85 dB
   * - Single-rotor: ~100 dB
   * - Jet propulsion: ~120 dB
   */
  private estimateDistance(category: ThreatCategory, rmsLevel: number): number {
    const referenceSPL: Record<string, number> = {
      MULTIROTOR: 70,
      SINGLE_ENGINE: 85,
      SINGLE_ROTOR: 100,
      JET_PROPULSION: 120,
      PROPELLER_FIXED: 95,
      BACKGROUND: 0,
      // Backward compat aliases
      DRONE_SMALL: 70,
      DRONE_LARGE: 85,
      HELICOPTER: 100,
      MISSILE: 120,
      AIRCRAFT: 95,
      AMBIENT: 0,
    };

    const refSPL = referenceSPL[category] || 70;

    // Convert RMS to approximate dB SPL (rough approximation)
    const measuredSPL = 20 * Math.log10(Math.max(rmsLevel, 1e-10)) + 94; // 94 dB SPL = 1 Pa

    // Inverse square law: distance = 10^((refSPL - measuredSPL) / 20)
    const estimatedDistance = Math.pow(10, (refSPL - measuredSPL) / 20);

    // Clamp to reasonable range; guard against NaN/Infinity
    const clamped = Math.max(50, Math.min(5000, Math.round(estimatedDistance)));
    return isFinite(clamped) ? clamped : 500;
  }

  /**
   * Get expected fundamental frequency for an acoustic pattern.
   * Used for Doppler approach rate calculation.
   */
  private getExpectedFrequency(category: ThreatCategory): number {
    const freqMap: Record<string, number> = {
      MULTIROTOR: 200,       // Typical quadcopter blade pass frequency
      SINGLE_ENGINE: 120,    // Larger props = lower BPF
      SINGLE_ROTOR: 80,      // Main rotor BPF
      JET_PROPULSION: 500,   // Jet/rocket noise center
      PROPELLER_FIXED: 150,  // Prop aircraft
      BACKGROUND: 0,
      // Backward compat aliases
      DRONE_SMALL: 200,
      DRONE_LARGE: 120,
      HELICOPTER: 80,
      MISSILE: 500,
      AIRCRAFT: 150,
      AMBIENT: 0,
    };
    return freqMap[category] || 0;
  }
}
