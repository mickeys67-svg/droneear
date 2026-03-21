/**
 * History Screen - v4.0 (Glass Redesign)
 *
 * Features:
 * - Glassmorphism design system
 * - i18n support
 * - Severity filter tabs (All / High / Medium / Low)
 * - Glass stat cards with large numbers
 * - Glass detection cards with chevron detail
 * - Glass detail modal
 * - Export (CSV/JSON) and clear history
 * - Confidence color coding
 * - Accuracy footnote
 */

import React, { useMemo, useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, TouchableOpacity, Alert, Modal, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useHistoryStore } from '@/src/stores/historyStore';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { exportAsCSV, exportAsJSON } from '@/src/utils/exportData';
import { GLASS, glassStyles, cyanGlow, primaryGlow } from '@/src/constants/glass';
import type { DetectionResult, ThreatSeverity, TacticalTheme } from '@/src/types';

const SEVERITY_ICON: Record<string, string> = {
  CRITICAL: '!!!',
  HIGH: '!!',
  MEDIUM: '!',
  LOW: '-',
  NONE: '',
};

const SEVERITY_FILTERS = ['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export default function HistoryScreen() {
  const theme = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const { detections, clearHistory } = useHistoryStore();
  const [selectedDetection, setSelectedDetection] = useState<DetectionResult | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const handleDetectionPress = useCallback((detection: DetectionResult) => {
    setSelectedDetection(detection);
  }, []);

  const getCategoryShort = (cat: string): string => {
    const map: Record<string, string> = {
      DRONE_SMALL: t.droneSmall.split('(')[0].trim(),
      DRONE_LARGE: t.droneLarge.split('(')[0].trim(),
      HELICOPTER: t.helicopter,
      MISSILE: t.missile,
      AIRCRAFT: t.aircraft,
      AMBIENT: t.ambient,
      MULTIROTOR: t.droneSmall.split('(')[0].trim(),
      SINGLE_ENGINE: t.droneLarge.split('(')[0].trim(),
      SINGLE_ROTOR: t.helicopter,
      JET_PROPULSION: t.missile,
      PROPELLER_FIXED: t.aircraft,
      BACKGROUND: t.ambient,
    };
    return map[cat] || cat;
  };

  const stats = useMemo(() => {
    const total = detections.length;
    const byCat: Record<string, number> = {};
    for (const d of detections) {
      byCat[d.threatCategory] = (byCat[d.threatCategory] || 0) + 1;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

    const todayCount = detections.filter(d => d.timestamp >= todayStart).length;
    const weekCount = detections.filter(d => d.timestamp >= weekStart).length;
    const avgConfidence = total > 0
      ? detections.reduce((sum, d) => sum + d.confidence, 0) / total
      : 0;

    return { total, byCat, todayCount, weekCount, avgConfidence };
  }, [detections]);

  const filteredDetections = useMemo(() => {
    if (filterSeverity === 'ALL') return detections;
    return detections.filter(d => d.severity === filterSeverity || (filterSeverity === 'HIGH' && d.severity === 'CRITICAL'));
  }, [detections, filterSeverity]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return GLASS.glowCyan;
    if (confidence >= 0.5) return GLASS.glowOrange;
    return GLASS.glowRed;
  };

  const getSeverityColor = (severity: string): string => {
    if (severity === 'CRITICAL' || severity === 'HIGH') return GLASS.glowRed;
    if (severity === 'MEDIUM') return GLASS.glowOrange;
    return GLASS.glowCyan;
  };

  const renderItem = ({ item }: { item: DetectionResult }) => {
    const time = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const confPercent = (item.confidence * 100).toFixed(0);
    const confColor = getConfidenceColor(item.confidence);
    const sevColor = getSeverityColor(item.severity);

    return (
      <TouchableOpacity
        style={[styles.detectionCard]}
        onPress={() => handleDetectionPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${getCategoryShort(item.threatCategory)} ${confPercent}%`}
      >
        {/* Left: Icon + Info */}
        <View style={styles.cardLeft}>
          <View style={[styles.droneIconContainer, { borderColor: sevColor }]}>
            <Text style={styles.droneIconText}>🛸</Text>
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                {item.similarDrones?.[0]?.name || getCategoryShort(item.threatCategory)}
              </Text>
              <View style={[styles.categoryBadge, { backgroundColor: sevColor + '22', borderColor: sevColor + '44' }]}>
                <Text style={[styles.categoryBadgeText, { color: sevColor }]}>
                  {getCategoryShort(item.threatCategory).toUpperCase().slice(0, 8)}
                </Text>
              </View>
            </View>
            <View style={styles.cardSecondary}>
              <Text style={[styles.cardDistance, { color: theme.primary }]}>~{Math.round(item.distanceMeters)}m</Text>
              <Text style={[styles.cardDot, { color: theme.textMuted }]}> · </Text>
              <Text style={[styles.cardTime, { color: theme.textDim }]}>{time}</Text>
            </View>
          </View>
        </View>

        {/* Right: Confidence + Chevron */}
        <View style={styles.cardRight}>
          <Text style={[styles.cardConfidence, { color: confColor }]}>{confPercent}%</Text>
          <Text style={[styles.cardChevron, { color: theme.textMuted }]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>
            <Text style={{ color: theme.text }}>Drone</Text>
            <Text style={{ color: theme.primary }}>Ear</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>{t.historyTab || 'HISTORY'}</Text>
        </View>
        {detections.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t.exportData}
              style={[styles.headerBtn, { borderColor: GLASS.borderLight }]}
              onPress={() => {
                Alert.alert(
                  t.exportData,
                  '',
                  [
                    { text: t.exportCSV, onPress: () => exportAsCSV(detections).catch((e) => Alert.alert(t.exportError || 'Export Error', e.message)) },
                    { text: t.exportJSON, onPress: () => exportAsJSON(detections).catch((e) => Alert.alert(t.exportError || 'Export Error', e.message)) },
                    { text: t.cancel, style: 'cancel' },
                  ],
                );
              }}
            >
              <Text style={[styles.headerBtnText, { color: theme.primary }]}>{t.exportData}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t.clearAll}
              style={[styles.headerBtn, { borderColor: GLASS.borderDanger }]}
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
              <Text style={[styles.headerBtnText, { color: GLASS.glowRed }]}>{t.clearAll}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsSection}>
        {/* Main total card */}
        <View style={[styles.statCardMain, primaryGlow(theme.primary, 8)]}>
          <Text style={[glassStyles.statValueLarge, { color: GLASS.glowCyan }]}>{stats.total}</Text>
          <Text style={[glassStyles.dataLabel, { color: theme.textDim, marginTop: 4 }]}>{t.total}</Text>
        </View>
        {/* Sub-stat cards row */}
        <View style={styles.statsSubRow}>
          <StatBadge label={t.todaysDetections || "Today"} value={String(stats.todayCount)} color={theme} />
          <StatBadge label={t.thisWeek || "This Week"} value={String(stats.weekCount)} color={theme} />
          <StatBadge label={t.avgConfidence || "Avg Conf."} value={`${(stats.avgConfidence * 100).toFixed(0)}%`} color={theme} accent />
        </View>
      </View>

      {/* Severity Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {SEVERITY_FILTERS.map(sev => {
          const SEVERITY_LABEL: Record<string, string> = {
            ALL: t.all || 'ALL',
            HIGH: t.highThreat || 'HIGH',
            MEDIUM: t.mediumThreat || 'MEDIUM',
            LOW: t.lowThreat || 'LOW',
          };
          const isActive = filterSeverity === sev;
          const pillBg = isActive ? GLASS.glowCyan : 'transparent';
          const pillBorder = isActive ? GLASS.glowCyan : GLASS.borderLight;
          const pillText = isActive ? (theme.mode !== 'DAY' ? '#FFF' : '#000') : theme.textDim;
          return (
            <TouchableOpacity
              key={sev}
              style={[styles.filterPill, { backgroundColor: pillBg, borderColor: pillBorder }]}
              onPress={() => setFilterSeverity(sev)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.filterPillText, { color: pillText }]}>{SEVERITY_LABEL[sev] || sev}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
            style={[glassStyles.btnPrimary, { backgroundColor: theme.primary, marginTop: 24 }]}
            onPress={() => router.navigate('/(tabs)')}
          >
            <Text style={[glassStyles.btnPrimaryText, theme.mode !== 'DAY' && { color: '#FFF' }]}>{t.engageSensors}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredDetections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            {t.noFilterResults || `No ${filterSeverity.toLowerCase()} severity detections`}
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={filteredDetections}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
          {/* Accuracy footer */}
          <View style={[styles.footer, { borderTopColor: GLASS.borderSubtle }]}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>{t.accuracyNote}</Text>
          </View>
        </>
      )}

      {/* Detection Detail Modal */}
      <Modal
        visible={selectedDetection !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDetection(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedDetection(null)}
        >
          <Pressable
            style={[glassStyles.sheet]}
            onPress={() => {}}
          >
            {/* Drag Handle */}
            <View style={glassStyles.sheetHandle} />

            {selectedDetection && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {t.detectionDetails || 'Detection Details'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedDetection(null)}
                    style={styles.modalClose}
                    accessibilityRole="button"
                    accessibilityLabel={t.close || 'Close'}
                  >
                    <Text style={[styles.modalCloseText, { color: theme.textMuted }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Drone Icon + Name */}
                <View style={styles.modalDroneInfo}>
                  <View style={[styles.modalDroneIconWrap, { borderColor: getSeverityColor(selectedDetection.severity) }]}>
                    <Text style={styles.modalDroneIcon}>🛸</Text>
                  </View>
                  <Text style={[styles.modalDroneName, { color: theme.text }]}>
                    {selectedDetection.similarDrones?.[0]?.name || getCategoryShort(selectedDetection.threatCategory)}
                  </Text>
                  <View style={[styles.categoryBadge, { backgroundColor: getSeverityColor(selectedDetection.severity) + '22', borderColor: getSeverityColor(selectedDetection.severity) + '44', marginTop: 6 }]}>
                    <Text style={[styles.categoryBadgeText, { color: getSeverityColor(selectedDetection.severity) }]}>
                      {getCategoryShort(selectedDetection.threatCategory).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.modalDroneTime, { color: theme.textDim }]}>
                    {new Date(selectedDetection.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {/* Stats Grid - Row 1: Distance + Confidence */}
                <View style={styles.modalStats}>
                  <View style={[styles.modalStatCard]}>
                    <Text style={[glassStyles.dataLabel, { color: theme.textDim, marginBottom: 6 }]}>
                      {t.distance || 'Distance'}
                    </Text>
                    <Text style={[glassStyles.statValueLarge, { color: theme.text }]}>
                      ~{Math.round(selectedDetection.distanceMeters)}
                    </Text>
                    <Text style={[glassStyles.statUnit, { color: theme.textDim }]}>{t.meters || 'meters'}</Text>
                  </View>
                  <View style={[styles.modalStatCard]}>
                    <Text style={[glassStyles.dataLabel, { color: theme.textDim, marginBottom: 6 }]}>
                      {t.confidence || 'Confidence'}
                    </Text>
                    <Text style={[glassStyles.statValueLarge, { color: getConfidenceColor(selectedDetection.confidence) }]}>
                      {(selectedDetection.confidence * 100).toFixed(0)}
                    </Text>
                    <Text style={[glassStyles.statUnit, { color: theme.textDim }]}>%</Text>
                  </View>
                </View>

                {/* Stats Grid - Row 2: Bearing + Frequency */}
                <View style={styles.modalStats}>
                  <View style={[styles.modalStatCard]}>
                    <Text style={[glassStyles.dataLabel, { color: theme.textDim, marginBottom: 6 }]}>
                      {t.bearing || 'Bearing'}
                    </Text>
                    <Text style={[styles.modalStatValueMd, { color: theme.text }]}>
                      {selectedDetection.bearingDegrees.toFixed(0)}°
                    </Text>
                  </View>
                  <View style={[styles.modalStatCard]}>
                    <Text style={[glassStyles.dataLabel, { color: theme.textDim, marginBottom: 6 }]}>
                      {t.frequency || 'Frequency'}
                    </Text>
                    <Text style={[styles.modalStatValueMd, { color: theme.text }]}>
                      ~{selectedDetection.frequencyPeaks?.[0] ? `${(selectedDetection.frequencyPeaks[0] / 1000).toFixed(1)}kHz` : 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Acoustic Signature */}
                <View style={[styles.modalSignature, { borderColor: GLASS.borderSubtle }]}>
                  <Text style={[glassStyles.sectionLabel, { color: theme.textDim }]}>
                    {t.acousticSignature || 'Acoustic Signature'}
                  </Text>
                  <View style={styles.modalSignatureBars}>
                    {(selectedDetection.spectralSignature || []).slice(0, 32).map((val, i) => (
                      <View
                        key={i}
                        style={[
                          styles.modalSignatureBar,
                          {
                            height: Math.max(2, val * 40),
                            backgroundColor: theme.primary,
                            opacity: 0.4 + val * 0.6,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>

                {/* View on Map Button */}
                <TouchableOpacity
                  style={[glassStyles.btnPrimary, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setSelectedDetection(null);
                    router.navigate('/(tabs)/map');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[glassStyles.btnPrimaryText, theme.mode !== 'DAY' && { color: '#FFF' }]}>{t.viewOnMap || 'VIEW ON MAP'}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const StatBadge: React.FC<{ label: string; value: string; color: TacticalTheme; accent?: boolean }> = ({
  label,
  value,
  color,
  accent,
}) => (
  <View style={styles.statCardSub}>
    <Text style={[styles.statSubValue, { color: accent ? GLASS.glowCyan : color.text }]}>{value}</Text>
    <Text style={[glassStyles.dataLabel, { color: color.textDim, marginTop: 2 }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Stats
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statCardMain: {
    backgroundColor: GLASS.cardBg,
    borderWidth: 1,
    borderColor: GLASS.borderActive,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  statsSubRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCardSub: {
    flex: 1,
    backgroundColor: GLASS.cardBg,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statSubValue: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  // Filters
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Detection Card
  detectionCard: {
    backgroundColor: GLASS.cardBg,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  droneIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 229, 204, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  droneIconText: {
    fontSize: 20,
  },
  cardInfo: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDistance: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardDot: {
    fontSize: 12,
  },
  cardTime: {
    fontSize: 11,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  cardConfidence: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  cardChevron: {
    fontSize: 20,
    fontWeight: '300',
  },

  // List
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Empty State
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  footerText: {
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: GLASS.overlayBg,
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalClose: {
    padding: 8,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalDroneInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalDroneIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'rgba(0, 229, 204, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalDroneIcon: {
    fontSize: 32,
  },
  modalDroneName: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  modalDroneTime: {
    fontSize: 13,
    marginTop: 6,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  modalStatCard: {
    flex: 1,
    backgroundColor: GLASS.cardBg,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  modalStatValueMd: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  modalSignature: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  modalSignatureBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 40,
    gap: 2,
  },
  modalSignatureBar: {
    width: 6,
    borderRadius: 3,
    minHeight: 2,
  },
});
