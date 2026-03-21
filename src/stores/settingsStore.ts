import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMMKVStorage } from './mmkvStorage';
import type { AppSettings, DeviceProfile, ThemeMode } from '../types';
import type { SupportedLocale } from '../i18n/translations';

const mmkvStorage = createMMKVStorage('dronefinder-settings', 'df-settings-2026');

interface SettingsState extends AppSettings {
  // Locale & voice
  locale: SupportedLocale;
  voiceAlert: boolean;
  onboardingComplete: boolean;
  setLocale: (locale: SupportedLocale) => void;
  setVoiceAlert: (enabled: boolean) => void;
  setOnboardingComplete: (done: boolean) => void;

  setProfile: (profile: DeviceProfile) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setConfidenceThreshold: (threshold: number) => void;
  setAlertVibration: (enabled: boolean) => void;
  setAlertSound: (enabled: boolean) => void;
  setAutoRecord: (enabled: boolean) => void;
  setMaxHistoryItems: (count: number) => void;
  setDebugMode: (enabled: boolean) => void;
  setBLEScanEnabled: (enabled: boolean) => void;
  wifiScanEnabled?: boolean;
  setWiFiScanEnabled: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS: AppSettings & { locale: SupportedLocale; voiceAlert: boolean; onboardingComplete: boolean } = {
  profile: 'BALANCED',
  themeMode: 'DAY',
  confidenceThreshold: 0.75,
  alertVibration: true,
  alertSound: true,
  voiceAlert: true,
  autoRecord: false,
  maxHistoryItems: 100,
  modelAutoUpdate: true,
  debugMode: false,
  bleScanEnabled: true,
  wifiScanEnabled: true,
  locale: 'ko',
  onboardingComplete: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setLocale: (locale) => set({ locale }),
      setVoiceAlert: (enabled) => set({ voiceAlert: enabled }),
      setOnboardingComplete: (done) => set({ onboardingComplete: done }),
      setProfile: (profile) => {
        const valid: DeviceProfile[] = ['BALANCED', 'SAMSUNG_OPTIMIZED', 'HIGH_SENSITIVITY', 'RAW_EXPERT'];
        if (!valid.includes(profile)) {
          console.warn(`[SettingsStore] Invalid profile "${profile}", using BALANCED`);
          set({ profile: 'BALANCED' });
        } else {
          set({ profile });
        }
      },
      setThemeMode: (mode) => set({ themeMode: mode }),
      setConfidenceThreshold: (threshold) => set({ confidenceThreshold: Math.max(0, Math.min(1, threshold)) }),
      setAlertVibration: (enabled) => set({ alertVibration: enabled }),
      setAlertSound: (enabled) => set({ alertSound: enabled }),
      setAutoRecord: (enabled) => set({ autoRecord: enabled }),
      setMaxHistoryItems: (count) => set({ maxHistoryItems: Math.max(10, Math.min(1000, count)) }),
      setDebugMode: (enabled) => set({ debugMode: enabled }),
      setBLEScanEnabled: (enabled) => set({ bleScanEnabled: enabled }),
      setWiFiScanEnabled: (enabled) => set({ wifiScanEnabled: enabled }),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'settings',
      storage: mmkvStorage,
      partialize: (state) => ({
        profile: state.profile,
        themeMode: state.themeMode,
        confidenceThreshold: state.confidenceThreshold,
        alertVibration: state.alertVibration,
        alertSound: state.alertSound,
        voiceAlert: state.voiceAlert,
        autoRecord: state.autoRecord,
        maxHistoryItems: state.maxHistoryItems,
        modelAutoUpdate: state.modelAutoUpdate,
        debugMode: state.debugMode,
        locale: state.locale,
        bleScanEnabled: state.bleScanEnabled,
        wifiScanEnabled: state.wifiScanEnabled,
        onboardingComplete: state.onboardingComplete,
      }),
    }
  )
);
