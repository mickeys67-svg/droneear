/**
 * BLE Adapter Factory
 *
 * Automatically selects the appropriate BLE adapter:
 * - Native build with react-native-ble-plx → RealBLEAdapter
 * - Fallback → NullBLEAdapter (BLE disabled, no fake data)
 */

import Constants from 'expo-constants';
import type { BLEAdapter, BLEAdapterDevice } from './BLERemoteIDScanner';

/**
 * Null BLE Adapter — BLE unavailable, does nothing.
 * Used when native BLE module is not available.
 */
class NullBLEAdapter implements BLEAdapter {
  async isAvailable(): Promise<boolean> { return false; }
  async startScan(_onDevice: (device: BLEAdapterDevice) => void): Promise<void> {}
  async stopScan(): Promise<void> {}
  dispose(): void {}
}

/**
 * Create the appropriate BLE adapter for the current runtime.
 */
export function createBLEAdapter(): BLEAdapter {
  // Expo Go has no native modules — BLE unavailable
  if (Constants.appOwnership === 'expo') {
    return new NullBLEAdapter();
  }

  try {
    const { RealBLEAdapter } = require('./RealBLEAdapter');
    return new RealBLEAdapter();
  } catch {
    // Native module unavailable — disable BLE instead of faking it
    console.warn('[BLE] Native module unavailable — BLE scanning disabled');
    return new NullBLEAdapter();
  }
}
