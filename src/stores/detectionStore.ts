import { create } from 'zustand';
import { KalmanFilter2D } from '../core/detection/KalmanFilter';
import type { DetectionResult, ThreatTrack, RemoteIDData } from '../types';
import type { FusedDetection } from '../core/detection/DetectionFusionEngine';
import type { MicQuality, MicWarning } from '../core/audio/MicQualityMonitor';

// Singleton Kalman filter instance (shared across all tracks)
const kalman = new KalmanFilter2D(0.5, 0.5, 10);

interface DetectionState {
  // Real-time state
  isScanning: boolean;
  currentThreats: ThreatTrack[];
  latestDetection: DetectionResult | null;
  audioLevel: number;         // 0.0 - 1.0 RMS
  spectralData: number[];     // Current mel spectrogram snapshot (128 bins)
  inferenceTimeMs: number;    // Last inference latency
  batteryLevel: number;       // 0-100

  // Mic quality
  micQuality: MicQuality;
  micSnrDb: number;
  micWarning: MicWarning;

  // Track selection & dismissal (map/UI interactions)
  selectedTrackId: string | null;
  hiddenTrackIds: string[];

  // BLE Remote ID
  bleDevices: Record<string, RemoteIDData>;
  bleScanActive: boolean;

  // Fused detections (acoustic + BLE)
  fusedDetections: FusedDetection[];

  // User location (shared across components to avoid duplicate GPS watchers)
  userLocation: { latitude: number; longitude: number } | null;

  // Feedback
  feedbackPending: boolean;
  feedbackDetectionId: string | null;

  // Actions
  setScanning: (active: boolean) => void;
  addDetection: (result: DetectionResult) => void;
  updateThreatTrack: (trackId: string, detection: DetectionResult) => void;
  removeThreatTrack: (trackId: string) => void;
  clearThreats: () => void;
  setAudioLevel: (level: number) => void;
  setSpectralData: (data: number[]) => void;
  setInferenceTime: (ms: number) => void;
  acknowledgeDetection: () => void;
  setBatteryLevel: (level: number) => void;
  setMicQuality: (quality: MicQuality, snrDb: number, warning: MicWarning) => void;
  setFeedbackPending: (pending: boolean, detectionId?: string | null) => void;
  setFusedDetections: (detections: FusedDetection[]) => void;
  setBLEScanActive: (active: boolean) => void;
  addBLEDevice: (id: string, data: RemoteIDData) => void;
  removeBLEDevice: (id: string) => void;
  clearBLEDevices: () => void;
  setUserLocation: (loc: { latitude: number; longitude: number } | null) => void;
  selectTrack: (trackId: string | null) => void;
  hideTrackFromMap: (trackId: string) => void;
  unhideTrack: (trackId: string) => void;
  clearHiddenTracks: () => void;
}

export const useDetectionStore = create<DetectionState>((set, get) => ({
  isScanning: false,
  currentThreats: [],
  latestDetection: null,
  audioLevel: 0,
  spectralData: new Array(128).fill(0),
  inferenceTimeMs: 0,
  batteryLevel: 100,
  micQuality: 'GOOD' as MicQuality,
  micSnrDb: 0,
  micWarning: null as MicWarning,
  selectedTrackId: null,
  hiddenTrackIds: [],
  bleDevices: {},
  bleScanActive: false,
  fusedDetections: [],
  userLocation: null,
  feedbackPending: false,
  feedbackDetectionId: null,

  setScanning: (active) => set({ isScanning: active }),

  addDetection: (result) => {
    set((state) => {
      // Prune inactive tracks older than 30 seconds
      const now = Date.now();
      const activeTracks = state.currentThreats.filter(
        (t) => t.isActive || (now - t.lastSeen) < 30000,
      );

      // Find existing track for similar acoustic pattern nearby
      // Uses bearing + distance + time for accurate deduplication
      const existingTrack = activeTracks.find((t) => {
        if (!t.isActive || t.detections.length === 0) return false;
        const last = t.detections[t.detections.length - 1];
        if (last.threatCategory !== result.threatCategory) return false;
        const bearingDiff = Math.abs(last.bearingDegrees - result.bearingDegrees);
        const wrappedBearing = Math.min(bearingDiff, 360 - bearingDiff);
        const distDiff = Math.abs(last.distanceMeters - result.distanceMeters);
        const timeDiff = Math.abs(last.timestamp - result.timestamp);
        return wrappedBearing < 20 && distDiff < 300 && timeDiff < 10000;
      });

      if (existingTrack) {
        // Update existing track with Kalman predict → update
        const { x: mx, y: my } = KalmanFilter2D.polarToCartesian(result.bearingDegrees, result.distanceMeters);
        let kalmanState = existingTrack.kalmanState;
        let predictedETA: number | null = null;

        if (kalmanState) {
          try {
            kalmanState = kalman.predict(kalmanState);
            kalmanState = kalman.update(kalmanState, mx, my);
            predictedETA = kalman.predictETA(kalmanState);
          } catch {
            // Kalman failed — keep existing state
            kalmanState = existingTrack.kalmanState;
          }
        }

        return {
          currentThreats: activeTracks.map((t) =>
            t.id === existingTrack.id
              ? {
                  ...t,
                  detections: [...t.detections, result].slice(-50),
                  lastSeen: result.timestamp,
                  kalmanState,
                  predictedETA,
                }
              : t
          ),
          latestDetection: result,
        };
      } else {
        // Create new track with Kalman init
        const { x, y } = KalmanFilter2D.polarToCartesian(result.bearingDegrees, result.distanceMeters);
        const kalmanState = kalman.init(x, y);

        const newTrack: ThreatTrack = {
          id: result.id,
          detections: [result],
          firstSeen: result.timestamp,
          lastSeen: result.timestamp,
          predictedETA: null,
          kalmanState,
          isActive: true,
        };
        return {
          currentThreats: [...activeTracks, newTrack].slice(-10),
          latestDetection: result,
        };
      }
    });
  },

  updateThreatTrack: (trackId, detection) => {
    set((state) => ({
      currentThreats: state.currentThreats.map((t) =>
        t.id === trackId
          ? {
              ...t,
              detections: [...t.detections, detection].slice(-50),
              lastSeen: detection.timestamp,
            }
          : t
      ),
    }));
  },

  removeThreatTrack: (trackId) => {
    set((state) => ({
      currentThreats: state.currentThreats.map((t) =>
        t.id === trackId ? { ...t, isActive: false } : t
      ),
      // FIX-H2: Also clean up hiddenTrackIds and selectedTrackId
      hiddenTrackIds: state.hiddenTrackIds.filter((id) => id !== trackId),
      selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
    }));
  },

  clearThreats: () => set({ currentThreats: [], latestDetection: null, hiddenTrackIds: [], selectedTrackId: null }),

  setAudioLevel: (level) => set({ audioLevel: level }),

  setSpectralData: (data) => set({ spectralData: data }),

  setInferenceTime: (ms) => set({ inferenceTimeMs: ms }),

  acknowledgeDetection: () => set({ latestDetection: null }),

  setBatteryLevel: (level) => set({ batteryLevel: level }),

  setMicQuality: (quality, snrDb, warning) => set({ micQuality: quality, micSnrDb: snrDb, micWarning: warning }),

  setFeedbackPending: (pending, detectionId = null) => set({ feedbackPending: pending, feedbackDetectionId: detectionId }),

  setFusedDetections: (detections) => set({ fusedDetections: detections }),

  setBLEScanActive: (active) => set({ bleScanActive: active }),

  addBLEDevice: (id, data) => set((state) => ({
    bleDevices: { ...state.bleDevices, [id]: data },
  })),

  removeBLEDevice: (id) => set((state) => {
    const { [id]: _, ...rest } = state.bleDevices;
    return { bleDevices: rest };
  }),

  clearBLEDevices: () => set({ bleDevices: {} }),

  setUserLocation: (loc) => set({ userLocation: loc }),

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  hideTrackFromMap: (trackId) => set((state) => ({
    hiddenTrackIds: state.hiddenTrackIds.includes(trackId)
      ? state.hiddenTrackIds
      : [...state.hiddenTrackIds, trackId],
    selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
  })),

  unhideTrack: (trackId) => set((state) => ({
    hiddenTrackIds: state.hiddenTrackIds.filter((id) => id !== trackId),
  })),

  clearHiddenTracks: () => set({ hiddenTrackIds: [] }),
}));
