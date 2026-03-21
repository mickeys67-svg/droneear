/**
 * WiFi Remote ID Scanner — v1.0
 *
 * Scans for ASTM F3411 Open Drone ID over WiFi (Beacon + NAN).
 * Android only — iOS automatically disabled via NullWiFiAdapter.
 *
 * Mirrors BLERemoteIDScanner architecture:
 * - Same RemoteIDData output format
 * - Same lifecycle (start/stop/dispose)
 * - Same stale device cleanup (30s)
 * - Same RemoteIDParser for ASTM F3411 message decoding
 *
 * WiFi advantages over BLE:
 * - Longer range (~1km vs ~300m for BLE)
 * - DJI & Skydio primarily use WiFi Beacon for Remote ID
 * - WiFi NAN provides peer-to-peer discovery
 */

import { RemoteIDParser } from '../ble/RemoteIDParser';
import { createWiFiAdapter, type WiFiAdapter, type WiFiAdapterDevice } from './WiFiNativeModule';
import type { RemoteIDData } from '../../types';

export type WiFiRemoteIDCallback = (deviceId: string, data: RemoteIDData) => void;

export class WiFiRemoteIDScanner {
  private adapter: WiFiAdapter;
  private callback: WiFiRemoteIDCallback | null = null;
  private devices: Map<string, RemoteIDData> = new Map();
  private scanning = false;
  private staleTimer: ReturnType<typeof setInterval> | null = null;

  // WiFi-specific manufacturer detection
  private static readonly WIFI_SSID_PATTERNS: Record<string, string> = {
    'DJI': 'DJI',
    'SKYDIO': 'Skydio',
    'AUTEL': 'Autel Robotics',
    'PARROT': 'Parrot',
  };

  constructor(adapter?: WiFiAdapter) {
    this.adapter = adapter || createWiFiAdapter();
  }

  // ===== Public API =====

  async isAvailable(): Promise<boolean> {
    try {
      return await this.adapter.isAvailable();
    } catch {
      return false;
    }
  }

  async startScanning(): Promise<boolean> {
    if (this.scanning) return true;

    const available = await this.isAvailable();
    if (!available) return false;

    this.devices.clear();
    this.scanning = true;

    try {
      await this.adapter.startScan((device) => this.handleDevice(device));
    } catch (e) {
      console.warn('[WiFiScanner] Failed to start:', e);
      this.scanning = false;
      return false;
    }

    // Stale device cleanup every 10s
    this.staleTimer = setInterval(() => this.removeStaleDevices(), 10000);

    return true;
  }

  async stopScanning(): Promise<void> {
    this.scanning = false;

    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }

    try {
      await this.adapter.stopScan();
    } catch {
      // Ignore stop errors
    }
  }

  onRemoteID(callback: WiFiRemoteIDCallback): void {
    this.callback = callback;
  }

  getDevices(): Map<string, RemoteIDData> {
    return new Map(this.devices);
  }

  dispose(): void {
    this.stopScanning().catch(() => {});
    this.adapter.dispose();
    this.devices.clear();
    this.callback = null;
  }

  // ===== Internal =====

  private handleDevice(device: WiFiAdapterDevice): void {
    if (!device.serviceData || device.serviceData.length < 25) return;

    try {
      // Parse ASTM F3411 messages (same format as BLE)
      const messages = RemoteIDParser.parseMessagePack(device.serviceData);
      if (messages.length === 0) return;

      // Merge with existing data for this device
      const existing = this.devices.get(device.id) || {};
      const merged = RemoteIDParser.mergeMessages([existing, ...messages]);

      // Enrich with WiFi-specific metadata
      const enriched: RemoteIDData = {
        ...merged,
        rssi: device.rssi,
        lastSeen: Date.now(),
        manufacturer: merged.manufacturer || this.identifyManufacturer(device),
      };

      // Use 'wifi_' prefix to distinguish from BLE devices
      const deviceId = `wifi_${device.id}`;
      this.devices.set(deviceId, enriched);
      this.callback?.(deviceId, enriched);
    } catch {
      // Skip unparseable frames
    }
  }

  private identifyManufacturer(device: WiFiAdapterDevice): string | undefined {
    // Check SSID for manufacturer patterns
    if (device.ssid) {
      const upperSSID = device.ssid.toUpperCase();
      for (const [pattern, name] of Object.entries(WiFiRemoteIDScanner.WIFI_SSID_PATTERNS)) {
        if (upperSSID.includes(pattern)) return name;
      }
    }
    return undefined;
  }

  private removeStaleDevices(): void {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    for (const [id, data] of this.devices) {
      if (data.lastSeen && now - data.lastSeen > staleThreshold) {
        this.devices.delete(id);
      }
    }
  }
}
