/**
 * Mic quality monitor — glass card with SNR meter and warning badges.
 */

import React from 'react';
import { View, Text, StyleSheet, type TextStyle } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { glassStyles } from '@/src/constants/glass';
import { useDetectionStore } from '@/src/stores/detectionStore';

interface MicQualityPanelProps {
  micQuality?: 'GOOD' | 'FAIR' | 'POOR';
  micSnrDb?: number;
  micWarning?: string | null;
}

// Subscribes to mic quality from the store DIRECTLY (props are optional
// overrides). micSnrDb updates a few times per second; reading it here keeps
// those re-renders scoped to this panel instead of re-rendering the whole
// SCAN screen via the parent. Not memoized on purpose — this leaf must still
// pick up useTheme/useTranslation changes.
export function MicQualityPanel({ micQuality: micQualityProp, micSnrDb: micSnrDbProp, micWarning: micWarningProp }: MicQualityPanelProps) {
  const theme = useTheme();
  const t = useTranslation();

  const storeMicQuality = useDetectionStore((s) => s.micQuality);
  const storeMicSnrDb = useDetectionStore((s) => s.micSnrDb);
  const storeMicWarning = useDetectionStore((s) => s.micWarning);
  const micQuality = micQualityProp ?? storeMicQuality;
  const micSnrDb = micSnrDbProp ?? storeMicSnrDb;
  const micWarning = micWarningProp ?? storeMicWarning;

  const qualityColor = micQuality === 'GOOD' ? theme.success : micQuality === 'FAIR' ? theme.warning : theme.danger;
  // Snap to integer to stop the visible jitter from per-frame SNR oscillation.
  const snrDisplay = Math.round(micSnrDb);
  const fillPct = Math.min(Math.max((snrDisplay / 40) * 100, 5), 100);

  return (
    <View style={[glassStyles.card, styles.container]}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: qualityColor }]} />
        <Text style={[styles.label, { color: theme.textDim }]} numberOfLines={1}>
          {t.signalQuality}:
        </Text>
        <Text style={[styles.value, { color: qualityColor }]} numberOfLines={1}>
          {micQuality === 'GOOD' ? t.micQualityGood : micQuality === 'FAIR' ? t.micQualityFair : t.micQualityPoor}
        </Text>
        <Text style={[styles.snr, { color: theme.textMuted }]} numberOfLines={1}>
          {snrDisplay}dB
        </Text>
      </View>

      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, {
          width: `${fillPct}%`,
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

// NOTE: previously wrapped in React.memo. Removed because the memo bypasses
// internal hook updates — useTheme/useTranslation changes would leave this
// panel rendering with the stale theme/language. The SNR jitter is already
// damped by the Math.round(micSnrDb) snap above, so per-frame re-renders
// produce no visual change and React's reconciliation handles the rest.

const styles = StyleSheet.create({
  container: { marginBottom: 14, gap: 8 },
  // FIXED single-line height. The SNR readout (micSnrDb) updates a few times a
  // second whenever there is ANY sound (typing included). Without a locked
  // height + single-line texts, a change in the SNR digit count could tip the
  // row over its width and wrap to a 2nd line, growing this panel and bouncing
  // everything below it (spectrogram, scan button) up/down every frame — the
  // reported "소리 나면 화면이 막 떨림". With height pinned the panel can never
  // reflow no matter what the audio values do.
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 22 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  // flexShrink so a long translated label ellipsizes instead of wrapping.
  label: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  value: { fontSize: 14, fontWeight: '800', flexShrink: 0 },
  // Pinned to the right with a fixed width + tabular figures so the digit-count
  // change (e.g. 9dB → 12dB) never shifts neighbours or the row width.
  snr: { fontSize: 13, marginLeft: 'auto', minWidth: 52, textAlign: 'right', fontVariant: ['tabular-nums'] } as TextStyle,
  meterTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 2 },
  warningBadge: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, gap: 8, marginTop: 4 },
  warningIcon: { fontSize: 16 },
  warningText: { fontSize: 13, lineHeight: 18 },
  warningHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
});
