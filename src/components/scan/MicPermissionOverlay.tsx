/**
 * Full-screen mic permission blocked overlay — DD.svg design
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { glassStyles, cyanGlow } from '@/src/constants/glass';

interface MicPermissionOverlayProps {
  onDismiss: () => void;
}

export function MicPermissionOverlay({ onDismiss }: MicPermissionOverlayProps) {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <View style={[glassStyles.overlay, { backgroundColor: theme.background }]}>
      {/* Permission Blocked badge */}
      <View style={[styles.badge, { backgroundColor: `${theme.danger}20`, borderColor: `${theme.danger}50` }]}>
        <Text style={[styles.badgeText, { color: theme.danger }]}>
          {t.permissionBlocked || 'Permission Blocked'}
        </Text>
      </View>

      <Text style={styles.icon}>🎙️</Text>

      <Text style={[styles.title, { color: theme.text }]}>
        {t.micAccessRequired || 'Microphone Access\nRequired'}
      </Text>
      <Text style={[styles.desc, { color: theme.textDim }]}>
        {t.micPermissionBlockedDesc || 'DroneEar needs microphone access to detect drone acoustic signatures. Without it, the app cannot function.'}
      </Text>

      {/* How-to glass card */}
      <View style={[glassStyles.card, styles.howTo]}>
        <Text style={[styles.howToTitle, { color: theme.textDim }]}>{t.howToEnable || 'How to enable:'}</Text>
        <View style={styles.step}>
          <Text style={[styles.stepIcon, { color: theme.textDim }]}>⚙</Text>
          <Text style={[styles.stepText, { color: theme.text }]}>{t.permStep1 || '1. Open Settings'}</Text>
        </View>
        <View style={styles.step}>
          <Text style={[styles.stepIcon, { color: theme.textDim }]}>🔍</Text>
          <Text style={[styles.stepText, { color: theme.text }]}>{t.permStep2 || '2. Find DroneEar'}</Text>
        </View>
        <View style={styles.step}>
          <Text style={[styles.stepIcon, { color: theme.textDim }]}>🎙</Text>
          <Text style={[styles.stepText, { color: theme.text }]}>{t.permStep3 || '3. Enable Microphone'}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[glassStyles.btnPrimary, { backgroundColor: theme.primary, width: '80%' }, cyanGlow(12)]}
        onPress={() => Linking.openSettings()}
        accessibilityRole="button"
      >
        <Text style={[glassStyles.btnPrimaryText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.openSettings?.toUpperCase() || 'OPEN SETTINGS'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ marginTop: 20, padding: 8 }}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t.continueWithout || 'Continue without microphone'}
      >
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          {t.continueWithout || 'Continue without microphone'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  icon: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12, letterSpacing: 0.5, lineHeight: 34 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 10 },
  howTo: { marginBottom: 28, width: '85%' },
  howToTitle: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  stepText: { fontSize: 14, fontWeight: '600' },
});
