/**
 * Mic quality monitor — glass card with SNR meter and warning badges.
 */

import React from 'react';
import { View, Text, StyleSheet, type TextStyle } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { glassStyles } from '@/src/constants/glass';

interface MicQualityPanelProps {
  micQuality: 'GOOD' | 'FAIR' | 'POOR';
  micSnrDb: number;
  micWarning: string | null;
}

export function MicQualityPanel({ micQuality, micSnrDb, micWarning }: MicQualityPanelProps) {
  const theme = useTheme();
  const t = useTranslation();

  const qualityColor = micQuality === 'GOOD' ? theme.success : micQuality === 'FAIR' ? theme.warning : theme.danger;

  return (
    <View style={[glassStyles.card, styles.container]}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: qualityColor }]} />
        <Text style={[styles.label, { color: theme.textDim }]}>
          {t.signalQuality}:
        </Text>
        <Text style={[styles.value, { color: qualityColor }]}>
          {micQuality === 'GOOD' ? t.micQualityGood : micQuality === 'FAIR' ? t.micQualityFair : t.micQualityPoor}
        </Text>
        <Text style={[styles.snr, { color: theme.textMuted }]}>
          {micSnrDb}dB
        </Text>
      </View>

      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, {
          width: `${Math.min(Math.max((micSnrDb / 40) * 100, 5), 100)}%`,
          backgroundColor: qualityColor,
        }]} />
      </View>

      {micWarning && (
        <View style={[styles.warningBadge, { backgroundColor: `${theme.warning}20`, borderColor: theme.warning }]}>
          <Text style={styles.warningIcon}>
            {micWarning === 'WIND' ? '💨' : micWarning === 'NOISE' ? '🔊' : '⚠'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.warningText, { color: theme.warning }]} numberOfLines={1}>
              {micWarning === 'WIND' ? t.micWindWarning :
               micWarning === 'NOISE' ? t.micNoiseWarning :
               t.micClippingWarning}
            </Text>
            <Text style={[styles.warningHint, { color: theme.textMuted }]} numberOfLines={1}>
              {micWarning === 'WIND' ? (t.micWindHint || 'Shield microphone from wind') :
               micWarning === 'NOISE' ? (t.micNoiseHint || 'Move to a quieter location') :
               (t.micClippingHint || 'Move away from loud sound source')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 13, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '800' },
  snr: { fontSize: 13, marginLeft: 6, fontVariant: ['tabular-nums'] } as TextStyle,
  meterTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 2 },
  warningBadge: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, gap: 8, marginTop: 4 },
  warningIcon: { fontSize: 16 },
  warningText: { fontSize: 13, lineHeight: 18 },
  warningHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
});
