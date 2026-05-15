/**
 * Category label helper.
 *
 * The ML model emits acoustic pattern names like `MULTIROTOR`, `BACKGROUND`,
 * `PROPELLER_FIXED`. Showing those raw uppercase identifiers to a Korean /
 * German / Arabic user is opaque. This module maps each pattern to a
 * localised, human-readable string per the current Translations object.
 *
 * Falls back to a humanised version of the identifier (`PROPELLER_FIXED`
 * → `Propeller Fixed`) so a previously unknown category never renders as
 * blank.
 */

import type { Translations } from './translations';

export type CategoryKey =
  | 'MULTIROTOR'
  | 'SINGLE_ENGINE'
  | 'SINGLE_ROTOR'
  | 'JET_PROPULSION'
  | 'PROPELLER_FIXED'
  | 'BACKGROUND'
  | 'AMBIENT'
  | 'DRONE_SMALL'
  | 'DRONE_LARGE'
  | 'HELICOPTER'
  | 'MISSILE'
  | 'AIRCRAFT';

const FIELD_MAP: Record<CategoryKey, keyof Translations> = {
  MULTIROTOR: 'catMultirotor',
  SINGLE_ENGINE: 'catSingleEngine',
  SINGLE_ROTOR: 'catSingleRotor',
  JET_PROPULSION: 'catJet',
  PROPELLER_FIXED: 'catPropellerFixed',
  BACKGROUND: 'catBackground',
  AMBIENT: 'catBackground',
  // Legacy fallbacks reuse the closest modern label
  DRONE_SMALL: 'catMultirotor',
  DRONE_LARGE: 'catSingleEngine',
  HELICOPTER: 'catSingleRotor',
  MISSILE: 'catJet',
  AIRCRAFT: 'catPropellerFixed',
};

/**
 * Get the localised, human-readable label for a category identifier.
 * `t` is the resolved Translations object from `useTranslation()`.
 */
export function categoryLabel(t: Translations, category: string | null | undefined): string {
  if (!category) return '';
  const key = category.toUpperCase() as CategoryKey;
  const field = FIELD_MAP[key];
  if (field) {
    const value = (t as unknown as Record<string, unknown>)[field as string];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  // Fallback — humanise the raw identifier so the screen never renders blank
  return category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
