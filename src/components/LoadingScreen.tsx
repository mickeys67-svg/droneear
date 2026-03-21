/**
 * LoadingScreen — DroneEar glassmorphism splash/loading screen
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { GLASS, primaryGlow } from '@/src/constants/glass';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import Constants from 'expo-constants';

interface LoadingScreenProps {
  message?: string;
  progress?: number;     // 0.0 - 1.0
  version?: string;
}

function LoadingScreen({
  message,
  progress,
  version = Constants.expoConfig?.version ? `v${Constants.expoConfig.version}` : 'v2.1.0',
}: LoadingScreenProps) {
  const theme = useTheme();
  const t = useTranslation();
  const displayMessage = message || t.loadingDefault || 'Loading...';
  const { width: screenWidth } = useWindowDimensions();
  const progressBarWidth = screenWidth * 0.6;
  // Pulse animation
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.4, 1]);
    const opacity = interpolate(pulse.value, [0, 1], [0.6, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // Progress bar animation
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    if (progress !== undefined) {
      progressAnim.value = withTiming(progress, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
      // Indeterminate: animate back and forth
      progressAnim.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    }
  }, [progress]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: progressAnim.value * progressBarWidth,
  }));

  return (
    <View style={styles.container}>
      {/* Center icon area */}
      <View style={styles.centerArea}>
        {/* Neumorphic circle */}
        <View style={[styles.circle, { borderColor: `${theme.primary}66` }, primaryGlow(theme.primary, 20)]}>
          {/* Pulse ring */}
          <Animated.View style={[styles.pulseRing, { borderColor: theme.primary }, pulseStyle]} />
          {/* Static inner dot */}
          <View style={[styles.innerDot, { backgroundColor: theme.primary }]} />
        </View>

        {/* Brand name */}
        <View style={styles.brandRow}>
          <Text style={styles.brandWhite}>Drone</Text>
          <Text style={[styles.brandCyan, { color: theme.primary }]}>Ear</Text>
        </View>

        {/* Loading message */}
        <Text style={styles.message}>{displayMessage}</Text>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { width: progressBarWidth }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: theme.primary }, progressBarStyle]} />
        </View>
      </View>

      {/* Version at bottom */}
      <Text style={styles.version}>{version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerArea: {
    alignItems: 'center',
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: GLASS.cardBg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  innerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  brandRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  brandWhite: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandCyan: {
    fontSize: 28,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 24,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.2)',
    letterSpacing: 0.5,
  },
});

export default LoadingScreen;
