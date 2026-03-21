/**
 * Platform Utilities — v1.0
 *
 * Centralizes all iOS/Android platform branching logic.
 * Eliminates duplicated permission code across screens.
 *
 * Usage:
 *   import { isAndroid, isIOS, requestMicPermission } from '@/src/utils/platform';
 */

import { Platform, PermissionsAndroid } from 'react-native';
import { Audio } from 'expo-av';

// ===== Platform Constants =====

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';

/** Android API version (0 on iOS) */
export const androidApiLevel = isAndroid ? (Platform.Version as number) : 0;

// ===== Microphone Permission =====

export type MicPermissionResult = 'granted' | 'denied' | 'never_ask_again';

/**
 * Request microphone permission.
 * Handles Android (PermissionsAndroid) and iOS (expo-av) differences.
 */
export async function requestMicPermission(): Promise<MicPermissionResult> {
  if (isAndroid) {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Access',
          message: 'DroneEar needs microphone access to analyze acoustic patterns.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'never_ask_again';
      return 'denied';
    } catch {
      return 'denied';
    }
  }

  // iOS
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'granted'; // iOS fallback — assume granted if API fails
  }
}

/**
 * Check microphone permission status without prompting.
 */
export async function checkMicPermission(): Promise<boolean> {
  if (isAndroid) {
    try {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
    } catch {
      return false;
    }
  }

  // iOS
  try {
    const { status } = await Audio.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ===== WiFi Remote ID Capability =====

/** WiFi Remote ID scanning is only available on Android */
export const supportsWiFiRemoteID = isAndroid;

/** BLE Remote ID scanning is available on both platforms (native builds only) */
export const supportsBLERemoteID = true;

// ===== UI Platform Helpers =====

/** Whether to use BlurView for tab bar background (iOS only) */
export const useTabBarBlur = isIOS;

/** Whether layout animation needs manual enablement */
export const needsLayoutAnimationSetup = isAndroid && androidApiLevel >= 23;
