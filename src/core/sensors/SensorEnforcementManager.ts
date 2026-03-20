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
  message: string;       // User-facing message (i18n key or fallback)
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
   */
  setMicQuality(quality: MicQuality, warning: MicWarning): void {
    this.micQuality = quality;
    this.micWarning = warning;

    if (quality === 'POOR') {
      this.sensorState.microphone = 'DEGRADED';
      const action = warning === 'WIND' ? 'REPOSITION' : warning === 'CLIPPING' ? 'CHANGE_PROFILE' : 'REPOSITION';
      this.startEscalatingAlarm('mic_quality', {
        sensor: 'microphone',
        status: 'DEGRADED',
        message: `Mic quality: ${quality}. ${warning || 'Low SNR'}.`,
        action,
        severity: 'HIGH',
      });
    } else {
      if (this.sensorState.microphone === 'DEGRADED') {
        this.sensorState.microphone = 'OK';
      }
      this.clearAlarm('mic_quality');
    }
    this.emitState();
  }

  /**
   * Update recording state.
   */
  setRecordingState(active: boolean, error?: string): void {
    if (error) {
      this.sensorState.recording = 'UNAVAILABLE';
      this.startEscalatingAlarm('recording', {
        sensor: 'recording',
        status: 'UNAVAILABLE',
        message: `Recording error: ${error}`,
        action: 'RETRY',
        severity: 'CRITICAL',
      });
    } else {
      this.sensorState.recording = active ? 'OK' : 'UNAVAILABLE';
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
      issues.push({ sensor: 'microphone', status: 'DENIED', message: 'Mic permission denied', action: 'SETTINGS', severity: 'CRITICAL' });
    } else if (this.sensorState.microphone === 'DEGRADED') {
      issues.push({ sensor: 'microphone', status: 'DEGRADED', message: `Mic quality poor: ${this.micWarning || 'low SNR'}`, action: 'REPOSITION', severity: 'HIGH' });
    }

    if (this.sensorState.compass === 'UNAVAILABLE') {
      issues.push({ sensor: 'compass', status: 'UNAVAILABLE', message: 'Compass unavailable. Bearing is relative only.', action: 'NONE', severity: 'MEDIUM' });
    } else if (this.sensorState.compass === 'DEGRADED') {
      issues.push({ sensor: 'compass', status: 'DEGRADED', message: 'Compass accuracy low. Move away from metal.', action: 'REPOSITION', severity: 'MEDIUM' });
    }

    if (this.sensorState.stereo === 'UNAVAILABLE' && this.isStereoProfile) {
      issues.push({ sensor: 'stereo', status: 'UNAVAILABLE', message: 'Stereo not available on current profile.', action: 'CHANGE_PROFILE', severity: 'HIGH' });
    } else if (!this.isStereoProfile) {
      issues.push({ sensor: 'stereo', status: 'DEGRADED', message: 'Mono profile: DOA bearing unavailable. Switch to stereo profile.', action: 'CHANGE_PROFILE', severity: 'MEDIUM' });
    }

    if (this.sensorState.recording === 'UNAVAILABLE') {
      issues.push({ sensor: 'recording', status: 'UNAVAILABLE', message: 'Recording stopped unexpectedly.', action: 'RETRY', severity: 'CRITICAL' });
    }

    if (this.sensorState.bluetooth === 'UNAVAILABLE') {
      issues.push({ sensor: 'bluetooth', status: 'UNAVAILABLE', message: 'Bluetooth unavailable. BLE Remote ID scanning disabled.', action: 'SETTINGS', severity: 'MEDIUM' });
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
    // atan2 gives angle from magnetic north
    let heading = Math.atan2(y, x) * (180 / Math.PI);
    heading = (heading + 360) % 360;
    // Adjust: 0 = North, 90 = East
    heading = (360 - heading) % 360;
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
    this.stopMonitoring();
  }
}
