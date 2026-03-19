/**
 * Drone Alert Panel - v3.0
 *
 * Added:
 * - i18n support
 * - Accuracy disclaimers on distance/bearing
 * - Confidence level text labels
 * - "~" prefix on distance (estimated)
 * - Improved accessibility
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../i18n/useTranslation';
import type { DetectionResult, ThreatSeverity, ThreatCategory } from '../../types';

interface ThreatAlertProps {
  detection: DetectionResult;
  onAcknowledge: () => void;
}

export const ThreatAlert: React.FC<ThreatAlertProps> = ({ detection, onAcknowledge }) => {
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
  };

  const getConfidenceLabel = (conf: number): string => {
    if (conf >= 0.9) return t.veryHighConfidence;
    if (conf >= 0.8) return t.highConfidence;
    if (conf >= 0.65) return t.moderateConfidence;
    if (conf >= 0.5) return t.lowConfidence;
    return t.verificationNeeded;
  };

  const severityColor =
    detection.severity === 'CRITICAL' ? theme.danger :
    detection.severity === 'HIGH' ? theme.warning :
    theme.secondary;

  const bearingStr = detection.bearingDegrees > 0
    ? `${detection.bearingDegrees.toFixed(0)}° (${getBearingLabel(detection.bearingDegrees, t)})`
    : t.directionLimited;

  return (
    <Animated.View
      entering={SlideInDown.duration(300)}
      style={[styles.container, { borderColor: severityColor }]}
      accessibilityRole="alert"
      accessibilityLabel={`${SEVERITY_LABELS[detection.severity]}: ${CATEGORY_LABELS[detection.threatCategory]}`}
    >
      {/* Severity Header */}
      <View style={[styles.header, { backgroundColor: severityColor }]}>
        <Text style={styles.headerText}>
          {SEVERITY_LABELS[detection.severity]}
        </Text>
      </View>

      {/* Data Grid */}
      <View style={[styles.body, { backgroundColor: `${severityColor}10` }]}>
        <DataRow
          label={t.type}
          value={CATEGORY_LABELS[detection.threatCategory] || detection.threatCategory}
          color={theme.text}
        />
        <DataRow
          label={t.confidence}
          value={`${(detection.confidence * 100).toFixed(1)}% — ${getConfidenceLabel(detection.confidence)}`}
          color={theme.text}
        />
        <DataRow
          label={`${t.distance} (~)`}
          value={`~${detection.distanceMeters}m`}
          color={severityColor}
          sublabel={t.distanceDisclaimer}
          sublabelColor={theme.textMuted}
        />
        <DataRow
          label={t.bearing}
          value={bearingStr}
          color={theme.text}
          sublabel={detection.bearingDegrees > 0 ? undefined : t.bearingDisclaimer}
          sublabelColor={theme.textMuted}
        />
        {detection.approachRate < 0 && (
          <DataRow
            label={t.approach}
            value={`${Math.abs(detection.approachRate).toFixed(1)} m/s`}
            color={theme.danger}
          />
        )}

        {/* Accuracy confidence bar */}
        <View style={styles.accuracyBar}>
          <View style={[styles.accuracyFill, {
            width: `${Math.min(detection.confidence * 100, 100)}%`,
            backgroundColor: detection.confidence >= 0.8 ? theme.success :
                           detection.confidence >= 0.65 ? theme.warning : theme.danger,
          }]} />
        </View>
        <Text style={[styles.accuracyNote, { color: theme.textMuted }]}>
          {t.accuracyNote}
        </Text>
      </View>

      {/* Acknowledge Button */}
      <TouchableOpacity
        style={[styles.ackButton, { borderTopColor: `${severityColor}33` }]}
        onPress={onAcknowledge}
        activeOpacity={0.7}
        accessibilityLabel={t.acknowledge}
        accessibilityRole="button"
      >
        <Text style={[styles.ackText, { color: severityColor }]}>{t.acknowledge}</Text>
      </TouchableOpacity>
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

function getBearingLabel(degrees: number, t: any): string {
  const dirs = [t.north, t.northEast, t.east, t.southEast, t.south, t.southWest, t.west, t.northWest];
  const idx = Math.round(degrees / 45) % 8;
  return dirs[idx];
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  header: {
    padding: 12,
    alignItems: 'center',
  },
  headerText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
  },
  body: {
    padding: 16,
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
    fontSize: 8,
    marginTop: 2,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  accuracyBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  accuracyFill: {
    height: '100%',
    borderRadius: 2,
  },
  accuracyNote: {
    fontSize: 8,
    marginTop: 4,
    fontStyle: 'italic',
  },
  ackButton: {
    borderTopWidth: 1,
    padding: 16,
    alignItems: 'center',
    minHeight: 56,
  },
  ackText: {
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
});
