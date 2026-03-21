/**
 * Main Detection Screen - v5.0 (Decomposed)
 *
 * Design: 9.svg + AA.svg tone & manner
 * - Glassmorphism cards + blur backgrounds
 * - 2-tone brand logo (Drone=white, Ear=cyan)
 * - Large stat numbers (36-48px)
 * - Cyan glow scan button
 * - Glass mic quality bar
 * - Glass threat summary cards
 *
 * v5.0: Extracted sub-components for maintainability
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  SafeAreaView, StatusBar, Linking,
  PermissionsAndroid, Platform, AppState,
} from 'react-native';
import { Audio } from 'expo-av';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/hooks/useTheme';
import { useThreatDetector } from '@/src/hooks/useThreatDetector';
import { TacticalRadar } from '@/src/components/radar/TacticalRadar';
import { TacticalSpectrogram } from '@/src/components/spectrogram/TacticalSpectrogram';
import { ThreatAlert } from '@/src/components/alerts/ThreatAlert';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTranslation } from '@/src/i18n/useTranslation';
import { EnvironmentWarningBanner } from '@/src/components/alerts/EnvironmentWarningBanner';
import { GLASS, glassStyles } from '@/src/constants/glass';
import { TrackingOverlay } from '@/src/components/TrackingOverlay';
import { useDetectionStore } from '@/src/stores/detectionStore';

// Extracted sub-components
import { MicPermissionOverlay } from '@/src/components/scan/MicPermissionOverlay';
import { ModelLoadingCard } from '@/src/components/scan/ModelLoadingCard';
import { EngineErrorCard } from '@/src/components/scan/EngineErrorCard';
import { MicQualityPanel } from '@/src/components/scan/MicQualityPanel';
import { SensorIssuesPanel } from '@/src/components/scan/SensorIssuesPanel';
import { ScanButton } from '@/src/components/scan/ScanButton';
import { FeedbackPrompt } from '@/src/components/scan/FeedbackPrompt';
import { ActiveThreatsList } from '@/src/components/scan/ActiveThreatsList';

import type { TacticalTheme } from '@/src/types';

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

  const activeThreats = currentThreats.filter((tr) => tr.isActive);

  // Track selection from store
  const selectedTrackId = useDetectionStore((s) => s.selectedTrackId);
  const selectTrack = useDetectionStore((s) => s.selectTrack);
  const feedbackDetectionId = useDetectionStore((s) => s.feedbackDetectionId);

  // Derive tracking data from selected track (FIX-C1: guard empty detections)
  const trackedTrack = selectedTrackId
    ? activeThreats.find((tr) => tr.id === selectedTrackId)
    : null;
  const trackedDetection = trackedTrack?.detections?.length
    ? trackedTrack.detections[trackedTrack.detections.length - 1]
    : null;

  // Auto-clear selected track if it becomes inactive (FIX-C5)
  useEffect(() => {
    if (selectedTrackId && !trackedTrack) {
      selectTrack(null);
    }
  }, [selectedTrackId, trackedTrack, selectTrack]);

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

  // Mic permission state for full-screen overlay
  const [micPermissionBlocked, setMicPermissionBlocked] = useState(false);

  useEffect(() => {
    const checkMicPermission = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        setMicPermissionBlocked(!granted);
      }
      if (Platform.OS === 'ios') {
        try {
          const { status } = await Audio.getPermissionsAsync();
          setMicPermissionBlocked(status !== 'granted');
        } catch {
          setMicPermissionBlocked(false);
        }
      }
    };
    checkMicPermission();

    // FIX-C3: Re-check on app resume (user may grant in system Settings)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkMicPermission();
    });
    return () => sub.remove();
  }, []);

  const handleScanToggle = useCallback(() => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning();
    }
  }, [isScanning, startScanning, stopScanning]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'DAY' ? 'dark-content' : 'light-content'} backgroundColor={theme.background} />

      {/* Full-screen mic permission blocked overlay */}
      {micPermissionBlocked && (
        <MicPermissionOverlay onDismiss={() => setMicPermissionBlocked(false)} />
      )}

      {/* Tracking Overlay — shown when a track is selected */}
      {!micPermissionBlocked && !isLoading && !(isError && !isScanning) && trackedDetection && trackedTrack && (
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

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header — 2-tone brand + glass badges */}
        <View style={styles.header}>
          <Text style={[styles.brandText, { color: theme.text }]} accessibilityRole="header">
            Drone<Text style={{ color: theme.primary }}>Ear</Text>
          </Text>
          <View style={styles.headerRight}>
            {isScanning && (
              <View style={[styles.glassBadge, { borderColor: `${theme.primary}40`, backgroundColor: `${theme.primary}10` }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>
                  {formatTime(scanSeconds)}
                </Text>
              </View>
            )}
            <View style={[styles.glassBadge, {
              backgroundColor: isScanning ? `${theme.primary}12` : isError ? `${theme.danger}12` : GLASS.cardBg,
              borderColor: isScanning ? `${theme.primary}40` : isError ? `${theme.danger}40` : GLASS.borderSubtle,
            }]}>
              <View style={[styles.statusDot, { backgroundColor: isScanning ? theme.primary : isError ? theme.danger : theme.textMuted }]} />
              <Text style={[styles.badgeText, { color: isError ? theme.danger : isScanning ? theme.primary : theme.textDim }]}>
                {isLoading ? t.loading : isError ? t.error : isScanning ? t.scanning : t.standby}
              </Text>
            </View>
          </View>
        </View>

        {/* Model Loading */}
        {!micPermissionBlocked && isLoading && <ModelLoadingCard />}

        {/* Engine Error */}
        {!micPermissionBlocked && isError && !isScanning && (
          <EngineErrorCard onRetry={() => startScanning()} />
        )}

        {/* Unified Warning Banner */}
        <EnvironmentWarningBanner
          environmentState={environmentState}
          micPermissionDenied={isError || sensorState.microphone === 'DENIED'}
          isScanning={isScanning}
          onRequestMicPermission={() => startScanning()}
          onOpenSettings={() => Linking.openSettings()}
        />

        {/* Mic Quality Monitor */}
        {isScanning && (
          <MicQualityPanel
            micQuality={micQuality}
            micSnrDb={micSnrDb}
            micWarning={micWarning}
          />
        )}

        {/* Sensor Enforcement Status */}
        {isScanning && sensorIssues.length > 0 && (
          <SensorIssuesPanel issues={sensorIssues} />
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
          <View style={[glassStyles.card, styles.debugPanel]}>
            <DebugItem label="Model" value={modelStatus} color={theme} />
            <DebugItem label="Inference" value={`${inferenceTimeMs.toFixed(1)}ms`} color={theme} />
            <DebugItem label="RMS" value={audioLevel.toFixed(3)} color={theme} />
            <DebugItem label="Tracks" value={String(activeThreats.length)} color={theme} />
            <DebugItem label="Time" value={formatTime(scanSeconds)} color={theme} />
            <DebugItem label="Batt" value={`${batteryLevel}%`} color={theme} />
          </View>
        )}

        {/* Scan Control Button */}
        <ScanButton
          isScanning={isScanning}
          isLoading={isLoading}
          isError={isError}
          disabled={micPermissionBlocked}
          onToggle={handleScanToggle}
        />

        {/* Detection Alert with Feedback */}
        {latestDetection && (
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <ThreatAlert
              detection={latestDetection}
              onAcknowledge={acknowledgeDetection}
              onTrack={(det) => {
                acknowledgeDetection();
                selectTrack(det.id);
              }}
            />
            <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
              {t.distanceDisclaimer}
            </Text>
          </Animated.View>
        )}

        {/* Detection Feedback Prompt */}
        {feedbackPending && !latestDetection && (
          <FeedbackPrompt detectionId={feedbackDetectionId} onSubmit={submitFeedback} />
        )}

        {/* Active Detections Summary */}
        {activeThreats.length > 0 && (
          <ActiveThreatsList
            activeThreats={activeThreats}
            onSelectTrack={selectTrack}
          />
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const DebugItem: React.FC<{ label: string; value: string; color: TacticalTheme }> = ({ label, value, color }) => (
  <View style={styles.debugItem}>
    <Text style={[styles.debugLabel, { color: color.textMuted }]}>{label}</Text>
    <Text style={[styles.debugValue, { color: color.textDim }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 16, paddingBottom: 100 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  brandText: { fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  glassBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

  // Radar
  radarSection: { alignItems: 'center', marginVertical: 20 },
  scanStatus: { fontSize: 14, fontWeight: '800', letterSpacing: 2.5, marginTop: 14, textTransform: 'uppercase' },

  // Debug panel
  debugPanel: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, flexWrap: 'wrap' },
  debugItem: { alignItems: 'center', minWidth: 55 },
  debugLabel: { fontSize: 10, letterSpacing: 0.5 },
  debugValue: { fontSize: 13, fontWeight: '700', marginTop: 2 },

  // Disclaimer
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic', paddingHorizontal: 16, lineHeight: 18 },
});
