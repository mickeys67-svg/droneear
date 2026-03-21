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
  /** Detection source (acoustic, BLE Remote ID, or fused) */
  source?: DetectionSource;
  /** BLE Remote ID data (if detected via BLE) */
  remoteIdData?: RemoteIDData;
}

export interface SimilarDrone {
  name: string;         // e.g. "DJI Mavic 3"
  probability: number;  // 0.0 - 1.0
  category: 'civilian' | 'industrial' | 'military' | 'racing' | 'other';
}

// ===== BLE Remote ID Types =====

/** Detection source discriminator */
export type DetectionSource = 'ACOUSTIC' | 'BLE_REMOTE_ID' | 'FUSED';

/** ASTM F3411 Remote ID data parsed from BLE advertising packets */
export interface RemoteIDData {
  /** UAS serial number or CAA registration ID */
  serialNumber?: string;
  /** Registration/session ID */
  registrationId?: string;
  /** UAV position */
  uavLatitude?: number;
  uavLongitude?: number;
  uavAltitude?: number;        // meters above WGS84 ellipsoid
  /** Operator position */
  operatorLatitude?: number;
  operatorLongitude?: number;
  /** Flight dynamics */
  speed?: number;              // m/s ground speed
  heading?: number;            // 0-360 degrees
  verticalSpeed?: number;      // m/s (positive = ascending)
  /** UA type per ASTM F3411 */
  uaType?: UAType;
  /** ID type: how the UAS is identified */
  idType?: RemoteIDType;
  /** RSSI signal strength (dBm) */
  rssi?: number;
  /** Manufacturer name (decoded from OUI or Remote ID) */
  manufacturer?: string;
  /** Last update timestamp */
  lastSeen?: number;
}

/** ASTM F3411 UA (Unmanned Aircraft) type codes */
export type UAType =
  | 0   // None/undeclared
  | 1   // Aeroplane
  | 2   // Helicopter/Multirotor
  | 3   // Gyroplane
  | 4   // Hybrid lift (VTOL)
  | 5   // Ornithopter
  | 6   // Glider
  | 7   // Kite
  | 8   // Free balloon
  | 9   // Captive balloon
  | 10  // Airship
  | 11  // Free fall / parachute
  | 12  // Rocket
  | 13  // Tethered powered aircraft
  | 14  // Ground obstacle
  | 15; // Other

/** ASTM F3411 Remote ID type codes */
export type RemoteIDType =
  | 0   // None
  | 1   // Serial Number (ANSI/CTA-2063-A)
  | 2   // CAA Assigned Registration ID
  | 3   // UTM Assigned (UUID)
  | 4;  // Specific Session ID

export interface SignalTrack {
  id: string;
  detections: DetectionResult[];
  firstSeen: number;
  lastSeen: number;
  predictedETA: number | null;  // seconds until closest approach
  kalmanState: KalmanState | null;
  isActive: boolean;
  /** Track duration in seconds (lastSeen - firstSeen) */
  trackDurationSec?: number;
  /** Minimum distance observed during this track */
  minDistanceMeters?: number;
  /** Maximum confidence observed during this track */
  maxConfidence?: number;
  /** Peak approach speed observed (m/s, negative = approaching) */
  peakApproachRate?: number;
  /** BLE Remote ID data associated with this track */
  remoteIdData?: RemoteIDData;
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
  quantization: 'FLOAT32' | 'FLOAT16' | 'INT8' | 'NONE';
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
  /** Enable BLE Remote ID scanning alongside acoustic detection */
  bleScanEnabled?: boolean;
  /** Enable WiFi Remote ID scanning (Android only) */
  wifiScanEnabled?: boolean;
}

// ===== Inference Metrics =====

export interface InferenceMetrics {
  inferenceTimeMs: number;
  preprocessTimeMs: number;
  totalTimeMs: number;
  modelVersion: string;
  delegate: 'CPU' | 'GPU' | 'NNAPI' | 'COREML' | 'NPU';
}
