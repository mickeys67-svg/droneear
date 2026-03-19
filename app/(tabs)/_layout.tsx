import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/src/hooks/useTheme';

/**
 * Tab Navigation — Icon-first design for emergency use
 *
 * Large icons (32px) with short labels (11px)
 * High contrast active/inactive states
 * 80px tab bar height for easy touch targets
 * Active tab: icon + colored underline indicator
 */

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}>

      {/* SCAN — radar icon */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'SCAN',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [tabStyles.activeWrap, { borderBottomColor: theme.primary }] : tabStyles.wrap}>
              <MaterialIcons name="radar" size={32} color={color} />
            </View>
          ),
          tabBarAccessibilityLabel: 'Drone scan screen',
        }}
      />

      {/* LOG — history icon */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'LOG',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [tabStyles.activeWrap, { borderBottomColor: theme.primary }] : tabStyles.wrap}>
              <MaterialIcons name="history" size={32} color={color} />
            </View>
          ),
          tabBarAccessibilityLabel: 'Detection history log',
        }}
      />

      {/* SET — settings gear icon */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SET',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [tabStyles.activeWrap, { borderBottomColor: theme.primary }] : tabStyles.wrap}>
              <MaterialIcons name="tune" size={32} color={color} />
            </View>
          ),
          tabBarAccessibilityLabel: 'Settings',
        }}
      />

      {/* GUIDE — help icon */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'GUIDE',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [tabStyles.activeWrap, { borderBottomColor: theme.primary }] : tabStyles.wrap}>
              <MaterialIcons name="menu-book" size={32} color={color} />
            </View>
          ),
          tabBarAccessibilityLabel: 'Usage guide',
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 40,
  },
  activeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 40,
    borderBottomWidth: 3,
    borderBottomColor: '#00FF88',
  },
});
