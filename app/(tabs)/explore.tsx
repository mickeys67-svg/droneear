/**
 * Guide / Help Screen — v4.0 (Glass Redesign)
 *
 * Design: Glass cards, 2-tone brand header, icon circles,
 * section cards with glassmorphism, bullet tips, detection range table.
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { GLASS, glassStyles } from '@/src/constants/glass';
import type { TacticalTheme } from '@/src/types';

export default function GuideScreen() {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header — 2-tone brand + subtitle */}
        <View style={styles.header}>
          <Text style={[styles.brandText, { color: theme.text }]}>
            Drone<Text style={{ color: theme.primary }}>Ear</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>{t.tabGuide || 'GUIDE'}</Text>
        </View>

        {/* Radar Guide */}
        <GuideCard
          icon="📡"
          title={t.guideRadarTitle}
          description={t.guideRadarDesc}
          theme={theme}
        />

        {/* Spectrogram Guide */}
        <GuideCard
          icon="📊"
          title={t.guideSpecTitle}
          description={t.guideSpecDesc}
          theme={theme}
        />

        {/* Alert Guide */}
        <GuideCard
          icon="🔔"
          title={t.guideAlertTitle}
          description={t.guideAlertDesc}
          theme={theme}
        />

        {/* Best Practices */}
        <View style={[glassStyles.card, styles.section]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { borderColor: `${theme.primary}40` }]}>
              <Text style={styles.iconEmoji}>💡</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              {t.guideTipsTitle}
            </Text>
          </View>
          <BulletItem text={t.guideTip1} theme={theme} />
          <BulletItem text={t.guideTip2} theme={theme} />
          <BulletItem text={t.guideTip3} theme={theme} />
          <BulletItem text={t.guideTip4} theme={theme} />
        </View>

        {/* Detection Range */}
        <View style={[glassStyles.card, styles.section]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { borderColor: `${theme.primary}40` }]}>
              <Text style={styles.iconEmoji}>📏</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              {t.guideRangeTitle}
            </Text>
          </View>
          <Text style={[styles.rangeDesc, { color: theme.textDim }]}>{t.guideRangeDesc}</Text>

          <View style={styles.rangeTable}>
            <RangeRow label={t.guideRangeMultirotor} value="~500m" color={GLASS.glowCyan} theme={theme} />
            <RangeRow label={t.guideRangeFixedWing} value="~800m" color={GLASS.glowCyan} theme={theme} />
            <RangeRow label={t.guideRangeSingleRotor} value="~1.2km" color={GLASS.glowOrange} theme={theme} />
            <RangeRow label={t.guideRangeSingleEngine} value="~2km" color={GLASS.glowOrange} theme={theme} />
            <RangeRow label={t.guideRangeJet} value="~3km+" color={GLASS.glowRed} theme={theme} />
          </View>

          <Text style={[styles.rangeNote, { color: theme.textMuted }]}>{t.guideRangeNote}</Text>
        </View>

        {/* Detection Limitations */}
        <View style={[glassStyles.card, styles.section, { borderColor: GLASS.borderWarning }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { borderColor: `${GLASS.glowOrange}40` }]}>
              <Text style={styles.iconEmoji}>⚠️</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: GLASS.glowOrange }]}>
              {t.guideLimitsTitle}
            </Text>
          </View>
          <Text style={[styles.limitDesc, { color: theme.textDim }]}>
            {t.guideLimitsDesc}
          </Text>
        </View>

        {/* Accuracy Notes */}
        <View style={[glassStyles.card, styles.section]}>
          <Text style={[glassStyles.sectionLabel, { color: theme.textDim }]}>
            {t.distance}
          </Text>
          <Text style={[styles.noteText, { color: theme.textDim }]}>{t.distanceDisclaimer}</Text>
          <View style={styles.noteDivider} />
          <Text style={[glassStyles.sectionLabel, { color: theme.textDim }]}>
            {t.bearing}
          </Text>
          <Text style={[styles.noteText, { color: theme.textDim }]}>{t.bearingDisclaimer}</Text>
        </View>

        {/* ML Disclaimer */}
        <View style={[styles.disclaimerBox, { borderTopColor: GLASS.borderSubtle }]}>
          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
            {t.mlDisclaimer}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== Sub-components =====

const GuideCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  theme: TacticalTheme;
}> = ({ icon, title, description, theme }) => (
  <View style={[glassStyles.card, styles.section]}>
    <View style={styles.sectionHeader}>
      <View style={[styles.iconCircle, { borderColor: `${theme.primary}40` }]}>
        <Text style={styles.iconEmoji}>{icon}</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>
        {title}
      </Text>
    </View>
    <Text style={[styles.bodyText, { color: theme.textDim }]}>{description}</Text>
  </View>
);

const BulletItem: React.FC<{ text: string; theme: TacticalTheme }> = ({ text, theme }) => (
  <View style={styles.bulletRow}>
    <View style={[styles.bulletDot, { backgroundColor: theme.primary }]} />
    <Text style={[styles.bulletText, { color: theme.textDim }]}>{text}</Text>
  </View>
);

const RangeRow: React.FC<{ label: string; value: string; color: string; theme: TacticalTheme }> = ({
  label,
  value,
  color,
  theme,
}) => (
  <View style={styles.rangeRow}>
    <Text style={[styles.rangeLabel, { color: theme.textDim }]}>{label}</Text>
    <Text style={[styles.rangeValue, { color }]}>{value}</Text>
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

  // Section
  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },

  // Icon circle
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 18 },

  // Body text
  bodyText: { fontSize: 13, lineHeight: 20 },

  // Bullets
  bulletRow: { flexDirection: 'row', marginBottom: 10, gap: 10, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { fontSize: 13, lineHeight: 20, flex: 1 },

  // Range table
  rangeDesc: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  rangeTable: { gap: 2 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  rangeLabel: { fontSize: 13, fontWeight: '600' },
  rangeValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rangeNote: { fontSize: 10, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },

  // Limits
  limitDesc: { fontSize: 13, lineHeight: 20 },

  // Notes
  noteText: { fontSize: 12, lineHeight: 18, marginBottom: 4 },
  noteDivider: {
    height: 1,
    backgroundColor: GLASS.borderSubtle,
    marginVertical: 12,
  },

  // Disclaimer
  disclaimerBox: { borderTopWidth: 0.5, paddingTop: 16, marginTop: 8, marginBottom: 8 },
  disclaimerText: { fontSize: 10, lineHeight: 14, fontStyle: 'italic', textAlign: 'center' },
});
