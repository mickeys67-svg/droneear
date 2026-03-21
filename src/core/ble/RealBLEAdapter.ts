/**
 * Real BLE Adapter — react-native-ble-plx implementation
 *
 * Implements BLEAdapter interface using react-native-ble-plx.
 * Scans for ASTM F3411 Open Drone ID BLE advertisements
 * on the ODID service UUID (0000FFFA-...).
 *
 * Only usable in native builds (not Expo Go).
 */

import { BleManager, Device, State } from 'react-native-ble-plx';
import { ODID_SERVICE_UUID } from './RemoteIDParser';
import type { BLEAdapter, BLEAdapterDevice } from './BLERemoteIDScanner';

/**
 * Decode base64 string to Uint8Array.
 * react-native-ble-plx returns service/manufacturer data as base64.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Remove padding
  let len = base64.length;
  if (base64[len - 1] === '=') len--;
  if (base64[len - 1] === '=') len--;

  const byteLength = (len * 3) >> 2;
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[base64.charCodeAt(i)];
    const b = lookup[base64.charCodeAt(i + 1)];
    const c = lookup[base64.charCodeAt(i + 2)];
    const d = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (a << 2) | (b >> 4);
    if (p < byteLength) bytes[p++] = ((b & 0xF) << 4) | (c >> 2);
    if (p < byteLength) bytes[p++] = ((c & 0x3) << 6) | d;
  }

  return bytes;
}

export class RealBLEAdapter implements BLEAdapter {
  private manager: BleManager;
  private scanning = false;

  constructor() {
    this.manager = new BleManager();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const state = await this.manager.state();
      if (state === State.PoweredOn) return true;

      // Wait briefly for BLE to power on
      return new Promise<boolean>((resolve) => {
        const sub = this.manager.onStateChange((newState) => {
          if (newState === State.PoweredOn) {
            sub.remove();
            resolve(true);
          }
        }, true);

        // Timeout after 5 seconds
        setTimeout(() => {
          sub.remove();
          resolve(false);
        }, 5000);
      });
    } catch {
      return false;
    }
  }

  async startScan(onDevice: (device: BLEAdapterDevice) => void): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;

    // Scan for ODID service UUID
    this.manager.startDeviceScan(
      [ODID_SERVICE_UUID],
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          console.warn('[RealBLEAdapter] Scan error:', error.message);
          return;
        }
        if (!device) return;

        const adapted = this.adaptDevice(device);
        if (adapted) {
          onDevice(adapted);
        }
      },
    );
  }

  async stopScan(): Promise<void> {
    if (!this.scanning) return;
    this.scanning = false;
    this.manager.stopDeviceScan();
  }

  dispose(): void {
    this.scanning = false;
    this.manager.stopDeviceScan();
    this.manager.destroy();
  }

  /**
   * Convert react-native-ble-plx Device to BLEAdapterDevice.
   * Extracts ODID service data or manufacturer data.
   */
  private adaptDevice(device: Device): BLEAdapterDevice | null {
    let serviceData: Uint8Array | undefined;
    let manufacturerData: Uint8Array | undefined;

    // Try service data for ODID UUID first
    if (device.serviceData) {
      const odidData = device.serviceData[ODID_SERVICE_UUID];
      if (odidData) {
        serviceData = base64ToUint8Array(odidData);
      }
    }

    // Fall back to manufacturer data
    if (!serviceData && device.manufacturerData) {
      manufacturerData = base64ToUint8Array(device.manufacturerData);
    }

    // Need at least some data to be useful
    if (!serviceData && !manufacturerData) return null;

    return {
      id: device.id,
      name: device.name ?? undefined,
      rssi: device.rssi ?? -100,
      serviceData,
      manufacturerData,
    };
  }
}

export { base64ToUint8Array };
