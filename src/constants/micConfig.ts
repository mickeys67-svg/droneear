import { type DeviceProfile, type MicConfig } from '../types';

// Single automatic microphone configuration. Mono capture at 16 kHz from the
// phone's default input — which the OS already routes to an external mic when
// one is connected. 16 kHz is the canonical fingerprint rate (fingerprintConfig)
// so the live audio and the reference library stay front-end-identical; mono
// because acoustic direction-of-arrival was removed (a single uncalibrated
// phone mic cannot determine direction).
export const DEVICE_PROFILES: Record<DeviceProfile, MicConfig> = {
  AUTO: {
    audioSource: 6,          // VOICE_RECOGNITION
    // 16 kHz: the drone acoustic signature lives below 8 kHz, and this is the
    // canonical rate the v1 fingerprint matcher and its reference library are
    // built at (see fingerprintConfig). Capturing natively at 16 kHz keeps
    // the live fingerprint and the bundled references front-end-identical.
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    bufferSize: 1024,        // one FFT window (~64ms at 16kHz)
    gainMultiplier: 1.0,
    label: 'Auto',
    description: 'Automatic — uses the phone\'s default microphone, or an external mic when connected.',
  },
};

// Drone acoustic signature reference data
export const DRONE_FREQUENCY_RANGES = {
  DRONE_SMALL: { min: 100, max: 4000, harmonics: [200, 400, 800, 1600] },
  DRONE_LARGE: { min: 50, max: 3000, harmonics: [100, 200, 400, 800] },
  HELICOPTER: { min: 20, max: 5000, harmonics: [50, 100, 200, 400] },
  JET_PROPULSION: { min: 200, max: 8000, harmonics: [500, 1000, 2000, 4000] },
  AIRCRAFT: { min: 50, max: 6000, harmonics: [100, 300, 600, 1200] },
} as const;

// Detection confidence thresholds per severity
export const SEVERITY_THRESHOLDS = {
  CRITICAL: 0.90,
  HIGH: 0.80,
  MEDIUM: 0.65,
  LOW: 0.50,
} as const;
