import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMMKVStorage } from './mmkvStorage';
import { useSettingsStore } from './settingsStore';
import type { DetectionResult, DetectionSession } from '../types';

const mmkvStorage = createMMKVStorage('dronefinder-history', 'df-history-2026');

interface HistoryState {
  detections: DetectionResult[];
  sessions: DetectionSession[];
  currentSession: DetectionSession | null;

  addDetection: (result: DetectionResult) => void;
  clearHistory: () => void;
  startSession: (session: DetectionSession) => void;
  endSession: () => void;
  getDetectionsByCategory: (category: string) => DetectionResult[];
  getRecentDetections: (count: number) => DetectionResult[];
  getDetectionsBySeverity: (severity: string) => DetectionResult[];
  getAverageConfidence: () => number;
  getWeeklyStats: () => { day: string; count: number }[];
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      detections: [],
      sessions: [],
      currentSession: null,

      addDetection: (result) => {
        const maxItems = useSettingsStore.getState().maxHistoryItems ?? 1000;
        set((state) => ({
          detections: [result, ...state.detections].slice(0, maxItems),
          currentSession: state.currentSession
            ? { ...state.currentSession, detectionCount: state.currentSession.detectionCount + 1 }
            : null,
        }));
      },

      clearHistory: () => set({ detections: [] }),

      startSession: (session) => set({ currentSession: session }),

      endSession: () => {
        const { currentSession, sessions } = get();
        if (currentSession) {
          const completedSession: DetectionSession = {
            ...currentSession,
            endTime: Date.now(),
          };
          set({
            sessions: [completedSession, ...sessions].slice(0, 100),
            currentSession: null,
          });
        }
      },

      getDetectionsByCategory: (category) => {
        return get().detections.filter((d) => d.threatCategory === category);
      },

      getRecentDetections: (count) => {
        return get().detections.slice(0, count);
      },

      getDetectionsBySeverity: (severity) => {
        return get().detections.filter((d) => d.severity === severity);
      },

      getAverageConfidence: () => {
        const dets = get().detections;
        if (dets.length === 0) return 0;
        return dets.reduce((sum, d) => sum + d.confidence, 0) / dets.length;
      },

      getWeeklyStats: () => {
        const dets = get().detections;
        const now = Date.now();
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const counts: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now - i * 24 * 60 * 60 * 1000);
          counts[dayNames[d.getDay()]] = 0;
        }
        for (const det of dets) {
          if (det.timestamp >= weekAgo) {
            const day = dayNames[new Date(det.timestamp).getDay()];
            if (day in counts) counts[day]++;
          }
        }
        return Object.entries(counts).map(([day, count]) => ({ day, count }));
      },
    }),
    {
      name: 'history',
      storage: mmkvStorage,
      partialize: (state) => ({
        detections: state.detections,
        sessions: state.sessions,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[HistoryStore] Rehydration failed, using empty state:', error);
        }
      },
    }
  )
);
