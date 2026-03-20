/**
 * Engine error overlay card with retry action.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { GLASS, glassStyles, dangerGlow } from '@/src/constants/glass';

interface EngineErrorCardProps {
  onRetry: () => void;
}

export function EngineErrorCard({ onRetry }: EngineErrorCardProps) {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <View style={styles.overlay}>
      <View style={[glassStyles.card, styles.card, { borderColor: GLASS.borderDanger }]}>
        <View style={[styles.iconCircle, dangerGlow(12)]}>
          <Text style={styles.icon}>⚠</Text>
        </View>
        <Text style={[styles.title, { color: GLASS.glowRed }]}>
          {t.engineError || 'Engine Error'}
        </Text>
        <Text style={[styles.desc, { color: theme.textDim }]}>
          {t.engineErrorDesc || 'Audio analysis engine failed to initialize. Check microphone permissions and try again.'}
        </Text>
        <TouchableOpacity
          style={[glassStyles.btnDanger, { backgroundColor: GLASS.glowRed }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t.retry || 'Retry'}
        >
          <Text style={[glassStyles.btnPrimaryText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.retry || 'RETRY'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', marginBottom: 20 },
  card: { alignItems: 'center', width: '100%', paddingVertical: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,68,68,0.08)', borderWidth: 1.5, borderColor: GLASS.borderDanger, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  icon: { fontSize: 32 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  desc: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 24, paddingHorizontal: 16 },
});
