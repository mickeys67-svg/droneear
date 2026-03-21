/**
 * Map Screen — v3.0 (Glass Design)
 *
 * Displays all drone detections on an interactive map.
 * Shows acoustic, BLE, and fused detections with appropriate markers.
 * Bottom sheet panel on marker press with Track/Dismiss actions.
 * Glassmorphism design system applied.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import Animated, { SlideInDown, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { useMapData, MapMarker } from '@/src/hooks/useMapData';
import DroneMapView from '@/src/components/map/DroneMapView';
import { GLASS, glassStyles, cyanGlow, primaryGlow } from '@/src/constants/glass';
import { TrackingOverlay } from '@/src/components/TrackingOverlay';
import { useDetectionStore } from '@/src/stores/detectionStore';

/** Convert bearing degrees to compass direction */
function bearingToDirection(deg: number | undefined): string {
  if (deg == null) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

export default function MapScreen() {
  const theme = useTheme();
  const t = useTranslation();
  const { userLocation, markers } = useMapData();
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  const activeCount = markers.filter((m) => m.type !== 'operator').length;

  // Track selection from store
  const selectedTrackId = useDetectionStore((s) => s.selectedTrackId);
  const selectTrack = useDetectionStore((s) => s.selectTrack);
  const hideTrackFromMap = useDetectionStore((s) => s.hideTrackFromMap);
  const currentThreats = useDetectionStore((s) => s.currentThreats);

  // Derive tracked drone data (FIX-C1: guard empty detections)
  const trackedTrack = selectedTrackId
    ? currentThreats.find((tr) => tr.id === selectedTrackId && tr.isActive)
    : null;
  const trackedDetection = trackedTrack?.detections?.length
    ? trackedTrack.detections[trackedTrack.detections.length - 1]
    : null;

  // FIX-C5: Auto-clear selected track when it becomes inactive
  useEffect(() => {
    if (selectedTrackId && !trackedTrack) {
      selectTrack(null);
    }
  }, [selectedTrackId, trackedTrack, selectTrack]);

  // FIX-C5: Auto-clear selectedMarker when marker no longer exists
  useEffect(() => {
    if (selectedMarker && !markers.find((m) => m.id === selectedMarker.id)) {
      setSelectedMarker(null);
    }
  }, [markers, selectedMarker]);

  const handleMarkerPress = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker);
  }, []);

  const handleDismissMarker = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Glass Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t.appName}</Text>
        {activeCount > 0 && (
          <View style={[styles.activeBadge, { backgroundColor: `${theme.success}18`, borderColor: `${theme.success}40` }]}>
            <View style={[styles.activeDot, { backgroundColor: theme.success }]} />
            <Text style={[styles.activeBadgeText, { color: theme.success }]}>
              {activeCount} {t.active || 'ACTIVE'}
            </Text>
          </View>
        )}
      </View>

      {/* Map or empty state */}
      {markers.length === 0 && userLocation ? (
        <View style={styles.emptyOverlay}>
          <DroneMapView
            userLocation={userLocation}
            markers={markers}
            onMarkerPress={handleMarkerPress}
            selectedMarkerId={selectedMarker?.id}
          />
          <View style={styles.emptyBanner}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              {t.mapNoDetections}
            </Text>
            <Text style={[styles.emptySubText, { color: theme.textDim }]}>
              {t.mapTitle}
            </Text>
          </View>
        </View>
      ) : (
        <DroneMapView
          userLocation={userLocation}
          markers={markers}
          onMarkerPress={handleMarkerPress}
          selectedMarkerId={selectedMarker?.id}
        />
      )}

      {/* Tracking Overlay — floating glass panel when tracking a drone */}
      {trackedDetection && trackedTrack && (
        <TrackingOverlay
          trackId={trackedTrack.id}
          droneName={trackedDetection.similarDrones?.[0]?.name || trackedDetection.threatCategory.replace('_', ' ')}
          category={trackedDetection.threatCategory.replace('_', ' ')}
          distance={trackedDetection.distanceMeters}
          bearing={trackedDetection.bearingDegrees}
          confidence={trackedDetection.confidence}
          onClose={() => selectTrack(null)}
        />
      )}

      {/* Glass Bottom Sheet — animated entry */}
      {selectedMarker && (
        <Animated.View entering={SlideInDown.duration(350).springify()} exiting={FadeOut.duration(200)} style={[styles.bottomSheet, { backgroundColor: theme.mode === 'DAY' ? 'rgba(245, 245, 250, 0.96)' : 'rgba(20, 20, 30, 0.92)', borderColor: theme.mode === 'DAY' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)' }]}>
          {/* Drag Handle */}
          <View style={glassStyles.sheetHandle} />

          {/* Drone Info Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetDroneInfo}>
              <Text style={styles.sheetDroneIcon}>🛸</Text>
              <View style={styles.sheetDroneNameWrap}>
                <Text style={[styles.sheetDroneName, { color: theme.text }]}>
                  {selectedMarker.detection?.similarDrones?.[0]?.name || selectedMarker.title || t.droneSmall}
                </Text>
                {selectedMarker.detection?.similarDrones?.[0]?.category && (
                  <View style={[styles.sheetCategoryBadge, { borderColor: `${theme.primary}4D`, backgroundColor: `${theme.primary}1A` }]}>
                    <Text style={[styles.sheetCategoryText, { color: theme.primary }]}>
                      {selectedMarker.detection.similarDrones[0].category}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={handleDismissMarker}
              style={styles.sheetClose}
              accessibilityRole="button"
              accessibilityLabel={t.close || 'Close'}
            >
              <Text style={[styles.sheetCloseText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={styles.sheetStats}>
            {/* Distance — large emphasis */}
            <View style={styles.sheetStatItem}>
              <Text style={[styles.sheetStatLabel, { color: theme.textMuted }]}>{t.distance || 'Distance'}</Text>
              <View style={styles.distanceRow}>
                <Text style={[styles.distanceValue, { color: theme.text }]}>
                  {selectedMarker.detection?.distanceMeters != null
                    ? `${Math.round(selectedMarker.detection.distanceMeters)}`
                    : '?'}
                </Text>
                <View style={styles.distanceSuffix}>
                  <Text style={[styles.distanceUnit, { color: theme.textDim }]}>m</Text>
                  {selectedMarker.detection?.bearingDegrees != null && (
                    <Text style={[styles.distanceDir, { color: theme.primary }]}>
                      {bearingToDirection(selectedMarker.detection.bearingDegrees)}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Confidence */}
            <View style={styles.sheetStatItem}>
              <Text style={[styles.sheetStatLabel, { color: theme.textMuted }]}>{t.confidence || 'Confidence'}</Text>
              <Text style={[styles.confidenceValue, { color: theme.primary }]}>
                {selectedMarker.detection
                  ? `${(selectedMarker.detection.confidence * 100).toFixed(0)}`
                  : 'N/A'}
              </Text>
              {selectedMarker.detection && (
                <View style={styles.confidenceBarBg}>
                  <View
                    style={[
                      styles.confidenceBarFill,
                      { width: `${Math.min(selectedMarker.detection.confidence * 100, 100)}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
              )}
            </View>

            {/* Frequency */}
            <View style={styles.sheetStatItem}>
              <Text style={[styles.sheetStatLabel, { color: theme.textMuted }]}>{t.frequency || 'Frequency'}</Text>
              <Text style={[styles.freqValue, { color: theme.text }]}>
                {selectedMarker.detection?.frequencyPeaks?.[0]
                  ? `${(selectedMarker.detection.frequencyPeaks[0] / 1000).toFixed(1)}`
                  : 'N/A'}
              </Text>
              {selectedMarker.detection?.frequencyPeaks?.[0] && (
                <Text style={[styles.freqUnit, { color: theme.textDim }]}>kHz</Text>
              )}
            </View>
          </View>

          {/* Acoustic Signature — real spectral data from detection */}
          {selectedMarker.detection?.spectralSignature && selectedMarker.detection.spectralSignature.length > 0 && (
          <View style={styles.waveformSection}>
            <Text style={[styles.waveformLabel, { color: theme.textMuted }]}>{t.acousticSignature || 'Acoustic Signature'}</Text>
            <View style={styles.waveformContainer}>
              {(() => {
                const sig = selectedMarker.detection!.spectralSignature;
                const step = Math.max(1, Math.floor(sig.length / 24));
                const bars: number[] = [];
                for (let i = 0; i < sig.length && bars.length < 24; i += step) {
                  bars.push(Math.abs(sig[i]) || 0);
                }
                const maxVal = Math.max(...bars, 0.01);
                return bars.map((val, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        height: 4 + (val / maxVal) * 20,
                        opacity: 0.4 + (val / maxVal) * 0.5,
                        backgroundColor: theme.primary,
                      },
                    ]}
                  />
                ));
              })()}
            </View>
          </View>
          )}

          {/* Action Buttons */}
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.trackBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary, 10)]}
              onPress={() => {
                if (selectedMarker?.detection?.id) {
                  selectTrack(selectedMarker.detection.id);
                }
                handleDismissMarker();
              }}
              accessibilityRole="button"
              accessibilityLabel="Track this drone"
            >
              <Text style={[styles.trackBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.track || 'TRACK'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dismissBtn, { borderColor: theme.mode === 'DAY' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)' }]}
              onPress={() => {
                if (selectedMarker?.detection?.id) {
                  hideTrackFromMap(selectedMarker.detection.id);
                }
                handleDismissMarker();
              }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss this detection"
            >
              <Text style={[styles.dismissBtnText, { color: theme.textDim }]}>{t.dismiss || 'DISMISS'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },

  // ── Header ──────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: GLASS.panelBg,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.borderSubtle,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 200, 83, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C853',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#00C853',
  },

  // ── Empty State ─────────────────────────────────────
  emptyOverlay: {
    flex: 1,
    position: 'relative',
  },
  emptyBanner: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: GLASS.cardBg,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptySubText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.35)',
  },

  // ── Bottom Sheet ────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(20, 20, 30, 0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // ── Sheet Header ────────────────────────────────────
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sheetDroneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sheetDroneIcon: {
    fontSize: 32,
  },
  sheetDroneNameWrap: {
    flex: 1,
  },
  sheetDroneName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sheetCategoryBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 204, 0.3)',
    backgroundColor: 'rgba(0, 229, 204, 0.1)',
    alignSelf: 'flex-start',
  },
  sheetCategoryText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: GLASS.glowCyan,
  },
  sheetClose: {
    padding: 8,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },

  // ── Stats Row ───────────────────────────────────────
  sheetStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sheetStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sheetStatLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },

  // Distance — large emphasis
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  distanceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 36,
  },
  distanceSuffix: {
    paddingBottom: 4,
  },
  distanceUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  distanceDir: {
    fontSize: 12,
    fontWeight: '800',
    color: GLASS.glowCyan,
    letterSpacing: 0.5,
  },

  // Confidence
  confidenceValue: {
    fontSize: 28,
    fontWeight: '900',
    color: GLASS.glowCyan,
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  confidenceBarBg: {
    width: '80%',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: GLASS.glowCyan,
  },

  // Frequency
  freqValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  freqUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },

  // ── Waveform Placeholder ────────────────────────────
  waveformSection: {
    marginBottom: 16,
  },
  waveformLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 8,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 28,
    gap: 2,
    paddingHorizontal: 4,
  },
  waveformBar: {
    flex: 1,
    backgroundColor: '#00E5CC', // base color, overridden by theme in NIGHT mode
    borderRadius: 1,
    minWidth: 2,
  },

  // ── Action Buttons ──────────────────────────────────
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  trackBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    backgroundColor: '#00E5CC', // overridden inline with theme.primary if needed
  },
  trackBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  dismissBtnText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.8,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
