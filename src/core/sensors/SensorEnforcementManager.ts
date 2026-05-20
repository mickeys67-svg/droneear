/**
 * Sensor Enforcement Manager — v1.0
 *
 * Monitors all critical sensors and enforces minimum quality thresholds.
 * When a sensor is degraded or unavailable, it:
 * 1. Attempts auto-recovery (re-request permission, restart sensor)
 * 2. Escalates alarms at increasing intervals (5s → 15s → 30s → 60s)
 * 3. Forces UI indicators showing exactly which sensors are degraded
 * 4. Provides actionable guidance for each sensor issue
 *
 * Sensors monitored:
 * - Microphone: permission, quality (SNR), clipping, wind
 * - Compass/Magnetometer: heading availability and accuracy
 * - Audio Recording: active state, error recovery
 * - Stereo capability: required for DOA bearing estimation
 */

import { Magnetometer, type MagnetometerMeasurement } from 'expo-sensors';
import { Platform, PermissionsAndroid } from 'react-native';
import type { MicQuality, MicWarning } from '../audio/MicQualityMonitor';

// ===== Types =====

export type SensorStatus = 'OK' | 'DEGRADED' | 'UNAVAILABLE' | 'DENIED';

export interface SensorState {
  microphone: SensorStatus;
  compass: SensorStatus;
  stereo: SensorStatus;
  recording: SensorStatus;
  bluetooth: SensorStatus;
}

export interface SensorIssue {
  sensor: keyof SensorState;
  status: SensorStatus;
  message: string;       // English fallback text
  // Stable i18n key — the UI translates this; falls back to `message` when
  // the active language has no entry. Keeps the core layer translation-free.
  messageKey: string;
  action: 'SETTINGS' | 'RETRY' | 'CHANGE_PROFILE' | 'REPOSITION' | 'NONE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface CompassData {
  heading: number;       // 0-360 degrees (magnetic north)
  accuracy: number;      // 0-3 (0=unreliable, 3=high accuracy)
  available: boolean;
}

export type SensorCallback = (state: SensorState, issues: SensorIssue[]) => void;
export type CompassCallback = (data: CompassData) => void;

// ===== Alarm Escalation =====
const ALARM_INTERVALS = [5000, 15000, 30000, 60000]; // Escalating intervals

export class SensorEnforcementManager {
  private disposed = false;
  private sensorState: SensorState = {
    microphone: 'UNAVAILABLE',
    compass: 'UNAVAILABLE',
    stereo: 'UNAVAILABLE',
    recording: 'UNAVAILABLE',
    bluetooth: 'UNAVAILABLE',
  };

  private compassData: CompassData = { heading: 0, accuracy: 0, available: false };
  private magnetometerSubscription: any = null;
  private alarmTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private alarmEscalation: Map<string, number> = new Map(); // Track escalation level per sensor

  private onSensorUpdate: SensorCallback | null = null;
  private onCompassUpdate: CompassCallback | null = null;
  private onAlarm: ((issue: SensorIssue) => void) | null = null;

  private isStereoProfile = false;
  private micQuality: MicQuality = 'GOOD';
  private micWarning: MicWarning = null;

  // ===== Public API =====

  /**
   * Register callbacks.
   */
  setCallbacks(opts: {
    onSensorUpdate?: SensorCallback;
    onCompassUpdate?: CompassCallback;
    onAlarm?: (issue: SensorIssue) => void;
  }): void {
    this.onSensorUpdate = opts.onSensorUpdate || null;
    this.onCompassUpdate = opts.onCompassUpdate || null;
    this.onAlarm = opts.onAlarm || null;
  }

  /**
   * Start monitoring all sensors.
   */
  async startMonitoring(isStereoProfile: boolean): Promise<void> {
    this.isStereoProfile = isStereoProfile;
    await this.startCompass();
    this.checkStereo();
    this.emitState();
  }

  /**
   * Stop monitoring.
   */
  stopMonitoring(): void {
    this.stopCompass();
    this.clearAllAlarms();
  }

  /**
   * Update mic permission status.
   */
  setMicPermission(granted: boolean): void {
    this.sensorState.microphone = granted ? 'OK' : 'DENIED';
    if (!granted) {
      this.startEscalatingAlarm('microphone', {
        sensor: 'microphone',
        status: 'DENIED',
        message: 'Microphone permission denied. Cannot detect threats.',
        messageKey: 'issueMicDenied',
        action: 'SETTINGS',
        severity: 'CRITICAL',
      });
    } else {
      this.clearAlarm('microphone');
    }
    this.emitState();
  }

  /**
   * Update mic quality from MicQualityMonitor.
   * Called on every audio frame (20-30Hz) — must early-return when unchanged
   * to avoid per-frame emitState/haptic storms that shake the UI.
   */
  setMicQuality(quality: MicQuality, warning: MicWarning): void {
    if (this.micQuality === quality && this.micWarning === warning) {
      return;
    }
    this.micQuality = quality;
    this.micWarning = warning;

    const prevMicState = this.sensorState.microphone;
    if (quality === 'POOR') {
      // Weak mic signal is an informational quality notice, NOT a failure.
      // It surfaces silently in the sensor-issues panel. We deliberately do
      // NOT fire an escalating haptic/voice alarm here — a quiet room
      // legitimately reads as low SNR, and repeating vibration made the app
      // feel broken/error-y to users. Escalating alarms stay reserved for
      // CRITICAL blockers (permission denied, recording crash).
      this.sensorState.microphone = 'DEGRADED';
    } else {
      if (this.sensorState.microphone === 'DEGRADED') {
        this.sensorState.microphone = 'OK';
      }
    }
    if (prevMicState !== this.sensorState.microphone) {
      this.emitState();
    }
  }

  /**
   * Update recording state.
   */
  setRecordingState(active: boolean, error?: string): void {
    const desired: SensorStatus = error || !active ? 'UNAVAILABLE' : 'OK';
    if (this.sensorState.recording === desired && !error) {
      return;
    }
    if (error) {
      this.sensorState.recording = 'UNAVAILABLE';
      this.startEscalatingAlarm('recording', {
        sensor: 'recording',
        status: 'UNAVAILABLE',
        message: `Recording error: ${error}`,
        messageKey: 'issueRecordingLost',
        action: 'RETRY',
        severity: 'CRITICAL',
      });
    } else {
      this.sensorState.recording = desired;
      if (active) this.clearAlarm('recording');
    }
    this.emitState();
  }

  /**
   * Update stereo profile state.
   */
  setStereoProfile(isStereo: boolean): void {
    this.isStereoProfile = isStereo;
    this.checkStereo();
    this.emitState();
  }

  /**
   * Update BLE scanner state.
   */
  setBLEState(available: boolean, scanning: boolean): void {
    if (!available) {
      this.sensorState.bluetooth = 'UNAVAILABLE';
    } else {
      this.sensorState.bluetooth = scanning ? 'OK' : 'DEGRADED';
    }
    this.emitState();
  }

  /**
   * Get current compass heading (for AudioClassifier).
   */
  getCompassHeading(): number {
    return this.compassData.heading;
  }

  /**
   * Get current sensor state.
   */
  getState(): SensorState {
    return { ...this.sensorState };
  }

  /**
   * Get all active issues.
   */
  getActiveIssues(): SensorIssue[] {
    const issues: SensorIssue[] = [];

    if (this.sensorState.microphone === 'DENIED') {
      issues.push({ sensor: 'microphone', status: 'DENIED', message: 'Mic permission denied', messageKey: 'issueMicDenied', action: 'SETTINGS', severity: 'CRITICAL' });
    } else if (this.sensorState.microphone === 'DEGRADED') {
      // Quality notice, not a failure — pick a specific calm message per
      // cause so it reads as guidance ("move somewhere quieter") rather
      // than a raw error string.
      const micKey =
        this.micWarning === 'WIND' ? 'issueMicWind' :
        this.micWarning === 'CLIPPING' ? 'issueMicClipping' :
        this.micWarning === 'NOISE' ? 'issueMicNoise' :
        'issueMicLowSignal';
      issues.push({ sensor: 'microphone', status: 'DEGRADED', message: 'Microphone signal is weak — detection range is reduced.', messageKey: micKey, action: 'REPOSITION', severity: 'MEDIUM' });
    }

    if (this.sensorState.compass === 'UNAVAILABLE') {
      issues.push({ sensor: 'compass', status: 'UNAVAILABLE', message: 'Compass unavailable. Bearing is relative only.', messageKey: 'issueCompassUnavailable', action: 'NONE', severity: 'MEDIUM' });
    } else if (this.sensorState.compass === 'DEGRADED') {
      issues.push({ sensor: 'compass', status: 'DEGRADED', message: 'Compass accuracy low. Move away from metal.', messageKey: 'issueCompassDegraded', action: 'REPOSITION', severity: 'MEDIUM' });
    }

    if (this.sensorState.stereo === 'UNAVAILABLE' && this.isStereoProfile) {
      issues.push({ sensor: 'stereo', status: 'UNAVAILABLE', message: 'Stereo not available on current profile.', messageKey: 'issueStereoUnavailable', action: 'CHANGE_PROFILE', severity: 'MEDIUM' });
    } else if (!this.isStereoProfile) {
      issues.push({ sensor: 'stereo', status: 'DEGRADED', message: 'Mono profile: direction estimate unavailable.', messageKey: 'issueMonoProfile', action: 'CHANGE_PROFILE', severity: 'MEDIUM' });
    }

    if (this.sensorState.recording === 'UNAVAILABLE') {
      issues.push({ sensor: 'recording', status: 'UNAVAILABLE', message: 'Recording stopped unexpectedly.', messageKey: 'issueRecordingLost', action: 'RETRY', severity: 'CRITICAL' });
    }

    if (this.sensorState.bluetooth === 'UNAVAILABLE') {
      issues.push({ sensor: 'bluetooth', status: 'UNAVAILABLE', message: 'Bluetooth unavailable. BLE Remote ID scanning disabled.', messageKey: 'issueBluetoothUnavailable', action: 'SETTINGS', severity: 'MEDIUM' });
    }

    return issues;
  }

  // ===== Compass =====

  private async startCompass(): Promise<void> {
    try {
      const available = await Magnetometer.isAvailableAsync();
      if (!available) {
        this.sensorState.compass = 'UNAVAILABLE';
        this.compassData.available = false;
        return;
      }

      Magnetometer.setUpdateInterval(200); // 5 Hz

      this.magnetometerSubscription = Magnetometer.addListener((data: MagnetometerMeasurement) => {
        // Calculate heading from magnetometer data
        const heading = this.calculateHeading(data.x, data.y, data.z);
        const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

        // Accuracy heuristic: magnetic field strength should be ~25-65 µT
        let accuracy = 3;
        if (magnitude < 15 || magnitude > 100) accuracy = 0;       // Unreliable
        else if (magnitude < 20 || magnitude > 80) accuracy = 1;   // Low
        else if (magnitude < 25 || magnitude > 65) accuracy = 2;   // Medium

        this.compassData = { heading, accuracy, available: true };

        // Update sensor state
        if (accuracy === 0) {
          this.sensorState.compass = 'DEGRADED';
        } else {
          this.sensorState.compass = 'OK';
          this.clearAlarm('compass');
        }

        this.onCompassUpdate?.(this.compassData);
      });

      this.sensorState.compass = 'OK';
    } catch (e) {
      console.warn('[SensorEnforcement] Compass init failed:', e);
      this.sensorState.compass = 'UNAVAILABLE';
      this.compassData.available = false;
    }
  }

  private stopCompass(): void {
    if (this.magnetometerSubscription) {
      this.magnetometerSubscription.remove();
      this.magnetometerSubscription = null;
    }
  }

  private calculateHeading(x: number, y: number, _z: number): number {
    // atan2(y,x) gives angle from East axis, CCW positive
    // Convert to compass heading: 0 = North, 90 = East (CW)
    let heading = Math.atan2(y, x) * (180 / Math.PI);
    heading = (90 - heading + 360) % 360;
    return Math.round(heading);
  }

  // ===== Stereo Check =====

  private checkStereo(): void {
    if (this.isStereoProfile) {
      this.sensorState.stereo = 'OK';
    } else {
      this.sensorState.stereo = 'DEGRADED';
    }
  }

  // ===== Escalating Alarm System =====

  private startEscalatingAlarm(key: string, issue: SensorIssue): void {
    // Clear any existing alarm for this key before starting a new one
    this.clearAlarm(key);

    const level = 0;
    this.alarmEscalation.set(key, level);

    // Fire immediately
    this.onAlarm?.(issue);

    // Set escalating timer
    const scheduleNext = () => {
      if (this.disposed) return;
      const currentLevel = this.alarmEscalation.get(key) || 0;
      const interval = ALARM_INTERVALS[Math.min(currentLevel, ALARM_INTERVALS.length - 1)] || 60000;

      const timer = setTimeout(() => {
        // Check if still relevant
        const stateVal = this.sensorState[issue.sensor];
        if (stateVal === 'OK') {
          this.clearAlarm(key);
          return;
        }

        this.onAlarm?.(issue);
        this.alarmEscalation.set(key, currentLevel + 1);
        scheduleNext(); // Schedule next escalation
      }, interval);

      this.alarmTimers.set(key, timer);
    };

    scheduleNext();
  }

  private clearAlarm(key: string): void {
    const timer = this.alarmTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.alarmTimers.delete(key);
    }
    this.alarmEscalation.delete(key);
  }

  private clearAllAlarms(): void {
    for (const [, timer] of this.alarmTimers) {
      clearTimeout(timer);
    }
    this.alarmTimers.clear();
    this.alarmEscalation.clear();
  }

  // ===== Emit =====

  private emitState(): void {
    const issues = this.getActiveIssues();
    this.onSensorUpdate?.(this.sensorState, issues);
  }

  dispose(): void {
    this.disposed = true;
    this.stopMonitoring();
  }
}
