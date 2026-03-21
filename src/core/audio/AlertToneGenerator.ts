/**
 * Alert Tone Generator — Programmatic WAV generation
 *
 * Generates alert tones as WAV buffers at runtime.
 * No external .mp3/.wav files required.
 * Each severity has a distinct frequency pattern and cadence.
 *
 * CRITICAL: 880Hz triple-pulse, fast (urgent staccato)
 * HIGH:     660Hz double-pulse (warning cadence)
 * MEDIUM:   440Hz single tone (notification)
 * LOW:      330Hz soft tone (info)
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const SAMPLE_RATE = 22050;

interface TonePattern {
  frequency: number;
  pulses: { durationMs: number; silenceMs: number }[];
  volume: number;
}

const SEVERITY_TONES: Record<string, TonePattern> = {
  CRITICAL: {
    frequency: 880,
    pulses: [
      { durationMs: 150, silenceMs: 80 },
      { durationMs: 150, silenceMs: 80 },
      { durationMs: 250, silenceMs: 0 },
    ],
    volume: 1.0,
  },
  HIGH: {
    frequency: 660,
    pulses: [
      { durationMs: 200, silenceMs: 120 },
      { durationMs: 300, silenceMs: 0 },
    ],
    volume: 0.85,
  },
  MEDIUM: {
    frequency: 440,
    pulses: [
      { durationMs: 400, silenceMs: 0 },
    ],
    volume: 0.7,
  },
  LOW: {
    frequency: 330,
    pulses: [
      { durationMs: 300, silenceMs: 0 },
    ],
    volume: 0.5,
  },
};

/**
 * Generate a sine wave tone as PCM Int16 samples.
 */
function generateSineWave(freq: number, durationMs: number, volume: number): Int16Array {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const samples = new Int16Array(numSamples);
  const fadeLen = Math.min(Math.floor(numSamples * 0.1), 200);

  for (let i = 0; i < numSamples; i++) {
    let amplitude = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);

    // Add 2nd harmonic for richness
    amplitude += 0.3 * Math.sin((2 * Math.PI * freq * 2 * i) / SAMPLE_RATE);
    amplitude /= 1.3;

    // Fade in/out to prevent clicks
    let envelope = 1.0;
    if (i < fadeLen) envelope = i / fadeLen;
    else if (i > numSamples - fadeLen) envelope = (numSamples - i) / fadeLen;

    samples[i] = Math.round(amplitude * envelope * volume * 32767 * 0.8);
  }
  return samples;
}

/**
 * Generate silence as PCM Int16 samples.
 */
function generateSilence(durationMs: number): Int16Array {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  return new Int16Array(numSamples);
}

/**
 * Create WAV file bytes from PCM Int16 data.
 */
function createWavBytes(pcmData: Int16Array): Uint8Array {
  const dataSize = pcmData.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);        // chunk size
  view.setUint16(20, 1, true);         // PCM format
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true);         // block align
  view.setUint16(34, 16, true);        // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM data
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate a complete alert tone WAV for a severity level.
 */
function generateAlertWav(severity: string): Uint8Array {
  const pattern = SEVERITY_TONES[severity];
  if (!pattern) return createWavBytes(new Int16Array(0));

  const segments: Int16Array[] = [];
  for (const pulse of pattern.pulses) {
    segments.push(generateSineWave(pattern.frequency, pulse.durationMs, pattern.volume));
    if (pulse.silenceMs > 0) {
      segments.push(generateSilence(pulse.silenceMs));
    }
  }

  // Concatenate all segments
  const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
  const combined = new Int16Array(totalLength);
  let offset = 0;
  for (const seg of segments) {
    combined.set(seg, offset);
    offset += seg.length;
  }

  return createWavBytes(combined);
}

// Cache generated sound objects
const soundCache = new Map<string, string>();

/**
 * Play an alert tone for the given severity.
 * Generates WAV on first call, caches for subsequent plays.
 */
export async function playAlertTone(severity: string): Promise<void> {
  if (severity === 'NONE') return;

  try {
    let uri = soundCache.get(severity);

    if (!uri) {
      // Generate WAV and write to temp file
      const wavBytes = generateAlertWav(severity);
      const base64 = uint8ArrayToBase64(wavBytes);
      const filePath = `${FileSystem.cacheDirectory}alert_${severity.toLowerCase()}.wav`;
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      uri = filePath;
      soundCache.set(severity, uri);
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: SEVERITY_TONES[severity]?.volume ?? 0.7 }
    );

    // Safety timeout: unload sound after 5s max (prevents leak if callback never fires)
    const safetyTimer = setTimeout(() => {
      sound.unloadAsync().catch(() => {});
    }, 5000);

    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        clearTimeout(safetyTimer);
        sound.unloadAsync().catch(() => {});
      } else if ('error' in status) {
        clearTimeout(safetyTimer);
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    // Graceful fallback — no crash if audio unavailable
    console.warn('[AlertTone] Failed to play:', e);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use global btoa if available, otherwise manual encoding
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  // Fallback for React Native
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < binary.length) {
    const a = binary.charCodeAt(i++);
    const b = i < binary.length ? binary.charCodeAt(i++) : 0;
    const c = i < binary.length ? binary.charCodeAt(i++) : 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i - 2 < binary.length ? chars[(triplet >> 6) & 0x3f] : '=';
    result += i - 1 < binary.length ? chars[triplet & 0x3f] : '=';
  }
  return result;
}

/**
 * Clear cached sound files.
 */
export async function clearAlertToneCache(): Promise<void> {
  for (const [, uri] of soundCache) {
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
  }
  soundCache.clear();
}
