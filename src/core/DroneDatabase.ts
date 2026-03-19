/**
 * Drone Database — Similar drone matching by acoustic pattern.
 *
 * Maps each acoustic pattern to a list of known drone models
 * with estimated probability. This is a static lookup table
 * (zero computation cost) — NOT an ML inference step.
 *
 * DISCLAIMER: Probabilities are based on publicly available acoustic
 * research data and represent similarity to known sound signatures,
 * NOT positive identification of any specific aircraft.
 */

import type { AcousticPattern, SimilarDrone } from '../types';

interface DroneEntry {
  name: string;
  category: SimilarDrone['category'];
  /** Base weight within this pattern group (higher = more common) */
  weight: number;
}

/** Core patterns that have drone mappings (excludes BACKGROUND) */
type MappedPattern = 'MULTIROTOR' | 'SINGLE_ENGINE' | 'SINGLE_ROTOR' | 'JET_PROPULSION' | 'PROPELLER_FIXED';

const DRONE_DATABASE: Record<MappedPattern, DroneEntry[]> = {
  MULTIROTOR: [
    { name: 'DJI Mavic 3 / Air 2S', category: 'civilian', weight: 18 },
    { name: 'DJI Mini 4 Pro / Mini 2 SE', category: 'civilian', weight: 16 },
    { name: 'Autel EVO Nano+ / Lite+', category: 'civilian', weight: 12 },
    { name: 'Skydio 2+ / X2', category: 'civilian', weight: 10 },
    { name: 'Parrot Anafi AI', category: 'civilian', weight: 8 },
    { name: 'FPV Racing Drone', category: 'racing', weight: 8 },
    { name: 'DJI Matrice 30T (Industrial)', category: 'industrial', weight: 7 },
    { name: 'Military Recon Quadcopter', category: 'military', weight: 6 },
    { name: 'Custom / DIY Multirotor', category: 'other', weight: 8 },
    { name: 'Other Multirotor', category: 'other', weight: 7 },
  ],

  SINGLE_ENGINE: [
    { name: 'Industrial Survey Drone', category: 'industrial', weight: 22 },
    { name: 'Agricultural Spray Drone', category: 'industrial', weight: 18 },
    { name: 'Custom Fixed-wing Drone', category: 'other', weight: 14 },
    { name: 'Shahed-series', category: 'military', weight: 12 },
    { name: 'Delivery Drone (Wing/Zipline)', category: 'civilian', weight: 10 },
    { name: 'Bayraktar TB2', category: 'military', weight: 8 },
    { name: 'Long-range Mapping UAV', category: 'industrial', weight: 9 },
    { name: 'Other Single Engine', category: 'other', weight: 7 },
  ],

  SINGLE_ROTOR: [
    { name: 'Aerial Photography Helicopter', category: 'civilian', weight: 22 },
    { name: 'RC Helicopter (450~700 class)', category: 'civilian', weight: 18 },
    { name: 'Industrial Heli-drone', category: 'industrial', weight: 15 },
    { name: 'Military Recon Helicopter', category: 'military', weight: 12 },
    { name: 'EMS / News Helicopter', category: 'civilian', weight: 14 },
    { name: 'Yamaha RMAX (Agriculture)', category: 'industrial', weight: 10 },
    { name: 'Other Single Rotor', category: 'other', weight: 9 },
  ],

  JET_PROPULSION: [
    { name: 'RC Jet (Turbine)', category: 'civilian', weight: 20 },
    { name: 'High-speed Racing Drone', category: 'racing', weight: 15 },
    { name: 'Jet-powered UAV', category: 'industrial', weight: 14 },
    { name: 'Cruise Missile (Tomahawk etc.)', category: 'military', weight: 12 },
    { name: 'Military Jet Drone (Kratos XQ-58)', category: 'military', weight: 10 },
    { name: 'Turbine-powered Target Drone', category: 'military', weight: 10 },
    { name: 'Small Turbojet Engine UAV', category: 'other', weight: 12 },
    { name: 'Other Jet Propulsion', category: 'other', weight: 7 },
  ],

  PROPELLER_FIXED: [
    { name: 'Agricultural Drone (Fixed-wing)', category: 'industrial', weight: 20 },
    { name: 'Mapping / Survey Drone', category: 'industrial', weight: 18 },
    { name: 'Delivery Drone (Fixed-wing)', category: 'civilian', weight: 14 },
    { name: 'Military UAV (MQ-9 etc.)', category: 'military', weight: 12 },
    { name: 'SenseFly eBee (Mapping)', category: 'industrial', weight: 10 },
    { name: 'RC Airplane', category: 'civilian', weight: 12 },
    { name: 'Solar-powered HALE Drone', category: 'industrial', weight: 6 },
    { name: 'Other Propeller Fixed-wing', category: 'other', weight: 8 },
  ],
};

/**
 * Get similar drones for an acoustic pattern with probability distribution.
 * Returns sorted by probability (highest first).
 *
 * This is a static table lookup — zero ML computation.
 */
/** Map legacy pattern names to new names for lookup */
const LEGACY_MAP: Record<string, MappedPattern> = {
  DRONE_SMALL: 'MULTIROTOR',
  DRONE_LARGE: 'SINGLE_ENGINE',
  HELICOPTER: 'SINGLE_ROTOR',
  MISSILE: 'JET_PROPULSION',
  AIRCRAFT: 'PROPELLER_FIXED',
};

export function getSimilarDrones(pattern: AcousticPattern): SimilarDrone[] {
  if (pattern === 'BACKGROUND' || (pattern as string) === 'AMBIENT') return [];

  const mapped = LEGACY_MAP[pattern] || pattern;
  const entries = DRONE_DATABASE[mapped as MappedPattern];
  if (!entries) return [];

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);

  return entries
    .map((entry) => ({
      name: entry.name,
      probability: entry.weight / totalWeight,
      category: entry.category,
    }))
    .sort((a, b) => b.probability - a.probability);
}

/**
 * Get the top N similar drones for display.
 */
export function getTopSimilarDrones(pattern: AcousticPattern, topN: number = 5): SimilarDrone[] {
  const all = getSimilarDrones(pattern);
  const top = all.slice(0, topN);

  // Add "Other" entry for remaining probability
  if (all.length > topN) {
    const remaining = all.slice(topN).reduce((sum, d) => sum + d.probability, 0);
    top.push({ name: 'Other', probability: remaining, category: 'other' });
  }

  return top;
}

/**
 * Get human-readable pattern label.
 */
export function getPatternLabel(pattern: AcousticPattern): string {
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
