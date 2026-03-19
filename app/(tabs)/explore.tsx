/**
 * Guide / Help Screen
 *
 * Replaces the old Expo boilerplate "Explore" tab.
 * Provides comprehensive usage guide, tips, and limitations.
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';

export default function GuideScreen() {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>{t.guideTitle}</Text>

        {/* Radar Guide */}
        <GuideSection
          title={t.guideRadarTitle}
          icon="📡"
          description={t.guideRadarDesc}
          theme={theme}
        />

        {/* Spectrogram Guide */}
        <GuideSection
          title={t.guideSpecTitle}
          icon="📊"
          description={t.guideSpecDesc}
          theme={theme}
        />

        {/* Alert Guide */}
        <GuideSection
          title={t.guideAlertTitle}
          icon="🔔"
          description={t.guideAlertDesc}
          theme={theme}
        />

        {/* Best Practices */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>
            💡 {t.guideTipsTitle}
          </Text>
          <BulletItem text={t.guideTip1} theme={theme} />
          <BulletItem text={t.guideTip2} theme={theme} />
          <BulletItem text={t.guideTip3} theme={theme} />
          <BulletItem text={t.guideTip4} theme={theme} />
        </View>

        {/* Detection Limitations */}
        <View style={[styles.section, { backgroundColor: `${theme.warning}10`, borderColor: theme.warning }]}>
          <Text style={[styles.sectionTitle, { color: theme.warning }]}>
            ⚠️ {t.guideLimitsTitle}
          </Text>
          <Text style={[styles.sectionBody, { color: theme.textDim }]}>
            {t.guideLimitsDesc}
          </Text>
        </View>

        {/* Accuracy Notes */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textDim }]}>
            📏 {t.distance}
          </Text>
          <Text style={[styles.sectionBody, { color: theme.textDim }]}>{t.distanceDisclaimer}</Text>
          <View style={{ height: 12 }} />
          <Text style={[styles.sectionTitle, { color: theme.textDim }]}>
            🧭 {t.bearing}
          </Text>
          <Text style={[styles.sectionBody, { color: theme.textDim }]}>{t.bearingDisclaimer}</Text>
        </View>

        {/* ML Disclaimer */}
        <View style={[styles.disclaimerBox, { borderColor: theme.border }]}>
          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
            {t.mlDisclaimer}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const GuideSection: React.FC<{
  title: string;
  icon: string;
  description: string;
  theme: any;
}> = ({ title, icon, description, theme }) => (
  <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <Text style={[styles.sectionTitle, { color: theme.primary }]}>
      {icon} {title}
    </Text>
    <Text style={[styles.sectionBody, { color: theme.textDim }]}>{description}</Text>
  </View>
);

const BulletItem: React.FC<{ text: string; theme: any }> = ({ text, theme }) => (
  <View style={styles.bulletRow}>
    <Text style={[styles.bullet, { color: theme.primary }]}>•</Text>
    <Text style={[styles.bulletText, { color: theme.textDim }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 20, marginTop: 10 },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  sectionBody: { fontSize: 13, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  bullet: { fontSize: 14, marginTop: 1 },
  bulletText: { fontSize: 13, lineHeight: 20, flex: 1 },
  disclaimerBox: { borderTopWidth: 1, paddingTop: 16, marginTop: 10 },
  disclaimerText: { fontSize: 11, lineHeight: 16, fontStyle: 'italic', textAlign: 'center' },
});
