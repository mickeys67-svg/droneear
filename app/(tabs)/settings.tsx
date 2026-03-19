/**
 * Settings Screen - v3.0
 *
 * Added:
 * - Language selection (KO/EN/UK)
 * - Voice alert toggle
 * - Accuracy disclaimers
 * - Reset onboarding button
 * - i18n throughout
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Switch } from 'react-native';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { DEVICE_PROFILES } from '@/src/constants/micConfig';
import type { DeviceProfile, ThemeMode } from '@/src/types';
import type { SupportedLocale } from '@/src/i18n/translations';

const LANGUAGE_OPTIONS: { locale: SupportedLocale; label: string; nativeLabel: string }[] = [
  { locale: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { locale: 'en', label: 'English', nativeLabel: 'English' },
  { locale: 'uk', label: 'Ukrainian', nativeLabel: 'Українська' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const t = useTranslation();
  const settings = useSettingsStore();

  const THEME_OPTIONS: { mode: ThemeMode; label: string; description: string }[] = [
    { mode: 'DAY', label: t.dayMode, description: t.dayModeDesc },
    { mode: 'NIGHT', label: t.nightMode, description: t.nightModeDesc },
    { mode: 'AMOLED', label: t.amoledMode, description: t.amoledModeDesc },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>{t.settings}</Text>

        {/* Language Selection */}
        <SectionTitle text={t.language} color={theme.textDim} />
        <View style={styles.langRow}>
          {LANGUAGE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.locale}
              style={[
                styles.langChip,
                {
                  backgroundColor: settings.locale === opt.locale ? theme.primary : theme.surface,
                  borderColor: settings.locale === opt.locale ? theme.primary : theme.border,
                },
              ]}
              onPress={() => settings.setLocale(opt.locale)}
              accessibilityLabel={opt.label}
            >
              <Text
                style={[
                  styles.langText,
                  { color: settings.locale === opt.locale ? '#000' : theme.textDim },
                ]}
              >
                {opt.nativeLabel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Theme Selection */}
        <SectionTitle text={t.displayTheme} color={theme.textDim} />
        {THEME_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.mode}
            style={[
              styles.optionCard,
              { backgroundColor: theme.surface, borderColor: settings.themeMode === opt.mode ? theme.primary : theme.border },
            ]}
            onPress={() => settings.setThemeMode(opt.mode)}
          >
            <Text style={[styles.optionLabel, { color: settings.themeMode === opt.mode ? theme.primary : theme.text }]}>
              {opt.label}
            </Text>
            <Text style={[styles.optionDesc, { color: theme.textDim }]}>{opt.description}</Text>
          </TouchableOpacity>
        ))}

        {/* Microphone Profile */}
        <SectionTitle text={t.acousticProfile} color={theme.textDim} />
        {Object.entries(DEVICE_PROFILES).map(([key, config]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.optionCard,
              { backgroundColor: theme.surface, borderColor: settings.profile === key ? theme.primary : theme.border },
            ]}
            onPress={() => settings.setProfile(key as DeviceProfile)}
          >
            <Text style={[styles.optionLabel, { color: settings.profile === key ? theme.primary : theme.text }]}>
              {config.label}
            </Text>
            <Text style={[styles.optionDesc, { color: theme.textDim }]}>
              {config.sampleRate / 1000}kHz | {config.channels}ch | Gain {config.gainMultiplier}x
            </Text>
          </TouchableOpacity>
        ))}

        {/* Detection Settings */}
        <SectionTitle text={t.detection} color={theme.textDim} />
        <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>{t.hapticAlert}</Text>
            <Text style={[styles.switchDesc, { color: theme.textDim }]}>{t.vibrateOnDetection}</Text>
          </View>
          <Switch
            value={settings.alertVibration}
            onValueChange={settings.setAlertVibration}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>
        <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>{t.audioAlert}</Text>
            <Text style={[styles.switchDesc, { color: theme.textDim }]}>{t.playWarningSound}</Text>
          </View>
          <Switch
            value={settings.alertSound}
            onValueChange={settings.setAlertSound}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>
        <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>{t.voiceAlert}</Text>
            <Text style={[styles.switchDesc, { color: theme.textDim }]}>{t.voiceAnnouncement}</Text>
          </View>
          <Switch
            value={settings.voiceAlert}
            onValueChange={settings.setVoiceAlert}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>
        <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>{t.debugMode}</Text>
            <Text style={[styles.switchDesc, { color: theme.textDim }]}>{t.showInferenceMetrics}</Text>
          </View>
          <Switch
            value={settings.debugMode}
            onValueChange={settings.setDebugMode}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>

        {/* Confidence Threshold */}
        <SectionTitle text={`${t.confidenceThreshold}: ${(settings.confidenceThreshold * 100).toFixed(0)}%`} color={theme.textDim} />
        <View style={styles.thresholdRow}>
          {[0.5, 0.65, 0.75, 0.85, 0.95].map((val) => (
            <TouchableOpacity
              key={val}
              style={[
                styles.thresholdChip,
                {
                  backgroundColor: settings.confidenceThreshold === val ? theme.primary : theme.surface,
                  borderColor: settings.confidenceThreshold === val ? theme.primary : theme.border,
                },
              ]}
              onPress={() => settings.setConfidenceThreshold(val)}
            >
              <Text
                style={[
                  styles.thresholdText,
                  { color: settings.confidenceThreshold === val ? '#000' : theme.textDim },
                ]}
              >
                {(val * 100).toFixed(0)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Model Info */}
        <SectionTitle text={t.mlModel} color={theme.textDim} />
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <InfoRow label="Model" value="DroneEar-YAMNet-v1" color={theme} />
          <InfoRow label="Quantization" value="INT8" color={theme} />
          <InfoRow label="Classes" value="6 (Drone/Heli/Jet/Aircraft/Ambient)" color={theme} />
          <InfoRow label="Input" value="96x128 Mel Spectrogram" color={theme} />
        </View>

        {/* Accuracy Disclaimer */}
        <View style={[styles.disclaimerBox, { borderColor: theme.border }]}>
          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>{t.accuracyNote}</Text>
          <Text style={[styles.disclaimerText, { color: theme.textMuted, marginTop: 4 }]}>{t.mlDisclaimer}</Text>
        </View>

        {/* Reset Onboarding */}
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: theme.border }]}
          onPress={() => settings.setOnboardingComplete(false)}
          accessibilityRole="button"
          accessibilityLabel="Reset onboarding"
        >
          <Text style={[styles.resetBtnText, { color: theme.textMuted }]}>
            {`↻ ${t.onboardingWelcome}`}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SectionTitle: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <Text style={[styles.sectionTitle, { color }]}>{text}</Text>
);

const InfoRow: React.FC<{ label: string; value: string; color: any }> = ({ label, value, color }) => (
  <View style={styles.infoRow}>
    <Text style={[styles.infoLabel, { color: color.textDim }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: color.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 20, marginTop: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  langChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, minHeight: 44 },
  langText: { fontSize: 14, fontWeight: '700' },
  optionCard: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  optionLabel: { fontSize: 14, fontWeight: '700' },
  optionDesc: { fontSize: 11, marginTop: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  switchDesc: { fontSize: 11, marginTop: 2 },
  thresholdRow: { flexDirection: 'row', gap: 8 },
  thresholdChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, minHeight: 44 },
  thresholdText: { fontSize: 13, fontWeight: '700' },
  infoCard: { padding: 14, borderRadius: 10, borderWidth: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 11, fontWeight: '500' },
  infoValue: { fontSize: 12, fontWeight: '600' },
  disclaimerBox: { borderTopWidth: 1, paddingTop: 16, marginTop: 20 },
  disclaimerText: { fontSize: 11, lineHeight: 16, fontStyle: 'italic', textAlign: 'center' },
  resetBtn: { marginTop: 20, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  resetBtnText: { fontSize: 12, fontWeight: '600' },
});
