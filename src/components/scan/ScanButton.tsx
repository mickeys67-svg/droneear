/**
 * Main scan control button with glow + scale micro-interaction.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { cyanGlow, dangerGlow } from '@/src/constants/glass';

interface ScanButtonProps {
  isScanning: boolean;
  isLoading: boolean;
  isError: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function ScanButton({ isScanning, isLoading, isError, disabled, onToggle }: ScanButtonProps) {
  const theme = useTheme();
  const t = useTranslation();

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
  }, []);
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: isScanning ? theme.danger : theme.primary,
              opacity: (isLoading || disabled) ? 0.5 : 1,
            },
            isScanning ? dangerGlow(15) : cyanGlow(15),
          ]}
          onPress={onToggle}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          disabled={isLoading || disabled}
          accessibilityLabel={isScanning ? t.haltDetection : t.engageSensors}
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.mode === 'NIGHT' ? '#FFF' : '#000'} />
          ) : (
            <Text style={[styles.text, theme.mode === 'NIGHT' && { color: '#FFF' }]}>
              {isScanning ? t.haltDetection : t.engageSensors}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {!isScanning && !isError && (
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {t.tapToBegin}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, marginBottom: 20 },
  button: { height: 64, borderRadius: 14, justifyContent: 'center', alignItems: 'center', minHeight: 64 },
  text: { fontSize: 20, fontWeight: '900', letterSpacing: 3, color: '#000' },
  hint: { fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 },
});
