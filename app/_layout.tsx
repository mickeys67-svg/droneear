import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { I18nManager, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useDetectionStore } from '@/src/stores/detectionStore';
import { RTL_LOCALES, type SupportedLocale, TRANSLATIONS } from '@/src/i18n/translations';
import LoadingScreen from '@/src/components/LoadingScreen';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)',
};

// ===== Error Boundary =====
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          {/* Brand */}
          <View style={errorStyles.brandRow}>
            <Text style={errorStyles.brandWhite}>Drone</Text>
            <Text style={errorStyles.brandCyan}>Ear</Text>
          </View>

          {/* Glass Card */}
          <View style={errorStyles.card}>
            {/* Neumorphic warning icon circle */}
            <View style={errorStyles.iconCircle}>
              <Text style={errorStyles.icon}>⚠</Text>
            </View>

            <Text style={errorStyles.title}>{TRANSLATIONS[useSettingsStore.getState().locale]?.systemError || 'System Error'}</Text>
            <Text style={errorStyles.message}>
              {this.state.error?.message || TRANSLATIONS[useSettingsStore.getState().locale]?.unexpectedError || 'An unexpected error occurred.'}
            </Text>

            <TouchableOpacity
              style={errorStyles.button}
              onPress={() => {
                // FIX-H6: Reset detection state on error restart
                useDetectionStore.getState().clearThreats();
                this.setState({ hasError: false, error: null });
              }}
              activeOpacity={0.8}
            >
              <Text style={errorStyles.buttonText}>{TRANSLATIONS[useSettingsStore.getState().locale]?.restart || 'RESTART'}</Text>
            </TouchableOpacity>
          </View>

          {/* Version */}
          <Text style={errorStyles.version}>{Constants.expoConfig?.version ? `v${Constants.expoConfig.version}` : 'v2.1.0'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  brandRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  brandWhite: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  brandCyan: {
    color: '#00E5CC',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.35)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,68,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    color: '#FF4444',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 12,
  },
  message: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#FF4444',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  version: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 24,
  },
});

// ===== RTL Support =====
function useRTLSupport(locale: SupportedLocale): void {
  useEffect(() => {
    const shouldBeRTL = RTL_LOCALES.includes(locale);
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      // Note: Full RTL change requires app restart on some platforms.
      // This handles the initial state and new installs.
    }
  }, [locale]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const locale = useSettingsStore((s) => s.locale);
  const [appReady, setAppReady] = useState(false);

  // Apply RTL for Arabic, Hebrew, Urdu, Gulf Arabic
  useRTLSupport(locale);

  // Splash timer — show LoadingScreen for initial hydration
  useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  // Redirect to onboarding if first launch
  useEffect(() => {
    if (appReady && !onboardingComplete && (segments[0] as string) !== 'onboarding') {
      router.replace('/onboarding');
    }
  }, [segments, onboardingComplete, appReady]);

  if (!appReady) {
    return <LoadingScreen message={TRANSLATIONS[locale]?.initializingEngine || 'Initializing audio engine...'} />;
  }

  return (
    <AppErrorBoundary>
      <ErrorBoundary>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              animation: 'fade',
              animationDuration: 250,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', animation: 'slide_from_bottom' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </ErrorBoundary>
    </AppErrorBoundary>
  );
}
