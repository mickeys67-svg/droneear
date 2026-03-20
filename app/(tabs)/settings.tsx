/**
 * Settings Screen - v4.0 (Glass Redesign)
 *
 * Design: 1.svg — sectioned glass cards
 * - APPEARANCE section: Theme toggle + Language
 * - DETECTION section: Sensitivity, threshold, toggles
 * - PROFILE section: Environment profiles (Urban/Rural/Indoor)
 * - ABOUT section: Model info, export, reset
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Switch } from 'react-native';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { DEVICE_PROFILES } from '@/src/constants/micConfig';
import { GLASS, glassStyles } from '@/src/constants/glass';
import type { DeviceProfile, ThemeMode, TacticalTheme } from '@/src/types';
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
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header — 2-tone brand + settings subtitle */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.brandText, { color: theme.text }]}>
              Drone<Text style={{ color: theme.primary }}>Ear</Text>
            </Text>
            <Text style={[styles.subtitle, { color: theme.textDim }]}>{t.settings}</Text>
          </View>
        </View>

        {/* ===== APPEARANCE ===== */}
        <View style={[glassStyles.card, styles.section]}>
          <Text style={[styles.sectionLabel, { color: theme.textDim }]}>{t.appearance || 'APPEARANCE'}</Text>

          {/* Theme Toggle */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>{t.displayTheme}</Text>
            <View style={styles.themeToggle}>
              {THEME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.themeChip,
                    settings.themeMode === opt.mode && { backgroundColor: theme.primary },
                    settings.themeMode !== opt.mode && { backgroundColor: GLASS.cardBg, borderColor: GLASS.borderSubtle, borderWidth: 1 },
                  ]}
                  onPress={() => settings.setThemeMode(opt.mode)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: settings.themeMode === opt.mode }}
                >
                  <Text style={[styles.themeChipText, { color: settings.themeMode === opt.mode ? (theme.mode === 'NIGHT' ? '#FFF' : '#000') : theme.textDim }]}>
                    {opt.mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Language */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>{t.language}</Text>
            <View style={styles.langRow}>
              {LANGUAGE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.locale}
                  style={[
                    styles.langChip,
                    settings.locale === opt.locale
                      ? { backgroundColor: `${theme.primary}20`, borderColor: `${theme.primary}60` }
                      : { backgroundColor: 'transparent', borderColor: GLASS.borderSubtle },
                  ]}
                  onPress={() => settings.setLocale(opt.locale)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: settings.locale === opt.locale }}
                >
                  <Text style={[styles.langText, { color: settings.locale === opt.locale ? theme.primary : theme.textDim }]}>
                    {opt.nativeLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ===== DETECTION ===== */}
        <View style={[glassStyles.card, styles.section]}>
          <Text style={[styles.sectionLabel, { color: theme.textDim }]}>{t.detection}</Text>

          {/* Confidence Threshold */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              {t.confidenceThreshold}
            </Text>
            <Text style={[styles.settingValue, { color: theme.primary }]}>
              {(settings.confidenceThreshold * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.thresholdRow}>
            {[0.5, 0.65, 0.75, 0.85, 0.95].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.thresholdChip,
                  settings.confidenceThreshold === val
                    ? { backgroundColor: theme.primary }
                    : { backgroundColor: 'transparent', borderColor: GLASS.borderSubtle, borderWidth: 1 },
                ]}
                onPress={() => settings.setConfidenceThreshold(val)}
                accessibilityRole="button"
                accessibilityLabel={`Confidence threshold ${(val * 100).toFixed(0)}%`}
                accessibilityState={{ selected: settings.confidenceThreshold === val }}
              >
                <Text style={[styles.thresholdText, { color: settings.confidenceThreshold === val ? (theme.mode === 'NIGHT' ? '#FFF' : '#000') : theme.textDim }]}>
                  {(val * 100).toFixed(0)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Toggle switches */}
          <ToggleRow label={t.hapticAlert} desc={t.vibrateOnDetection} value={settings.alertVibration} onToggle={settings.setAlertVibration} theme={theme} />
          <ToggleRow label={t.audioAlert} desc={t.playWarningSound} value={settings.alertSound} onToggle={settings.setAlertSound} theme={theme} />
          <ToggleRow label={t.voiceAlert} desc={t.voiceAnnouncement} value={settings.voiceAlert} onToggle={settings.setVoiceAlert} theme={theme} />
          <ToggleRow label={t.bleScan} desc={t.bleScanDesc} value={settings.bleScanEnabled ?? false} onToggle={settings.setBLEScanEnabled} theme={theme} />
        </View>

        {/* ===== PROFILE ===== */}
        <View style={[glassStyles.card, styles.section]}>
          <Text style={[styles.sectionLabel, { color: theme.textDim }]}>{t.profileSection || 'PROFILE'}</Text>
          <View style={styles.profileGrid}>
            {Object.entries(DEVICE_PROFILES).map(([key, config]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.profileCard,
                  {
                    backgroundColor: settings.profile === key ? `${theme.primary}12` : GLASS.cardBg,
                    borderColor: settings.profile === key ? `${theme.primary}50` : GLASS.borderSubtle,
                  },
                ]}
                onPress={() => settings.setProfile(key as DeviceProfile)}
                accessibilityRole="button"
                accessibilityLabel={`Device profile: ${config.label}`}
                accessibilityState={{ selected: settings.profile === key }}
              >
                {settings.profile === key && (
                  <View style={[styles.profileCheck, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.profileCheckText, { color: theme.mode === 'NIGHT' ? '#FFF' : '#000' }]}>✓</Text>
                  </View>
                )}
                <Text style={[styles.profileLabel, { color: settings.profile === key ? theme.primary : theme.text }]}>
                  {config.label}
                </Text>
                <Text style={[styles.profileDesc, { color: theme.textDim }]} numberOfLines={2}>
                  {config.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ===== ABOUT ===== */}
        <View style={[glassStyles.card, styles.section]}>
          <Text style={[styles.sectionLabel, { color: theme.textDim }]}>{t.aboutSection || 'ABOUT'}</Text>

          {/* Model Info */}
          <InfoRow label={t.modelLabel || 'Model'} value="DroneEar-YAMNet-v1" theme={theme} />
          <InfoRow label={t.quantizationLabel || 'Quantization'} value="INT8" theme={theme} />
          <InfoRow label={t.classesLabel || 'Classes'} value={t.patternsCount || '6 patterns'} theme={theme} />

          {/* Debug toggle */}
          <ToggleRow label={t.debugMode} desc={t.showInferenceMetrics} value={settings.debugMode} onToggle={settings.setDebugMode} theme={theme} />

          {/* Version */}
          <View style={[styles.versionRow, { borderTopColor: GLASS.borderSubtle }]}>
            <Text style={[styles.versionText, { color: theme.textMuted }]}>v2.1.0</Text>
          </View>
        </View>

        {/* Accuracy Disclaimer */}
        <View style={[styles.disclaimerBox, { borderTopColor: GLASS.borderSubtle }]}>
          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>{t.accuracyNote}</Text>
          <Text style={[styles.disclaimerText, { color: theme.textMuted, marginTop: 4 }]}>{t.mlDisclaimer}</Text>
        </View>

        {/* Reset Onboarding */}
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: GLASS.borderSubtle }]}
          onPress={() => settings.setOnboardingComplete(false)}
          accessibilityRole="button"
        >
          <Text style={[styles.resetBtnText, { color: theme.textMuted }]}>
            ↻ {t.resetOnboarding || 'Reset Onboarding'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== Sub-components =====

const ToggleRow: React.FC<{
  label: string; desc: string; value: boolean;
  onToggle: (val: boolean) => void; theme: TacticalTheme;
}> = ({ label, desc, value, onToggle, theme }) => (
  <View style={styles.toggleRow}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.toggleDesc, { color: theme.textDim }]}>{desc}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ true: theme.primary, false: GLASS.borderSubtle }}
      thumbColor={value ? (theme.mode === 'NIGHT' ? '#FFF' : '#000') : theme.textMuted}
    />
  </View>
);

const InfoRow: React.FC<{ label: string; value: string; theme: TacticalTheme }> = ({ label, value, theme }) => (
  <View style={styles.infoRow}>
    <Text style={[styles.infoLabel, { color: theme.textDim }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
  </View>
);

// ===== Styles =====
const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20 },

  // Header
  header: { marginBottom: 24, marginTop: 10 },
  brandText: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  subtitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 2 },

  // Section card
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },

  // Settings rows
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  settingLabel: { fontSize: 14, fontWeight: '600' },
  settingValue: { fontSize: 16, fontWeight: '800' },

  // Theme toggle
  themeToggle: { flexDirection: 'row', gap: 6 },
  themeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, minHeight: 44 },
  themeChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Language chips
  langRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  langChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, minHeight: 44 },
  langText: { fontSize: 13, fontWeight: '600' },

  // Threshold chips
  thresholdRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  thresholdChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, minHeight: 44 },
  thresholdText: { fontSize: 12, fontWeight: '700' },

  // Toggle rows
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: GLASS.borderSubtle },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 11, marginTop: 2 },

  // Profile grid
  profileGrid: { gap: 8 },
  profileCard: { padding: 14, borderRadius: 12, borderWidth: 1, position: 'relative' },
  profileLabel: { fontSize: 14, fontWeight: '700' },
  profileDesc: { fontSize: 11, marginTop: 4, lineHeight: 16 },
  profileCheck: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  profileCheckText: { fontSize: 12, fontWeight: '900' },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: 12, fontWeight: '500' },
  infoValue: { fontSize: 12, fontWeight: '700' },

  // Version
  versionRow: { borderTopWidth: 0.5, paddingTop: 12, marginTop: 8, alignItems: 'center' },
  versionText: { fontSize: 12, fontWeight: '600' },

  // Disclaimer
  disclaimerBox: { borderTopWidth: 0.5, paddingTop: 16, marginTop: 8, marginBottom: 8 },
  disclaimerText: { fontSize: 10, lineHeight: 14, fontStyle: 'italic', textAlign: 'center' },

  // Reset button
  resetBtn: { marginTop: 12, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  resetBtnText: { fontSize: 12, fontWeight: '600' },
});
