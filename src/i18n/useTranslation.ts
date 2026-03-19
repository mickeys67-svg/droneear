/**
 * Translation Hook
 *
 * Provides localized strings based on user's language setting.
 */

import { useSettingsStore } from '../stores/settingsStore';
import { getTranslation, type Translations } from './translations';

export function useTranslation(): Translations {
  const locale = useSettingsStore((s) => s.locale);
  return getTranslation(locale);
}
