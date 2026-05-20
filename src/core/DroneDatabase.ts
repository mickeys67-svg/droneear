/**
 * Drone Database — reference list of real drone models per acoustic class.
 *
 * HONESTY CONTRACT:
 * - This is a STATIC REFERENCE LIST, not a detector. It does NOT identify a
 *   specific drone from audio. The classifier only determines an acoustic
 *   CLASS (e.g. MULTIROTOR); this file just lists real-world models that
 *   belong to that class, shown to the user as "≈ similar" examples.
 * - There is NO probability/weight scoring. Earlier versions exposed a
 *   per-model "probability" derived from a hand-assigned popularity weight —
 *   that number was meaningless (not an acoustic match) and was removed.
 * - similarDrone examples are attached ONLY for acoustic classes that are
 *   actually data-backed (see CATEGORY_AVAILABILITY). Classes not yet backed
 *   by a real labelled dataset return no examples.
 *
 * All model names below are real, publicly-known aircraft.
 */

import type { AcousticPattern, ThreatCategory, SimilarDrone } from '../types';

interface DroneEntry {
  name: string;
  category: SimilarDrone['category'];
}

/** Core patterns that have drone mappings (excludes BACKGROUND) */
type MappedPattern = 'MULTIROTOR' | 'SINGLE_ENGINE' | 'SINGLE_ROTOR' | 'JET_PROPULSION' | 'PROPELLER_FIXED';

// ===== Reference model lists per acoustic class =====
//
// MULTIROTOR is the data-backed, detectable class — populated comprehensively
// with real consumer / prosumer / industrial / FPV multirotor drones, since
// virtually every drone a user will encounter is a multirotor and they all
// share the same propeller-array acoustic signature.
//
// The other four classes are NOT yet data-backed (see CATEGORY_AVAILABILITY).
// They keep a short list of real aircraft for future use, but the app does
// not currently surface them as similar-model examples.

const DRONE_DATABASE: Record<MappedPattern, DroneEntry[]> = {
  MULTIROTOR: [
    // DJI — consumer / prosumer
    { name: 'DJI Mavic 3 Pro', category: 'civilian' },
    { name: 'DJI Mavic 3 / Mavic 3 Classic', category: 'civilian' },
    { name: 'DJI Air 3S', category: 'civilian' },
    { name: 'DJI Air 3', category: 'civilian' },
    { name: 'DJI Air 2S', category: 'civilian' },
    { name: 'DJI Mini 4 Pro', category: 'civilian' },
    { name: 'DJI Mini 4K', category: 'civilian' },
    { name: 'DJI Mini 3 Pro', category: 'civilian' },
    { name: 'DJI Mini 3', category: 'civilian' },
    { name: 'DJI Mini 2 SE', category: 'civilian' },
    { name: 'DJI Neo', category: 'civilian' },
    { name: 'DJI Flip', category: 'civilian' },
    { name: 'DJI Inspire 3', category: 'civilian' },
    { name: 'DJI Phantom 4 Pro', category: 'civilian' },
    // DJI — FPV
    { name: 'DJI Avata 2', category: 'racing' },
    { name: 'DJI Avata', category: 'racing' },
    { name: 'DJI FPV', category: 'racing' },
    // Autel
    { name: 'Autel EVO Lite+ / EVO Lite', category: 'civilian' },
    { name: 'Autel EVO Nano+ / Nano', category: 'civilian' },
    { name: 'Autel EVO II Pro', category: 'civilian' },
    { name: 'Autel EVO Max 4T', category: 'industrial' },
    // Skydio
    { name: 'Skydio 2+', category: 'civilian' },
    { name: 'Skydio X2', category: 'industrial' },
    { name: 'Skydio X10', category: 'industrial' },
    // Parrot
    { name: 'Parrot Anafi', category: 'civilian' },
    { name: 'Parrot Anafi AI', category: 'civilian' },
    { name: 'Parrot Anafi USA', category: 'industrial' },
    // Other consumer brands
    { name: 'HoverAir X1', category: 'civilian' },
    { name: 'Holy Stone HS-series', category: 'civilian' },
    { name: 'Potensic ATOM-series', category: 'civilian' },
    // FPV / racing builds
    { name: '5-inch FPV Freestyle Quad', category: 'racing' },
    { name: 'FPV Racing Drone (sub-250g)', category: 'racing' },
    { name: 'Cinewhoop / Tinywhoop', category: 'racing' },
    // Industrial heavy-lift / agricultural
    { name: 'DJI Matrice 350 RTK', category: 'industrial' },
    { name: 'DJI Matrice 300 RTK', category: 'industrial' },
    { name: 'DJI Matrice 30 / 30T', category: 'industrial' },
    { name: 'DJI Mavic 3 Enterprise / Thermal', category: 'industrial' },
    { name: 'DJI Agras T40 / T50 (sprayer)', category: 'industrial' },
    // Generic / unknown
    { name: 'Military Recon Quadcopter', category: 'military' },
    { name: 'Custom / DIY Multirotor', category: 'other' },
    { name: 'Other Multirotor', category: 'other' },
  ],

  // ----- Not yet data-backed (COMING_SOON). Short real-aircraft lists kept
  // for future use; the app does not surface these as examples today. -----
  SINGLE_ENGINE: [
    { name: 'Industrial Survey Drone', category: 'industrial' },
    { name: 'Agricultural Spray Drone', category: 'industrial' },
    { name: 'Delivery Drone (Wing / Zipline)', category: 'civilian' },
    { name: 'Custom Fixed-wing Drone', category: 'other' },
  ],

  SINGLE_ROTOR: [
    { name: 'RC Helicopter (450~700 class)', category: 'civilian' },
    { name: 'Aerial Photography Helicopter', category: 'civilian' },
    { name: 'Yamaha RMAX (Agriculture)', category: 'industrial' },
    { name: 'EMS / News Helicopter', category: 'civilian' },
  ],

  JET_PROPULSION: [
    { name: 'RC Jet (Turbine)', category: 'civilian' },
    { name: 'Jet-powered UAV', category: 'industrial' },
    { name: 'Turbine-powered Target Drone', category: 'other' },
  ],

  PROPELLER_FIXED: [
    { name: 'Mapping / Survey Drone (Fixed-wing)', category: 'industrial' },
    { name: 'Agricultural Drone (Fixed-wing)', category: 'industrial' },
    { name: 'RC Airplane', category: 'civilian' },
    { name: 'SenseFly eBee (Mapping)', category: 'industrial' },
  ],
};

/** Map legacy pattern names to new names for lookup */
const LEGACY_MAP: Record<string, MappedPattern> = {
  DRONE_SMALL: 'MULTIROTOR',
  DRONE_LARGE: 'SINGLE_ENGINE',
  HELICOPTER: 'SINGLE_ROTOR',
  MISSILE: 'JET_PROPULSION',
  AIRCRAFT: 'PROPELLER_FIXED',
};

// ===== Detection Capability Scope =====
//
// Which acoustic classes the app can HONESTLY claim to detect today.
// "AVAILABLE" classes are backed by legally-clean, commercially-usable
// labelled audio (DroneAudioset — MIT; FSD50K — CC0/CC-BY). "COMING_SOON"
// classes are not yet data-backed.

export type CategoryAvailability = 'AVAILABLE' | 'COMING_SOON';

export const CATEGORY_AVAILABILITY: Record<MappedPattern, CategoryAvailability> = {
  MULTIROTOR: 'AVAILABLE',       // DroneAudioset (MIT) — multirotor drone audio
  SINGLE_ENGINE: 'COMING_SOON',
  SINGLE_ROTOR: 'COMING_SOON',
  PROPELLER_FIXED: 'COMING_SOON',
  JET_PROPULSION: 'COMING_SOON',
};

/** True when the app has data-backed detection for this pattern. */
export function isPatternAvailable(pattern: AcousticPattern | ThreatCategory): boolean {
  if (pattern === 'BACKGROUND' || (pattern as string) === 'AMBIENT') return true;
  const mapped = LEGACY_MAP[pattern] || pattern;
  return CATEGORY_AVAILABILITY[mapped as MappedPattern] === 'AVAILABLE';
}

export interface DetectionCapability {
  pattern: MappedPattern;
  availability: CategoryAvailability;
  /** Example real-world models that fall in this acoustic class. */
  examples: string[];
}

/**
 * Ordered capability list for the Guide screen — AVAILABLE first.
 */
export function getDetectionCapabilities(): DetectionCapability[] {
  const order: MappedPattern[] = [
    'MULTIROTOR', 'SINGLE_ENGINE', 'SINGLE_ROTOR', 'PROPELLER_FIXED', 'JET_PROPULSION',
  ];
  return order.map((pattern) => ({
    pattern,
    availability: CATEGORY_AVAILABILITY[pattern],
    examples: DRONE_DATABASE[pattern]
      .filter((e) => e.category === 'civilian' || e.category === 'industrial' || e.category === 'racing')
      .slice(0, 6)
      .map((e) => e.name),
  }));
}

/**
 * Get reference drone models for an acoustic class.
 * Returns an empty list for BACKGROUND/AMBIENT or unknown patterns.
 */
export function getSimilarDrones(pattern: AcousticPattern | ThreatCategory): SimilarDrone[] {
  if (pattern === 'BACKGROUND' || (pattern as string) === 'AMBIENT') return [];

  const mapped = LEGACY_MAP[pattern] || pattern;
  const entries = DRONE_DATABASE[mapped as MappedPattern];
  if (!entries) return [];

  return entries.map((entry) => ({ name: entry.name, category: entry.category }));
}

/**
 * Get reference drone models to attach to a detection result.
 *
 * Examples are returned ONLY for data-backed acoustic classes. A detection in
 * a not-yet-supported class carries no model examples — the app must not imply
 * it can name drones it has no data for.
 */
export function getTopSimilarDrones(pattern: AcousticPattern | ThreatCategory, topN: number = 5): SimilarDrone[] {
  if (!isPatternAvailable(pattern)) return [];
  return getSimilarDrones(pattern).slice(0, topN);
}

/**
 * Get human-readable pattern label.
 */
export function getPatternLabel(pattern: AcousticPattern | ThreatCategory): string {
  const labels: Record<string, string> = {
    MULTIROTOR: 'Multirotor',
    SINGLE_ENGINE: 'Single Engine Propulsion',
    SINGLE_ROTOR: 'Single Rotor',
    JET_PROPULSION: 'Jet / Turbine Propulsion',
    PROPELLER_FIXED: 'Propeller Fixed-Wing',
    BACKGROUND: 'Background',
    // Legacy names
    DRONE_SMALL: 'Multirotor',
    DRONE_LARGE: 'Single Engine Propulsion',
    HELICOPTER: 'Single Rotor',
    MISSILE: 'Jet / Turbine Propulsion',
    AIRCRAFT: 'Propeller Fixed-Wing',
    AMBIENT: 'Background',
  };
  return labels[pattern] || pattern;
}
