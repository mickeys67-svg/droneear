/**
 * BLE Remote ID Scanner — v1.0
 *
 * Scans for ASTM F3411 Open Drone ID BLE advertisements.
 * Uses an adapter pattern with react-native-ble-plx (RealBLEAdapter).
 *
 * Architecture:
 *   BLERemoteIDScanner (public API)
 *     └─ BLEAdapter (interface)
 *          ├─ RealBLEAdapter (react-native-ble-plx — production)
 *          └─ NullBLEAdapter (Expo Go fallback — no-op)
 */

import { RemoteIDParser, ODID_SERVICE_UUID } from './RemoteIDParser';
import type { RemoteIDData } from '../../types';

// ===== Adapter Interface =====

export interface BLEAdapterDevice {
  id: string;              // BLE peripheral ID (MAC or UUID)
  name?: string;
  rssi: number;            // Signal strength in dBm
  manufacturerData?: Uint8Array;
  serviceData?: Uint8Array;
}

export interface BLEAdapter {
  isAvailable(): Promise<boolean>;
  startScan(onDevice: (device: BLEAdapterDevice) => void): Promise<void>;
  stopScan(): Promise<void>;
  dispose(): void;
}

// ===== Public Scanner =====

export type RemoteIDCallback = (deviceId: string, data: RemoteIDData) => void;

export class BLERemoteIDScanner {
  private adapter: BLEAdapter;
  private callback: RemoteIDCallback | null = null;
  private devices: Map<string, RemoteIDData> = new Map();
  private scanning = false;
  private staleTimer: ReturnType<typeof setInterval> | null = null;

  // Known manufacturer OUI → name mapping
  private static readonly MANUFACTURER_OUI: Record<string, string> = {
    '60:60:1F': 'DJI',
    '90:3A:E6': 'Parrot',
    'A0:14:3D': 'Parrot',
  };

  constructor(adapter?: BLEAdapter) {
    if (!adapter) throw new Error('BLEAdapter is required');
    this.adapter = adapter;
  }

  /**
   * Check if BLE scanning is available on this device.
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.adapter.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Register callback for Remote ID discoveries.
   */
  onRemoteID(callback: RemoteIDCallback): void {
    this.callback = callback;
  }

  /**
   * Start scanning for Remote ID BLE advertisements.
   */
  async startScanning(): Promise<boolean> {
    if (this.scanning) return true;

    const available = await this.isAvailable();
    if (!available) {
      console.warn('[BLEScanner] BLE not available');
      return false;
    }

    this.devices.clear();
    this.scanning = true;

    await this.adapter.startScan((device) => {
      this.handleDevice(device);
    });

    // Periodically remove stale devices (not seen for 30s)
    this.staleTimer = setInterval(() => {
      this.removeStaleDevices();
    }, 10000);

    return true;
  }

  /**
   * Stop scanning.
   */
  async stopScanning(): Promise<void> {
    if (!this.scanning) return;

    this.scanning = false;
    await this.adapter.stopScan();

    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }

  }

  /**
   * Get all currently tracked Remote ID devices.
   */
  getDevices(): Map<string, RemoteIDData> {
    return new Map(this.devices);
  }

  /**
   * Get device count.
   */
  get deviceCount(): number {
    return this.devices.size;
  }

  get isScanning(): boolean {
    return this.scanning;
  }

  dispose(): void {
    this.scanning = false;
    if (this.staleTimer) { clearInterval(this.staleTimer); this.staleTimer = null; }
    this.adapter.dispose();
    this.callback = null;
    this.devices.clear();
  }

  // ===== Internal =====

  private handleDevice(device: BLEAdapterDevice): void {
    const data = device.serviceData || device.manufacturerData;
    if (!data || data.length < 2) return;

    // Parse ODID messages
    const messages = RemoteIDParser.parseMessagePack(data);
    if (messages.length === 0) return;

    // Merge with existing device data
    const existing = this.devices.get(device.id) || {};
    const merged = RemoteIDParser.mergeMessages([existing, ...messages]);

    // Enrich with adapter-level info
    merged.rssi = device.rssi;
    merged.manufacturer = this.identifyManufacturer(device.id, device.name);
    merged.lastSeen = Date.now();

    this.devices.set(device.id, merged);
    this.callback?.(device.id, merged);
  }

  private identifyManufacturer(deviceId: string, name?: string): string | undefined {
    // Check OUI prefix
    for (const [prefix, manufacturer] of Object.entries(BLERemoteIDScanner.MANUFACTURER_OUI)) {
      if (deviceId.startsWith(prefix)) return manufacturer;
    }

    // Check device name for known patterns
    if (name) {
      if (name.includes('DJI')) return 'DJI';
      if (name.includes('Parrot')) return 'Parrot';
      if (name.includes('Autel')) return 'Autel Robotics';
      if (name.includes('Skydio')) return 'Skydio';
    }

    return undefined;
  }

  private removeStaleDevices(): void {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    // Collect IDs first to avoid mutating Map during iteration
    const staleIds: string[] = [];
    for (const [id, data] of this.devices) {
      if (data.lastSeen && now - data.lastSeen > staleThreshold) {
        staleIds.push(id);
      }
    }
    for (const id of staleIds) {
      this.devices.delete(id);
    }
  }
}
