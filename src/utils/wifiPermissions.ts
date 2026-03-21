/**
 * WiFi Permissions Utility
 *
 * Handles Android 13+ runtime NEARBY_WIFI_DEVICES permission.
 * Required for WiFi Remote ID scanning (WiFi Beacon + WiFi NAN).
 *
 * On iOS: returns false (WiFi scanning not supported).
 * On Android < 13: returns true (no runtime permission needed).
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';

/**
 * Request WiFi scanning permissions on Android 13+ (API 33).
 * Returns true if WiFi scanning is permitted.
 */
export async function requestWiFiPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false; // iOS: WiFi scanning not supported

  // Android 13+ (API 33) requires NEARBY_WIFI_DEVICES
  if (Platform.Version >= 33) {
    try {
      // Check if already granted
      const alreadyGranted = await PermissionsAndroid.check(
        'android.permission.NEARBY_WIFI_DEVICES' as any
      );
      if (alreadyGranted) return true;

      // Google Play requirement: show pre-rationale BEFORE system dialog
      await new Promise<void>((resolve) => {
        Alert.alert(
          'WiFi Scanning',
          'DroneEar uses WiFi to detect drones broadcasting Remote ID via WiFi Beacon and WiFi NAN. This extends detection range beyond Bluetooth. WiFi data stays on your device.',
          [{ text: 'Continue', onPress: () => resolve() }],
        );
      });

      const result = await PermissionsAndroid.request(
        'android.permission.NEARBY_WIFI_DEVICES' as any,
      );
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      if (!granted) {
        console.warn('[WiFi] NEARBY_WIFI_DEVICES permission denied:', result);
      }
      return granted;
    } catch (err) {
      console.error('[WiFi] Permission request failed:', err);
      return false;
    }
  }

  // Android < 13: WiFi permissions handled via manifest
  return true;
}

/**
 * Check WiFi scanning permission status without prompting.
 */
export async function checkWiFiPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  if (Platform.Version >= 33) {
    try {
      return await PermissionsAndroid.check(
        'android.permission.NEARBY_WIFI_DEVICES' as any
      );
    } catch {
      return false;
    }
  }

  return true; // Android < 13: no runtime check needed
}
