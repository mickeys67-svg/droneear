/**
 * TrackingOverlay — Floating glass panel for real-time drone tracking
 *
 * Appears at the top of the scan screen when a user taps "TRACK" on a
 * detected drone. Shows distance, bearing, and confidence in glass sub-cards
 * with a pulsing cyan bar to indicate active tracking.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GLASS, glassStyles, primaryGlow } from '@/src/constants/glass';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';

// ===== Types =====

export interface TrackingOverlayProps {
  trackId: string;
  droneName: string;
  category: string;
  distance: number;      // meters
  bearing: number;       // degrees 0-360
  confidence: number;    // 0-1
  onClose: () => void;
}

// ===== Helpers =====

/** Convert bearing degrees to compass direction label */
function bearingToCompass(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return directions[index];
}

/** Confidence value to color */
function confidenceColor(c: number): string {
  if (c >= 0.7) return GLASS.glowCyan;
  if (c >= 0.4) return GLASS.glowWarning;
  return GLASS.glowRed;
}

// ===== Component =====

export function TrackingOverlay({
  trackId,
  droneName,
  category,
  distance,
  bearing,
  confidence,
  onClose,
}: TrackingOverlayProps) {
  const theme = useTheme();
  const t = useTranslation();

  // Pulse animation for the tracking bar
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, []);

  const pulseBarStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.value * 0.6,
    transform: [{ scaleX: 0.6 + pulse.value * 0.4 }],
  }));

  const safeDistance = isFinite(distance) ? distance : 0;
  const safeBearing = isFinite(bearing) ? bearing : 0;
  const safeConfidence = isFinite(confidence) ? confidence : 0;
  const confPercent = Math.round(safeConfidence * 100);
  const confColor = confidenceColor(safeConfidence);
  const compass = bearingToCompass(safeBearing);

  return (
    <View style={[styles.container, primaryGlow(theme.primary, 10)]}>
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <Text style={[styles.trackingLabel, { color: theme.primary }]}>{t.tracking || 'TRACKING'}</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityLabel={t.closeTracking || 'Close tracking'}
          accessibilityRole="button"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Drone name + category ── */}
      <View style={styles.nameRow}>
        <Text style={styles.droneName} numberOfLines={1}>
          {droneName}
        </Text>
        <View style={[styles.categoryBadge, { borderColor: `${theme.primary}40`, backgroundColor: `${theme.primary}1F` }]}>
          <Text style={[styles.categoryText, { color: theme.primary }]}>{category}</Text>
        </View>
      </View>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        {/* Distance */}
        <View style={styles.statCard}>
          <Text style={glassStyles.dataLabel}>{t.distance}</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statPrefix}>~</Text>
            <Text style={styles.statValue}>{Math.round(safeDistance)}</Text>
            <Text style={styles.statUnit}>m</Text>
          </View>
        </View>

        {/* Bearing */}
        <View style={styles.statCard}>
          <Text style={glassStyles.dataLabel}>{t.bearing}</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{Math.round(safeBearing)}°</Text>
            <Text style={[styles.statCompass, { color: theme.primary }]}>{compass}</Text>
          </View>
        </View>

        {/* Confidence */}
        <View style={styles.statCard}>
          <Text style={glassStyles.dataLabel}>{t.confidence}</Text>
          <View style={styles.statValueRow}>
            <Text style={[styles.statValue, { color: confColor }]}>
              {confPercent}
            </Text>
            <Text style={[styles.statUnit, { color: confColor }]}>%</Text>
          </View>
        </View>
      </View>

      {/* ── Pulse bar ── */}
      <View style={styles.pulseTrack}>
        <Animated.View style={[styles.pulseFill, { backgroundColor: theme.primary }, pulseBarStyle]} />
      </View>
    </View>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(20, 20, 30, 0.92)',
    borderWidth: 1,
    borderColor: GLASS.borderActive,
    borderRadius: 20,
    padding: 16,
    zIndex: 50,
    overflow: 'hidden',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  trackingLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -12,
    marginTop: -12,
  },
  closeBtnText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },

  // Name row
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  droneName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 10,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  statPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    marginRight: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 2,
  },
  statCompass: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },

  // Pulse bar
  pulseTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  pulseFill: {
    width: '100%',
    height: '100%',
    borderRadius: 1.5,
  },
});
