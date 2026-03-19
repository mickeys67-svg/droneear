import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { I18nManager, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { RTL_LOCALES, type SupportedLocale } from '@/src/i18n/translations';

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
          <Text style={errorStyles.icon}>⚠</Text>
          <Text style={errorStyles.title}>DroneEar Error</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorStyles.buttonText}>RESTART</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#FF4444', fontSize: 20, fontWeight: '700', fontFamily: 'monospace', marginBottom: 12 },
  message: { color: '#AAAAAA', fontSize: 13, fontFamily: 'monospace', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  button: { backgroundColor: '#FF4444', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  buttonText: { color: '#000', fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
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

  // Apply RTL for Arabic, Hebrew, Urdu, Gulf Arabic
  useRTLSupport(locale);

  // Redirect to onboarding if first launch
  useEffect(() => {
    if (!onboardingComplete && (segments[0] as string) !== 'onboarding') {
      router.replace('/onboarding' as any);
    }
  }, [onboardingComplete]);

  return (
    <AppErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
