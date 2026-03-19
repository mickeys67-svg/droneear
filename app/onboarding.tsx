/**
 * Onboarding Screen
 *
 * 5-step first-run experience:
 * 1. Welcome & app description
 * 2. Microphone permission (with pre-permission explanation)
 * 3. Device profile selection
 * 4. Microphone test
 * 5. Ready to go
 */

import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  Dimensions, FlatList, Alert, PermissionsAndroid, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/hooks/useTheme';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTranslation } from '@/src/i18n/useTranslation';
import { DEVICE_PROFILES } from '@/src/constants/micConfig';
import type { DeviceProfile } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingStep {
  key: string;
}

const STEPS: OnboardingStep[] = [
  { key: 'welcome' },
  { key: 'mic' },
  { key: 'profile' },
  { key: 'test' },
  { key: 'ready' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const settings = useSettingsStore();
  const flatListRef = useRef<FlatList>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [micGranted, setMicGranted] = useState(false);
  const [micTestResult, setMicTestResult] = useState<'idle' | 'testing' | 'good' | 'bad'>('idle');

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    }
  };

  const finish = () => {
    settings.setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const requestMic = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'DroneEar',
          message: t.onboardingMicDesc,
          buttonPositive: t.grantAccess,
        }
      );
      setMicGranted(granted === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      setMicGranted(true);
    }
    goNext();
  };

  const testMicrophone = () => {
    setMicTestResult('testing');
    // Simulate mic test (in production, this would do a quick AudioCapture test)
    setTimeout(() => {
      setMicTestResult('good');
    }, 2000);
  };

  const renderStep = ({ item }: { item: OnboardingStep }) => {
    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        {item.key === 'welcome' && (
          <View style={styles.stepContent}>
            <Text style={[styles.icon]}>📡</Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingWelcome}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.onboardingWelcomeDesc}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={goNext}>
              <Text style={styles.primaryBtnText}>{t.next}</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.key === 'mic' && (
          <View style={styles.stepContent}>
            <Text style={[styles.icon]}>🎙️</Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingMic}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.onboardingMicDesc}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={requestMic}>
              <Text style={styles.primaryBtnText}>{t.grantAccess}</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.key === 'profile' && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingProfile}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.onboardingProfileDesc}</Text>
            <View style={styles.profileList}>
              {Object.entries(DEVICE_PROFILES).map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.profileCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: settings.profile === key ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => settings.setProfile(key as DeviceProfile)}
                >
                  <Text style={[styles.profileLabel, { color: settings.profile === key ? theme.primary : theme.text }]}>
                    {config.label}
                  </Text>
                  <Text style={[styles.profileDesc, { color: theme.textDim }]}>{config.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={goNext}>
              <Text style={styles.primaryBtnText}>{t.next}</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.key === 'test' && (
          <View style={styles.stepContent}>
            <Text style={[styles.icon]}>🔊</Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingTest}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.onboardingTestDesc}</Text>
            {micTestResult === 'idle' && (
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={testMicrophone}>
                <Text style={styles.primaryBtnText}>{t.testMicrophone}</Text>
              </TouchableOpacity>
            )}
            {micTestResult === 'testing' && (
              <View style={styles.testingContainer}>
                <Text style={[styles.testingText, { color: theme.primary }]}>Testing...</Text>
                <View style={[styles.testBar, { backgroundColor: theme.surface }]}>
                  <View style={[styles.testBarFill, { backgroundColor: theme.primary, width: '60%' }]} />
                </View>
              </View>
            )}
            {micTestResult === 'good' && (
              <View>
                <Text style={[styles.testResult, { color: theme.success }]}>{t.micTestGood}</Text>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={goNext}>
                  <Text style={styles.primaryBtnText}>{t.next}</Text>
                </TouchableOpacity>
              </View>
            )}
            {micTestResult === 'bad' && (
              <View>
                <Text style={[styles.testResult, { color: theme.warning }]}>{t.micTestBad}</Text>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={goNext}>
                  <Text style={styles.primaryBtnText}>{t.next}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {item.key === 'ready' && (
          <View style={styles.stepContent}>
            <Text style={[styles.icon]}>✅</Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingReady}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.onboardingReadyDesc}</Text>
            <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>{t.mlDisclaimer}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={finish}>
              <Text style={styles.primaryBtnText}>{t.getStarted}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={[styles.skipText, { color: theme.textMuted }]}>{t.skip}</Text>
      </TouchableOpacity>

      {/* Steps */}
      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderStep}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      />

      {/* Step indicator */}
      <View style={styles.indicators}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.indicator,
              {
                backgroundColor: i === currentStep ? theme.primary : theme.border,
                width: i === currentStep ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  skipBtn: { position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8 },
  skipText: { fontSize: 14, fontWeight: '600' },
  stepContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  stepContent: { alignItems: 'center' },
  icon: { fontSize: 64, marginBottom: 24 },
  stepTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 16, letterSpacing: 1 },
  stepDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 10 },
  primaryBtn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 12, minWidth: 200, alignItems: 'center', minHeight: 52 },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  profileList: { width: '100%', marginBottom: 20 },
  profileCard: { padding: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  profileLabel: { fontSize: 14, fontWeight: '700' },
  profileDesc: { fontSize: 11, marginTop: 4 },
  testingContainer: { alignItems: 'center', gap: 12 },
  testingText: { fontSize: 14, fontWeight: '600' },
  testBar: { width: 200, height: 8, borderRadius: 4, overflow: 'hidden' },
  testBarFill: { height: '100%', borderRadius: 4 },
  testResult: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  disclaimerText: { fontSize: 11, textAlign: 'center', marginBottom: 24, lineHeight: 16, fontStyle: 'italic' },
  indicators: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 40 },
  indicator: { height: 8, borderRadius: 4 },
});
