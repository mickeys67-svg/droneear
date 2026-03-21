/**
 * Drone Monitor — v4.0
 *
 * Acoustic pattern analysis engine.
 *
 * Major fixes:
 * - Passes raw PCM data in onAudioLevel callback (fixes broken mic monitoring)
 * - Audio recording error handler with auto-recovery
 * - Compass heading integration via SensorEnforcementManager
 * - Stereo/mono profile awareness for DOA
 * - Recording health watchdog (detects stalled capture)
 */

import { AudioCapture } from '../audio/AudioCapture';
import { AudioClassifierEngine } from '../ml/AudioClassifier';
import { DEVICE_PROFILES } from '../../constants/micConfig';
import type {
  DetectionResult,
  DeviceProfile,
  SpectralData,
  InferenceMetrics,
  AudioFrame,
} from '../../types';

export interface ThreatDetectorCallbacks {
  onDetection?: (result: DetectionResult) => void;
  onSpectralData?: (data: SpectralData) => void;
  onAudioLevel?: (rms: number, pcmData: Float32Array) => void; // FIXED: passes PCM data
  onMetrics?: (metrics: InferenceMetrics) => void;
  onStatusChange?: (status: ThreatDetectorStatus) => void;
  onRecordingError?: (error: string) => void;
}

export type ThreatDetectorStatus = 'INITIALIZING' | 'READY' | 'SCANNING' | 'STOPPED' | 'ERROR' | 'RECOVERING';

export class ThreatDetector {
  private audioCapture: AudioCapture;
  private classifier: AudioClassifierEngine;
  private callbacks: ThreatDetectorCallbacks;
  private isInitialized = false;
  private frameSkipCounter = 0;
  private frameSkipRate = 2;
  private currentProfile: DeviceProfile = 'BALANCED';

  // Recording health watchdog
  private lastFrameTime = 0;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 3;
  private isRecovering = false;

  constructor(callbacks: ThreatDetectorCallbacks = {}) {
    this.callbacks = callbacks;
    this.audioCapture = new AudioCapture('BALANCED');
    this.classifier = new AudioClassifierEngine();
  }

  async initialize(): Promise<boolean> {
    this.callbacks.onStatusChange?.('INITIALIZING');

    try {
      const hasPermission = await this.audioCapture.requestPermission();
      if (!hasPermission) {
        console.error('[DroneMonitor] Microphone permission denied');
        this.callbacks.onStatusChange?.('ERROR');
        return false;
      }

      await this.classifier.initialize();

      this.classifier.onDetect((result) => {
        this.callbacks.onDetection?.(result);
      });

      this.classifier.onSpectral((data) => {
        this.callbacks.onSpectralData?.(data);
      });

      this.classifier.onInferenceMetrics((metrics) => {
        this.callbacks.onMetrics?.(metrics);
      });

      this.isInitialized = true;
      this.callbacks.onStatusChange?.('READY');
      return true;
    } catch (error) {
      console.error('[DroneMonitor] Initialization failed:', error);
      this.callbacks.onStatusChange?.('ERROR');
      return false;
    }
  }

  /**
   * Start scanning with error recovery and PCM passthrough.
   */
  startScanning(): void {
    if (!this.isInitialized) {
      console.error('[DroneMonitor] Not initialized');
      return;
    }

    this.classifier.reset();
    this.frameSkipCounter = 0;
    this.lastFrameTime = Date.now();
    this.recoveryAttempts = 0;

    this.startAudioCapture();
    this.startWatchdog();

    this.callbacks.onStatusChange?.('SCANNING');
  }

  private startAudioCapture(): void {
    try {
      this.audioCapture.start((frame: AudioFrame) => {
        this.lastFrameTime = Date.now();

        // CRITICAL FIX: Pass raw PCM data for mic quality monitoring
        this.callbacks.onAudioLevel?.(frame.rmsLevel, frame.pcmData);

        // Frame skip for CPU optimization
        this.frameSkipCounter++;
        if (this.frameSkipCounter % this.frameSkipRate !== 0) return;

        // ML pipeline (try/catch guards synchronous throws before promise)
        try {
          this.classifier.processFrame(frame).catch((err) => {
            console.warn('[DroneMonitor] Frame processing error:', err);
            this.callbacks.onRecordingError?.(`Inference error: ${err instanceof Error ? err.message : String(err)}`);
          });
        } catch (err) {
          console.warn('[DroneMonitor] Sync frame error:', err);
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[DroneMonitor] Audio capture start failed:', msg);
      this.callbacks.onRecordingError?.(msg);
      this.attemptRecovery();
    }
  }

  /**
   * Recording health watchdog — detects stalled audio capture.
   * If no frames received for 5s, attempts auto-recovery.
   */
  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (!this.audioCapture.recording) return;

      const elapsed = Date.now() - this.lastFrameTime;
      if (elapsed > 5000) {
        console.warn(`[DroneMonitor] No audio frames for ${elapsed}ms — attempting recovery`);
        this.callbacks.onRecordingError?.('Audio capture stalled');
        this.attemptRecovery();
      }
    }, 3000);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * Auto-recovery: stop + restart audio capture.
   */
  private async attemptRecovery(): Promise<void> {
    // Prevent concurrent recovery attempts
    if (this.isRecovering) return;
    this.isRecovering = true;

    while (this.recoveryAttempts < this.maxRecoveryAttempts) {
      this.recoveryAttempts++;
      this.callbacks.onStatusChange?.('RECOVERING');
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(`[DroneMonitor] Recovery attempt ${this.recoveryAttempts}/${this.maxRecoveryAttempts}`);

      try {
        await this.audioCapture.stop();
      } catch {}

      // Exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * this.recoveryAttempts));

      try {
        this.startAudioCapture();
        this.callbacks.onStatusChange?.('SCANNING');
        this.isRecovering = false;
        return; // Recovery succeeded
      } catch (err) {
        console.error(`[DroneMonitor] Recovery attempt ${this.recoveryAttempts} failed:`, err);
      }
    }

    // All attempts exhausted
    this.isRecovering = false;
    console.error('[DroneMonitor] Max recovery attempts reached');
    this.callbacks.onStatusChange?.('ERROR');
    this.callbacks.onRecordingError?.('Recording failed after multiple retries');
  }

  /**
   * Update compass heading for DOA bearing estimation.
   */
  setCompassHeading(heading: number): void {
    this.classifier.setCompassHeading(heading);
  }

  async stopScanning(): Promise<void> {
    this.stopWatchdog();
    await this.audioCapture.stop();
    this.classifier.reset();
    this.callbacks.onStatusChange?.('STOPPED');
  }

  setProfile(profile: DeviceProfile): void {
    this.currentProfile = profile;
    this.audioCapture.setProfile(profile);

    // Tell classifier about stereo capability
    const config = DEVICE_PROFILES[profile];
    this.classifier.setStereoChannels(config.channels);
  }

  setConfidenceThreshold(threshold: number): void {
    this.classifier.setConfidenceThreshold(threshold);
  }

  setFrameSkipRate(rate: number): void {
    this.frameSkipRate = Math.max(1, Math.min(10, rate));
  }

  get isStereoProfile(): boolean {
    const config = DEVICE_PROFILES[this.currentProfile];
    return config.channels === 2;
  }

  get isScanning(): boolean {
    return this.audioCapture.recording;
  }

  get modelStatus() {
    return this.classifier.modelStatus;
  }

  get avgInferenceMs(): number {
    return this.classifier.averageInferenceMs;
  }
}
