import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import { GLASS, BLUR_INTENSITY } from '@/src/constants/glass';

/**
 * Tab Navigation — Glass design (777.svg)
 *
 * 5 tabs: SCAN / MAP / LOG / SET / GUIDE
 * Glassmorphism tab bar with blur background
 * Active tab: filled glass card + cyan accent + underline
 * Large icons (28px) with short labels (10px)
 */

export default function TabLayout() {
  const theme = useTheme();
  const t = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: GLASS.panelBg,
          borderTopColor: GLASS.borderSubtle,
          borderTopWidth: 1,
          height: 82,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 8,
          paddingHorizontal: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        // Use blur background on iOS
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={BLUR_INTENSITY}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.panelBg }]} />
          ),
      }}>

      {/* SCAN — radar icon */}
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabScan || 'SCAN',
          tabBarIcon: ({ color, focused }) => (
            <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive, focused && { backgroundColor: `${theme.primary}15` }]}>
              <MaterialIcons name="radar" size={28} color={color} />
              {focused && <View style={[tabStyles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
          tabBarAccessibilityLabel: t.tabScanDesc || 'Drone scan screen',
        }}
      />

      {/* MAP — map icon */}
      <Tabs.Screen
        name="map"
        options={{
          title: t.tabMap || 'MAP',
          tabBarIcon: ({ color, focused }) => (
            <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive, focused && { backgroundColor: `${theme.primary}15` }]}>
              <MaterialIcons name="location-on" size={28} color={color} />
              {focused && <View style={[tabStyles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
          tabBarAccessibilityLabel: t.tabMapDesc || 'Drone map view',
        }}
      />

      {/* LOG — history icon */}
      <Tabs.Screen
        name="history"
        options={{
          title: t.tabLog || 'LOG',
          tabBarIcon: ({ color, focused }) => (
            <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive, focused && { backgroundColor: `${theme.primary}15` }]}>
              <MaterialIcons name="format-list-bulleted" size={28} color={color} />
              {focused && <View style={[tabStyles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
          tabBarAccessibilityLabel: t.tabLogDesc || 'Detection history log',
        }}
      />

      {/* SET — settings gear icon */}
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabSet || 'SET',
          tabBarIcon: ({ color, focused }) => (
            <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive, focused && { backgroundColor: `${theme.primary}15` }]}>
              <MaterialIcons name="settings" size={28} color={color} />
              {focused && <View style={[tabStyles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
          tabBarAccessibilityLabel: t.settings || 'Settings',
        }}
      />

      {/* GUIDE — help icon */}
      <Tabs.Screen
        name="explore"
        options={{
          title: t.tabGuide || 'GUIDE',
          tabBarIcon: ({ color, focused }) => (
            <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive, focused && { backgroundColor: `${theme.primary}15` }]}>
              <MaterialIcons name="menu-book" size={28} color={color} />
              {focused && <View style={[tabStyles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
          tabBarAccessibilityLabel: t.guideTitle || 'Usage guide',
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 40,
    borderRadius: 10,
  },
  iconWrapActive: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -10,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
});
