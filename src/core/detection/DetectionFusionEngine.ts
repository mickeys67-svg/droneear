/**
 * Detection Fusion Engine — v2.0 (two-tier model)
 *
 * Produces FUSED detections — the "corroborated" tier — when a BLE Remote ID
 * drone is seen at roughly the same time as an acoustic drone-like detection.
 *
 * Detection tiers (see project 2-tier rework):
 *   1. CONFIRMED   — BLE Remote ID alone (rendered directly from bleDevices)
 *   2. CORROBORATED — BLE + acoustic time-match → this engine emits FUSED
 *   3. ACOUSTIC    — acoustic only (beta), handled on the scan screen
 *
 * Matching is by TIME PROXIMITY ONLY. Acoustic detection no longer carries a
 * bearing (single uncalibrated mic cannot determine direction honestly), so
 * bearing-based matching was removed. A FUSED detection means "a Remote ID
 * drone was present and a drone-like sound was heard around the same time".
 *
 * A FUSED detection takes its position (distance + bearing) entirely from the
 * BLE drone's broadcast GPS — the acoustic side never contributes position.
 * Confidence is the BLE-confirmed value: receiving a Remote ID broadcast is
 * digital proof a drone exists, so there is no probabilistic guess and no
 * acoustic-based confidence boost (the old 1.3x boost conflated two
 * independent sources and was removed).
 */

import type { DetectionResult, ThreatTrack, RemoteIDData } from '../../types';

export interface UserPosition {
  latitude: number;
  longitude: number;
}

export interface FusedDetection extends DetectionResult {
  /** Fused source flag */
  source: 'FUSED';
  /** Original acoustic track ID */
  acousticTrackId: string;
  /** BLE device ID that matched */
  bleDeviceId: string;
  /** Original BLE Remote ID data */
  remoteIdData: RemoteIDData;
}

// ===== Haversine utilities =====

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine distance between two lat/lon points in meters.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Bearing from point 1 to point 2 in degrees (0-360).
 */
export function haversineBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const bearing = toDeg(Math.atan2(y, x));
  return ((bearing % 360) + 360) % 360;
}

// ===== Fusion Engine =====

// Acoustic detection and a BLE sighting are treated as the same event when
// they occur within this window of each other.
const TIME_THRESHOLD_MS = 5000;

// A FUSED detection is backed by a BLE Remote ID broadcast — digital proof a
// drone exists. Its confidence is this fixed high value, not a guess.
const BLE_CONFIRMED_CONFIDENCE = 0.97;

export class DetectionFusionEngine {
  private userPosition: UserPosition | null = null;

  /**
   * Update the user's current GPS position.
   * Required for computing bearing from user to BLE devices.
   */
  setUserPosition(position: UserPosition | null): void {
    this.userPosition = position;
  }

  /**
   * Fuse acoustic threat tracks with BLE Remote ID devices.
   * Returns an array of FUSED detections for matched pairs.
   *
   * Uses greedy 1:1 matching — each acoustic track and BLE device
   * can only be matched once.
   */
  fuse(
    tracks: ThreatTrack[],
    bleDevices: Record<string, RemoteIDData>,
  ): FusedDetection[] {
    if (!this.userPosition || !isFinite(this.userPosition.latitude) || !isFinite(this.userPosition.longitude)) return [];

    const activeTracks = tracks.filter((t) => t.isActive && t.detections.length > 0);
    const bleEntries = Object.entries(bleDevices).filter(
      ([, data]) => data.uavLatitude != null && data.uavLongitude != null && isFinite(data.uavLatitude!) && isFinite(data.uavLongitude!),
    );

    if (activeTracks.length === 0 || bleEntries.length === 0) return [];

    // Build candidate matches scored by time proximity only.
    type Candidate = {
      track: ThreatTrack;
      bleId: string;
      bleData: RemoteIDData;
      timeDiff: number;
    };

    const candidates: Candidate[] = [];

    for (const track of activeTracks) {
      const lastDetection = track.detections[track.detections.length - 1];

      for (const [bleId, bleData] of bleEntries) {
        // Skip entries with no valid timestamp instead of defaulting to 0 —
        // a `|| 0` sentinel could spuriously fuse if a detection timestamp is
        // itself near epoch (uninitialized/mocked).
        const seen = bleData.lastSeen;
        if (typeof seen !== 'number' || !Number.isFinite(seen)) continue;
        const tDiff = Math.abs(lastDetection.timestamp - seen);
        if (tDiff > TIME_THRESHOLD_MS) continue;
        candidates.push({ track, bleId, bleData, timeDiff: tDiff });
      }
    }

    // Greedy 1:1 matching — closest in time first.
    candidates.sort((a, b) => a.timeDiff - b.timeDiff);

    const usedTracks = new Set<string>();
    const usedBLE = new Set<string>();
    const results: FusedDetection[] = [];

    for (const c of candidates) {
      if (usedTracks.has(c.track.id) || usedBLE.has(c.bleId)) continue;

      usedTracks.add(c.track.id);
      usedBLE.add(c.bleId);

      const lastDetection = c.track.detections[c.track.detections.length - 1];

      // Position comes entirely from the BLE drone's broadcast GPS.
      const gpsDistance = haversineDistance(
        this.userPosition.latitude, this.userPosition.longitude,
        c.bleData.uavLatitude!, c.bleData.uavLongitude!,
      );
      const gpsBearing = haversineBearing(
        this.userPosition.latitude, this.userPosition.longitude,
        c.bleData.uavLatitude!, c.bleData.uavLongitude!,
      );

      const fused: FusedDetection = {
        ...lastDetection,
        id: `fused_${c.track.id}_${c.bleId}`,
        source: 'FUSED',
        // BLE Remote ID is digital proof — confidence is the fixed confirmed
        // value, not the acoustic guess and not a boosted multiple of it.
        confidence: BLE_CONFIRMED_CONFIDENCE,
        distanceMeters: Math.round(gpsDistance),
        bearingDegrees: Math.round(gpsBearing),
        approachRate: 0,
        remoteIdData: c.bleData,
        acousticTrackId: c.track.id,
        bleDeviceId: c.bleId,
        timestamp: Date.now(),
      };

      results.push(fused);
    }

    return results;
  }
}
