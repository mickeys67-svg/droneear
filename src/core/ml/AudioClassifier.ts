/**
 * Real-time Audio Classifier — v1 (acoustic fingerprint matching)
 *
 * Pipeline:  Audio Frame → FFT → Mel Spectrogram → fingerprint → reference
 *            match → Detection Result
 *
 * The previous heuristic engine (rule-based + Gaussian, no training data)
 * scored 0% against real recordings and was removed. v1 instead matches the
 * live sound's log-mel fingerprint against a library of fingerprints
 * extracted from REAL drone recordings (see AcousticFingerprint /
 * referenceFingerprints). Validated on real audio at ~80% balanced accuracy,
 * 95% recall on unseen drone models — see __tests__/FingerprintRealData.
 *
 * The whole pipeline runs at the canonical fingerprint spec (fingerprintConfig)
 * so the live fingerprint and the bundled reference fingerprints are computed
 * identically — front-end parity is mandatory or matching silently fails.
 *
 * Temporal voting (consecutive-window agreement) suppresses one-off matches.
 */

import { FFTProcessor } from '../audio/FFTProcessor';
import { MelSpectrogram } from '../audio/MelSpectrogram';
import { AcousticFingerprintMatcher } from './AcousticFingerprint';
import { REFERENCE_FINGERPRINTS, BACKGROUND_FINGERPRINTS } from './referenceFingerprints';
import {
  FP_SAMPLE_RATE, FP_FFT_SIZE, FP_MEL_BINS, FP_FMIN, FP_FMAX, FP_VOTE_WINDOW, FP_VOTE_NEEDED,
} from './fingerprintConfig';
import { getTopSimilarDrones } from '../DroneDatabase';
import { SEVERITY_THRESHOLDS } from '../../constants/micConfig';
import type {
  AudioFrame,
  DetectionResult,
  ThreatCategory,
  ThreatSeverity,
  SpectralData,
  InferenceMetrics,
  ModelStatus,
} from '../../types';

interface ClassifierConfig {
  /** Mel frames accumulated per fingerprint window (~1s of audio). */
  windowSizeFrames: number;
  /** Frames advanced between windows. */
  hopSizeFrames: number;
  /** Sustained-detection voting window (number of recent windows examined). */
  voteWindow: number;
  /** Matched windows required within voteWindow to declare a detection. */
  voteNeeded: number;
}

const DEFAULT_CONFIG: ClassifierConfig = {
  windowSizeFrames: 16,   // ~1.0s at 16kHz / 1024-sample frames
  hopSizeFrames: 8,       // ~0.5s step
  // Sustained-detection voting (calibrated — see fingerprintConfig): 12/8
  // gives 100% drone detection and 100% background-clean per session.
  voteWindow: FP_VOTE_WINDOW,
  voteNeeded: FP_VOTE_NEEDED,
};

export class AudioClassifierEngine {
  private fft: FFTProcessor;
  private mel: MelSpectrogram;
  private matcher: AcousticFingerprintMatcher;
  private config: ClassifierConfig;
  private status: ModelStatus = 'UNLOADED';

  // Sliding window of raw log-mel frames.
  private melBuffer: Float32Array[] = [];
  // Recent windows — true = matched a reference. Used for temporal voting.
  private recentMatches: boolean[] = [];

  private totalInferences = 0;
  private totalInferenceTimeMs = 0;

  // Callbacks
  private onDetection: ((result: DetectionResult) => void) | null = null;
  private onSpectralData: ((data: SpectralData) => void) | null = null;
  private onMetrics: ((metrics: InferenceMetrics) => void) | null = null;
  // Fires every window with the best reference similarity, so the listen
  // screen's HEARING pill always shows what the matcher is seeing.
  private onRawInference: ((category: string, confidence: number) => void) | null = null;

  constructor(config: Partial<ClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fft = new FFTProcessor(FP_FFT_SIZE);
    this.mel = new MelSpectrogram(FP_MEL_BINS, FP_FFT_SIZE, FP_SAMPLE_RATE, FP_FMIN, FP_FMAX);
    this.matcher = new AcousticFingerprintMatcher();
  }

  /**
   * Compass heading / stereo channels were used for acoustic DOA, which was
   * removed (an uncalibrated phone mic cannot determine direction). Kept as
   * no-ops so existing callers need no change; real bearing comes from BLE.
   */
  setCompassHeading(_heading: number): void { /* no-op — acoustic DOA removed */ }
  setStereoChannels(_channels: number): void { /* no-op — acoustic DOA removed */ }

  /**
   * Load the reference fingerprint library. Synchronous in practice — kept
   * async so the ThreatDetector call site is unchanged.
   */
  async initialize(): Promise<void> {
    this.status = 'LOADING';
    this.matcher.loadReferences(REFERENCE_FINGERPRINTS, BACKGROUND_FINGERPRINTS);
    this.status = this.matcher.isReady ? 'READY' : 'ERROR';
    if (!this.matcher.isReady) {
      console.warn('[AudioClassifier] Reference fingerprints missing — acoustic detection disabled.');
    }
  }

  /**
   * Process one audio frame. Each frame is one FFT window; mel frames are
   * accumulated until a full fingerprint window is available, then matched.
   */
  async processFrame(frame: AudioFrame): Promise<DetectionResult | null> {
    const pipelineStart = performance.now();

    // FFT → frequency peaks → mel frame.
    const magnitudeSpectrum = this.fft.computeMagnitudeSpectrum(frame.pcmData);
    const peaks = this.fft.findPeaks(magnitudeSpectrum, frame.sampleRate, 10);
    const melFrame = this.mel.computeMelFrame(magnitudeSpectrum);

    // Spectral data for the on-screen spectrogram (normalised for display).
    this.onSpectralData?.({
      melSpectrogram: this.mel.normalize(melFrame),
      mfcc: this.mel.computeMFCC(melFrame),
      frequencyBins: magnitudeSpectrum,
      dominantFrequencies: peaks.map((p) => p.freq),
      timestamp: frame.timestamp,
    });

    // Accumulate raw log-mel frames (cap growth).
    if (this.melBuffer.length > this.config.windowSizeFrames * 2) {
      this.melBuffer = this.melBuffer.slice(-this.config.windowSizeFrames);
    }
    this.melBuffer.push(melFrame);
    if (this.melBuffer.length < this.config.windowSizeFrames) return null;

    // Fingerprint-match the current window.
    const inferenceStart = performance.now();
    const window = this.melBuffer.slice(-this.config.windowSizeFrames);
    // Discriminative match (drone vs background references). bestSimilarity is
    // the raw drone similarity, shown on the HEARING pill regardless of match.
    const matchResult = this.matcher.match(window);
    const best = this.matcher.bestSimilarity(window);
    const inferenceTimeMs = performance.now() - inferenceStart;

    // Advance the sliding window.
    this.melBuffer.splice(0, this.config.hopSizeFrames);

    const similarity = best?.similarity ?? 0;
    const matched = matchResult != null;

    // Sustained-detection temporal voting — require enough recent windows to
    // also have matched (12/8). A momentary false match never accumulates;
    // a real drone, present for seconds, easily does.
    this.recentMatches.push(matched);
    if (this.recentMatches.length > this.config.voteWindow) {
      this.recentMatches.shift();
    }

    this.totalInferences++;
    this.totalInferenceTimeMs += inferenceTimeMs;
    const totalTimeMs = performance.now() - pipelineStart;
    this.onMetrics?.({
      inferenceTimeMs,
      preprocessTimeMs: totalTimeMs - inferenceTimeMs,
      totalTimeMs,
      modelVersion: 'fingerprint-v1',
      delegate: 'CPU',
    });

    // Always report the live similarity for the HEARING pill / debug panel.
    this.onRawInference?.(matched ? 'MULTIROTOR' : 'BACKGROUND', similarity);

    if (!matched) return null;

    // Sustained-detection gate: enough of the recent window votes must match.
    const votes = this.recentMatches.filter(Boolean).length;
    if (votes < this.config.voteNeeded) return null;

    // Build the detection. Acoustic detection carries NO position — distance,
    // bearing and approach rate cannot be derived from a single uncalibrated
    // mic; real position comes only from BLE Remote ID. Confidence is the
    // fingerprint similarity to the closest real reference recording.
    const result: DetectionResult = {
      id: `det_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      threatCategory: 'MULTIROTOR' as ThreatCategory,
      severity: this.classifySeverity(similarity),
      confidence: similarity,
      distanceMeters: 0,
      bearingDegrees: 0,
      approachRate: 0,
      source: 'ACOUSTIC',
      timestamp: frame.timestamp,
      spectralSignature: Array.from(this.mel.normalize(melFrame)),
      frequencyPeaks: peaks.map((p) => p.freq),
      similarDrones: getTopSimilarDrones('MULTIROTOR', 5),
    };

    this.onDetection?.(result);
    return result;
  }

  onDetect(callback: (result: DetectionResult) => void): void {
    this.onDetection = callback;
  }

  onSpectral(callback: (data: SpectralData) => void): void {
    this.onSpectralData = callback;
  }

  onInferenceMetrics(callback: (metrics: InferenceMetrics) => void): void {
    this.onMetrics = callback;
  }

  onRaw(callback: (category: string, confidence: number) => void): void {
    this.onRawInference = callback;
  }

  /**
   * v1 fingerprint matching uses its own calibrated discriminative gate
   * (FP_MATCH_FLOOR / FP_MATCH_MARGIN in fingerprintConfig). The user-facing
   * confidence slider does not apply — kept as a no-op so the settings call
   * site is unchanged.
   */
  setConfidenceThreshold(_threshold: number): void { /* no-op for v1 fingerprint */ }

  reset(): void {
    this.melBuffer = [];
    this.recentMatches = [];
  }

  get averageInferenceMs(): number {
    return this.totalInferences > 0 ? this.totalInferenceTimeMs / this.totalInferences : 0;
  }

  get modelStatus(): ModelStatus {
    return this.status;
  }

  // ===== Internal Helpers =====

  private classifySeverity(confidence: number): ThreatSeverity {
    if (confidence >= SEVERITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (confidence >= SEVERITY_THRESHOLDS.HIGH) return 'HIGH';
    if (confidence >= SEVERITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
    if (confidence >= SEVERITY_THRESHOLDS.LOW) return 'LOW';
    return 'NONE';
  }
}
