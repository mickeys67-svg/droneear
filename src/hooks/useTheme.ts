import { useMemo } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { getTheme } from '../constants/theme';
import type { TacticalTheme } from '../types';

export function useTheme(): TacticalTheme {
  const themeMode = useSettingsStore((s) => s.themeMode);
  return useMemo(() => getTheme(themeMode), [themeMode]);
}
