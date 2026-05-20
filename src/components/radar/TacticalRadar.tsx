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
  /** Phone GPS — required to place BLE drones at their true bearing/range. */
  userLocation?: { latitude: number; longitude: number } | null;
  maxRange?: number; // Max display range in meters
  // Device compass heading in degrees (0 = North, 90 = East). When provided
  // the radar rotates into "front-up" mode: the top of the radar always
  // points to the direction the phone is facing, and the N/E/S/W labels
  // spin to show where true compass directions actually are. Omit / pass
  // null to keep classic north-up mode.
  headingDegrees?: number | null;
}

const BEARING_LABELS = ['N', 'E', 'S', 'W'] as const;
const RANGE_RINGS = [0.25, 0.5, 0.75, 1.0]; // As fraction of radius

/** Great-circle bearing (degrees, 0=N) from point 1 to point 2. */
function haversineBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const φ1 = lat1 * toRad, φ2 = lat2 * toRad;
  const Δλ = (lon2 - lon1) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Great-circle distance in metres between two lat/lon points. */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const R = 6_371_000;
  const dφ = (lat2 - lat1) * toRad;
  const dλ = (lon2 - lon1) * toRad;
  const a = Math.sin(dφ / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const TacticalRadar: React.FC<TacticalRadarProps> = ({
  size = 280,
  isActive,
  threats,
  bleDevices = {},
  userLocation = null,
  maxRange = 2000,
  headingDegrees = null,
}) => {
  const theme = useTheme();
  const rotation = useSharedValue(0);
  const radius = size / 2;
  // Effective rotation applied to cardinal labels & threats so the radar
  // becomes front-up when a heading is supplied. We rotate by -heading so
  // that absolute bearings on screen become relative to the phone facing.
  const headingRot = headingDegrees != null ? -headingDegrees : 0;
  const toScreenRad = (bearingDeg: number) => ((bearingDeg + headingRot) * Math.PI) / 180;

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

  // Sweep is a thin line rooted at the radar centre that spins clockwise.
  // The Animated.View sits at the centre (left:radius-1, top:0, w:2, h:radius)
  // and rotates around its bottom edge — origin is the radar centre.
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Calculate signal positions on radar.
  // Only plot tracks that have a REAL position — i.e. BLE Remote ID or FUSED
  // detections, whose bearing/distance come from the drone's broadcast GPS.
  // Acoustic-only detections carry no position and must not be placed at a
  // fabricated angle (they would otherwise pile up at the radar centre).
  const threatDots = useMemo(() => {
    return threats
      .filter((t) => {
        if (!t.isActive || t.detections.length === 0) return false;
        const src = t.detections[t.detections.length - 1].source;
        return src === 'BLE_REMOTE_ID' || src === 'FUSED';
      })
      .map((track) => {
        const latest = track.detections[track.detections.length - 1];
        const dist = Math.min(latest.distanceMeters / maxRange, 1.0);
        const radians = toScreenRad(latest.bearingDegrees);
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
  }, [threats, radius, maxRange, headingRot]);

  // Calculate BLE Remote ID device positions on radar (square dots).
  // Bearing/range are the REAL great-circle values from the phone GPS to the
  // drone's broadcast GPS. (Previous code used the drone's own heading as the
  // bearing — which is the direction the drone is flying, not its direction
  // from the observer — and RSSI as a fake distance proxy.)
  const bleDots = useMemo(() => {
    if (!userLocation || !Number.isFinite(userLocation.latitude) || !Number.isFinite(userLocation.longitude)) {
      return [];
    }
    return Object.entries(bleDevices)
      .filter(([, data]) =>
        data.uavLatitude != null && data.uavLongitude != null &&
        Number.isFinite(data.uavLatitude) && Number.isFinite(data.uavLongitude))
      .map(([id, data]) => {
        const bearing = haversineBearing(
          userLocation.latitude, userLocation.longitude,
          data.uavLatitude as number, data.uavLongitude as number,
        );
        const distM = haversineDistance(
          userLocation.latitude, userLocation.longitude,
          data.uavLatitude as number, data.uavLongitude as number,
        );
        const dist = Math.min(distM / maxRange, 1.0);
        const radians = toScreenRad(bearing);
        const x = dist * radius * 0.85 * Math.sin(radians);
        const y = -dist * radius * 0.85 * Math.cos(radians);

        return { id, x: radius + x, y: radius + y };
      });
  }, [bleDevices, userLocation, radius, maxRange, headingRot]);

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

      {/* Bearing labels — positioned just inside the outer ring at each
          cardinal's true compass angle. When headingDegrees is provided the
          cardinals rotate around the radar so that the top of the display
          shows the direction the phone is facing (front-up compass). */}
      {BEARING_LABELS.map((label, i) => {
        const baseAngle = i * 90; // N=0, E=90, S=180, W=270
        const radians = toScreenRad(baseAngle);
        const labelRadius = radius - 10;
        const cx = radius + labelRadius * Math.sin(radians) - 5;
        const cy = radius - labelRadius * Math.cos(radians) - 7;
        return (
          <Text
            key={label}
            style={[styles.bearingLabel, { color: theme.radarGrid, left: cx, top: cy }]}
          >
            {label}
          </Text>
        );
      })}

      {/* Range labels — placed just inside each ring along the N axis so the
          rings (500/1000/1500/2000m) are visually distinguishable. Previous
          formula divided the radius by 2, which stacked all four labels in
          a 15px column near the centre and looked broken. */}
      {RANGE_RINGS.map((ring) => {
        const ringRadius = (size * ring) / 2;
        return (
          <Text
            key={`range-${ring}`}
            style={[
              styles.rangeLabel,
              {
                color: theme.textMuted,
                top: radius - ringRadius + 2,
                left: radius + 4,
              },
            ]}
          >
            {Math.round(maxRange * ring)}m
          </Text>
        );
      })}

      {/* Sweep line — thin radial line, not a 90° sector */}
      {isActive && (
        <Animated.View
          style={[
            styles.sweep,
            sweepStyle,
            {
              left: radius - 1,
              top: 0,
              width: 2,
              height: radius,
              backgroundColor: theme.radarSweep,
            },
          ]}
        />
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
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.85,
    fontVariant: ['tabular-nums'],
    // Small shadow so the label stays readable against the cyan signal sweep
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  } as any,
  // Sweep — a thin radial line that rotates around the centre.
  // Was previously a 90° pie-slice (borderTopLeftRadius:1000 on a radius-square)
  // which users mistook for "detected sector" even when 0 tracks were present.
  sweep: {
    position: 'absolute',
    transformOrigin: '50% 100%' as any,
    opacity: 0.7,
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
