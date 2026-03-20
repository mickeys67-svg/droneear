/**
 * Model loading overlay card with animated progress bar.
 */

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { GLASS, glassStyles, cyanGlow } from '@/src/constants/glass';

export function ModelLoadingCard() {
  const theme = useTheme();
  const t = useTranslation();

  const translateX = useSharedValue(-100);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(200, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.overlay}>
      <View style={[glassStyles.card, styles.card]}>
        <View style={[styles.pulse, cyanGlow(16)]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>
          {t.initializingEngine}
        </Text>
        <Text style={[styles.desc, { color: theme.textMuted }]}>
          {t.loadingAcousticModel || 'Loading acoustic analysis model...'}
        </Text>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { backgroundColor: theme.primary }, barStyle]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', marginBottom: 20 },
  card: { alignItems: 'center', width: '100%', paddingVertical: 32 },
  pulse: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: GLASS.borderActive, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  desc: { fontSize: 12, lineHeight: 18, marginBottom: 20 },
  barTrack: { width: '60%', height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { width: '40%', height: '100%', borderRadius: 1.5 },
});
