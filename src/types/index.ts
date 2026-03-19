// ===== Core Acoustic Pattern Types =====

/**
 * Acoustic pattern categories based on sound characteristics.
 * These represent sound signature patterns, NOT specific aircraft identification.
 */
export type AcousticPattern =
  | 'MULTIROTOR'          // Multi-propeller rotary sound pattern
  | 'SINGLE_ENGINE'       // Single engine propulsion sound pattern
  | 'SINGLE_ROTOR'        // Large single rotor sound pattern
  | 'JET_PROPULSION'      // High-frequency jet/turbine sound pattern
  | 'PROPELLER_FIXED'     // Fixed-wing propeller sound pattern
  | 'BACKGROUND';         // Background ambient sound

/** Legacy category names — accepted at runtime, mapped internally */
export type LegacyCategory = 'DRONE_SMALL' | 'DRONE_LARGE' | 'HELICOPTER' | 'MISSILE' | 'AIRCRAFT' | 'AMBIENT';

/** Accepts both new and legacy pattern names for backward compat */
export type ThreatCategory = AcousticPattern | LegacyCategory;

export type SignalLevel =
  | 'STRONG' | 'MODERATE' | 'WEAK' | 'FAINT' | 'NONE';

/** Legacy severity names — accepted at runtime */
export type LegacySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Accepts both new and legacy severity names */
export type ThreatSeverity = SignalLevel | LegacySeverity;

export interface DetectionResult {
  id: string;
  /** Identified acoustic pattern type */
  acousticPattern?: ThreatCategory;
  /** @deprecated Use acousticPattern instead */
  threatCategory: ThreatCategory;
  /** Signal strength level */
  signalLevel?: ThreatSeverity;
  /** @deprecated Use signalLevel instead */
  severity: ThreatSeverity;
  confidence: number;          // 0.0 - 1.0
  distanceMeters: number;      // Estimated distance in meters
  bearingDegrees: number;      // 0-360, relative to device heading
  approachRate: number;        // m/s, negative = approaching
  timestamp: number;           // Unix timestamp ms
  spectralSignature: number[]; // Mel spectrogram snapshot (128 bins)
  frequencyPeaks: number[];    // Dominant frequency peaks in Hz
  /** Similar drone models with probability (from DroneDatabase) */
  similarDrones?: SimilarDrone[];
}

export interface SimilarDrone {
  name: string;         // e.g. "DJI Mavic 3"
  probability: number;  // 0.0 - 1.0
  category: 'civilian' | 'industrial' | 'military' | 'racing' | 'other';
}

export interface SignalTrack {
  id: string;
  detections: DetectionResult[];
  firstSeen: number;
  lastSeen: number;
  predictedETA: number | null;  // seconds until closest approach
  kalmanState: KalmanState | null;
  isActive: boolean;
}

/** @deprecated Use SignalTrack instead */
export type ThreatTrack = SignalTrack;

export interface KalmanState {
  x: number;      // estimated x position
  y: number;      // estimated y position
  vx: number;     // estimated x velocity
  vy: number;     // estimated y velocity
  P: number[][];  // covariance matrix
}

// ===== Audio Types =====

export type DeviceProfile = 'BALANCED' | 'SAMSUNG_OPTIMIZED' | 'HIGH_SENSITIVITY' | 'RAW_EXPERT';

export interface MicConfig {
  audioSource: number;
  sampleRate: number;
  channels: 1 | 2;
  bitsPerSample: 16 | 32;
  bufferSize: number;
  gainMultiplier: number;
  label: string;
  description: string;
}

export interface AudioFrame {
  pcmData: Float32Array;
  sampleRate: number;
  timestamp: number;
  rmsLevel: number;      // Root Mean Square level (0.0 - 1.0)
  peakLevel: number;     // Peak amplitude
}

export interface SpectralData {
  melSpectrogram: Float32Array;  // 128 mel bins
  mfcc: Float32Array;           // 30 MFCC coefficients
  frequencyBins: Float32Array;  // Raw FFT magnitude spectrum
  dominantFrequencies: number[];
  timestamp: number;
}

// ===== ML Types =====

export type ModelStatus = 'UNLOADED' | 'LOADING' | 'READY' | 'ERROR' | 'INFERENCE';

export interface ModelInfo {
  name: string;
  version: string;
  sizeBytes: number;
  quantization: 'FLOAT32' | 'FLOAT16' | 'INT8';
  inputShape: number[];
  outputClasses: AcousticPattern[];
  lastUpdated: number;
}

// ===== UI Theme Types =====

export type ThemeMode = 'DAY' | 'NIGHT' | 'AMOLED';

export interface TacticalTheme {
  mode: ThemeMode;
  primary: string;
  secondary: string;
  danger: string;
  warning: string;
  success: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textDim: string;
  textMuted: string;
  border: string;
  radarSweep: string;
  radarGrid: string;
  threatDot: string;
  spectrogramLow: string;
  spectrogramMid: string;
  spectrogramHigh: string;
}

// ===== Session Types =====

export interface DetectionSession {
  id: string;
  startTime: number;
  endTime: number | null;
  profile: DeviceProfile;
  detectionCount: number;
  avgInferenceMs: number;
  batteryStart: number;
  batteryEnd: number | null;
}

// ===== Settings Types =====

export interface AppSettings {
  profile: DeviceProfile;
  themeMode: ThemeMode;
  confidenceThreshold: number;      // 0.0 - 1.0
  alertVibration: boolean;
  alertSound: boolean;
  autoRecord: boolean;
  maxHistoryItems: number;
  modelAutoUpdate: boolean;
  debugMode: boolean;
}

// ===== Inference Metrics =====

export interface InferenceMetrics {
  inferenceTimeMs: number;
  preprocessTimeMs: number;
  totalTimeMs: number;
  modelVersion: string;
  delegate: 'CPU' | 'GPU' | 'NNAPI' | 'COREML' | 'NPU';
}
