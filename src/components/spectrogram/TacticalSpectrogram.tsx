/**
 * Spectrogram Component
 *
 * Real-time frequency spectrum visualization using Reanimated.
 * Displays mel spectrogram data as animated bars with intensity-level coloring.
 *
 * Future upgrade: Replace with Skia Canvas for true waterfall display.
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';

interface TacticalSpectrogramProps {
  spectralData: number[]; // 128 mel bins
  audioLevel: number;     // 0.0 - 1.0
  isActive: boolean;
  numBars?: number;       // Number of visible bars (downsampled from 128)
  height?: number;
}

const AnimatedBar: React.FC<{
  value: number;
  maxHeight: number;
  colorLow: string;
  colorMid: string;
  colorHigh: string;
  width: number;
}> = ({ value, maxHeight, colorLow, colorMid, colorHigh, width }) => {
  const animHeight = useSharedValue(2);

  useEffect(() => {
    animHeight.value = withSpring(Math.max(2, value * maxHeight), {
      damping: 15,
      stiffness: 150,
      mass: 0.5,
    });
  }, [value]);

  const barStyle = useAnimatedStyle(() => {
    const h = animHeight.value;
    const ratio = h / maxHeight;
    return {
      height: h,
      backgroundColor: ratio > 0.7 ? colorHigh : ratio > 0.4 ? colorMid : colorLow,
      opacity: 0.3 + ratio * 0.7,
    };
  });

  return <Animated.View style={[styles.bar, { width, borderRadius: width / 2 }, barStyle]} />;
};

export const TacticalSpectrogram: React.FC<TacticalSpectrogramProps> = ({
  spectralData,
  audioLevel,
  isActive,
  numBars = 32,
  height = 60,
}) => {
  const theme = useTheme();

  // Downsample 128 mel bins to numBars
  const barValues = useMemo(() => {
    if (!isActive || spectralData.length === 0) {
      return new Array(numBars).fill(0);
    }

    const binSize = Math.floor(spectralData.length / numBars);
    const values: number[] = [];

    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      const start = i * binSize;
      for (let j = start; j < start + binSize && j < spectralData.length; j++) {
        sum += Math.abs(spectralData[j]);
      }
      // Normalize and apply audio level scaling
      const avg = sum / binSize;
      values.push(Math.min(1, avg * (audioLevel + 0.3)));
    }

    return values;
  }, [spectralData, audioLevel, isActive, numBars]);

  const barWidth = Math.max(2, Math.floor((280 - numBars * 2) / numBars));

  return (
    <View style={[styles.container, { height, backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.barsContainer}>
        {barValues.map((value, i) => (
          <AnimatedBar
            key={i}
            value={value}
            maxHeight={height - 20}
            colorLow={theme.spectrogramLow}
            colorMid={theme.spectrogramMid}
            colorHigh={theme.spectrogramHigh}
            width={barWidth}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: theme.textMuted }]}>
        ACOUSTIC SPECTRUM ANALYSIS
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    paddingBottom: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flex: 1,
    gap: 2,
  },
  bar: {
    minHeight: 2,
  },
  label: {
    fontSize: 8,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 1,
    fontWeight: '600',
  },
});
