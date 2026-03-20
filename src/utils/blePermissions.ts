/**
 * BLE Permissions Utility
 *
 * Handles Android 12+ runtime BLE permissions (BLUETOOTH_SCAN, BLUETOOTH_CONNECT).
 * iOS permissions are handled via Info.plist.
 */

import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Request BLE scanning permissions on Android 12+ (API 31+).
 * Returns true if all required BLE permissions are granted.
 *
 * On iOS or Android < 12, returns true (no runtime permission needed).
 */
export async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Android 12+ (API 31) requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
  if (Platform.Version >= 31) {
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
      const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

      if (!scanGranted || !connectGranted) {
        console.warn('[BLE] Permissions not fully granted:', results);
      }

      return scanGranted && connectGranted;
    } catch (err) {
      console.error('[BLE] Permission request failed:', err);
      return false;
    }
  }

  // Android < 12: BLE permissions handled via manifest
  return true;
}
