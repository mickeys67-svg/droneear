/**
 * Platform Utilities — v1.0
 *
 * Centralizes all iOS/Android platform branching logic.
 * Eliminates duplicated permission code across screens.
 *
 * Usage:
 *   import { isAndroid, isIOS, requestMicPermission } from '@/src/utils/platform';
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
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
      // Check if already granted (skip rationale if so)
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (alreadyGranted) return 'granted';

      // Google Play requirement: show pre-rationale BEFORE system dialog
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Microphone Access',
          'DroneEar analyzes sound patterns from your microphone to detect nearby drones. Audio is processed in real-time on your device and is never recorded or stored.',
          [{ text: 'Continue', onPress: () => resolve() }],
        );
      });

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'never_ask_again';
      return 'denied';
    } catch {
      return 'denied';
    }
  }

  // iOS — system handles rationale via NSMicrophoneUsageDescription
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'granted';
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
