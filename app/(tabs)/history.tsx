/**
 * History Screen - v3.0
 *
 * Added:
 * - i18n support
 * - Improved empty state with icon + CTA
 * - Confidence level labels
 * - Accuracy footnote
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useHistoryStore } from '@/src/stores/historyStore';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import type { DetectionResult, ThreatSeverity } from '@/src/types';

const SEVERITY_ICON: Record<string, string> = {
  CRITICAL: '!!!',
  HIGH: '!!',
  MEDIUM: '!',
  LOW: '-',
  NONE: '',
};

export default function HistoryScreen() {
  const theme = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const { detections, clearHistory } = useHistoryStore();

  const getCategoryShort = (cat: string): string => {
    const map: Record<string, string> = {
      DRONE_SMALL: t.droneSmall.split('(')[0].trim(),
      DRONE_LARGE: t.droneLarge.split('(')[0].trim(),
      HELICOPTER: t.helicopter,
      MISSILE: t.missile,
      AIRCRAFT: t.aircraft,
      AMBIENT: t.ambient,
    };
    return map[cat] || cat;
  };

  const stats = useMemo(() => {
    const total = detections.length;
    const byCat: Record<string, number> = {};
    for (const d of detections) {
      byCat[d.threatCategory] = (byCat[d.threatCategory] || 0) + 1;
    }
    return { total, byCat };
  }, [detections]);

  const renderItem = ({ item }: { item: DetectionResult }) => {
    const time = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const severityColor =
      item.severity === 'CRITICAL' ? theme.danger :
      item.severity === 'HIGH' ? theme.warning :
      theme.primary;

    return (
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <Text style={[styles.time, { color: theme.textDim }]}>{time}</Text>
        <View style={styles.middle}>
          <Text style={[styles.category, { color: theme.text }]}>
            {getCategoryShort(item.threatCategory)}
          </Text>
          <Text style={[styles.severity, { color: severityColor }]}>
            {SEVERITY_ICON[item.severity]} {(item.confidence * 100).toFixed(0)}%
          </Text>
        </View>
        <Text style={[styles.distance, { color: theme.primary }]}>~{item.distanceMeters}m</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t.detectionLog}</Text>
        {detections.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t.clearAll}
            onPress={() => {
              Alert.alert(
                t.clearConfirmTitle,
                t.clearConfirmMsg(detections.length),
                [
                  { text: t.cancel, style: 'cancel' },
                  { text: t.clearAll, style: 'destructive', onPress: clearHistory },
                ],
              );
            }}
          >
            <Text style={[styles.clearBtn, { color: theme.danger }]}>{t.clearAll}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBadge label={t.total} value={String(stats.total)} color={theme} />
        {Object.entries(stats.byCat).map(([cat, count]) => (
          <StatBadge
            key={cat}
            label={getCategoryShort(cat).toUpperCase().slice(0, 10)}
            value={String(count)}
            color={theme}
          />
        ))}
      </View>

      {/* List or Empty State */}
      {detections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            {t.noDetections}
          </Text>
          <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
            {t.startScanningHint}
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.navigate('/(tabs)')}
          >
            <Text style={styles.emptyBtnText}>{t.engageSensors}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={detections}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
          {/* Accuracy footer */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>{t.accuracyNote}</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const StatBadge: React.FC<{ label: string; value: string; color: any }> = ({
  label,
  value,
  color,
}) => (
  <View style={[styles.stat, { backgroundColor: color.surface, borderColor: color.border }]}>
    <Text style={[styles.statValue, { color: color.primary }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: color.textDim }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  clearBtn: { fontSize: 12, fontWeight: '700', padding: 4, minHeight: 44, textAlignVertical: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  stat: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 8, letterSpacing: 1, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  time: { fontSize: 11, width: 70 },
  middle: { flex: 1 },
  category: { fontSize: 14, fontWeight: '600' },
  severity: { fontSize: 11, marginTop: 2 },
  distance: { fontSize: 14, fontWeight: '800' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  emptyHint: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10, minHeight: 48 },
  emptyBtnText: { color: '#000', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  footer: { borderTopWidth: 1, padding: 16 },
  footerText: { fontSize: 10, textAlign: 'center', fontStyle: 'italic' },
});
