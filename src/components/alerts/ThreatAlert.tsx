/**
 * Drone Alert Panel - v4.0 (Glass Design)
 *
 * Added:
 * - i18n support
 * - Accuracy disclaimers on distance/bearing
 * - Confidence level text labels
 * - "~" prefix on distance (estimated)
 * - Improved accessibility
 * - Glassmorphism card style with severity glow
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../i18n/useTranslation';
import { GLASS, glassStyles, cyanGlow, dangerGlow, primaryGlow } from '@/src/constants/glass';
import type { DetectionResult, ThreatSeverity, ThreatCategory } from '../../types';

interface ThreatAlertProps {
  detection: DetectionResult;
  onAcknowledge: () => void;
  onTrack?: (detection: DetectionResult) => void;
  onDismiss?: (detection: DetectionResult) => void;
}

export const ThreatAlert: React.FC<ThreatAlertProps> = ({ detection, onAcknowledge, onTrack, onDismiss }) => {
  const theme = useTheme();
  const t = useTranslation();

  const SEVERITY_LABELS: Record<string, string> = {
    CRITICAL: t.criticalThreat,
    HIGH: t.highThreat,
    MEDIUM: t.mediumThreat,
    LOW: t.lowThreat,
    NONE: t.clear,
  };

  const CATEGORY_LABELS: Record<string, string> = {
    DRONE_SMALL: t.droneSmall,
    DRONE_LARGE: t.droneLarge,
    HELICOPTER: t.helicopter,
    MISSILE: t.missile,
    AIRCRAFT: t.aircraft,
    AMBIENT: t.ambient,
    // New AcousticPattern names
    MULTIROTOR: t.droneSmall,
    SINGLE_ENGINE: t.droneLarge,
    SINGLE_ROTOR: t.helicopter,
    JET_PROPULSION: t.missile,
    PROPELLER_FIXED: t.aircraft,
    BACKGROUND: t.ambient,
  };

  const getConfidenceLabel = (conf: number): string => {
    if (conf >= 0.9) return t.veryHighConfidence;
    if (conf >= 0.8) return t.highConfidence;
    if (conf >= 0.65) return t.moderateConfidence;
    if (conf >= 0.5) return t.lowConfidence;
    return t.verificationNeeded;
  };

  const isDanger = detection.severity === 'CRITICAL' || detection.severity === 'HIGH';

  const severityColor =
    detection.severity === 'CRITICAL' ? theme.danger :
    detection.severity === 'HIGH' ? theme.warning :
    theme.secondary;

  const glowEffect = isDanger ? dangerGlow(16) : primaryGlow(theme.primary, 12);

  const borderGlowColor = isDanger ? GLASS.borderDanger : GLASS.borderActive;

  const safeBearing = isFinite(detection.bearingDegrees) ? detection.bearingDegrees : 0;
  const safeConfidence = isFinite(detection.confidence) ? detection.confidence : 0;

  const bearingStr = safeBearing > 0
    ? `${safeBearing.toFixed(0)}° (${getBearingLabel(safeBearing, t)})`
    : t.directionLimited;

  const confidencePercent = (safeConfidence * 100).toFixed(0);

  const accuracyBarColor =
    safeConfidence >= 0.8 ? theme.success :
    safeConfidence >= 0.65 ? theme.warning : theme.danger;

  return (
    <Animated.View
      entering={SlideInDown.duration(300)}
      style={[
        styles.container,
        { borderColor: borderGlowColor },
        glowEffect,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`${SEVERITY_LABELS[detection.severity]}: ${CATEGORY_LABELS[detection.threatCategory]}`}
    >
      {/* Severity Badge Header */}
      <View style={styles.headerRow}>
        <View style={[
          styles.severityBadge,
          { backgroundColor: `${severityColor}22`, borderColor: `${severityColor}66` },
        ]}>
          <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
          <Text style={[styles.severityBadgeText, { color: severityColor }]}>
            {SEVERITY_LABELS[detection.severity]}
          </Text>
        </View>
        <Text style={[styles.categoryText, { color: `${theme.text}99` }]}>
          {CATEGORY_LABELS[detection.threatCategory] || detection.threatCategory}
        </Text>
      </View>

      {/* Stat Highlights */}
      <View style={styles.statRow}>
        {/* Distance Stat */}
        <View style={styles.statCard}>
          <Text style={[glassStyles.dataLabel, { color: `${theme.text}77` }]}>
            {t.distance} (~)
          </Text>
          <View style={styles.statValueRow}>
            <Text style={[styles.statValueLarge, { color: severityColor }]}>
              ~{Math.round(detection.distanceMeters)}
            </Text>
            <Text style={[styles.statUnit, { color: `${severityColor}AA` }]}>m</Text>
          </View>
          <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
            {t.distanceDisclaimer}
          </Text>
        </View>

        {/* Confidence Stat */}
        <View style={styles.statCard}>
          <Text style={[glassStyles.dataLabel, { color: `${theme.text}77` }]}>
            {t.confidence}
          </Text>
          <View style={styles.confidenceCircleWrap}>
            <View style={[styles.confidenceRing, { borderColor: accuracyBarColor }]}>
              <Text style={[styles.confidenceValue, { color: accuracyBarColor }]}>
                {confidencePercent}
              </Text>
              <Text style={[styles.confidencePercent, { color: `${accuracyBarColor}AA` }]}>%</Text>
            </View>
          </View>
          <Text style={[styles.confidenceLabel, { color: `${theme.text}99` }]}>
            {getConfidenceLabel(detection.confidence)}
          </Text>
        </View>
      </View>

      {/* Data Grid */}
      <View style={styles.body}>
        <DataRow
          label={t.bearing}
          value={bearingStr}
          color={theme.text}
          sublabel={safeBearing > 0 ? undefined : t.bearingDisclaimer}
          sublabelColor={theme.textMuted}
        />
        {isFinite(detection.approachRate) && detection.approachRate < 0 && (
          <DataRow
            label={t.approach}
            value={`${Math.abs(detection.approachRate).toFixed(1)} m/s`}
            color={theme.danger}
          />
        )}

        {/* Similar drone models */}
        {detection.similarDrones && detection.similarDrones.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={[glassStyles.dataLabel, { color: `${theme.text}77`, marginBottom: 6 }]}>
              {t.similarModels || 'SIMILAR MODELS'}
            </Text>
            {detection.similarDrones.slice(0, 3).map((drone, i) => (
              <Text key={i} style={[styles.similarItem, { color: theme.textDim }]}>
                {drone.name} ({(drone.probability * 100).toFixed(0)}%)
              </Text>
            ))}
          </View>
        )}

        {/* Accuracy confidence bar */}
        <View style={styles.accuracyBarWrap}>
          <View style={styles.accuracyBar}>
            <View style={[styles.accuracyFill, {
              width: `${Math.min(safeConfidence * 100, 100)}%`,
              backgroundColor: accuracyBarColor,
            }]} />
          </View>
          <Text style={[styles.accuracyNote, { color: theme.textMuted }]}>
            {t.accuracyNote}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {onTrack && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.actionBtnPrimary,
              { backgroundColor: isDanger ? theme.danger : theme.primary },
              isDanger ? dangerGlow(8) : primaryGlow(theme.primary, 8),
            ]}
            onPress={() => onTrack(detection)}
            activeOpacity={0.7}
            accessibilityLabel={t.track || 'Track'}
            accessibilityRole="button"
          >
            <Text style={[styles.actionBtnTextPrimary, { color: theme.mode === 'NIGHT' ? '#FFF' : '#000' }]}>{t.track || 'TRACK'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnOutline,
            { borderColor: `${theme.textMuted}88` },
          ]}
          onPress={() => {
            if (onDismiss) onDismiss(detection);
            onAcknowledge();
          }}
          activeOpacity={0.7}
          accessibilityLabel={t.dismiss || 'Dismiss'}
          accessibilityRole="button"
        >
          <Text style={[styles.actionBtnTextOutline, { color: theme.textDim }]}>{t.dismiss || 'DISMISS'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const DataRow: React.FC<{
  label: string;
  value: string;
  color: string;
  sublabel?: string;
  sublabelColor?: string;
}> = ({ label, value, color, sublabel, sublabelColor }) => (
  <View style={styles.dataRow}>
    <Text style={[styles.dataLabel, { color: `${color}88` }]}>{label}</Text>
    <View style={styles.dataValueCol}>
      <Text style={[styles.dataValue, { color }]}>{value}</Text>
      {sublabel && (
        <Text style={[styles.dataSublabel, { color: sublabelColor || `${color}66` }]}>
          {sublabel}
        </Text>
      )}
    </View>
  </View>
);

function getBearingLabel(degrees: number, t: ReturnType<typeof useTranslation>): string {
  const dirs = [t.north, t.northEast, t.east, t.southEast, t.south, t.southWest, t.west, t.northWest];
  const idx = ((Math.round(degrees / 45) % 8) + 8) % 8;
  return dirs[idx];
}

const styles = StyleSheet.create({
  // ===== Container =====
  container: {
    backgroundColor: GLASS.panelBg,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 20,
  },

  // ===== Severity Badge Header =====
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  severityBadgeText: {
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ===== Stat Highlights =====
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    padding: 12,
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  statValueLarge: {
    fontSize: 36,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 2,
  },
  disclaimer: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },

  // ===== Confidence Circle =====
  confidenceCircleWrap: {
    marginTop: 4,
    alignItems: 'center',
  },
  confidenceRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confidenceValue: {
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  confidencePercent: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },

  // ===== Data Grid =====
  body: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dataLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  dataValueCol: {
    alignItems: 'flex-end',
    flexShrink: 1,
    maxWidth: '60%',
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  dataSublabel: {
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
    textAlign: 'right',
  },

  // ===== Similar Models =====
  similarSection: {
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    padding: 10,
  },
  similarItem: {
    fontSize: 11,
    marginLeft: 8,
    marginBottom: 3,
  },

  // ===== Accuracy Bar =====
  accuracyBarWrap: {
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    padding: 10,
  },
  accuracyBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  accuracyFill: {
    height: '100%',
    borderRadius: 2,
  },
  accuracyNote: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // ===== Action Buttons =====
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: GLASS.borderSubtle,
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionBtnPrimary: {
    paddingVertical: 14,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    paddingVertical: 14,
  },
  actionBtnTextPrimary: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  actionBtnTextOutline: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.8,
  },
});
