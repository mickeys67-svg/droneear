/**
 * Sensor enforcement status panel — glass card with issue rows.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { GLASS, glassStyles } from '@/src/constants/glass';
import type { SensorIssue } from '@/src/core/sensors/SensorEnforcementManager';

interface SensorIssuesPanelProps {
  issues: SensorIssue[];
}

export function SensorIssuesPanel({ issues }: SensorIssuesPanelProps) {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <View style={[glassStyles.card, styles.container]}>
      {issues.map((issue, idx) => {
        // CRITICAL keeps the danger color (genuine blocker). Everything else
        // is informational guidance — render it in a calm muted tone with
        // a dim text colour so quality notices don't read as app errors.
        const isCritical = issue.severity === 'CRITICAL';
        const dotColor = isCritical ? theme.danger : theme.textMuted;
        const textColor = isCritical ? theme.danger : theme.textDim;
        // Translate the stable messageKey; fall back to English message.
        const label = (t as unknown as Record<string, unknown>)[issue.messageKey];
        const text = typeof label === 'string' ? label : issue.message;
        return (
          <View key={`${issue.sensor}-${idx}`} style={[styles.row, { borderBottomColor: `${theme.border}40` }]}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={[styles.text, { color: textColor }]} numberOfLines={2}>
              {text}
            </Text>
            {issue.action === 'SETTINGS' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: textColor }]}
                onPress={() => Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel={t.openSettings}
              >
                <Text style={[styles.actionText, { color: textColor }]}>{t.openSettings}</Text>
              </TouchableOpacity>
            )}
            {issue.action === 'CHANGE_PROFILE' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: textColor }]}
                onPress={() => Alert.alert(t.bearingDirection || 'Bearing', t.bearingDisclaimer)}
                accessibilityRole="button"
              >
                <Text style={[styles.actionText, { color: textColor }]}>{t.stereo || 'STEREO'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// NOTE: previously wrapped in React.memo with a custom comparator to avoid
// per-frame re-renders. Removed because the memo bypasses internal hook
// updates — useTheme/useTranslation changes (DAY ↔ NIGHT, locale switch)
// would leave the panel rendering with the previous theme/language. The
// real flicker root cause was new issues array refs every audio frame,
// now fixed in SensorEnforcementManager.setMicQuality/setRecordingState
// early-return guards; React reconciliation is cheap when issues are stable.

const styles = StyleSheet.create({
  container: { marginBottom: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: GLASS.borderSubtle, minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, minHeight: 44, justifyContent: 'center' as const },
  actionText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
