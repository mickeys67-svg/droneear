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
import { MicQualityMonitor, type MicQuality, type MicWarning } from '../core/audio/MicQualityMonitor';
import { SensorEnforcementManager, type SensorState, type SensorIssue } from '../core/sensors/SensorEnforcementManager';
import { EnvironmentDetector, type EnvironmentState } from '../core/sensors/EnvironmentDetector';
import { getTranslation } from '../i18n/translations';
import { useDetectionStore } from '../stores/detectionStore';
import { useHistoryStore } from '../stores/historyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useBLEScanner } from './useBLEScanner';
import { useWiFiScanner } from './useWiFiScanner';
import { DEVICE_PROFILES } from '../constants/micConfig';
import type { DeviceProfile, DetectionSession } from '../types';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

// ===== Compass anti-jitter (radar front-up rotation) =====
// The magnetometer runs at 5Hz and, even on a perfectly still phone, its raw
// heading dithers by several degrees. The radar rotates its cardinal labels
// and threat dots by this heading, so feeding the raw value straight through
// makes the whole radar vibrate continuously ("막 움직인다 / 고장났다"). We
// low-pass the heading toward the raw reading and only commit a new on-screen
// value once it has moved past a deadband, so the radar holds still until the
// user genuinely rotates the phone. NOTE: this smoothing is UI-ONLY — the raw
// heading is still sent to the AudioClassifier for DOA, so bearing accuracy is
// unaffected.
const HEADING_LP_ALPHA = 0.2;    // low-pass factor toward each raw reading
const HEADING_DEADBAND_DEG = 3;  // ignore sub-threshold heading changes

// Smallest signed circular difference a-b mapped into [-180, 180].
function circularDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

export function useThreatDetector() {
  const detectorRef = useRef<ThreatDetector | null>(null);
  const voiceRef = useRef<VoiceAlertManager>(null as unknown as VoiceAlertManager);
  const micMonitorRef = useRef<MicQualityMonitor>(null as unknown as MicQualityMonitor);
  const sensorMgrRef = useRef<SensorEnforcementManager>(null as unknown as SensorEnforcementManager);
  const envDetectorRef = useRef<EnvironmentDetector>(null as unknown as EnvironmentDetector);
  const fusionEngineRef = useRef<DetectionFusionEngine>(null as unknown as DetectionFusionEngine);
  if (!voiceRef.current) voiceRef.current = new VoiceAlertManager();
  if (!micMonitorRef.current) micMonitorRef.current = new MicQualityMonitor();
  if (!sensorMgrRef.current) sensorMgrRef.current = new SensorEnforcementManager();
  if (!envDetectorRef.current) envDetectorRef.current = new EnvironmentDetector();
  if (!fusionEngineRef.current) fusionEngineRef.current = new DetectionFusionEngine();
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const isInitializedRef = useRef(false);
  const batteryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const envVoiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batteryAlertShownRef = useRef<Set<number>>(new Set()); // Track which thresholds were already alerted

  // Sensor status state (exposed to UI)
  const [sensorState, setSensorState] = useState<SensorState>({
    microphone: 'UNAVAILABLE', compass: 'UNAVAILABLE', stereo: 'UNAVAILABLE', recording: 'UNAVAILABLE', bluetooth: 'UNAVAILABLE',
  });
  const [sensorIssues, setSensorIssues] = useState<SensorIssue[]>([]);

  // Environment detection state (exposed to UI)
  const [environmentState, setEnvironmentState] = useState<EnvironmentState | null>(null);

  // Compass heading exposed to UI (radar front-up rotation + readout).
  // Updated from magnetometer at ~5Hz, snapped to integer degrees so it
  // only triggers re-renders when the value actually changes.
  const [compassHeading, setCompassHeading] = useState(0);
  const [compassAvailable, setCompassAvailable] = useState(false);
  // Low-pass accumulator (float) for the smoothed radar heading. Kept in a ref
  // so it survives re-renders without itself triggering one. null until the
  // first magnetometer sample seeds it.
  const smoothedHeadingRef = useRef<number | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [modelStatus, setModelStatus] = useState<string>('UNLOADED');

  // Zustand stores — use selectors to minimize re-renders
  const isScanning = useDetectionStore((s) => s.isScanning);
  const latestDetection = useDetectionStore((s) => s.latestDetection);
  const currentThreats = useDetectionStore((s) => s.currentThreats);
  // NOTE: audioLevel / spectralData are intentionally NOT subscribed here.
  // They update at 20-30Hz and this hook runs inside the SCAN screen render,
  // so subscribing would re-render the ENTIRE screen every audio frame
  // (the "whole page shaking like it's broken" bug). The setters below still
  // write them to the store; leaf consumers (TacticalSpectrogram, DebugRmsItem)
  // subscribe to the store directly so per-frame updates stay scoped to them.
  // inferenceTimeMs is also NOT subscribed here — onMetrics updates it every
  // audio frame (frameSkipRate defaults to 1), so a top-level subscription
  // would re-render the whole SCAN screen at frame rate even though the value
  // is only shown in the debug panel. A DebugInferenceItem leaf reads it from
  // the store directly instead.
  // micQuality / micSnrDb / micWarning are NOT subscribed here either — the
  // store's setMicQuality fires a few times per second (integer-snapped SNR),
  // which would re-render the whole SCAN screen. MicQualityPanel subscribes to
  // the store directly so those updates stay scoped to that one panel.
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
  const setRawInference = useDetectionStore((s) => s.setRawInference);
  const showToast = useDetectionStore((s) => s.showToast);
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

  // ===== Mic quality/warning hysteresis (SCAN-screen anti-shake) =====
  // analyze() computes quality/warning from a SINGLE 20-30Hz audio frame
  // (instantaneous windDetected / clippingRatio / SNR). Near a threshold these
  // flip every frame. CONFIRMED root cause of the "Signal Quality 밑으로 전부
  // 위아래로 떨림": the warning badge sits at the BOTTOM of MicQualityPanel, so
  // a per-frame null↔warning flip grows/shrinks that panel and bounces EVERY
  // element below it (radar, range labels, spectrogram) at frame rate — a
  // layout reflow, not a re-render (which is why re-render-only fixes failed).
  //
  // Because the app can only be tested via App Store/TestFlight (no live
  // reload), this MUST be impossible to shake, not merely less frequent. Two
  // gates make the committed quality/warning change AT MOST once every
  // MIN_DWELL_FRAMES (~3-4s): (1) a candidate must hold for HYSTERESIS_FRAMES,
  // and (2) at least MIN_DWELL_FRAMES must have passed since the last commit.
  // So the badge physically cannot toggle faster than ~once per 3s → no shake.
  // snrDb is left live (it changes only a number, never the layout).
  const HYSTERESIS_FRAMES = 15;  // candidate must hold ~0.5-0.8s before accepted
  const MIN_DWELL_FRAMES = 90;   // and a committed value holds ~3-4s before it can change again
  const micCommittedRef = useRef<{ quality: MicQuality; warning: MicWarning; dwell: number }>({ quality: 'GOOD', warning: null, dwell: MIN_DWELL_FRAMES });
  const micCandidateRef = useRef<{ quality: MicQuality; warning: MicWarning; count: number }>({ quality: 'GOOD', warning: null, count: 0 });

  // BLE Remote ID Scanner
  const {
    bleAvailable, bleScanActive, bleDevices, bleDeviceCount,
    startBLE, stopBLE,
  } = useBLEScanner();

  // WiFi Remote ID Scanner (Android only)
  const {
    wifiAvailable, wifiScanActive,
    startWiFi, stopWiFi,
  } = useWiFiScanner();

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
        // CRITICAL: Wire the RAW heading to the AudioClassifier — DOA bearing
        // accuracy must not be deadbanded.
        detectorRef.current?.setCompassHeading(compassData.heading);

        // Radar/HEADING readout get a smoothed + deadbanded heading so raw 5Hz
        // magnetometer jitter (±several degrees even on a still phone) can't
        // make the front-up radar's cardinal labels and threat dots vibrate
        // every frame. We low-pass toward the raw reading, then only commit a
        // new integer heading once it has drifted past HEADING_DEADBAND_DEG.
        const raw = compassData.heading;
        const prevSmooth = smoothedHeadingRef.current;
        if (prevSmooth == null) {
          smoothedHeadingRef.current = raw;
          const seed = ((Math.round(raw) % 360) + 360) % 360;
          setCompassHeading((prev) => (prev === seed ? prev : seed));
        } else {
          // Low-pass in circular space so the wrap at 360/0 is handled.
          const smooth = (prevSmooth + circularDelta(raw, prevSmooth) * HEADING_LP_ALPHA + 360) % 360;
          smoothedHeadingRef.current = smooth;
          setCompassHeading((prev) => {
            if (Math.abs(circularDelta(smooth, prev)) < HEADING_DEADBAND_DEG) return prev;
            const next = ((Math.round(smooth) % 360) + 360) % 360;
            return next === prev ? prev : next;
          });
        }
        setCompassAvailable((prev) => prev === compassData.available ? prev : compassData.available);
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

          // Hysteresis + dwell: a reading must (1) hold for HYSTERESIS_FRAMES
          // consecutive frames AND (2) at least MIN_DWELL_FRAMES must have
          // elapsed since the last committed change. Together these cap the
          // warning badge / sensor panel to ~one layout change per 3-4s, so it
          // is physically impossible for them to flicker and bounce the radar.
          const cand = micCandidateRef.current;
          if (cand.quality === report.quality && cand.warning === report.warning) {
            cand.count++;
          } else {
            cand.quality = report.quality;
            cand.warning = report.warning;
            cand.count = 1;
          }
          const committed = micCommittedRef.current;
          committed.dwell++;
          const wouldChange = committed.quality !== cand.quality || committed.warning !== cand.warning;
          if (wouldChange && cand.count >= HYSTERESIS_FRAMES && committed.dwell >= MIN_DWELL_FRAMES) {
            committed.quality = cand.quality;
            committed.warning = cand.warning;
            committed.dwell = 0;
          }
          const stableQuality = committed.quality;
          const stableWarning = committed.warning;

          // snrDb stays live (number-only update, no layout impact).
          setMicQuality(stableQuality, report.snrDb, stableWarning);

          // Update sensor enforcement manager
          sensorMgr.setMicQuality(stableQuality, stableWarning);

          // Voice warning for mic issues
          if (stableWarning) {
            voiceRef.current.announceMicWarning(stableQuality, stableWarning);
          }
        }
      },
      onMetrics: (metrics) => {
        setInferenceTime(metrics.totalTimeMs);
      },
      onStatusChange: (status) => {
        setModelStatus(status);
        if (status === 'ERROR') {
          sensorMgr.setRecordingState(false, 'Detection engine error');
        }
      },
      onRecordingError: (error) => {
        console.error(`[DroneMonitor] Recording error: ${error}`);
        sensorMgr.setRecordingState(false, error);
      },
      onRecordingRecovered: () => {
        // Clear stale UNAVAILABLE state so the "Recording stopped unexpectedly"
        // issue disappears from the warning panel once capture restarts.
        sensorMgr.setRecordingState(true);
        // Brief inline confirmation so the user notices the gap was closed.
        const tr = getTranslation(useSettingsStore.getState().locale);
        showToast(tr.recordingResumed || 'Listening resumed', 4000, 'info');
      },
      onRawInference: (category, confidence) => {
        // Always store so the debug panel can show what the model heard, even
        // when the verdict was filtered out (BACKGROUND, below threshold, etc).
        setRawInference(category, confidence);
      },
    });

    detectorRef.current = detector;

    let disposed = false;
    detector.initialize().then((success) => {
      if (disposed) return; // Prevent state updates after cleanup
      isInitializedRef.current = success;
      setIsInitialized(success);
      sensorMgr.setMicPermission(success);
    }).catch((err) => {
      if (disposed) return;
      console.error('[DroneMonitor] Init failed:', err);
      sensorMgr.setMicPermission(false);
      setIsInitialized(false);
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
        // Going to background — pause intervals + BLE/WiFi scans to save battery
        if (useDetectionStore.getState().isScanning) {
          wasScanningRef.current = true;
          if (batteryIntervalRef.current) { clearInterval(batteryIntervalRef.current); batteryIntervalRef.current = null; }
          if (statusIntervalRef.current) { clearInterval(statusIntervalRef.current); statusIntervalRef.current = null; }
          if (envVoiceIntervalRef.current) { clearInterval(envVoiceIntervalRef.current); envVoiceIntervalRef.current = null; }
          // Pause BLE + WiFi scans to prevent background battery drain
          stopBLE().catch((e) => console.warn('[BLE] background stop failed:', e));
          stopWiFi().catch((e) => console.warn('[WiFi] background stop failed:', e));
        }
      } else if (nextState === 'active' && wasScanningRef.current) {
        // Resuming from background — restart intervals + BLE/WiFi scans
        wasScanningRef.current = false;
        // Resume BLE + WiFi scans
        if (useSettingsStore.getState().bleScanEnabled) {
          startBLE().catch((e) => console.warn('[BLE] foreground resume failed:', e));
        }
        if (wifiAvailable) {
          startWiFi().catch((e) => console.warn('[WiFi] foreground resume failed:', e));
        }
        if (!batteryIntervalRef.current) {
          batteryIntervalRef.current = setInterval(async () => {
            try {
              const level = await Battery.getBatteryLevelAsync();
              const pct = Math.round(level * 100);
              useDetectionStore.getState().setBatteryLevel(pct);
              if (pct < 20 && detectorRef.current) {
                detectorRef.current.setFrameSkipRate(3);
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
    const config = DEVICE_PROFILES[profile] ?? DEVICE_PROFILES.AUTO;
    sensorMgrRef.current.setStereoProfile(config.channels === 2);
  }, [profile]);

  useEffect(() => {
    detectorRef.current?.setConfidenceThreshold(confidenceThreshold);
  }, [confidenceThreshold]);

  // ===== Acoustic + BLE Fusion (debounced to avoid excessive re-computation) =====
  useEffect(() => {
    if (!isScanning || Object.keys(bleDevices).length === 0 || currentThreats.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      const fused = fusionEngineRef.current.fuse(currentThreats, bleDevices);
      setFusedDetections(fused);
    }, 300); // 300ms debounce — avoids running fusion on every detection tick

    return () => clearTimeout(timer);
  }, [currentThreats, bleDevices, isScanning]);

  // ===== Scan control =====
  const isScanningRef = useRef(isScanning);
  useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);

  // Synchronous mutex flipped before any async work so a second startScanning
  // call (e.g. rapid double-tap of the scan button) can't slip past the guard
  // while the first call is still awaiting permissions/battery/etc.
  const scanStartingRef = useRef(false);

  const startScanning = useCallback(async () => {
    if (isScanningRef.current || scanStartingRef.current || !isInitializedRef.current) return;
    if (!detectorRef.current) return;
    scanStartingRef.current = true;

    try {
    // Configure iOS/Android audio session so recording survives system sounds,
    // notifications, and brief background transitions. Without this the
    // AVAudioSession defaults to "ambient" and any interruption silently drops
    // capture — the watchdog then fires "Recording stopped unexpectedly".
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
      });
    } catch (err) {
      console.warn('[ThreatDetector] setAudioModeAsync failed:', err);
    }

    const battLevel = await Battery.getBatteryLevelAsync();
    const battPercent = Math.round(battLevel * 100);
    setBatteryLevel(battPercent);

    // Adaptive frame skip — battery saver. Normal battery runs skip=1: the
    // v1 detection calibration (12/8 voting) was validated at skip=1, and the
    // fingerprint matcher is cheap. Low battery throttles gracefully —
    // detection still works, just with longer latency.
    if (battPercent < 20) detectorRef.current.setFrameSkipRate(3);
    else if (battPercent < 50) detectorRef.current.setFrameSkipRate(2);
    else detectorRef.current.setFrameSkipRate(1);

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
    const config = DEVICE_PROFILES[profile] ?? DEVICE_PROFILES.AUTO;
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

    // Start WiFi Remote ID scanning (Android only, parallel to BLE)
    if (wifiAvailable) {
      await startWiFi().catch((e) => console.warn('[WiFi] Start error:', e));
    }

    voiceRef.current.announceScanStart();

    // Start location watch for fusion engine (with pre-permission rationale)
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      if (existingStatus !== 'granted') {
        // Show rationale before system permission dialog (Google Play requirement)
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Location Access',
            'DroneEar uses your location to detect indoor/outdoor environment, display your position on the map, and calculate distance to detected drones. Location data stays on your device.',
            [{ text: 'OK', onPress: () => resolve() }],
          );
        });
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 15 },
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
    batteryAlertShownRef.current.clear();
    batteryIntervalRef.current = setInterval(async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const pct = Math.round(level * 100);
        setBatteryLevel(pct);

        // Low battery performance throttling
        if (pct < 20 && detectorRef.current) {
          detectorRef.current.setFrameSkipRate(3);
        }

        // Battery alert thresholds (50%, 30%, 15%) — show once per threshold
        const thresholds = [50, 30, 15];
        for (const threshold of thresholds) {
          if (pct <= threshold && !batteryAlertShownRef.current.has(threshold)) {
            batteryAlertShownRef.current.add(threshold);

            // Voice alert
            const currentLocale = useSettingsStore.getState().locale;
            const tr = getTranslation(currentLocale);
            const msg = pct <= 15
              ? (tr.batteryCritical || `Battery critical: ${pct}%. Connect power immediately.`)
              : pct <= 30
              ? (tr.batteryLow || `Battery low: ${pct}%. Connect a power bank to continue scanning.`)
              : (tr.batteryHalf || `Battery at ${pct}%. Consider connecting a power bank for extended scanning.`);
            voiceRef.current.enqueueCustom(msg, pct <= 15 ? 1 : 2);

            // Visual notice — uses the non-blocking inline toast instead of
            // Alert.alert, so the user can keep interacting with the listen
            // screen while the warning fades on its own.
            if (pct <= 30) {
              showToast(msg, pct <= 15 ? 8000 : 6000, pct <= 15 ? 'danger' : 'warn');
            }
            break; // Only alert for the lowest matching threshold
          }
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
    } finally {
      scanStartingRef.current = false;
    }
  }, [profile, bleScanEnabled, bleAvailable, startBLE, wifiAvailable, startWiFi]);

  const stopScanning = useCallback(async () => {
    if (!detectorRef.current) return;
    await detectorRef.current.stopScanning();
    endSession();
    setScanning(false);
    setAudioLevel(0);

    sensorMgrRef.current.stopMonitoring();
    sensorMgrRef.current.setRecordingState(false);
    envDetectorRef.current.stop();

    // Drop the smoothed-heading accumulator so the NEXT scan re-seeds the radar
    // straight to the first live magnetometer reading instead of easing over a
    // few seconds from this session's stale heading.
    smoothedHeadingRef.current = null;

    // Stop BLE + WiFi scanning
    await stopBLE().catch((e) => console.warn('[BLE] stopScanning failed:', e));
    await stopWiFi().catch((e) => console.warn('[WiFi] stopScanning failed:', e));
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
  }, [stopBLE, stopWiFi, bleAvailable]);

  const setProfile = useCallback((newProfile: DeviceProfile) => {
    useSettingsStore.getState().setProfile(newProfile);
  }, []);

  const submitFeedback = useCallback((detectionId: string, accurate: boolean) => {
    setFeedbackPending(false, null);
    // Voice confirmation so user knows feedback was recorded
    const tr = getTranslation(useSettingsStore.getState().locale);
    voiceRef.current.enqueueCustom(tr.thankYouFeedback, 6);
  }, []);

  return {
    // State
    isScanning,
    isInitialized,
    latestDetection,
    currentThreats,
    modelStatus,
    batteryLevel,
    feedbackPending,

    // Sensor enforcement state
    sensorState,
    sensorIssues,

    // Environment detection state
    environmentState,

    // Compass / heading (for radar front-up rotation and HEADING readout)
    compassHeading,
    compassAvailable,

    // BLE Remote ID state
    bleAvailable,
    bleScanActive,
    bleDevices,
    bleDeviceCount,

    // WiFi Remote ID state (Android only)
    wifiAvailable,
    wifiScanActive,

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
