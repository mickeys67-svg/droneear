import { useDetectionStore } from '../src/stores/detectionStore';
import type { DetectionResult, ThreatSeverity, ThreatCategory } from '../src/types';

// Helper to create a detection result
function makeDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    id: `det_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    threatCategory: 'DRONE_SMALL' as ThreatCategory,
    severity: 'HIGH' as ThreatSeverity,
    confidence: 0.85,
    distanceMeters: 500,
    bearingDegrees: 45,
    approachRate: -10,
    timestamp: Date.now(),
    spectralSignature: new Array(128).fill(0),
    frequencyPeaks: [200, 400, 800],
    ...overrides,
  };
}

describe('DetectionStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useDetectionStore.setState({
      isScanning: false,
      currentThreats: [],
      latestDetection: null,
      audioLevel: 0,
      spectralData: new Array(128).fill(0),
      inferenceTimeMs: 0,
    });
  });

  describe('scanning state', () => {
    it('should start with scanning off', () => {
      expect(useDetectionStore.getState().isScanning).toBe(false);
    });

    it('should toggle scanning', () => {
      useDetectionStore.getState().setScanning(true);
      expect(useDetectionStore.getState().isScanning).toBe(true);

      useDetectionStore.getState().setScanning(false);
      expect(useDetectionStore.getState().isScanning).toBe(false);
    });
  });

  describe('addDetection', () => {
    it('should add detection and set latestDetection', () => {
      const det = makeDetection();
      useDetectionStore.getState().addDetection(det);

      const state = useDetectionStore.getState();
      expect(state.latestDetection).toEqual(det);
      expect(state.currentThreats.length).toBe(1);
    });

    it('should create separate tracks for different categories', () => {
      const drone = makeDetection({ threatCategory: 'DRONE_SMALL', bearingDegrees: 45 });
      const heli = makeDetection({ threatCategory: 'HELICOPTER', bearingDegrees: 180 });

      useDetectionStore.getState().addDetection(drone);
      useDetectionStore.getState().addDetection(heli);

      expect(useDetectionStore.getState().currentThreats.length).toBe(2);
    });

    it('should merge detections for same category within 30° bearing', () => {
      const det1 = makeDetection({ threatCategory: 'DRONE_SMALL', bearingDegrees: 45 });
      const det2 = makeDetection({ threatCategory: 'DRONE_SMALL', bearingDegrees: 50 }); // Within 30°

      useDetectionStore.getState().addDetection(det1);
      useDetectionStore.getState().addDetection(det2);

      const threats = useDetectionStore.getState().currentThreats;
      expect(threats.length).toBe(1); // Merged into same track
      expect(threats[0].detections.length).toBe(2);
    });

    it('should limit to 10 tracks', () => {
      for (let i = 0; i < 15; i++) {
        const det = makeDetection({
          threatCategory: 'DRONE_SMALL',
          bearingDegrees: i * 40, // Different bearings to create separate tracks
        });
        useDetectionStore.getState().addDetection(det);
      }

      expect(useDetectionStore.getState().currentThreats.length).toBeLessThanOrEqual(10);
    });
  });

  describe('acknowledgeDetection', () => {
    it('should clear latestDetection', () => {
      useDetectionStore.getState().addDetection(makeDetection());
      expect(useDetectionStore.getState().latestDetection).not.toBeNull();

      useDetectionStore.getState().acknowledgeDetection();
      expect(useDetectionStore.getState().latestDetection).toBeNull();
    });
  });

  describe('clearThreats', () => {
    it('should remove all threats and latestDetection', () => {
      useDetectionStore.getState().addDetection(makeDetection());
      useDetectionStore.getState().addDetection(makeDetection({ threatCategory: 'MISSILE', bearingDegrees: 200 }));

      useDetectionStore.getState().clearThreats();
      const state = useDetectionStore.getState();
      expect(state.currentThreats.length).toBe(0);
      expect(state.latestDetection).toBeNull();
    });
  });

  describe('audio level', () => {
    it('should update audio level', () => {
      useDetectionStore.getState().setAudioLevel(0.75);
      expect(useDetectionStore.getState().audioLevel).toBe(0.75);
    });
  });

  describe('inference time', () => {
    it('should track inference time', () => {
      useDetectionStore.getState().setInferenceTime(23.5);
      expect(useDetectionStore.getState().inferenceTimeMs).toBe(23.5);
    });
  });
});
