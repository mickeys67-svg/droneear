/**
 * BLE Adapter Factory
 *
 * Automatically selects the appropriate BLE adapter:
 * - Expo Go / dev client without native modules → MockBLEAdapter
 * - Native build with react-native-ble-plx → RealBLEAdapter
 */

import Constants from 'expo-constants';
import type { BLEAdapter } from './BLERemoteIDScanner';
import { MockBLEAdapter } from './BLERemoteIDScanner';

/**
 * Detect if running in Expo Go (no native modules available).
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Create the appropriate BLE adapter for the current runtime.
 */
export function createBLEAdapter(): BLEAdapter {
  if (isExpoGo()) {
    console.log('[BLE] Expo Go detected — using MockBLEAdapter');
    return new MockBLEAdapter();
  }

  try {
    // Dynamic require to avoid crash when native module isn't linked
    const { RealBLEAdapter } = require('./RealBLEAdapter');
    console.log('[BLE] Native build — using RealBLEAdapter');
    return new RealBLEAdapter();
  } catch (e) {
    console.warn('[BLE] RealBLEAdapter unavailable, falling back to MockBLEAdapter:', e);
    return new MockBLEAdapter();
  }
}
