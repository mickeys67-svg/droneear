/**
 * Detection accuracy feedback prompt — glass card.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { glassStyles } from '@/src/constants/glass';

interface FeedbackPromptProps {
  detectionId?: string | null;
  onSubmit: (detectionId: string, accurate: boolean) => void;
}

export function FeedbackPrompt({ detectionId, onSubmit }: FeedbackPromptProps) {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <View style={[glassStyles.card, styles.card]}>
      <Text style={[styles.question, { color: theme.textDim }]}>
        {t.wasDetectionAccurate}
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: `${theme.success}20`, borderColor: theme.success }]}
          onPress={() => onSubmit(detectionId || '', true)}
          accessibilityRole="button"
          accessibilityLabel={t.yes}
        >
          <Text style={[styles.btnText, { color: theme.success }]}>{t.yes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: `${theme.danger}20`, borderColor: theme.danger }]}
          onPress={() => onSubmit(detectionId || '', false)}
          accessibilityRole="button"
          accessibilityLabel={t.no}
        >
          <Text style={[styles.btnText, { color: theme.danger }]}>{t.reportFalsePositive}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 18 },
  question: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center', minHeight: 48, backgroundColor: 'transparent' },
  btnText: { fontSize: 15, fontWeight: '700' },
});
