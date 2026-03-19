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
