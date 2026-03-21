/**
 * Active threats summary — glass card with animated track rows.
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type TextStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { GLASS, glassStyles } from '@/src/constants/glass';

interface ActiveThreatsListProps {
  activeThreats: Array<{
    id: string;
    detections?: Array<{
      threatCategory: string;
      confidence: number;
      distanceMeters: number;
      severity: string;
    }>;
  }>;
  onSelectTrack: (trackId: string) => void;
}

function getConfidenceLabel(conf: number, t: ReturnType<typeof useTranslation>): string {
  if (conf >= 0.9) return t.veryHighConfidence;
  if (conf >= 0.8) return t.highConfidence;
  if (conf >= 0.65) return t.moderateConfidence;
  if (conf >= 0.5) return t.lowConfidence;
  return t.verificationNeeded;
}

export const ActiveThreatsList = memo(function ActiveThreatsList({ activeThreats, onSelectTrack }: ActiveThreatsListProps) {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <Animated.View entering={FadeInUp.duration(350)} style={[glassStyles.card, styles.container]}>
      <Text style={[styles.sectionTitle, { color: theme.textDim }]}>
        {t.scanning} ({activeThreats.length})
      </Text>
      {activeThreats.map((track) => {
        if (!track.detections?.length) return null;
        const latest = track.detections[track.detections.length - 1];
        const severityColor =
          latest.severity === 'CRITICAL' ? theme.danger :
          latest.severity === 'HIGH' ? theme.warning :
          theme.primary;
        return (
          <TouchableOpacity
            key={track.id}
            style={[styles.row, { borderBottomColor: theme.border }]}
            onPress={() => onSelectTrack(track.id)}
            accessibilityRole="button"
            accessibilityLabel={`Track ${latest.threatCategory} ${t.distance} ${latest.distanceMeters}m`}
          >
            <View style={[styles.dot, { backgroundColor: severityColor }]} />
            <View style={styles.info}>
              <Text style={[styles.type, { color: theme.text }]}>
                {latest.threatCategory.replace(/_/g, ' ')}
              </Text>
              <Text style={[styles.confLabel, { color: theme.textMuted }]}>
                {getConfidenceLabel(latest.confidence, t)}
              </Text>
            </View>
            <Text style={[styles.dist, { color: theme.primary }]}>
              ~{Math.round(latest.distanceMeters)}m
            </Text>
            <Text style={[styles.conf, { color: theme.textDim }]}>
              {(latest.confidence * 100).toFixed(0)}%
            </Text>
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.footer, { color: theme.textMuted }]}>
        {t.mlDisclaimer}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: GLASS.borderSubtle, gap: 12, minHeight: 52 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  info: { flex: 1 },
  type: { fontSize: 15, fontWeight: '700' },
  confLabel: { fontSize: 12, marginTop: 2 },
  dist: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] } as TextStyle,
  conf: { fontSize: 14, width: 46, textAlign: 'right', fontWeight: '700' },
  footer: { fontSize: 11, marginTop: 12, fontStyle: 'italic', lineHeight: 16 },
});
