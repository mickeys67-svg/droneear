/**
 * Glassmorphism Design System — DroneEar
 *
 * Shared styles for glass cards, panels, buttons, and glow effects.
 * Based on 39 design files analysis.
 */

import { StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';

// ===== Color Tokens =====
export const GLASS = {
  // Backgrounds
  cardBg: 'rgba(20, 20, 30, 0.7)',
  cardBgSolid: '#14141A',         // fallback when blur unavailable
  panelBg: 'rgba(20, 20, 30, 0.85)',
  sheetBg: 'rgba(25, 25, 35, 0.92)',
  overlayBg: 'rgba(0, 0, 0, 0.7)',

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderActive: 'rgba(0, 229, 204, 0.4)',
  borderDanger: 'rgba(255, 68, 68, 0.5)',
  borderWarning: 'rgba(255, 187, 51, 0.5)',

  // Glow colors
  glowCyan: '#00E5CC',
  glowRed: '#FF4444',
  glowWarning: '#FFBB33',
  glowOrange: '#FF9500',

  // Tints (for background overlay)
  tintCyan: 'rgba(0, 229, 204, 0.08)',
  tintRed: 'rgba(255, 68, 68, 0.08)',
  tintOrange: 'rgba(255, 149, 0, 0.08)',
} as const;

// ===== Blur Config =====
export const BLUR_INTENSITY = 20;
export const BLUR_TINT = 'dark' as const;

// ===== Shadow Helpers =====
export function glowShadow(color: string, radius: number = 12): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: radius,
    },
    android: {
      elevation: Math.min(radius / 2, 8),
    },
  }) as ViewStyle;
}

export function cyanGlow(radius: number = 12): ViewStyle {
  return glowShadow(GLASS.glowCyan, radius);
}

export function dangerGlow(radius: number = 15): ViewStyle {
  return glowShadow(GLASS.glowRed, radius);
}

/**
 * Theme-aware primary glow — uses theme.primary instead of hardcoded cyan.
 * Use this instead of cyanGlow() in components that render across all themes.
 */
export function primaryGlow(primaryColor: string, radius: number = 12): ViewStyle {
  return glowShadow(primaryColor, radius);
}

/**
 * Theme-aware active border color.
 * Returns cyan-ish border for DAY/AMOLED, red-ish for NIGHT.
 */
export function activeBorder(primaryColor: string): string {
  return `${primaryColor}66`;
}

// ===== Shared Styles =====
export const glassStyles = StyleSheet.create({
  // Glass card — primary container
  card: {
    backgroundColor: GLASS.cardBg,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },

  // Elevated card (modals, sheets)
  cardElevated: {
    backgroundColor: GLASS.sheetBg,
    borderWidth: 1,
    borderColor: GLASS.borderLight,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },

  // Active/selected card
  cardActive: {
    borderColor: GLASS.borderActive,
    ...Platform.select({
      ios: {
        shadowColor: GLASS.glowCyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },

  // Danger card (threat detected)
  cardDanger: {
    borderColor: GLASS.borderDanger,
    ...Platform.select({
      ios: {
        shadowColor: GLASS.glowRed,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },

  // Bottom sheet
  sheet: {
    backgroundColor: GLASS.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: GLASS.borderLight,
    padding: 20,
    paddingBottom: 36,
  },

  // Sheet drag handle
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center' as const,
    marginBottom: 16,
  },

  // Primary CTA button
  btnPrimary: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: GLASS.glowCyan,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },

  btnPrimaryText: {
    color: '#000',  // Default for DAY/AMOLED (cyan bg). NIGHT mode should override to '#FFF'.
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },

  // Outline button
  btnOutline: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 48,
    backgroundColor: 'transparent',
  },

  btnOutlineText: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },

  // Danger button
  btnDanger: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: GLASS.glowRed,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },

  // Full overlay (permission blocked, etc)
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS.overlayBg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 100,
  },

  // Section label (uppercase small)
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },

  // Stat value (large bold number)
  statValueLarge: {
    fontSize: 36,
    fontWeight: '900' as const,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },

  statValueXL: {
    fontSize: 48,
    fontWeight: '900' as const,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },

  // Stat unit (smaller, beside value)
  statUnit: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginLeft: 2,
  },

  // Data label
  dataLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
});
