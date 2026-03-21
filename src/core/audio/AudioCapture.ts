/**
 * High-performance audio capture manager.
 *
 * Manages the audio recording lifecycle with ring buffer for
 * continuous frame processing. Uses react-native-audio-record
 * for now, designed to be swappable with react-native-audio-api
 * or a native Oboe/AVAudioEngine TurboModule.
 */

import AudioRecord from 'react-native-audio-record';
import { Platform, PermissionsAndroid } from 'react-native';
import type { MicConfig, AudioFrame } from '../../types';
import { DEVICE_PROFILES } from '../../constants/micConfig';

export type AudioFrameCallback = (frame: AudioFrame) => void;

export class AudioCapture {
  private isRecording = false;
  private config: MicConfig;
  private frameCallback: AudioFrameCallback | null = null;
  private frameCount = 0;
  private dataHandler: ((base64Data: string) => void) | null = null;

  constructor(profileName: keyof typeof DEVICE_PROFILES = 'BALANCED') {
    this.config = DEVICE_PROFILES[profileName];
  }

  /**
   * Request microphone permission (Android).
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'DroneEar Microphone Access',
            message: 'DroneEar needs microphone access for acoustic pattern analysis.',
            buttonPositive: 'Grant Access',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('[AudioCapture] Permission error:', err);
        return false;
      }
    }
    return true; // iOS handles via Info.plist
  }

  /**
   * Set the active microphone profile.
   */
  setProfile(profileName: keyof typeof DEVICE_PROFILES): void {
    if (this.isRecording) {
      console.warn('[AudioCapture] Cannot change profile while recording');
      return;
    }
    this.config = DEVICE_PROFILES[profileName];
  }

  /**
   * Start audio capture with frame callback.
   */
  start(onFrame: AudioFrameCallback): void {
    if (this.isRecording) return;

    this.frameCallback = onFrame;
    this.frameCount = 0;

    AudioRecord.init({
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
      bitsPerSample: this.config.bitsPerSample,
      audioSource: this.config.audioSource,
      wavFile: 'drone_capture.wav',
    });

    // Remove any previous listener to prevent duplicates on start/stop cycles
    if (this.dataHandler) {
      try { (AudioRecord as any).removeListener?.('data', this.dataHandler); } catch {}
    }

    this.dataHandler = (base64Data: string) => {
      this.frameCount++;

      // Decode base64 to PCM samples
      const pcmData = this.decodeBase64ToPCM(base64Data);
      if (pcmData.length === 0) return; // Skip empty frames

      // Calculate audio levels
      const rmsLevel = this.calculateRMS(pcmData) * this.config.gainMultiplier;
      const peakLevel = this.calculatePeak(pcmData) * this.config.gainMultiplier;

      const frame: AudioFrame = {
        pcmData,
        sampleRate: this.config.sampleRate,
        timestamp: Date.now(),
        rmsLevel: Math.min(rmsLevel, 1.0),
        peakLevel: Math.min(peakLevel, 1.0),
      };

      this.frameCallback?.(frame);
    };

    AudioRecord.on('data', this.dataHandler);

    AudioRecord.start();
    this.isRecording = true;
    console.log(`[AudioCapture] Started: ${this.config.sampleRate}Hz, ${this.config.channels}ch`);
  }

  /**
   * Stop audio capture.
   */
  async stop(): Promise<void> {
    if (!this.isRecording) return;

    // Remove listener before stopping to prevent stale callbacks
    if (this.dataHandler) {
      try { (AudioRecord as any).removeListener?.('data', this.dataHandler); } catch {}
      this.dataHandler = null;
    }
    await AudioRecord.stop();
    this.isRecording = false;
    this.frameCallback = null;
    console.log(`[AudioCapture] Stopped after ${this.frameCount} frames`);
  }

  get recording(): boolean {
    return this.isRecording;
  }

  get currentConfig(): MicConfig {
    return { ...this.config };
  }

  // ===== Internal Helpers =====

  private decodeBase64ToPCM(base64: string): Float32Array {
    try {
      // Decode base64 to binary
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Ensure even byte count for 16-bit PCM
      const safeLength = bytes.length - (bytes.length % 2);
      if (safeLength === 0) return new Float32Array(0);

      // Convert 16-bit PCM to normalized float32
      const numSamples = safeLength / 2;
      const pcm = new Float32Array(numSamples);
      const dataView = new DataView(bytes.buffer, 0, safeLength);

      for (let i = 0; i < numSamples; i++) {
        const sample = dataView.getInt16(i * 2, true); // little-endian
        pcm[i] = sample / 32768.0; // Normalize to [-1.0, 1.0]
      }

      return pcm;
    } catch (err) {
      console.error('[AudioCapture] Base64 decode failed:', err);
      return new Float32Array(0);
    }
  }

  private calculateRMS(pcm: Float32Array): number {
    if (pcm.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) {
      sum += pcm[i] * pcm[i];
    }
    return Math.sqrt(sum / pcm.length);
  }

  private calculatePeak(pcm: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) {
      const abs = Math.abs(pcm[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }
}
