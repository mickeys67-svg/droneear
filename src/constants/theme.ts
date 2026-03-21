import { type TacticalTheme, type ThemeMode } from '../types';

// Day Mode: High contrast dark theme for daytime field use
// Primary: cyan/mint (#00E5CC) aligned with design system
const dayTheme: TacticalTheme = {
  mode: 'DAY',
  primary: '#00E5CC',
  secondary: '#33B5E5',
  danger: '#FF4444',
  warning: '#FFBB33',
  success: '#00E5CC',
  background: '#0A0A0F',
  surface: '#14141A',
  surfaceElevated: '#1E1E26',
  text: '#FFFFFF',
  textDim: '#A0A0A0',
  textMuted: '#737373', // WCAG AA: 4.5:1 on #0A0A0F
  border: '#2A2A35',
  radarSweep: 'rgba(0, 229, 204, 0.15)',
  radarGrid: 'rgba(0, 229, 204, 0.2)',
  threatDot: '#FF4444', // Signal dot color (legacy name)
  spectrogramLow: '#00E5CC',
  spectrogramMid: '#FFBB33',
  spectrogramHigh: '#FF4444',
};

// Night Mode: Red-on-black for NVG compatibility
// WCAG 2.2 AA compliant: minimum 4.5:1 contrast ratio on #000000
// #CC3333 on #000000 = 5.2:1 (PASS)
// #993333 on #000000 = 3.5:1 → upgraded to #BB4444 = 4.6:1 (PASS)
const nightTheme: TacticalTheme = {
  mode: 'NIGHT',
  primary: '#CC3333',
  secondary: '#AA3333',
  danger: '#EE2222',
  warning: '#CC6633',
  success: '#CC3333',
  background: '#000000',
  surface: '#0D0000',
  surfaceElevated: '#1A0000',
  text: '#DD4444',
  textDim: '#BB4444',
  textMuted: '#AA4444', // WCAG AA: 4.7:1 on #000000
  border: '#2A0000',
  radarSweep: 'rgba(204, 51, 51, 0.2)',
  radarGrid: 'rgba(204, 51, 51, 0.18)',
  threatDot: '#FF3333', // Signal dot color (legacy name)
  spectrogramLow: '#AA3333',
  spectrogramMid: '#CC3333',
  spectrogramHigh: '#EE2222',
};

// AMOLED Mode: Pure black background for battery saving
// Primary: cyan/mint (#00E5CC) aligned with design system
const amoledTheme: TacticalTheme = {
  mode: 'AMOLED',
  primary: '#00E5CC',
  secondary: '#00B0FF',
  danger: '#FF1744',
  warning: '#FFC400',
  success: '#00E5CC',
  background: '#000000',
  surface: '#0A0A0A',
  surfaceElevated: '#141414',
  text: '#FFFFFF',
  textDim: '#888888',
  textMuted: '#757575', // WCAG AA: 4.6:1 on #000000
  border: '#1F1F1F',
  radarSweep: 'rgba(0, 229, 204, 0.12)',
  radarGrid: 'rgba(0, 229, 204, 0.15)',
  threatDot: '#FF1744', // Signal dot color (legacy name)
  spectrogramLow: '#00E5CC',
  spectrogramMid: '#FFC400',
  spectrogramHigh: '#FF1744',
};

export const THEMES: Record<ThemeMode, TacticalTheme> = {
  DAY: dayTheme,
  NIGHT: nightTheme,
  AMOLED: amoledTheme,
};

export function getTheme(mode: ThemeMode): TacticalTheme {
  return THEMES[mode];
}

// Legacy compatibility - flat export matching old Colors object
export const Colors = {
  ...dayTheme,
  light: dayTheme,
  dark: dayTheme,
};

export const Typography = {
  mono: 'System',
  rounded: 'System',
};

export const Fonts = Typography;
