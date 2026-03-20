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
        const issueColor = issue.severity === 'CRITICAL' ? theme.danger : issue.severity === 'HIGH' ? theme.warning : theme.textMuted;
        return (
          <View key={`${issue.sensor}-${idx}`} style={[styles.row, { borderBottomColor: `${theme.border}40` }]}>
            <View style={[styles.dot, { backgroundColor: issueColor }]} />
            <Text style={[styles.text, { color: issueColor }]} numberOfLines={1}>
              {issue.message}
            </Text>
            {issue.action === 'SETTINGS' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: issueColor }]}
                onPress={() => Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel={t.openSettings}
              >
                <Text style={[styles.actionText, { color: issueColor }]}>{t.openSettings}</Text>
              </TouchableOpacity>
            )}
            {issue.action === 'CHANGE_PROFILE' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: issueColor }]}
                onPress={() => Alert.alert(t.bearingDirection || 'Bearing', t.bearingDisclaimer)}
                accessibilityRole="button"
              >
                <Text style={[styles.actionText, { color: issueColor }]}>{t.stereo || 'STEREO'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: GLASS.borderSubtle, minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, minHeight: 44, justifyContent: 'center' as const },
  actionText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
