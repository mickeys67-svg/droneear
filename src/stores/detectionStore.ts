import { create } from 'zustand';
import type { DetectionResult, ThreatTrack } from '../types';
import type { MicQuality, MicWarning } from '../core/audio/MicQualityMonitor';

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
  feedbackPending: false,
  feedbackDetectionId: null,

  setScanning: (active) => set({ isScanning: active }),

  addDetection: (result) => {
    const { currentThreats } = get();

    // Find existing track for similar acoustic pattern nearby
    // Uses bearing + distance + time for accurate deduplication
    const existingTrack = currentThreats.find((t) => {
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
      // Update existing track
      const updatedTracks = currentThreats.map((t) =>
        t.id === existingTrack.id
          ? {
              ...t,
              detections: [...t.detections, result].slice(-50), // Keep last 50 detections
              lastSeen: result.timestamp,
            }
          : t
      );
      set({ currentThreats: updatedTracks, latestDetection: result });
    } else {
      // Create new track
      const newTrack: ThreatTrack = {
        id: result.id,
        detections: [result],
        firstSeen: result.timestamp,
        lastSeen: result.timestamp,
        predictedETA: null,
        kalmanState: null,
        isActive: true,
      };
      set({
        currentThreats: [...currentThreats, newTrack].slice(-10), // Max 10 tracks
        latestDetection: result,
      });
    }
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
    }));
  },

  clearThreats: () => set({ currentThreats: [], latestDetection: null }),

  setAudioLevel: (level) => set({ audioLevel: level }),

  setSpectralData: (data) => set({ spectralData: data }),

  setInferenceTime: (ms) => set({ inferenceTimeMs: ms }),

  acknowledgeDetection: () => set({ latestDetection: null }),

  setBatteryLevel: (level) => set({ batteryLevel: level }),

  setMicQuality: (quality, snrDb, warning) => set({ micQuality: quality, micSnrDb: snrDb, micWarning: warning }),

  setFeedbackPending: (pending, detectionId = null) => set({ feedbackPending: pending, feedbackDetectionId: detectionId }),
}));
