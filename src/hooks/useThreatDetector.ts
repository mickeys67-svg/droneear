/**
 * React hook for the DroneMonitor system — v4.0
 *
 * Major upgrades:
 * - SensorEnforcementManager integration (compass, mic monitoring, alarms)
 * - Real PCM data passed to MicQualityMonitor (fixes broken monitoring)
 * - Compass heading wired to AudioClassifier for DOA
 * - Recording error recovery with user notification
 * - Sensor status exposed to UI for enforcement indicators
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { ThreatDetector } from '../core/detection/ThreatDetector';
import { VoiceAlertManager } from '../core/audio/VoiceAlertManager';
import { MicQualityMonitor } from '../core/audio/MicQualityMonitor';
import { SensorEnforcementManager, type SensorState, type SensorIssue } from '../core/sensors/SensorEnforcementManager';
import { EnvironmentDetector, type EnvironmentState } from '../core/sensors/EnvironmentDetector';
import { getTranslation } from '../i18n/translations';
import { useDetectionStore } from '../stores/detectionStore';
import { useHistoryStore } from '../stores/historyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { DEVICE_PROFILES } from '../constants/micConfig';
import type { DeviceProfile, DetectionSession } from '../types';
import * as Haptics from 'expo-haptics';
import * as Battery from 'expo-battery';

export function useThreatDetector() {
  const detectorRef = useRef<ThreatDetector | null>(null);
  const voiceRef = useRef<VoiceAlertManager>(new VoiceAlertManager());
  const micMonitorRef = useRef<MicQualityMonitor>(new MicQualityMonitor());
  const sensorMgrRef = useRef<SensorEnforcementManager>(new SensorEnforcementManager());
  const envDetectorRef = useRef<EnvironmentDetector>(new EnvironmentDetector());
  const isInitializedRef = useRef(false);
  const batteryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const envVoiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sensor status state (exposed to UI)
  const [sensorState, setSensorState] = useState<SensorState>({
    microphone: 'UNAVAILABLE', compass: 'UNAVAILABLE', stereo: 'UNAVAILABLE', recording: 'UNAVAILABLE',
  });
  const [sensorIssues, setSensorIssues] = useState<SensorIssue[]>([]);

  // Environment detection state (exposed to UI)
  const [environmentState, setEnvironmentState] = useState<EnvironmentState | null>(null);

  // Zustand stores
  const {
    isScanning, latestDetection, currentThreats, audioLevel,
    spectralData, inferenceTimeMs, micQuality, micSnrDb, micWarning,
    batteryLevel, feedbackPending,
    setScanning, addDetection, setAudioLevel, setSpectralData,
    setInferenceTime, acknowledgeDetection, clearThreats,
    setBatteryLevel, setMicQuality, setFeedbackPending,
  } = useDetectionStore();

  const { addDetection: addToHistory, startSession, endSession } = useHistoryStore();

  const {
    profile, confidenceThreshold, alertVibration, alertSound, voiceAlert, locale,
  } = useSettingsStore();

  // ===== Sync settings =====
  useEffect(() => { voiceRef.current.setLocale(locale); }, [locale]);
  useEffect(() => { voiceRef.current.setVoiceEnabled(voiceAlert); }, [voiceAlert]);
  useEffect(() => { voiceRef.current.setSoundEnabled(alertSound); }, [alertSound]);

  // ===== Initialize detector + sensor manager + environment detector =====
  useEffect(() => {
    const sensorMgr = sensorMgrRef.current;
    const envDetector = envDetectorRef.current;

    // Wire environment detector
    envDetector.setCallback((state) => {
      setEnvironmentState(state);
    });

    // Wire sensor callbacks
    sensorMgr.setCallbacks({
      onSensorUpdate: (state, issues) => {
        setSensorState(state);
        setSensorIssues(issues);
      },
      onCompassUpdate: (compassData) => {
        // CRITICAL: Wire compass heading to AudioClassifier
        detectorRef.current?.setCompassHeading(compassData.heading);
      },
      onAlarm: (issue) => {
        // Voice alarm for critical sensor issues
        if (issue.severity === 'CRITICAL') {
          voiceRef.current.announceMicWarning('POOR', 'NOISE');
        }
        // Haptic feedback for any alarm
        if (alertVibration) {
          Haptics.notificationAsync(
            issue.severity === 'CRITICAL'
              ? Haptics.NotificationFeedbackType.Error
              : Haptics.NotificationFeedbackType.Warning
          );
        }
      },
    });

    const detector = new ThreatDetector({
      onDetection: (result) => {
        addDetection(result);
        addToHistory(result);

        if (alertVibration) {
          Haptics.notificationAsync(
            result.severity === 'CRITICAL'
              ? Haptics.NotificationFeedbackType.Error
              : Haptics.NotificationFeedbackType.Warning
          );
        }

        voiceRef.current.announceDetection(result);
        setFeedbackPending(true, result.id);
      },
      onSpectralData: (data) => {
        setSpectralData(Array.from(data.melSpectrogram));
      },
      onAudioLevel: (rms, pcmData) => {
        setAudioLevel(rms);

        // Feed audio level to environment detector
        envDetectorRef.current.updateAmbientLevel(rms);

        // FIXED: Real PCM data analysis for mic quality
        if (pcmData && pcmData.length > 0) {
          const report = micMonitorRef.current.analyze(pcmData);
          setMicQuality(report.quality, report.snrDb, report.warning);

          // Update sensor enforcement manager
          sensorMgr.setMicQuality(report.quality, report.warning);

          // Voice warning for mic issues
          if (report.warning) {
            voiceRef.current.announceMicWarning(report.quality, report.warning);
          }
        }
      },
      onMetrics: (metrics) => {
        setInferenceTime(metrics.totalTimeMs);
      },
      onStatusChange: (status) => {
        console.log(`[DroneMonitor] Status: ${status}`);
        if (status === 'ERROR') {
          sensorMgr.setRecordingState(false, 'Detection engine error');
        }
      },
      onRecordingError: (error) => {
        console.error(`[DroneMonitor] Recording error: ${error}`);
        sensorMgr.setRecordingState(false, error);
      },
    });

    detectorRef.current = detector;

    let disposed = false;
    detector.initialize().then((success) => {
      if (disposed) return; // Prevent state updates after cleanup
      isInitializedRef.current = success;
      sensorMgr.setMicPermission(success);
    }).catch((err) => {
      if (disposed) return;
      console.error('[DroneMonitor] Init failed:', err);
      sensorMgr.setMicPermission(false);
    });

    return () => {
      disposed = true;
      detector.stopScanning();
      voiceRef.current.dispose();
      sensorMgr.dispose();
      envDetector.dispose();
      if (batteryIntervalRef.current) clearInterval(batteryIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      if (envVoiceIntervalRef.current) clearInterval(envVoiceIntervalRef.current);
    };
  }, []);

  // Update profile
  useEffect(() => {
    detectorRef.current?.setProfile(profile);
    const config = DEVICE_PROFILES[profile];
    sensorMgrRef.current.setStereoProfile(config.channels === 2);
  }, [profile]);

  useEffect(() => {
    detectorRef.current?.setConfidenceThreshold(confidenceThreshold);
  }, [confidenceThreshold]);

  // ===== Scan control =====
  const startScanning = useCallback(async () => {
    if (!detectorRef.current || !isInitializedRef.current) return;

    const battLevel = await Battery.getBatteryLevelAsync();
    const battPercent = Math.round(battLevel * 100);
    setBatteryLevel(battPercent);

    // Adaptive frame skip
    if (battPercent < 20) detectorRef.current.setFrameSkipRate(4);
    else if (battPercent < 50) detectorRef.current.setFrameSkipRate(3);
    else detectorRef.current.setFrameSkipRate(2);

    const session: DetectionSession = {
      id: `session_${Date.now()}`,
      startTime: Date.now(),
      endTime: null,
      profile,
      detectionCount: 0,
      avgInferenceMs: 0,
      batteryStart: battPercent,
      batteryEnd: null,
    };
    startSession(session);
    micMonitorRef.current.reset();

    // Start sensor monitoring (compass, etc.)
    const config = DEVICE_PROFILES[profile];
    await sensorMgrRef.current.startMonitoring(config.channels === 2);
    sensorMgrRef.current.setRecordingState(true);

    detectorRef.current.startScanning();
    setScanning(true);

    voiceRef.current.announceScanStart();

    // Start environment detection
    await envDetectorRef.current.start();

    // Periodic environment voice warnings (every 30s if indoor/degraded)
    envVoiceIntervalRef.current = setInterval(() => {
      const env = envDetectorRef.current.getState();
      const currentLocale = useSettingsStore.getState().locale;
      const tr = getTranslation(currentLocale);

      if (env.environment === 'INDOOR') {
        voiceRef.current.enqueueCustom(tr.indoorWarningVoice, 2);
      } else if (env.detectionCapability < 40) {
        voiceRef.current.enqueueCustom(tr.accuracyDegradedVoice, 3);
      }
    }, 30000);

    // Battery monitoring
    batteryIntervalRef.current = setInterval(async () => {
      const level = await Battery.getBatteryLevelAsync();
      const pct = Math.round(level * 100);
      setBatteryLevel(pct);
      if (pct < 20 && detectorRef.current) {
        detectorRef.current.setFrameSkipRate(4);
      }
    }, 30000);

    // Periodic voice status
    statusIntervalRef.current = setInterval(() => {
      const threats = useDetectionStore.getState().currentThreats;
      const active = threats.filter((t) => t.isActive).length;
      voiceRef.current.announceStatus(active);
    }, 30000);
  }, [profile]);

  const stopScanning = useCallback(async () => {
    if (!detectorRef.current) return;
    await detectorRef.current.stopScanning();
    endSession();
    setScanning(false);
    setAudioLevel(0);

    sensorMgrRef.current.stopMonitoring();
    sensorMgrRef.current.setRecordingState(false);
    envDetectorRef.current.stop();

    voiceRef.current.announceScanStop();

    if (batteryIntervalRef.current) {
      clearInterval(batteryIntervalRef.current);
      batteryIntervalRef.current = null;
    }
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    if (envVoiceIntervalRef.current) {
      clearInterval(envVoiceIntervalRef.current);
      envVoiceIntervalRef.current = null;
    }
  }, []);

  const setProfile = useCallback((newProfile: DeviceProfile) => {
    useSettingsStore.getState().setProfile(newProfile);
  }, []);

  const submitFeedback = useCallback((detectionId: string, accurate: boolean) => {
    console.log(`[Feedback] Detection ${detectionId}: ${accurate ? 'accurate' : 'false positive'}`);
    setFeedbackPending(false, null);
    // Voice confirmation so user knows feedback was recorded
    const tr = getTranslation(useSettingsStore.getState().locale);
    voiceRef.current.enqueueCustom(tr.thankYouFeedback, 6);
  }, []);

  return {
    // State
    isScanning,
    isInitialized: isInitializedRef.current,
    latestDetection,
    currentThreats,
    audioLevel,
    spectralData,
    inferenceTimeMs,
    modelStatus: detectorRef.current?.modelStatus || 'UNLOADED',
    batteryLevel,
    micQuality,
    micSnrDb,
    micWarning,
    feedbackPending,

    // Sensor enforcement state
    sensorState,
    sensorIssues,

    // Environment detection state
    environmentState,

    // Actions
    startScanning,
    stopScanning,
    setProfile,
    acknowledgeDetection,
    clearThreats,
    submitFeedback,
  };
}
