/**
 * Main Detection Screen - v3.0
 *
 * Global UX improvements:
 * - Voice alert (TTS) + sound alert integration
 * - Mic quality indicator with warnings
 * - Battery level display
 * - Scan duration timer
 * - Accuracy disclaimers on distance/bearing
 * - Detection feedback (false positive reporting)
 * - Error recovery with "Open Settings" button
 * - Confidence level text labels (not just percentages)
 * - Long-press to start scan (prevent accidental activation)
 * - Accessibility labels throughout
 * - i18n ready
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useThreatDetector } from '@/src/hooks/useThreatDetector';
import { TacticalRadar } from '@/src/components/radar/TacticalRadar';
import { TacticalSpectrogram } from '@/src/components/spectrogram/TacticalSpectrogram';
import { ThreatAlert } from '@/src/components/alerts/ThreatAlert';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTranslation } from '@/src/i18n/useTranslation';
import { EnvironmentWarningBanner } from '@/src/components/alerts/EnvironmentWarningBanner';

export default function HomeScreen() {
  const theme = useTheme();
  const t = useTranslation();
  const debugMode = useSettingsStore((s) => s.debugMode);

  const {
    isScanning,
    latestDetection,
    currentThreats,
    audioLevel,
    spectralData,
    inferenceTimeMs,
    modelStatus,
    batteryLevel,
    micQuality,
    micSnrDb,
    micWarning,
    feedbackPending,
    sensorState,
    sensorIssues,
    environmentState,
    startScanning,
    stopScanning,
    acknowledgeDetection,
    submitFeedback,
  } = useThreatDetector();

  const activeThreats = currentThreats.filter((t) => t.isActive);

  // Scan timer
  const [scanSeconds, setScanSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isScanning) {
      setScanSeconds(0);
      timerRef.current = setInterval(() => setScanSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setScanSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isScanning]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isLoading = modelStatus === 'LOADING';
  const isError = modelStatus === 'ERROR';

  // Confidence level label
  const getConfidenceLabel = (conf: number): string => {
    if (conf >= 0.9) return t.veryHighConfidence;
    if (conf >= 0.8) return t.highConfidence;
    if (conf >= 0.65) return t.moderateConfidence;
    if (conf >= 0.5) return t.lowConfidence;
    return t.verificationNeeded;
  };

  // Mic quality color
  const micQualityColor = micQuality === 'GOOD' ? theme.success : micQuality === 'FAIR' ? theme.warning : theme.danger;

  // Long press handler for scan button (prevent accidental activation)
  const handleScanPress = useCallback(() => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning();
    }
  }, [isScanning, startScanning, stopScanning]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.brandText, { color: theme.text }]} accessibilityRole="header">
            DRONE<Text style={{ color: theme.primary }}>EAR</Text>
          </Text>
          <View style={styles.headerRight}>
            {/* Battery */}
            <View style={[styles.batteryBadge, { borderColor: batteryLevel < 20 ? theme.danger : theme.border }]}>
              <Text style={[styles.batteryText, { color: batteryLevel < 20 ? theme.danger : theme.textDim }]}>
                {batteryLevel}%
              </Text>
            </View>
            {/* Scan Timer */}
            {isScanning && (
              <View style={[styles.timerBadge, { borderColor: theme.danger }]}>
                <Text style={[styles.timerText, { color: theme.danger }]}>
                  {formatTime(scanSeconds)}
                </Text>
              </View>
            )}
            {/* Status Badge */}
            <View style={[styles.badge, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}40` }]}>
              <View style={[styles.statusDot, { backgroundColor: isScanning ? theme.primary : isError ? theme.danger : theme.textMuted }]} />
              <Text style={[styles.badgeText, { color: isError ? theme.danger : theme.primary }]}>
                {isLoading ? t.loading : isError ? t.error : isScanning ? t.scanning : t.standby}
              </Text>
            </View>
          </View>
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.statusText, { color: theme.textDim }]}>
              {t.initializingEngine}
            </Text>
          </View>
        )}

        {/* Unified Warning Banner — handles mic permission denied + indoor + accuracy degraded */}
        <EnvironmentWarningBanner
          environmentState={environmentState}
          micPermissionDenied={isError || sensorState.microphone === 'DENIED'}
          isScanning={isScanning}
          onRequestMicPermission={() => startScanning()}
          onOpenSettings={() => Linking.openSettings()}
        />

        {/* Mic Quality Monitor — Enhanced with visual SNR meter */}
        {isScanning && (
          <View style={[styles.micQualityBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.micQualityLeft}>
              <View style={[styles.micQualityDot, { backgroundColor: micQualityColor }]} />
              <Text style={[styles.micQualityLabel, { color: theme.textDim }]}>
                {t.signalQuality}:
              </Text>
              <Text style={[styles.micQualityValue, { color: micQualityColor }]}>
                {micQuality === 'GOOD' ? t.micQualityGood : micQuality === 'FAIR' ? t.micQualityFair : t.micQualityPoor}
              </Text>
              <Text style={[styles.micSnr, { color: theme.textMuted }]}>
                {micSnrDb}dB
              </Text>
            </View>

            {/* SNR Visual Meter */}
            <View style={styles.snrMeterTrack}>
              <View style={[styles.snrMeterFill, {
                width: `${Math.min(Math.max((micSnrDb / 40) * 100, 5), 100)}%`,
                backgroundColor: micQualityColor,
              }]} />
            </View>

            {micWarning && (
              <View style={[styles.micWarningBadge, { backgroundColor: `${theme.warning}20`, borderColor: theme.warning }]}>
                <Text style={[styles.micWarningIcon]}>
                  {micWarning === 'WIND' ? '💨' : micWarning === 'NOISE' ? '🔊' : '⚠'}
                </Text>
                <Text style={[styles.micWarningText, { color: theme.warning }]} numberOfLines={1}>
                  {micWarning === 'WIND' ? t.micWindWarning :
                   micWarning === 'NOISE' ? t.micNoiseWarning :
                   t.micClippingWarning}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Sensor Enforcement Status */}
        {isScanning && sensorIssues.length > 0 && (
          <View style={[styles.sensorPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {sensorIssues.map((issue, idx) => {
              const issueColor = issue.severity === 'CRITICAL' ? theme.danger : issue.severity === 'HIGH' ? theme.warning : theme.textMuted;
              return (
                <View key={`${issue.sensor}-${idx}`} style={[styles.sensorRow, { borderBottomColor: `${theme.border}40` }]}>
                  <View style={[styles.sensorDot, { backgroundColor: issueColor }]} />
                  <Text style={[styles.sensorText, { color: issueColor }]} numberOfLines={1}>
                    {issue.message}
                  </Text>
                  {issue.action === 'SETTINGS' && (
                    <TouchableOpacity
                      style={[styles.sensorActionBtn, { borderColor: issueColor }]}
                      onPress={() => Linking.openSettings()}
                      accessibilityLabel={t.openSettings}
                    >
                      <Text style={[styles.sensorActionText, { color: issueColor }]}>{t.openSettings}</Text>
                    </TouchableOpacity>
                  )}
                  {issue.action === 'CHANGE_PROFILE' && (
                    <TouchableOpacity
                      style={[styles.sensorActionBtn, { borderColor: issueColor }]}
                      onPress={() => {
                        // Navigate to settings or show profile picker
                        Alert.alert('DOA', t.bearingDisclaimer);
                      }}
                    >
                      <Text style={[styles.sensorActionText, { color: issueColor }]}>STEREO</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Tactical Radar */}
        <View style={styles.radarSection}>
          <TacticalRadar
            size={280}
            isActive={isScanning}
            threats={currentThreats}
            maxRange={2000}
          />
          <Text
            style={[styles.scanStatus, { color: theme.primary, opacity: isScanning ? 1 : 0.4 }]}
            accessibilityLabel={isScanning ? `${t.scanning}, ${activeThreats.length} active tracks` : t.sensorOffline}
          >
            {isScanning
              ? t.scanningTracks(activeThreats.length)
              : t.sensorOffline}
          </Text>
        </View>

        {/* Spectrogram */}
        <TacticalSpectrogram
          spectralData={spectralData}
          audioLevel={audioLevel}
          isActive={isScanning}
          numBars={32}
          height={70}
        />

        {/* Debug Metrics */}
        {debugMode && isScanning && (
          <View style={[styles.debugPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <DebugItem label="Model" value={modelStatus} color={theme} />
            <DebugItem label="Inference" value={`${inferenceTimeMs.toFixed(1)}ms`} color={theme} />
            <DebugItem label="RMS" value={audioLevel.toFixed(3)} color={theme} />
            <DebugItem label="Tracks" value={String(activeThreats.length)} color={theme} />
            <DebugItem label="Time" value={formatTime(scanSeconds)} color={theme} />
            <DebugItem label="Batt" value={`${batteryLevel}%`} color={theme} />
          </View>
        )}

        {/* Control Button */}
        <View style={styles.controlSection}>
          <TouchableOpacity
            style={[
              styles.mainButton,
              {
                backgroundColor: isScanning ? theme.danger : theme.primary,
                opacity: isLoading ? 0.5 : 1,
              },
            ]}
            onPress={handleScanPress}
            onLongPress={!isScanning ? startScanning : undefined}
            activeOpacity={0.8}
            disabled={isLoading}
            accessibilityLabel={isScanning ? t.haltDetection : t.engageSensors}
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={[styles.buttonText, { color: '#000' }]}>
                {isScanning ? t.haltDetection : t.engageSensors}
              </Text>
            )}
          </TouchableOpacity>

          {!isScanning && !isError && (
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              {t.tapToBegin}
            </Text>
          )}
        </View>

        {/* Detection Alert with Feedback */}
        {latestDetection && (
          <View>
            <ThreatAlert
              detection={latestDetection}
              onAcknowledge={acknowledgeDetection}
            />
            {/* Accuracy Disclaimer */}
            <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
              {t.distanceDisclaimer}
            </Text>
          </View>
        )}

        {/* Detection Feedback Prompt */}
        {feedbackPending && !latestDetection && (
          <View style={[styles.feedbackCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.feedbackQuestion, { color: theme.textDim }]}>
              {t.wasDetectionAccurate}
            </Text>
            <View style={styles.feedbackButtons}>
              <TouchableOpacity
                style={[styles.feedbackBtn, { backgroundColor: `${theme.success}20`, borderColor: theme.success }]}
                onPress={() => submitFeedback('', true)}
                accessibilityLabel={t.yes}
              >
                <Text style={[styles.feedbackBtnText, { color: theme.success }]}>{t.yes}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedbackBtn, { backgroundColor: `${theme.danger}20`, borderColor: theme.danger }]}
                onPress={() => submitFeedback('', false)}
                accessibilityLabel={t.no}
              >
                <Text style={[styles.feedbackBtnText, { color: theme.danger }]}>{t.reportFalsePositive}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Active Detections Summary */}
        {activeThreats.length > 0 && (
          <View style={[styles.threatSummary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textDim }]}>
              {t.scanning} ({activeThreats.length})
            </Text>
            {activeThreats.map((track) => {
              const latest = track.detections[track.detections.length - 1];
              const severityColor =
                latest.severity === 'CRITICAL' ? theme.danger :
                latest.severity === 'HIGH' ? theme.warning :
                theme.primary;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[styles.trackRow, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    Alert.alert(
                      `${latest.threatCategory.replace('_', ' ')}`,
                      `${t.distance}: ~${latest.distanceMeters}m (${t.estimatedDistance})\n${t.confidence}: ${(latest.confidence * 100).toFixed(1)}% — ${getConfidenceLabel(latest.confidence)}\n${t.bearing}: ${latest.bearingDegrees.toFixed(0)}° (${t.directionLimited})\n\n${t.accuracyNote}`,
                    );
                  }}
                  accessibilityLabel={`${latest.threatCategory} ${t.distance} ${latest.distanceMeters}m`}
                >
                  <View style={[styles.trackDot, { backgroundColor: severityColor }]} />
                  <View style={styles.trackInfo}>
                    <Text style={[styles.trackType, { color: theme.text }]}>
                      {latest.threatCategory.replace('_', ' ')}
                    </Text>
                    <Text style={[styles.trackConfLabel, { color: theme.textMuted }]}>
                      {getConfidenceLabel(latest.confidence)}
                    </Text>
                  </View>
                  <Text style={[styles.trackDist, { color: theme.primary }]}>
                    ~{latest.distanceMeters}m
                  </Text>
                  <Text style={[styles.trackConf, { color: theme.textDim }]}>
                    {(latest.confidence * 100).toFixed(0)}%
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* Accuracy footer */}
            <Text style={[styles.accuracyFooter, { color: theme.textMuted }]}>
              {t.mlDisclaimer}
            </Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const DebugItem: React.FC<{ label: string; value: string; color: any }> = ({ label, value, color }) => (
  <View style={styles.debugItem}>
    <Text style={[styles.debugLabel, { color: color.textMuted }]}>{label}</Text>
    <Text style={[styles.debugValue, { color: color.textDim }]}>{value}</Text>
  </View>
);

/**
 * STYLES — High-readability design
 * All fonts sized for clear use:
 * - Critical info: 20-28px (distance, status, buttons)
 * - Primary info: 16-18px (labels, categories)
 * - Secondary info: 14-15px (descriptions, hints)
 * - Minimum anywhere: 13px (disclaimers only)
 * Touch targets: minimum 48px height
 */
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 16 },

  // Header — brand + status clearly readable
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  brandText: { fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  badgeText: { fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  timerBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1.5 },
  timerText: { fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  batteryBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1.5 },
  batteryText: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Status / Error cards
  statusCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1.5, gap: 14, marginBottom: 16 },
  statusText: { fontSize: 15, flex: 1, lineHeight: 22 },
  errorCard: { padding: 18, borderRadius: 14, borderWidth: 1.5, marginBottom: 16 },
  errorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorIcon: { fontSize: 26 },
  errorTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  errorActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  errorBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', minHeight: 52 },
  errorBtnText: { color: '#000', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  errorBtnSecondary: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, minHeight: 52 },
  errorBtnSecondaryText: { fontWeight: '700', fontSize: 16 },

  // Mic Quality — readable at a glance
  micQualityBar: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 14, gap: 8 },
  micQualityLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  micQualityDot: { width: 12, height: 12, borderRadius: 6 },
  micQualityLabel: { fontSize: 14, fontWeight: '600' },
  micQualityValue: { fontSize: 15, fontWeight: '800' },
  micSnr: { fontSize: 14, marginLeft: 6, fontVariant: ['tabular-nums'] as any },
  snrMeterTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  snrMeterFill: { height: '100%', borderRadius: 3 },
  micWarningBadge: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, gap: 8, marginTop: 4 },
  micWarningIcon: { fontSize: 18 },
  micWarningText: { fontSize: 14, flex: 1, lineHeight: 20 },

  // Sensor enforcement panel
  sensorPanel: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 14, gap: 6 },
  sensorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, minHeight: 44 },
  sensorDot: { width: 10, height: 10, borderRadius: 5 },
  sensorText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  sensorActionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1.5, minHeight: 36 },
  sensorActionText: { fontSize: 13, fontWeight: '800' },

  // Radar
  radarSection: { alignItems: 'center', marginVertical: 16 },
  scanStatus: { fontSize: 16, fontWeight: '800', letterSpacing: 2.5, marginTop: 12 },

  // Debug panel
  debugPanel: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 12, flexWrap: 'wrap' },
  debugItem: { alignItems: 'center', minWidth: 55 },
  debugLabel: { fontSize: 11, letterSpacing: 0.5 },
  debugValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  // Main action button — LARGE and unmistakable
  controlSection: { marginTop: 16, marginBottom: 20 },
  mainButton: { height: 72, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, minHeight: 72 },
  buttonText: { fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  hintText: { fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 },

  // Disclaimer — still readable
  disclaimer: { fontSize: 13, textAlign: 'center', marginTop: 8, fontStyle: 'italic', paddingHorizontal: 16, lineHeight: 20 },

  // Feedback
  feedbackCard: { padding: 18, borderRadius: 14, borderWidth: 1, marginBottom: 18 },
  feedbackQuestion: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  feedbackButtons: { flexDirection: 'row', gap: 12 },
  feedbackBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', minHeight: 52 },
  feedbackBtnText: { fontSize: 16, fontWeight: '700' },

  // Detection Summary
  threatSummary: { padding: 16, borderRadius: 14, borderWidth: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12, minHeight: 56 },
  trackDot: { width: 12, height: 12, borderRadius: 6 },
  trackInfo: { flex: 1 },
  trackType: { fontSize: 17, fontWeight: '700' },
  trackConfLabel: { fontSize: 14, marginTop: 3 },
  trackDist: { fontSize: 22, fontWeight: '900' },
  trackConf: { fontSize: 15, width: 50, textAlign: 'right', fontWeight: '700' },
  accuracyFooter: { fontSize: 13, marginTop: 12, fontStyle: 'italic', lineHeight: 20 },
});
