/**
 * Environment Detector — v1.0
 *
 * Detects indoor/outdoor environment using multiple signals:
 * 1. GPS accuracy — high accuracy (< 10m) = outdoor, low (> 30m) = likely indoor
 * 2. Audio ambient level — very low ambient + no variation = indoor
 * 3. Barometric pressure stability — stable = indoor (if available)
 * 4. GPS satellite count — low count = indoor
 *
 * Combined confidence score determines environment.
 * When indoor is detected with high confidence:
 * - Persistent warning banner shown
 * - TTS voice warns repeatedly (every 30s)
 * - Scan accuracy rating forced to minimum
 * - User guided to optimal outdoor position
 */

import * as Location from 'expo-location';
import { Barometer } from 'expo-sensors';

// ===== Types =====

export type EnvironmentType = 'OUTDOOR' | 'INDOOR' | 'UNCERTAIN';

export interface EnvironmentState {
  environment: EnvironmentType;
  confidence: number;         // 0.0-1.0
  gpsAccuracy: number | null; // meters
  gpsAvailable: boolean;
  barometerAvailable: boolean;
  ambientNoiseLevel: number;  // RMS from mic
  signals: EnvironmentSignals;
  detectionCapability: number; // 0-100% estimated detection accuracy
  lastUpdated: number;
}

export interface EnvironmentSignals {
  gpsScore: number;           // 0=indoor, 1=outdoor
  audioScore: number;         // 0=indoor, 1=outdoor
  barometerScore: number;     // 0=indoor, 1=outdoor
  satelliteScore: number;     // 0=indoor, 1=outdoor
}

export type EnvironmentCallback = (state: EnvironmentState) => void;

// ===== Thresholds =====

const GPS_OUTDOOR_THRESHOLD = 15;   // < 15m accuracy = likely outdoor
const GPS_INDOOR_THRESHOLD = 40;    // > 40m accuracy = likely indoor
const AMBIENT_OUTDOOR_MIN = 0.005;  // Outdoor has some ambient noise
const AMBIENT_INDOOR_MAX = 0.002;   // Dead quiet = indoor
const PRESSURE_VARIANCE_OUTDOOR = 0.3; // hPa variance — outdoor has more

const UPDATE_INTERVAL_MS = 10000;   // Check every 10 seconds
const PRESSURE_HISTORY_SIZE = 10;

export class EnvironmentDetector {
  private state: EnvironmentState = {
    environment: 'UNCERTAIN',
    confidence: 0,
    gpsAccuracy: null,
    gpsAvailable: false,
    barometerAvailable: false,
    ambientNoiseLevel: 0,
    signals: { gpsScore: 0.5, audioScore: 0.5, barometerScore: 0.5, satelliteScore: 0.5 },
    detectionCapability: 50,
    lastUpdated: Date.now(),
  };

  private callback: EnvironmentCallback | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private initialTimeout: ReturnType<typeof setTimeout> | null = null;
  private barometerSub: any = null;
  private pressureHistory: number[] = [];
  private ambientLevels: number[] = [];
  private locationWatcher: Location.LocationSubscription | null = null;
  private lastGpsAccuracy = 999;

  // ===== Public API =====

  setCallback(cb: EnvironmentCallback): void {
    this.callback = cb;
  }

  async start(): Promise<void> {
    await this.startGPSMonitoring();
    await this.startBarometerMonitoring();

    // Periodic environment evaluation
    this.updateInterval = setInterval(() => {
      this.evaluate();
    }, UPDATE_INTERVAL_MS);

    // Initial evaluation after 3 seconds
    this.initialTimeout = setTimeout(() => this.evaluate(), 3000);
  }

  stop(): void {
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout);
      this.initialTimeout = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.barometerSub) {
      this.barometerSub.remove();
      this.barometerSub = null;
    }
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }
    this.pressureHistory = [];
    this.ambientLevels = [];
  }

  /**
   * Feed ambient audio level from mic (called from useThreatDetector).
   */
  updateAmbientLevel(rms: number): void {
    this.ambientLevels.push(rms);
    if (this.ambientLevels.length > 30) {
      this.ambientLevels.shift();
    }
  }

  getState(): EnvironmentState {
    return { ...this.state };
  }

  /**
   * Estimated detection capability percentage based on environment.
   * Indoor: 5-15%   Uncertain: 30-60%   Outdoor: 70-95%
   */
  getDetectionCapability(): number {
    return this.state.detectionCapability;
  }

  // ===== GPS Monitoring =====

  private async startGPSMonitoring(): Promise<void> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        this.state.gpsAvailable = false;
        return;
      }

      this.state.gpsAvailable = true;

      // Watch position for continuous accuracy data
      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          this.lastGpsAccuracy = location.coords.accuracy ?? 999;
          this.state.gpsAccuracy = this.lastGpsAccuracy;
        },
      );
    } catch (e) {
      console.warn('[EnvironmentDetector] GPS init failed:', e);
      this.state.gpsAvailable = false;
    }
  }

  // ===== Barometer Monitoring =====

  private async startBarometerMonitoring(): Promise<void> {
    try {
      const available = await Barometer.isAvailableAsync();
      if (!available) {
        this.state.barometerAvailable = false;
        return;
      }

      this.state.barometerAvailable = true;
      Barometer.setUpdateInterval(2000);

      this.barometerSub = Barometer.addListener(({ pressure }) => {
        this.pressureHistory.push(pressure);
        if (this.pressureHistory.length > PRESSURE_HISTORY_SIZE) {
          this.pressureHistory.shift();
        }
      });
    } catch (e) {
      console.warn('[EnvironmentDetector] Barometer init failed:', e);
      this.state.barometerAvailable = false;
    }
  }

  // ===== Environment Evaluation =====

  private evaluate(): void {
    const signals = this.calculateSignals();
    this.state.signals = signals;

    // Weighted combination:
    // GPS accuracy is strongest signal (weight 0.45)
    // Audio ambient is secondary (weight 0.25)
    // Barometer variance (weight 0.15)
    // Satellite/GPS availability (weight 0.15)
    const weights = {
      gps: this.state.gpsAvailable ? 0.45 : 0,
      audio: 0.25,
      barometer: this.state.barometerAvailable ? 0.15 : 0,
      satellite: this.state.gpsAvailable ? 0.15 : 0,
    };

    const totalWeight = weights.gps + weights.audio + weights.barometer + weights.satellite;
    if (totalWeight === 0) {
      this.state.environment = 'UNCERTAIN';
      this.state.confidence = 0;
      this.state.detectionCapability = 30;
      this.emit();
      return;
    }

    const outdoorScore = (
      signals.gpsScore * weights.gps +
      signals.audioScore * weights.audio +
      signals.barometerScore * weights.barometer +
      signals.satelliteScore * weights.satellite
    ) / totalWeight;

    // Determine environment
    if (outdoorScore >= 0.65) {
      this.state.environment = 'OUTDOOR';
      this.state.confidence = Math.min((outdoorScore - 0.5) * 2, 1);
      // Outdoor: 70-95% detection based on confidence
      this.state.detectionCapability = Math.round(70 + this.state.confidence * 25);
    } else if (outdoorScore <= 0.35) {
      this.state.environment = 'INDOOR';
      this.state.confidence = Math.min((0.5 - outdoorScore) * 2, 1);
      // Indoor: 5-15% detection (basically nothing works)
      this.state.detectionCapability = Math.round(5 + (1 - this.state.confidence) * 10);
    } else {
      this.state.environment = 'UNCERTAIN';
      this.state.confidence = 1 - Math.abs(outdoorScore - 0.5) * 2;
      // Uncertain: 30-60%
      this.state.detectionCapability = Math.round(30 + outdoorScore * 30);
    }

    this.state.lastUpdated = Date.now();
    this.emit();
  }

  private calculateSignals(): EnvironmentSignals {
    // 1. GPS accuracy score
    let gpsScore = 0.5;
    if (this.state.gpsAvailable && this.lastGpsAccuracy < 999) {
      if (this.lastGpsAccuracy < GPS_OUTDOOR_THRESHOLD) {
        gpsScore = 1.0;
      } else if (this.lastGpsAccuracy > GPS_INDOOR_THRESHOLD) {
        gpsScore = 0.0;
      } else {
        // Linear interpolation between thresholds
        gpsScore = 1 - (this.lastGpsAccuracy - GPS_OUTDOOR_THRESHOLD) / (GPS_INDOOR_THRESHOLD - GPS_OUTDOOR_THRESHOLD);
      }
    }

    // 2. Audio ambient level score
    let audioScore = 0.5;
    if (this.ambientLevels.length >= 5) {
      const avgRms = this.ambientLevels.reduce((a, b) => a + b, 0) / this.ambientLevels.length;
      const variance = this.ambientLevels.reduce((sum, v) => sum + (v - avgRms) ** 2, 0) / this.ambientLevels.length;

      this.state.ambientNoiseLevel = avgRms;

      // Dead quiet with no variation = likely indoor
      if (avgRms < AMBIENT_INDOOR_MAX && variance < 0.000001) {
        audioScore = 0.1;
      } else if (avgRms > AMBIENT_OUTDOOR_MIN) {
        // Some ambient noise with variation = likely outdoor
        audioScore = Math.min(0.6 + variance * 1000, 1.0);
      } else {
        audioScore = 0.4;
      }
    }

    // 3. Barometer variance score
    let barometerScore = 0.5;
    if (this.pressureHistory.length >= 5) {
      const avgPressure = this.pressureHistory.reduce((a, b) => a + b, 0) / this.pressureHistory.length;
      const variance = this.pressureHistory.reduce((sum, v) => sum + (v - avgPressure) ** 2, 0) / this.pressureHistory.length;
      const stdDev = Math.sqrt(variance);

      // Outdoor: more pressure fluctuation from wind
      if (stdDev > PRESSURE_VARIANCE_OUTDOOR) {
        barometerScore = 0.9;
      } else if (stdDev < 0.05) {
        barometerScore = 0.2; // Very stable = indoor
      } else {
        barometerScore = 0.3 + (stdDev / PRESSURE_VARIANCE_OUTDOOR) * 0.5;
      }
    }

    // 4. Satellite/GPS availability score
    let satelliteScore = 0.5;
    if (!this.state.gpsAvailable) {
      satelliteScore = 0.2; // No GPS at all = possibly indoor
    } else if (this.lastGpsAccuracy < 10) {
      satelliteScore = 1.0; // Excellent GPS = definitely outdoor
    } else if (this.lastGpsAccuracy > 50) {
      satelliteScore = 0.1; // Terrible GPS = likely indoor
    } else {
      satelliteScore = 1 - (this.lastGpsAccuracy - 10) / 40;
    }

    return { gpsScore, audioScore, barometerScore, satelliteScore };
  }

  private emit(): void {
    this.callback?.(this.state);
  }

  dispose(): void {
    this.stop();
  }
}
