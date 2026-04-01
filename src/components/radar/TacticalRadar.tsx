/**
 * Direction Indicator Component
 *
 * GPU-accelerated radar display showing real-time signal positions.
 * Uses React Native Reanimated for smooth 60fps animations.
 *
 * Future upgrade: Replace with @shopify/react-native-skia for
 * true GPU rendering with custom shaders.
 *
 * Features:
 * - Rotating sweep line
 * - Multiple signal dots with pulsing animation
 * - Bearing/distance grid overlay
 * - Signal trajectory trails
 * - Night vision compatible theming
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import type { ThreatTrack, ThreatSeverity, RemoteIDData } from '../../types';

interface TacticalRadarProps {
  size?: number;
  isActive: boolean;
  threats: ThreatTrack[];
  bleDevices?: Record<string, RemoteIDData>;
  maxRange?: number; // Max display range in meters
}

const BEARING_LABELS = ['N', 'E', 'S', 'W'] as const;
const RANGE_RINGS = [0.25, 0.5, 0.75, 1.0]; // As fraction of radius

export const TacticalRadar: React.FC<TacticalRadarProps> = ({
  size = 280,
  isActive,
  threats,
  bleDevices = {},
  maxRange = 2000,
}) => {
  const theme = useTheme();
  const rotation = useSharedValue(0);
  const radius = size / 2;

  useEffect(() => {
    if (isActive) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [isActive, rotation]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: radius / 2 },
      { translateY: radius / 2 },
      { rotate: `${rotation.value}deg` },
      { translateX: -radius / 2 },
      { translateY: -radius / 2 },
    ],
  }));

  // Calculate signal positions on radar
  const threatDots = useMemo(() => {
    return threats
      .filter((t) => t.isActive && t.detections.length > 0)
      .map((track) => {
        const latest = track.detections[track.detections.length - 1];
        const dist = Math.min(latest.distanceMeters / maxRange, 1.0);
        const radians = (latest.bearingDegrees * Math.PI) / 180;
        const x = dist * radius * 0.85 * Math.sin(radians);
        const y = -dist * radius * 0.85 * Math.cos(radians);

        return {
          id: track.id,
          x: radius + x,
          y: radius + y,
          severity: latest.severity,
          category: latest.threatCategory,
          distance: latest.distanceMeters,
          eta: track.predictedETA,
        };
      });
  }, [threats, radius, maxRange]);

  // Calculate BLE device positions on radar (square dots)
  const bleDots = useMemo(() => {
    return Object.entries(bleDevices)
      .filter(([, data]) => data.uavLatitude != null && data.uavLongitude != null && data.heading != null)
      .map(([id, data]) => {
        // Use heading for bearing, RSSI for approximate distance
        const bearing = data.heading ?? 0;
        const rssi = data.rssi ?? -70;
        // Map RSSI (-30 to -100) to distance fraction (0.1 to 0.9)
        const dist = Math.min(Math.max((-rssi - 30) / 70, 0.1), 0.9);
        const radians = (bearing * Math.PI) / 180;
        const x = dist * radius * 0.85 * Math.sin(radians);
        const y = -dist * radius * 0.85 * Math.cos(radians);

        return { id, x: radius + x, y: radius + y };
      });
  }, [bleDevices, radius]);

  const getSeverityColor = (severity: ThreatSeverity): string => {
    switch (severity) {
      case 'CRITICAL': return theme.danger;
      case 'HIGH': return theme.warning;
      case 'MEDIUM': return theme.secondary;
      default: return theme.primary;
    }
  };

  return (
    <View
      style={[styles.container, { width: size, height: size, borderColor: theme.border }]}
      accessibilityLabel={`Radar display, ${isActive ? 'scanning' : 'inactive'}, ${threats.filter(t => t.isActive).length} active signals`}
      accessibilityRole="image"
    >
      {/* Background */}
      <View style={[styles.background, { backgroundColor: theme.background }]} />

      {/* Range rings */}
      {RANGE_RINGS.map((ring) => (
        <View
          key={ring}
          style={[
            styles.rangeRing,
            {
              width: size * ring,
              height: size * ring,
              borderColor: theme.radarGrid,
              borderRadius: (size * ring) / 2,
            },
          ]}
        />
      ))}

      {/* Crosshair */}
      <View style={[styles.axisV, { backgroundColor: theme.radarGrid }]} />
      <View style={[styles.axisH, { backgroundColor: theme.radarGrid }]} />

      {/* Bearing labels */}
      {BEARING_LABELS.map((label, i) => {
        const positions = [
          { top: 4, left: radius - 5 },
          { top: radius - 7, right: 4 },
          { bottom: 4, left: radius - 5 },
          { top: radius - 7, left: 4 },
        ];
        return (
          <Text
            key={label}
            style={[styles.bearingLabel, { color: theme.radarGrid }, positions[i]]}
          >
            {label}
          </Text>
        );
      })}

      {/* Range labels */}
      {RANGE_RINGS.map((ring) => (
        <Text
          key={`range-${ring}`}
          style={[
            styles.rangeLabel,
            {
              color: theme.textMuted,
              bottom: radius + (radius * ring * 0.85) / 2 - 6,
              left: radius + 4,
            },
          ]}
        >
          {Math.round(maxRange * ring)}m
        </Text>
      ))}

      {/* Sweep line */}
      {isActive && (
        <Animated.View
          style={[
            styles.sweep,
            sweepStyle,
            { width: radius, height: radius },
          ]}
        >
          <View style={[styles.sweepGlow, { backgroundColor: theme.radarSweep }]} />
        </Animated.View>
      )}

      {/* Signal dots */}
      {threatDots.map((dot) => (
        <React.Fragment key={dot.id}>
          <Animated.View
            style={[
              styles.threatDot,
              {
                left: dot.x - 6,
                top: dot.y - 6,
                backgroundColor: getSeverityColor(dot.severity),
                shadowColor: getSeverityColor(dot.severity),
              },
            ]}
          />
          {dot.eta != null && dot.eta > 0 && (
            <Text
              style={[
                styles.etaLabel,
                {
                  left: dot.x + 8,
                  top: dot.y - 6,
                  color: getSeverityColor(dot.severity),
                },
              ]}
            >
              {dot.eta < 60 ? `${Math.round(dot.eta)}s` : `${Math.round(dot.eta / 60)}m`}
            </Text>
          )}
        </React.Fragment>
      ))}

      {/* BLE Remote ID dots (square) */}
      {bleDots.map((dot) => (
        <View
          key={`ble-${dot.id}`}
          style={[
            styles.bleDot,
            {
              left: dot.x - 5,
              top: dot.y - 5,
              backgroundColor: theme.secondary,
              borderColor: theme.primary,
            },
          ]}
        />
      ))}

      {/* Center dot */}
      <View style={[styles.centerDot, { backgroundColor: theme.primary }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 1000,
    borderWidth: 1,
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 1000,
  },
  rangeRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  axisV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    opacity: 0.5,
  },
  axisH: {
    position: 'absolute',
    height: 1,
    width: '100%',
    opacity: 0.5,
  },
  bearingLabel: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  rangeLabel: {
    position: 'absolute',
    fontSize: 11,
    opacity: 0.5,
  },
  sweep: {
    position: 'absolute',
    bottom: '50%',
    right: '50%',
  },
  sweepGlow: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 1000,
  },
  threatDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  etaLabel: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bleDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    elevation: 4,
  },
  centerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.8,
  },
});
