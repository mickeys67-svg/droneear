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
  spectralData: number[];     // Current mel spectrogram snapshot (64 bins)
  inferenceTimeMs: number;    // Last inference latency
  batteryLevel: number;       // 0-100

  // Mic quality
  micQuality: MicQuality;
  micSnrDb: number;
  micWarning: MicWarning;

  // Debug surface — last raw inference (filtered out before reaching detection
  // store, but kept here so the debug panel can show "BACKGROUND 23%" while
  // listening to non-drone sounds, instead of silence)
  lastRawCategory: string | null;
  lastRawConfidence: number;

  // Transient toast — short non-blocking message at the top/bottom of the
  // listen screen. Replaces blocking Alert.alert popups for things like
  // "battery low" or "listening resumed" so the user is informed without
  // having to dismiss a modal mid-scan. `until` is a Date.now() timestamp;
  // UI computes visibility on each render against the current clock.
  transientToast: { message: string; until: number; tone: 'info' | 'warn' | 'danger' } | null;

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
  setRawInference: (category: string, confidence: number) => void;
  showToast: (message: string, durationMs?: number, tone?: 'info' | 'warn' | 'danger') => void;
  dismissToast: () => void;
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
  spectralData: new Array(64).fill(0),
  inferenceTimeMs: 0,
  batteryLevel: 100,
  micQuality: 'GOOD' as MicQuality,
  micSnrDb: 0,
  micWarning: null as MicWarning,
  lastRawCategory: null as string | null,
  lastRawConfidence: 0,
  transientToast: null as { message: string; until: number; tone: 'info' | 'warn' | 'danger' } | null,
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
        // Create new track. Kalman tracking only makes sense for detections
        // with a REAL position (BLE Remote ID / fused) — acoustic-only
        // detections have no bearing/distance, so they get no Kalman state
        // and no ETA prediction (predictedETA stays null).
        const hasPosition = result.source === 'BLE_REMOTE_ID' || result.source === 'FUSED';
        let kalmanState: ThreatTrack['kalmanState'] = null;
        if (hasPosition) {
          const { x, y } = KalmanFilter2D.polarToCartesian(result.bearingDegrees, result.distanceMeters);
          kalmanState = kalman.init(x, y);
        }

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

  // Audio callbacks fire at 20-30Hz with always-different float values. If
  // we set unconditionally, every subscriber (HomeScreen, TacticalRadar,
  // header badges) re-renders ~25× per second and the whole page visibly
  // shakes/flickers. Quantize before writing and early-return when the
  // quantized value is unchanged so the store only notifies on real motion.
  setAudioLevel: (level) => {
    const q = Math.round(level * 100) / 100; // 2 decimals → ~100 buckets
    if (get().audioLevel === q) return;
    set({ audioLevel: q });
  },

  setSpectralData: (data) => set({ spectralData: data }),

  setInferenceTime: (ms) => {
    if (get().inferenceTimeMs === ms) return;
    set({ inferenceTimeMs: ms });
  },

  acknowledgeDetection: () => set({ latestDetection: null }),

  setBatteryLevel: (level) => {
    if (get().batteryLevel === level) return;
    set({ batteryLevel: level });
  },

  setMicQuality: (quality, snrDb, warning) => {
    const qSnr = Math.round(snrDb);
    const st = get();
    if (st.micQuality === quality && st.micSnrDb === qSnr && st.micWarning === warning) return;
    set({ micQuality: quality, micSnrDb: qSnr, micWarning: warning });
  },

  setRawInference: (category, confidence) => {
    const qConf = Math.round(confidence * 100) / 100;
    const st = get();
    if (st.lastRawCategory === category && st.lastRawConfidence === qConf) return;
    set({ lastRawCategory: category, lastRawConfidence: qConf });
  },

  showToast: (message, durationMs = 4000, tone = 'info') => {
    set({ transientToast: { message, until: Date.now() + durationMs, tone } });
  },
  dismissToast: () => set({ transientToast: null }),

  setFeedbackPending: (pending, detectionId = null) => set({ feedbackPending: pending, feedbackDetectionId: detectionId }),

  // Cap fusedDetections to avoid unbounded growth on long sessions — each
  // detection carries a 64-bin spectralSignature array, so multi-hour
  // scanning otherwise climbs into tens of MB of retained memory.
  setFusedDetections: (detections) => set({
    fusedDetections: detections.length > 500 ? detections.slice(-500) : detections,
  }),

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
