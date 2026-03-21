/**
 * WiFi Remote ID Native Module Interface — v1.0
 *
 * Provides a platform-abstracted interface for WiFi-based Remote ID scanning.
 * On Android: uses WiFi Aware (NAN) and WiFi Beacon frame parsing.
 * On iOS: returns NullWiFiAdapter (Apple blocks WiFi scanning).
 *
 * The native Android implementation (Java/Kotlin) will:
 * 1. Register a WiFi Aware subscribe session for ODID service
 * 2. Parse WiFi Beacon vendor-specific IEs for ASTM F3411 data
 * 3. Forward raw ODID bytes to JS via NativeEventEmitter
 *
 * Until the native module is built, this uses a structured interface
 * that the scanner can program against.
 */

import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

// ===== WiFi Adapter Interface (mirrors BLEAdapter pattern) =====

export interface WiFiAdapterDevice {
  /** Unique device identifier (MAC or hash) */
  id: string;
  /** Source type: 'beacon' | 'nan' */
  source: 'beacon' | 'nan';
  /** Signal strength (dBm) */
  rssi: number;
  /** Channel frequency (MHz) */
  channel?: number;
  /** Raw ODID service data (ASTM F3411 messages) */
  serviceData: Uint8Array;
  /** WiFi SSID if available */
  ssid?: string;
}

export interface WiFiAdapter {
  /** Check if WiFi Remote ID scanning is available on this device */
  isAvailable(): Promise<boolean>;
  /** Start scanning for WiFi Remote ID broadcasts */
  startScan(onDevice: (device: WiFiAdapterDevice) => void): Promise<void>;
  /** Stop scanning */
  stopScan(): Promise<void>;
  /** Release resources */
  dispose(): void;
}

// ===== Null WiFi Adapter (iOS / unsupported devices) =====

export class NullWiFiAdapter implements WiFiAdapter {
  async isAvailable(): Promise<boolean> { return false; }
  async startScan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  dispose(): void {}
}

// ===== Android WiFi Adapter =====

/**
 * Android WiFi Remote ID Adapter
 *
 * Bridges to the native WiFiRemoteIDModule which handles:
 * - WiFi Aware (NAN) subscription for ODID service type
 * - WiFi Beacon IE parsing for vendor-specific ODID data
 * - Broadcasts discovered devices via NativeEventEmitter
 *
 * Native module name: 'WiFiRemoteIDModule'
 * Events: 'onWiFiRemoteIDDevice'
 */
export class AndroidWiFiAdapter implements WiFiAdapter {
  private emitter: NativeEventEmitter | null = null;
  private subscription: { remove: () => void } | null = null;
  private nativeModule: any = null;

  constructor() {
    try {
      this.nativeModule = NativeModules.WiFiRemoteIDModule || null;
      if (this.nativeModule) {
        this.emitter = new NativeEventEmitter(this.nativeModule);
      }
    } catch {
      this.nativeModule = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.nativeModule) return false;
    try {
      return await this.nativeModule.isAvailable();
    } catch {
      return false;
    }
  }

  async startScan(onDevice: (device: WiFiAdapterDevice) => void): Promise<void> {
    if (!this.nativeModule || !this.emitter) return;

    // Listen for native events
    this.subscription = this.emitter.addListener(
      'onWiFiRemoteIDDevice',
      (event: {
        id: string;
        source: 'beacon' | 'nan';
        rssi: number;
        channel?: number;
        serviceData: string; // base64 encoded
        ssid?: string;
      }) => {
        try {
          const bytes = this.base64ToUint8Array(event.serviceData);
          onDevice({
            id: event.id,
            source: event.source,
            rssi: event.rssi,
            channel: event.channel,
            serviceData: bytes,
            ssid: event.ssid,
          });
        } catch {
          // Skip malformed events
        }
      }
    );

    try {
      await this.nativeModule.startScanning();
    } catch (e) {
      // Clean up listener on failure
      this.subscription?.remove();
      this.subscription = null;
      console.warn('[WiFiAdapter] Failed to start native scan:', e);
    }
  }

  async stopScan(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;

    if (this.nativeModule) {
      try {
        await this.nativeModule.stopScanning();
      } catch {
        // Ignore stop errors
      }
    }
  }

  dispose(): void {
    this.stopScan().catch(() => {});
    this.emitter = null;
    this.nativeModule = null;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    const len = base64.length;
    let bufLen = (len * 3) / 4;
    if (base64[len - 1] === '=') bufLen--;
    if (base64[len - 2] === '=') bufLen--;

    const bytes = new Uint8Array(bufLen);
    let p = 0;

    for (let i = 0; i < len; i += 4) {
      const a = lookup[base64.charCodeAt(i)];
      const b = lookup[base64.charCodeAt(i + 1)];
      const c = lookup[base64.charCodeAt(i + 2)];
      const d = lookup[base64.charCodeAt(i + 3)];

      bytes[p++] = (a << 2) | (b >> 4);
      if (p < bufLen) bytes[p++] = ((b & 0xF) << 4) | (c >> 2);
      if (p < bufLen) bytes[p++] = ((c & 0x3) << 6) | d;
    }

    return bytes;
  }
}

// ===== Factory =====

export function createWiFiAdapter(): WiFiAdapter {
  if (Platform.OS !== 'android') {
    return new NullWiFiAdapter();
  }

  try {
    return new AndroidWiFiAdapter();
  } catch {
    console.warn('[WiFi] Failed to create Android WiFi adapter');
    return new NullWiFiAdapter();
  }
}
