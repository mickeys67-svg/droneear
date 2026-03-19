import { type DeviceProfile, type MicConfig } from '../types';

export const DEVICE_PROFILES: Record<DeviceProfile, MicConfig> = {
  BALANCED: {
    audioSource: 6,          // VOICE_RECOGNITION
    sampleRate: 44100,       // 44.1kHz - covers full drone harmonic range
    channels: 1,
    bitsPerSample: 16,
    bufferSize: 2048,        // ~46ms latency at 44.1kHz
    gainMultiplier: 1.0,
    label: '표준 전술 (Balanced)',
    description: '44.1kHz 샘플링. 드론 프로펠러 주파수(100Hz-8kHz) 전체를 커버하는 최적 설정.',
  },
  SAMSUNG_OPTIMIZED: {
    audioSource: 9,          // UNPROCESSED (Android 7.0+)
    sampleRate: 44100,
    channels: 2,             // Stereo for DOA estimation
    bitsPerSample: 16,
    bufferSize: 2048,
    gainMultiplier: 1.2,
    label: '삼성 갤럭시 특화',
    description: '비가공 스테레오 오디오. GCC-PHAT 방향 추정 활성화.',
  },
  HIGH_SENSITIVITY: {
    audioSource: 6,
    sampleRate: 44100,
    channels: 1,
    bitsPerSample: 16,
    bufferSize: 1024,        // Lower buffer for faster response
    gainMultiplier: 2.0,
    label: '고감도 모드',
    description: '2x 게인 증폭. 원거리 탐지에 최적화. 소음이 많은 환경에서는 오탐률 증가.',
  },
  RAW_EXPERT: {
    audioSource: 9,          // UNPROCESSED
    sampleRate: 48000,       // 48kHz for maximum frequency resolution
    channels: 2,
    bitsPerSample: 16,
    bufferSize: 4096,        // Larger buffer for better FFT resolution
    gainMultiplier: 1.0,
    label: '전문가 원시 데이터',
    description: '48kHz 비가공 스테레오. 최대 주파수 해상도. 높은 CPU 사용.',
  },
};

// Drone acoustic signature reference data
export const DRONE_FREQUENCY_RANGES = {
  DRONE_SMALL: { min: 100, max: 4000, harmonics: [200, 400, 800, 1600] },
  DRONE_LARGE: { min: 50, max: 3000, harmonics: [100, 200, 400, 800] },
  HELICOPTER: { min: 20, max: 5000, harmonics: [50, 100, 200, 400] },
  MISSILE: { min: 200, max: 8000, harmonics: [500, 1000, 2000, 4000] },
  AIRCRAFT: { min: 50, max: 6000, harmonics: [100, 300, 600, 1200] },
} as const;

// Detection confidence thresholds per severity
export const SEVERITY_THRESHOLDS = {
  CRITICAL: 0.90,
  HIGH: 0.80,
  MEDIUM: 0.65,
  LOW: 0.50,
} as const;
