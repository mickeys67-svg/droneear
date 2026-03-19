const tacticalColors = {
  primary: '#00C851', // Tactical Green
  secondary: '#ff4444', // Alert Red
  background: '#0D0D0D', // Deep Black
  surface: '#1A1A1A', // Dark Gray
  surfaceLight: '#262626',
  text: '#FFFFFF',
  textDim: '#A0A0A0',
  accent: '#007AFF', // Tactical Blue
  glass: 'rgba(255, 255, 255, 0.05)',
  border: '#333333',
  tint: '#00C851',
  icon: '#A0A0A0',
  tabIconDefault: '#A0A0A0',
  tabIconSelected: '#00C851',
};

export const Colors = {
  light: tacticalColors,
  dark: tacticalColors,
  ...tacticalColors // Also keep them flat for index.tsx
};

export const Typography = {
  mono: 'System',
  rounded: 'System',
};

export const Fonts = Typography; // Alias for compatibility
