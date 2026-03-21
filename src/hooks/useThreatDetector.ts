/**
 * React hook for the DroneMonitor system — v5.0
 *
 * v5.0: BLE Remote ID scanning integration
 * v4.0: SensorEnforcementManager, MicQualityMonitor, compass DOA, error recovery
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { ThreatDetector } from '../core/detection/ThreatDetector';
import { DetectionFusionEngine } from '../core/detection/DetectionFusionEngine';
import { VoiceAlertManager } from '../core/audio/VoiceAlertManager';
import { MicQualityMonitor } from '../core/audio/MicQualityMonitor';
import { SensorEnforcementManager, type SensorState, type SensorIssue } from '../core/sensors/SensorEnforcementManager';
import { EnvironmentDetector, type EnvironmentState } from '../core/sensors/EnvironmentDetector';
import { getTranslation } from '../i18n/translations';
import { useDetectionStore } from '../stores/detectionStore';
import { useHistoryStore } from '../stores/historyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useBLEScanner } from './useBLEScanner';
import { DEVICE_PROFILES } from '../constants/micConfig';
import type { DeviceProfile, DetectionSession } from '../types';
import { AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';

export function useThreatDetector() {
  const detectorRef = useRef<ThreatDetector | null>(null);
  const voiceRef = useRef<VoiceAlertManager>(new VoiceAlertManager());
  const micMonitorRef = useRef<MicQualityMonitor>(new MicQualityMonitor());
  const sensorMgrRef = useRef<SensorEnforcementManager>(new SensorEnforcementManager());
  const envDetectorRef = useRef<EnvironmentDetector>(new EnvironmentDetector());
  const fusionEngineRef = useRef<DetectionFusionEngine>(new DetectionFusionEngine());
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const isInitializedRef = useRef(false);
  const batteryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const envVoiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sensor status state (exposed to UI)
  const [sensorState, setSensorState] = useState<SensorState>({
    microphone: 'UNAVAILABLE', compass: 'UNAVAILABLE', stereo: 'UNAVAILABLE', recording: 'UNAVAILABLE', bluetooth: 'UNAVAILABLE',
  });
  const [sensorIssues, setSensorIssues] = useState<SensorIssue[]>([]);

  // Environment detection state (exposed to UI)
  const [environmentState, setEnvironmentState] = useState<EnvironmentState | null>(null);

  // Zustand stores — use selectors to minimize re-renders
  const isScanning = useDetectionStore((s) => s.isScanning);
  const latestDetection = useDetectionStore((s) => s.latestDetection);
  const currentThreats = useDetectionStore((s) => s.currentThreats);
  const audioLevel = useDetectionStore((s) => s.audioLevel);
  const spectralData = useDetectionStore((s) => s.spectralData);
  const inferenceTimeMs = useDetectionStore((s) => s.inferenceTimeMs);
  const micQuality = useDetectionStore((s) => s.micQuality);
  const micSnrDb = useDetectionStore((s) => s.micSnrDb);
  const micWarning = useDetectionStore((s) => s.micWarning);
  const batteryLevel = useDetectionStore((s) => s.batteryLevel);
  const feedbackPending = useDetectionStore((s) => s.feedbackPending);
  const fusedDetections = useDetectionStore((s) => s.fusedDetections);

  // Actions (stable refs from Zustand)
  const setScanning = useDetectionStore((s) => s.setScanning);
  const addDetection = useDetectionStore((s) => s.addDetection);
  const setAudioLevel = useDetectionStore((s) => s.setAudioLevel);
  const setSpectralData = useDetectionStore((s) => s.setSpectralData);
  const setInferenceTime = useDetectionStore((s) => s.setInferenceTime);
  const acknowledgeDetection = useDetectionStore((s) => s.acknowledgeDetection);
  const clearThreats = useDetectionStore((s) => s.clearThreats);
  const setBatteryLevel = useDetectionStore((s) => s.setBatteryLevel);
  const setMicQuality = useDetectionStore((s) => s.setMicQuality);
  const setFeedbackPending = useDetectionStore((s) => s.setFeedbackPending);
  const setFusedDetections = useDetectionStore((s) => s.setFusedDetections);

  const addToHistory = useHistoryStore((s) => s.addDetection);
  const startSession = useHistoryStore((s) => s.startSession);
  const endSession = useHistoryStore((s) => s.endSession);

  const profile = useSettingsStore((s) => s.profile);
  const confidenceThreshold = useSettingsStore((s) => s.confidenceThreshold);
  const alertVibration = useSettingsStore((s) => s.alertVibration);
  const alertSound = useSettingsStore((s) => s.alertSound);
  const voiceAlert = useSettingsStore((s) => s.voiceAlert);
  const locale = useSettingsStore((s) => s.locale);
  const bleScanEnabled = useSettingsStore((s) => s.bleScanEnabled);

  // Ref to avoid stale closure for alertVibration in long-lived callbacks
  const alertVibrationRef = useRef(alertVibration);
  useEffect(() => { alertVibrationRef.current = alertVibration; }, [alertVibration]);

  // BLE Remote ID Scanner
  const {
    bleAvailable, bleScanActive, bleDevices, bleDeviceCount,
    startBLE, stopBLE,
  } = useBLEScanner();

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
        // Haptic feedback for any alarm (use ref to avoid stale closure)
        if (alertVibrationRef.current) {
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

        if (alertVibrationRef.current) {
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
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
      if (batteryIntervalRef.current) { clearInterval(batteryIntervalRef.current); batteryIntervalRef.current = null; }
      if (statusIntervalRef.current) { clearInterval(statusIntervalRef.current); statusIntervalRef.current = null; }
      if (envVoiceIntervalRef.current) { clearInterval(envVoiceIntervalRef.current); envVoiceIntervalRef.current = null; }
    };
  }, []);

  // ===== AppState: pause scanning on background, resume on foreground =====
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasScanningRef = useRef(false);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextState.match(/inactive|background/)) {
        // Going to background — pause intervals to save battery
        if (useDetectionStore.getState().isScanning) {
          wasScanningRef.current = true;
          if (batteryIntervalRef.current) { clearInterval(batteryIntervalRef.current); batteryIntervalRef.current = null; }
          if (statusIntervalRef.current) { clearInterval(statusIntervalRef.current); statusIntervalRef.current = null; }
          if (envVoiceIntervalRef.current) { clearInterval(envVoiceIntervalRef.current); envVoiceIntervalRef.current = null; }
        }
      } else if (nextState === 'active' && wasScanningRef.current) {
        // Resuming from background — restart intervals only if not already running
        wasScanningRef.current = false;
        if (!batteryIntervalRef.current) {
          batteryIntervalRef.current = setInterval(async () => {
            try {
              const level = await Battery.getBatteryLevelAsync();
              const pct = Math.round(level * 100);
              useDetectionStore.getState().setBatteryLevel(pct);
              if (pct < 20 && detectorRef.current) {
                detectorRef.current.setFrameSkipRate(4);
              }
            } catch (err) {
              console.warn('[DroneMonitor] Battery check failed:', err);
            }
          }, 60000);
        }
        if (!statusIntervalRef.current) {
          statusIntervalRef.current = setInterval(() => {
            const threats = useDetectionStore.getState().currentThreats;
            const active = threats.filter((t) => t.isActive).length;
            voiceRef.current.announceStatus(active);
          }, 30000);
        }
        if (!envVoiceIntervalRef.current) {
          envVoiceIntervalRef.current = setInterval(() => {
            const env = envDetectorRef.current?.getState?.();
            if (!env) return;
            const currentLocale = useSettingsStore.getState().locale;
            const tr = getTranslation(currentLocale);
            if (env.environment === 'INDOOR') {
              voiceRef.current.enqueueCustom(tr.indoorWarningVoice, 2);
            } else if (env.detectionCapability < 40) {
              voiceRef.current.enqueueCustom(tr.accuracyDegradedVoice, 3);
            }
          }, 30000);
        }
      }
      appStateRef.current = nextState;
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
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

  // ===== Acoustic + BLE Fusion =====
  useEffect(() => {
    if (!isScanning || Object.keys(bleDevices).length === 0 || currentThreats.length === 0) {
      return;
    }

    const fused = fusionEngineRef.current.fuse(currentThreats, bleDevices);
    setFusedDetections(fused);
  }, [currentThreats, bleDevices, isScanning]);

  // ===== Scan control =====
  const isScanningRef = useRef(isScanning);
  useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);

  const startScanning = useCallback(async () => {
    if (isScanningRef.current || !isInitializedRef.current) return;
    if (!detectorRef.current) return;

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

    // Start BLE Remote ID scanning if enabled
    if (bleScanEnabled && bleAvailable) {
      const bleStarted = await startBLE();
      sensorMgrRef.current.setBLEState(bleAvailable, bleStarted);
    } else {
      sensorMgrRef.current.setBLEState(bleAvailable, false);
    }

    voiceRef.current.announceScanStart();

    // Start location watch for fusion engine
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          (loc) => {
            const pos = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            fusionEngineRef.current.setUserPosition(pos);
            // Share location with detection store (so useMapData doesn't need its own GPS watcher)
            useDetectionStore.getState().setUserLocation(pos);
          },
        );
      }
    } catch (e) {
      console.warn('[DroneMonitor] Location watch failed:', e);
    }

    // Start environment detection
    await envDetectorRef.current.start();

    // Clear any existing intervals before creating new ones
    if (batteryIntervalRef.current) clearInterval(batteryIntervalRef.current);
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    if (envVoiceIntervalRef.current) clearInterval(envVoiceIntervalRef.current);

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

    // Battery monitoring (60s interval — battery changes slowly)
    batteryIntervalRef.current = setInterval(async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const pct = Math.round(level * 100);
        setBatteryLevel(pct);
        if (pct < 20 && detectorRef.current) {
          detectorRef.current.setFrameSkipRate(4);
        }
      } catch (err) {
        console.warn('[DroneMonitor] Battery check failed:', err);
      }
    }, 60000);

    // Periodic voice status
    statusIntervalRef.current = setInterval(() => {
      const threats = useDetectionStore.getState().currentThreats;
      const active = threats.filter((t) => t.isActive).length;
      voiceRef.current.announceStatus(active);
    }, 30000);
  }, [profile, bleScanEnabled, bleAvailable, startBLE]);

  const stopScanning = useCallback(async () => {
    if (!detectorRef.current) return;
    await detectorRef.current.stopScanning();
    endSession();
    setScanning(false);
    setAudioLevel(0);

    sensorMgrRef.current.stopMonitoring();
    sensorMgrRef.current.setRecordingState(false);
    envDetectorRef.current.stop();

    // Stop BLE scanning
    await stopBLE();
    sensorMgrRef.current.setBLEState(bleAvailable, false);

    // Stop location watch
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    fusionEngineRef.current.setUserPosition(null);
    useDetectionStore.getState().setUserLocation(null);
    setFusedDetections([]);

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
  }, [stopBLE, bleAvailable]);

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

    // BLE Remote ID state
    bleAvailable,
    bleScanActive,
    bleDevices,
    bleDeviceCount,

    // Fused detections
    fusedDetections,

    // Actions
    startScanning,
    stopScanning,
    setProfile,
    acknowledgeDetection,
    clearThreats,
    submitFeedback,
  };
}
