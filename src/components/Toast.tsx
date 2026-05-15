/**
 * Transient toast — short non-blocking banner at the top of the listen
 * screen. Replaces `Alert.alert()` popups for things the user just needs
 * to acknowledge (low battery, listening resumed). Auto-dismisses after
 * `until` timestamp passes; user can also tap to dismiss early.
 */

import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/src/hooks/useTheme';
import { useDetectionStore } from '@/src/stores/detectionStore';

export const Toast: React.FC = () => {
  const theme = useTheme();
  const toast = useDetectionStore((s) => s.transientToast);
  const dismissToast = useDetectionStore((s) => s.dismissToast);
  // Force a re-render once the timer expires so the visibility check below
  // re-evaluates and the banner disappears even when no other store update
  // triggers a render.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!toast) return;
    const remaining = Math.max(0, toast.until - Date.now());
    const id = setTimeout(() => tick((n) => n + 1), remaining + 50);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast || toast.until <= Date.now()) return null;

  const color =
    toast.tone === 'danger' ? theme.danger :
    toast.tone === 'warn' ? theme.warning :
    theme.primary;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(180)}
      style={[
        styles.container,
        { backgroundColor: `${color}1A`, borderColor: `${color}60` },
      ]}
    >
      <TouchableOpacity
        onPress={dismissToast}
        accessibilityRole="button"
        accessibilityLabel={toast.message}
        style={styles.tapArea}
      >
        <Text style={[styles.text, { color }]} numberOfLines={2}>
          {toast.message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tapArea: { minHeight: 32, justifyContent: 'center' },
  text: { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
});
