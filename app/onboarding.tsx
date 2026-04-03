/**
 * Onboarding Screen — v4.0 (Glass Redesign)
 *
 * 6-step first-run experience (111-666.svg design):
 * 1. Welcome — ear+soundwave icon in glass circle
 * 2. Microphone permission — mic icon + glow
 * 3. Device profile selection — iPhone/Android/Tablet cards
 * 4. Microphone test — waveform animation
 * 5. BLE Detection — bluetooth radar
 * 6. Ready to go — checkmark
 *
 * Glass design: dark bg, cyan accent, rounded glass buttons,
 * large centered icons in neumorphic circles, step dots
 */

import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  FlatList, Alert, Platform, Linking,
  useWindowDimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/hooks/useTheme';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTranslation } from '@/src/i18n/useTranslation';
import { DEVICE_PROFILES } from '@/src/constants/micConfig';
import { GLASS, glassStyles, cyanGlow, primaryGlow } from '@/src/constants/glass';
import { requestMicPermission } from '@/src/utils/platform';
import type { DeviceProfile } from '@/src/types';

interface OnboardingStep {
  key: string;
}

const STEPS: OnboardingStep[] = [
  { key: 'welcome' },
  { key: 'mic' },
  { key: 'profile' },
  { key: 'test' },
  { key: 'ble' },
  { key: 'ready' },
];

export default function OnboardingScreen() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const theme = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const setOnboardingComplete = useSettingsStore((s) => s.setOnboardingComplete);
  const setBLEScanEnabled = useSettingsStore((s) => s.setBLEScanEnabled);
  const flatListRef = useRef<FlatList>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [micGranted, setMicGranted] = useState(false);
  const [micTestResult, setMicTestResult] = useState<'idle' | 'testing' | 'good' | 'bad'>('idle');
  const [micDenied, setMicDenied] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Cleanup recording on unmount
  React.useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    }
  };

  const finish = () => {
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const [micPermanentlyDenied, setMicPermanentlyDenied] = useState(false);

  const requestMic = async () => {
    const result = await requestMicPermission();
    if (result === 'granted') {
      setMicGranted(true);
      setMicDenied(false);
      goNext();
    } else {
      setMicDenied(true);
      if (result === 'never_ask_again') {
        setMicPermanentlyDenied(true);
      }
    }
  };

  const testMicrophone = async () => {
    setMicTestResult('testing');
    try {
      // Record a short clip and check audio levels
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY
      );
      recordingRef.current = recording;
      // Record for 1.5 seconds
      await new Promise((r) => setTimeout(r, 1500));
      const status = await recording.getStatusAsync();
      await recording.stopAndUnloadAsync();
      recordingRef.current = null;

      // Check if we got audio data (metering level)
      if (status.isRecording || status.durationMillis > 500) {
        setMicTestResult('good');
      } else {
        setMicTestResult('bad');
      }
    } catch (err) {
      console.warn('[Onboarding] Mic test failed:', err);
      setMicTestResult('bad');
    }
  };

  const renderStep = ({ item }: { item: OnboardingStep }) => {
    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        {item.key === 'welcome' && (
          <View style={styles.stepContent}>
            <Text style={[styles.brand, { color: theme.primary }]}>
              Drone<Text style={{ color: theme.text }}>Ear</Text>
            </Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.welcome || 'Welcome'}</Text>
            {/* Icon circle */}
            <View style={[styles.iconCircle, { borderColor: `${theme.primary}30` }, primaryGlow(theme.primary,20)]}>
              <Text style={styles.iconEmoji}>👂</Text>
            </View>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>
              {t.acousticDroneDetection || 'Acoustic Drone Detection'}
            </Text>
            <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,10)]} onPress={goNext} accessibilityRole="button" accessibilityLabel="Get started">
              <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.getStarted}</Text>
            </TouchableOpacity>
            <Text style={[styles.stepIndicatorText, { color: theme.textMuted }]}>{t.stepOf?.(1, 6) || 'Step 1 of 6'}</Text>
          </View>
        )}

        {item.key === 'mic' && (
          <View style={styles.stepContent}>
            <Text style={[styles.brand, { color: theme.primary }]}>
              Drone<Text style={{ color: theme.text }}>Ear</Text>
            </Text>
            <Text style={[styles.stepIndicatorText, { color: theme.textMuted, marginBottom: 8 }]}>{t.stepOf?.(2, 6) || 'Step 2 of 6'}</Text>
            {/* Mic icon circle */}
            <View style={[styles.iconCircle, {
              borderColor: micDenied ? `${theme.danger}40` : `${theme.primary}30`,
            }, micDenied ? {} : primaryGlow(theme.primary,20)]}>
              <Text style={styles.iconEmoji}>{micDenied ? '🚫' : '🎙️'}</Text>
            </View>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingMic}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>
              {t.onboardingMicDesc}
            </Text>
            {micDenied && (
              <View style={[glassStyles.card, styles.warningCard, { borderColor: `${theme.danger}40` }]}>
                <Text style={[styles.warningText, { color: theme.danger }]}>
                  {t.micPermissionDenied || 'Microphone access is required for drone detection.'}
                </Text>
              </View>
            )}
            {micGranted ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.grantedText, { color: theme.primary }]}>
                  {t.micPermissionGranted || '✓ Microphone access granted'}
                </Text>
                <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,10)]} onPress={goNext} accessibilityRole="button" accessibilityLabel="Next step">
                  <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.next}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.ctaBtn, { backgroundColor: micDenied ? theme.danger : theme.primary }, micDenied ? {} : primaryGlow(theme.primary,10)]}
                  onPress={micPermanentlyDenied ? () => Linking.openSettings() : requestMic}
                  accessibilityRole="button"
                  accessibilityLabel={micPermanentlyDenied ? 'Open device settings' : micDenied ? 'Retry microphone permission' : 'Continue to microphone access'}
                >
                  <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>
                    {micPermanentlyDenied ? (t.openSettings || 'OPEN SETTINGS') : micDenied ? (t.tryAgain || 'TRY AGAIN') : (t.allow || 'CONTINUE')}
                  </Text>
                </TouchableOpacity>
                {micDenied && (
                  <TouchableOpacity style={{ marginTop: 16, padding: 8, minHeight: 48, justifyContent: 'center' }} onPress={goNext} accessibilityRole="button" accessibilityLabel="Continue without microphone">
                    <Text style={[{ color: theme.textMuted, fontSize: 13 }]}>{t.continueWithout || 'Continue without microphone'}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {item.key === 'profile' && (
          <View style={styles.stepContent}>
            <Text style={[styles.brand, { color: theme.primary }]}>
              Drone<Text style={{ color: theme.text }}>Ear</Text>
            </Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.selectDevice || 'Select Device'}</Text>
            <View style={styles.profileList}>
              {Object.entries(DEVICE_PROFILES).map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.profileCard,
                    {
                      backgroundColor: profile === key ? `${theme.primary}12` : GLASS.cardBg,
                      borderColor: profile === key ? `${theme.primary}50` : GLASS.borderSubtle,
                    },
                    profile === key && primaryGlow(theme.primary,6),
                  ]}
                  onPress={() => setProfile(key as DeviceProfile)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select device profile: ${config.label}`}
                  accessibilityState={{ selected: profile === key }}
                >
                  {profile === key && (
                    <View style={[styles.checkMark, { backgroundColor: theme.primary }]}>
                      <Text style={[styles.checkMarkText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>✓</Text>
                    </View>
                  )}
                  <Text style={[styles.profileLabel, { color: profile === key ? theme.primary : theme.text }]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,10)]} onPress={goNext} accessibilityRole="button" accessibilityLabel="Continue">
              <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.continueBtn || 'CONTINUE'}</Text>
            </TouchableOpacity>
            <Text style={[styles.stepIndicatorText, { color: theme.textMuted }]}>{t.stepOf?.(3, 6) || 'Step 3 of 6'}</Text>
          </View>
        )}

        {item.key === 'test' && (
          <View style={styles.stepContent}>
            <Text style={[styles.brand, { color: theme.primary }]}>
              Drone<Text style={{ color: theme.text }}>Ear</Text>
            </Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingTest}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.speakOrMakeSound || 'Speak or make a sound'}</Text>
            {/* Waveform circle */}
            <View style={[styles.iconCircle, { borderColor: `${theme.primary}30` }, primaryGlow(theme.primary,15)]}>
              <Text style={styles.iconEmoji}>🔊</Text>
            </View>
            {micTestResult === 'idle' && (
              <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,10)]} onPress={testMicrophone} accessibilityRole="button" accessibilityLabel="Test microphone">
                <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.testMicrophone}</Text>
              </TouchableOpacity>
            )}
            {micTestResult === 'testing' && (
              <View style={styles.testingContainer}>
                <Text style={[styles.testingText, { color: theme.primary }]}>{t.listeningTest || 'LISTENING...'}</Text>
                <View style={[styles.testBar, { backgroundColor: GLASS.cardBg }]}>
                  <View style={[styles.testBarFill, { backgroundColor: theme.primary, width: '60%' }]} />
                </View>
              </View>
            )}
            {micTestResult === 'good' && (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.grantedText, { color: theme.success }]}>{t.micTestGood}</Text>
                <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,10)]} onPress={goNext} accessibilityRole="button" accessibilityLabel="Next step">
                  <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.next}</Text>
                </TouchableOpacity>
              </View>
            )}
            {micTestResult === 'bad' && (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.grantedText, { color: theme.warning }]}>{t.micTestBad}</Text>
                <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,10)]} onPress={goNext} accessibilityRole="button" accessibilityLabel="Next step">
                  <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.next}</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={[styles.stepIndicatorText, { color: theme.textMuted }]}>{t.stepOf?.(4, 6) || 'Step 4 of 6'}</Text>
          </View>
        )}

        {item.key === 'ble' && (
          <View style={styles.stepContent}>
            <Text style={[styles.brand, { color: theme.primary }]}>
              Drone<Text style={{ color: theme.text }}>Ear</Text>
            </Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingBLE}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>
              {t.detectControllersDesc || 'Detect drone remote controllers nearby'}
            </Text>
            {/* BLE icon circle */}
            <View style={[styles.iconCircle, { borderColor: `${theme.primary}30` }, primaryGlow(theme.primary,15)]}>
              <Text style={styles.iconEmoji}>📶</Text>
            </View>
            {/* Detection method info banner */}
            <View style={[styles.infoBanner, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}25` }]}>
              <Text style={[styles.infoBannerTitle, { color: theme.primary }]}>
                🎧 {t.audioDetectionNote || 'Audio + BLE Dual Detection'}
              </Text>
              <Text style={[styles.infoBannerText, { color: theme.textDim }]}>
                {t.audioDetectionDesc || 'DroneEar detects drones using acoustic sound analysis alongside BLE Remote ID scanning for maximum detection accuracy.'}
              </Text>
              {Platform.OS === 'ios' && (
                <View style={[styles.infoBannerDivider, { borderTopColor: `${theme.primary}15` }]}>
                  <Text style={[styles.infoBannerText, { color: theme.warning }]}>
                    ⚠️ {t.bleWifiNoticeDesc || 'On iOS, WiFi scanning is blocked by Apple policy. Only Bluetooth (BLE) Remote ID can be received.'}
                  </Text>
                </View>
              )}
              {Platform.OS === 'android' && (
                <View style={[styles.infoBannerDivider, { borderTopColor: `${theme.primary}15` }]}>
                  <Text style={[styles.infoBannerText, { color: theme.success || '#4ADE80' }]}>
                    ✓ {t.bleWifiAndroidOnly || 'WiFi Remote ID: Android only'} — {t.androidWifiSupported || 'WiFi Remote ID supported on this device'}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,10)]} onPress={() => {
              setBLEScanEnabled(true);
              goNext();
            }} accessibilityRole="button" accessibilityLabel="Continue with BLE detection">
              <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.enableBLE || 'CONTINUE'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 16, padding: 8, minHeight: 48, justifyContent: 'center' }} onPress={() => {
              setBLEScanEnabled(false);
              goNext();
            }} accessibilityRole="button" accessibilityLabel="Skip BLE detection">
              <Text style={[{ color: theme.textMuted, fontSize: 13 }]}>{t.onboardingBLESkip}</Text>
            </TouchableOpacity>
            <Text style={[styles.stepIndicatorText, { color: theme.textMuted }]}>{t.stepOf?.(5, 6) || 'Step 5 of 6'}</Text>
          </View>
        )}

        {item.key === 'ready' && (
          <View style={styles.stepContent}>
            <Text style={[styles.brand, { color: theme.primary }]}>
              Drone<Text style={{ color: theme.text }}>Ear</Text>
            </Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t.onboardingReady}</Text>
            <Text style={[styles.stepDesc, { color: theme.textDim }]}>
              {t.onboardingReadyDesc}
            </Text>
            {/* Checkmark circle */}
            <View style={[styles.iconCircle, { borderColor: `${theme.primary}40` }, primaryGlow(theme.primary,25)]}>
              <Text style={[styles.iconEmoji, { color: theme.primary }]}>✓</Text>
            </View>
            <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>{t.mlDisclaimer}</Text>
            <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.primary }, primaryGlow(theme.primary,12)]} onPress={finish} accessibilityRole="button" accessibilityLabel="Start scanning for drones">
              <Text style={[styles.ctaBtnText, theme.mode === 'NIGHT' && { color: '#FFF' }]}>{t.startScanningBtn || 'START SCANNING'}</Text>
            </TouchableOpacity>
            <Text style={[styles.stepIndicatorText, { color: theme.textMuted }]}>{t.stepOf?.(6, 6) || 'Step 6 of 6'}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Skip button */}
      <TouchableOpacity style={[styles.skipBtn, { minHeight: 48, justifyContent: 'center' }]} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip onboarding">
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
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Step indicator dots */}
      <View style={styles.indicators}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.indicator,
              {
                backgroundColor: i === currentStep ? theme.primary : `${theme.textMuted}40`,
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
  skipText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8 },
  stepContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  stepContent: { alignItems: 'center' },

  // Brand
  brand: { fontSize: 20, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },

  // Icon circle — neumorphic glass
  iconCircle: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2,
    backgroundColor: 'rgba(20, 20, 30, 0.6)',
    justifyContent: 'center', alignItems: 'center',
    marginVertical: 32,
  },
  iconEmoji: { fontSize: 56 },

  // Text
  stepTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 8, letterSpacing: 0.5 },
  stepDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 10 },
  stepIndicatorText: { fontSize: 12, letterSpacing: 0.5, marginTop: 20 },

  // CTA button — glass with glow
  ctaBtn: {
    paddingHorizontal: 48, paddingVertical: 16,
    borderRadius: 30, minWidth: 220,
    alignItems: 'center', minHeight: 52,
  },
  ctaBtnText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },

  // Profile cards
  profileList: { width: '100%', marginBottom: 20, gap: 12 },
  profileCard: {
    padding: 20, borderRadius: 16, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center',
    minHeight: 64, position: 'relative',
  },
  profileLabel: { fontSize: 18, fontWeight: '700', marginLeft: 12 },
  checkMark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkMarkText: { color: '#000', fontSize: 14, fontWeight: '900' },

  // Mic test
  testingContainer: { alignItems: 'center', gap: 12 },
  testingText: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  testBar: { width: 200, height: 6, borderRadius: 3, overflow: 'hidden' },
  testBarFill: { height: '100%', borderRadius: 3 },
  grantedText: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 20 },

  // Warning
  warningCard: { marginBottom: 20, width: '100%', borderWidth: 1 },
  warningText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Disclaimer
  disclaimerText: { fontSize: 11, textAlign: 'center', marginBottom: 24, lineHeight: 16, fontStyle: 'italic', paddingHorizontal: 20 },

  // Info banner (BLE step)
  infoBanner: { marginHorizontal: 20, marginBottom: 20, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoBannerTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  infoBannerText: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  infoBannerDivider: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },

  // Step indicators
  indicators: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 40 },
  indicator: { height: 8, borderRadius: 4 },
});
