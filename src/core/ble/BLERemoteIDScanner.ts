/**
 * BLE Remote ID Scanner — v1.0
 *
 * Scans for ASTM F3411 Open Drone ID BLE advertisements.
 * Uses an adapter pattern: currently ships with a mock adapter for
 * development/Expo Go. Replace with a real BLE adapter (react-native-ble-plx)
 * when building a production native binary.
 *
 * Architecture:
 *   BLERemoteIDScanner (public API)
 *     └─ BLEAdapter (interface)
 *          ├─ MockBLEAdapter (dev/testing — simulates Remote ID beacons)
 *          └─ (future) RealBLEAdapter (react-native-ble-plx wrapper)
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

// ===== Mock BLE Adapter (for dev/Expo Go) =====

export class MockBLEAdapter implements BLEAdapter {
  private timer: ReturnType<typeof setInterval> | null = null;
  private counter = 0;

  async isAvailable(): Promise<boolean> {
    return true; // Always available in mock
  }

  async startScan(onDevice: (device: BLEAdapterDevice) => void): Promise<void> {
    this.counter = 0;

    // Simulate periodic Remote ID beacon discovery
    this.timer = setInterval(() => {
      this.counter++;

      // Simulate 1-3 drones appearing over time
      if (this.counter % 8 === 0) {
        onDevice(this.generateMockDevice('MOCK-DJI-001', 'DJI-Mavic3-RID', -65));
      }
      if (this.counter % 12 === 0) {
        onDevice(this.generateMockDevice('MOCK-AUTEL-002', 'Autel-EVO2-RID', -78));
      }
      if (this.counter % 20 === 0) {
        onDevice(this.generateMockDevice('MOCK-SKYDIO-003', 'Skydio-X10-RID', -85));
      }
    }, 2000);
  }

  async stopScan(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stopScan();
  }

  private generateMockDevice(id: string, name: string, baseRssi: number): BLEAdapterDevice {
    // Build a mock ODID Basic ID message
    const basicId = new Uint8Array(25);
    basicId[0] = 0x01; // msg type 0x0, id type 0x1 (serial)
    basicId[1] = 2;    // UA type: Helicopter/Multirotor

    // Write serial number
    const serial = id;
    for (let i = 0; i < serial.length && i < 20; i++) {
      basicId[2 + i] = serial.charCodeAt(i);
    }

    // Build a mock ODID Location message
    const location = new Uint8Array(25);
    location[0] = 0x10; // msg type 0x1
    location[2] = 90;   // heading = 180°

    // Speed: ~15 m/s
    location[3] = 60;   // 60 * 0.25 = 15 m/s

    // Lat/Lon: Seoul area (37.5665°N, 126.9780°E) with random offset
    const baseLat = 37.5665 + (Math.random() - 0.5) * 0.01;
    const baseLon = 126.978 + (Math.random() - 0.5) * 0.01;
    this.writeInt32LE(location, 5, Math.round(baseLat * 1e7));
    this.writeInt32LE(location, 9, Math.round(baseLon * 1e7));

    // Altitude: ~120m
    const altRaw = Math.round((120 + 1000) / 0.5);
    location[13] = altRaw & 0xFF;
    location[14] = (altRaw >> 8) & 0xFF;

    // Combine into message pack
    const pack = new Uint8Array(2 + 50);
    pack[0] = 0xF0; // Message pack header
    pack[1] = 2;     // 2 messages
    pack.set(basicId, 2);
    pack.set(location, 27);

    return {
      id,
      name,
      rssi: baseRssi + Math.round((Math.random() - 0.5) * 6),
      serviceData: pack,
    };
  }

  private writeInt32LE(arr: Uint8Array, offset: number, value: number): void {
    arr[offset] = value & 0xFF;
    arr[offset + 1] = (value >> 8) & 0xFF;
    arr[offset + 2] = (value >> 16) & 0xFF;
    arr[offset + 3] = (value >> 24) & 0xFF;
  }
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
    'MOCK-DJI': 'DJI',
    'MOCK-AUTEL': 'Autel Robotics',
    'MOCK-SKYDIO': 'Skydio',
    '60:60:1F': 'DJI',
    '90:3A:E6': 'Parrot',
    'A0:14:3D': 'Parrot',
  };

  constructor(adapter?: BLEAdapter) {
    this.adapter = adapter || new MockBLEAdapter();
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

    console.log('[BLEScanner] Starting Remote ID scan...');

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

    console.log('[BLEScanner] Scan stopped');
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
