/**
 * Voice Alert Manager — v4.0
 *
 * Major upgrade:
 * - 15 language TTS support (all SupportedLocale)
 * - Programmatic alert tone generation (no .wav dependency)
 * - Severity-escalated speech rate & pitch
 * - Mic quality voice warnings
 * - Distance/bearing accuracy disclaimer in voice
 * - Queued announcement system (prevents overlap)
 * - Configurable cooldown per severity level
 */

import * as Speech from 'expo-speech';
import type { DetectionResult, ThreatSeverity, ThreatCategory } from '../../types';
import { getTranslation, type SupportedLocale } from '../../i18n/translations';
import type { MicQuality, MicWarning } from './MicQualityMonitor';
import { playAlertTone, clearAlertToneCache } from './AlertToneGenerator';

// Per-severity cooldown (ms) — CRITICAL alerts always get through faster
const SEVERITY_COOLDOWN: Record<string, number> = {
  CRITICAL: 2000,
  HIGH: 4000,
  MEDIUM: 6000,
  LOW: 8000,
  NONE: 10000,
};

const STATUS_UPDATE_INTERVAL_MS = 30000;
const MIC_WARNING_COOLDOWN_MS = 60000; // Only warn about mic issues every 60s

// TTS language codes for all 15 locales
const TTS_LANG: Record<SupportedLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  uk: 'uk-UA',
  ar: 'ar-SA',
  ar_gulf: 'ar-AE',
  he: 'he-IL',
  hi: 'hi-IN',
  ur: 'ur-PK',
  tl: 'fil-PH',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

// Speech rate per severity (higher = more urgent)
const SPEECH_RATE: Record<string, number> = {
  CRITICAL: 1.3,
  HIGH: 1.2,
  MEDIUM: 1.1,
  LOW: 1.0,
  NONE: 1.0,
};

// Speech pitch per severity
const SPEECH_PITCH: Record<string, number> = {
  CRITICAL: 1.2,
  HIGH: 1.1,
  MEDIUM: 1.0,
  LOW: 0.95,
  NONE: 1.0,
};

interface QueuedAnnouncement {
  text: string;
  severity: ThreatSeverity;
  priority: number; // Lower = higher priority
}

export class VoiceAlertManager {
  private lastAlertTime: Record<string, number> = {
    CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0,
  };
  private lastStatusUpdateTime = 0;
  private lastMicWarningTime = 0;
  private locale: SupportedLocale = 'ko';
  private voiceEnabled = true;
  private soundEnabled = true;
  private isSpeaking = false;
  private queue: QueuedAnnouncement[] = [];
  private processingQueue = false;
  private disposed = false;
  setLocale(locale: SupportedLocale): void {
    this.locale = locale;
  }

  setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    if (!enabled) {
      Speech.stop();
      this.isSpeaking = false;
      this.queue = [];
    }
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  /**
   * Announce a threat detection with severity-based urgency.
   */
  async announceDetection(detection: DetectionResult): Promise<void> {
    const now = Date.now();
    const cooldown = SEVERITY_COOLDOWN[detection.severity];
    if (now - (this.lastAlertTime[detection.severity] || 0) < cooldown) return;
    this.lastAlertTime[detection.severity] = now;

    // Play alert tone first (non-blocking)
    if (this.soundEnabled) {
      this.playTone(detection.severity);
    }

    if (!this.voiceEnabled) return;

    const t = getTranslation(this.locale);
    const categoryName = this.getCategoryName(detection.threatCategory);
    const directionName = this.getDirectionName(detection.bearingDegrees);

    let message = '';

    // Severity prefix with repetition for critical
    if (detection.severity === 'CRITICAL') {
      message += `${t.voiceCritical}! ${t.voiceCritical}! `;
    } else if (detection.severity === 'HIGH') {
      message += `${t.voiceWarning}! `;
    }

    // Main detection info
    message += t.voiceDetected(categoryName, detection.distanceMeters, directionName);

    // Approach rate
    if (detection.approachRate < -2) {
      message += ' ' + t.voiceApproaching(Math.abs(Math.round(detection.approachRate)));
    }

    // Priority: CRITICAL=0, HIGH=1, MEDIUM=2, LOW=3
    const priority = detection.severity === 'CRITICAL' ? 0 :
                     detection.severity === 'HIGH' ? 1 :
                     detection.severity === 'MEDIUM' ? 2 : 3;

    this.enqueue({ text: message, severity: detection.severity, priority });
  }

  /**
   * Announce microphone quality issues.
   */
  async announceMicWarning(quality: MicQuality, warning: MicWarning): Promise<void> {
    if (!this.voiceEnabled || !warning) return;

    const now = Date.now();
    if (now - this.lastMicWarningTime < MIC_WARNING_COOLDOWN_MS) return;
    this.lastMicWarningTime = now;

    const t = getTranslation(this.locale);
    let message = '';

    if (warning === 'WIND') message = t.micWindWarning;
    else if (warning === 'NOISE') message = t.micNoiseWarning;
    else if (warning === 'CLIPPING') message = t.micClippingWarning;

    if (message) {
      this.enqueue({ text: message, severity: 'LOW', priority: 5 });
    }
  }

  /**
   * Enqueue a custom voice message (used by environment warnings, etc.)
   */
  async enqueueCustom(text: string, priority = 4): Promise<void> {
    if (!this.voiceEnabled || !text) return;
    this.enqueue({ text, severity: 'LOW', priority });
  }

  async announceScanStart(): Promise<void> {
    if (!this.voiceEnabled) return;
    const t = getTranslation(this.locale);
    this.enqueue({ text: t.voiceScanStarted, severity: 'NONE', priority: 4 });
  }

  async announceScanStop(): Promise<void> {
    if (!this.voiceEnabled) return;
    const t = getTranslation(this.locale);
    // Stop everything and announce immediately
    this.queue = [];
    Speech.stop();
    this.isSpeaking = false;
    await this.speak(t.voiceScanStopped, 'NONE');
  }

  /**
   * Periodic status update during scanning.
   */
  async announceStatus(activeTrackCount: number): Promise<void> {
    if (!this.voiceEnabled) return;

    const now = Date.now();
    if (now - this.lastStatusUpdateTime < STATUS_UPDATE_INTERVAL_MS) return;
    this.lastStatusUpdateTime = now;

    const t = getTranslation(this.locale);
    const text = activeTrackCount === 0
      ? t.voiceNoThreats
      : t.voiceTracking(activeTrackCount);

    this.enqueue({ text, severity: 'NONE', priority: 6 });
  }

  /**
   * Play programmatic alert tone (generated at runtime, no .mp3 needed).
   */
  private async playTone(severity: ThreatSeverity): Promise<void> {
    await playAlertTone(severity);
  }

  // ===== Queue System =====

  private enqueue(item: QueuedAnnouncement): void {
    // CRITICAL alerts jump the queue
    if (item.priority === 0) {
      Speech.stop();
      this.isSpeaking = false;
      this.queue = [item, ...this.queue];
    } else {
      this.queue.push(item);
      // Sort by priority
      this.queue.sort((a, b) => a.priority - b.priority);
    }

    // Keep queue bounded
    if (this.queue.length > 5) {
      this.queue = this.queue.slice(0, 5);
    }

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.isSpeaking || this.queue.length === 0) return;
    if (this.disposed) return;
    this.processingQueue = true;

    try {
      let iterations = 0;
      const maxIterations = 10;
      while (this.queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const item = this.queue.shift()!;
        await this.speak(item.text, item.severity);
        // Small gap between announcements
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      this.processingQueue = false;
      // Re-check: items may have been enqueued during processing
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }

  private async speak(text: string, severity: ThreatSeverity): Promise<void> {
    if (this.isSpeaking) {
      Speech.stop();
    }

    this.isSpeaking = true;

    const lang = TTS_LANG[this.locale] || 'en-US';

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.isSpeaking = false;
        resolve();
      }, 10000); // 10s safety timeout

      Speech.speak(text, {
        language: lang,
        rate: SPEECH_RATE[severity] || 1.0,
        pitch: SPEECH_PITCH[severity] || 1.0,
        onDone: () => {
          clearTimeout(timeout);
          this.isSpeaking = false;
          resolve();
        },
        onError: () => {
          clearTimeout(timeout);
          this.isSpeaking = false;
          resolve();
        },
      });
    });
  }

  private getCategoryName(category: ThreatCategory): string {
    const t = getTranslation(this.locale);
    const map: Record<string, string> = {
      // New AcousticPattern names (v2.0)
      MULTIROTOR: t.droneSmall,
      SINGLE_ENGINE: t.droneLarge,
      SINGLE_ROTOR: t.helicopter,
      JET_PROPULSION: t.missile,
      PROPELLER_FIXED: t.aircraft,
      BACKGROUND: t.ambient,
      // Legacy backward compat
      DRONE_SMALL: t.droneSmall,
      DRONE_LARGE: t.droneLarge,
      HELICOPTER: t.helicopter,
      MISSILE: t.missile,
      AIRCRAFT: t.aircraft,
      AMBIENT: t.ambient,
    };
    return map[category] || category;
  }

  private getDirectionName(degrees: number): string {
    const t = getTranslation(this.locale);
    const dirs = [t.north, t.northEast, t.east, t.southEast, t.south, t.southWest, t.west, t.northWest];
    const idx = ((Math.round(degrees / 45) % 8) + 8) % 8;
    return dirs[idx];
  }

  dispose(): void {
    this.disposed = true;
    Speech.stop();
    this.isSpeaking = false;
    this.queue = [];
    clearAlertToneCache().catch(() => {});
  }
}
