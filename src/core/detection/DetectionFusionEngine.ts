/**
 * Detection Fusion Engine — v1.0
 *
 * Fuses acoustic detection tracks with BLE Remote ID data to produce
 * enriched FUSED detections. Matching criteria:
 * - Bearing alignment: ±30° (acoustic DOA vs BLE GPS bearing)
 * - Time proximity: <5 seconds between detections
 *
 * FUSED detections gain:
 * - GPS-based distance (from BLE) instead of acoustic estimate
 * - 1.3x confidence boost (capped at 0.99)
 * - BLE metadata (serial, operator position, etc.)
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

/**
 * Angular difference between two bearings, accounting for 360° wrap.
 */
function bearingDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ===== Fusion Engine =====

const BEARING_THRESHOLD_DEG = 30;
const TIME_THRESHOLD_MS = 5000;
const CONFIDENCE_BOOST = 1.3;
const MAX_CONFIDENCE = 0.99;

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

    // Build candidate matches with scores
    type Candidate = {
      track: ThreatTrack;
      bleId: string;
      bleData: RemoteIDData;
      bearingDiff: number;
      timeDiff: number;
      score: number;
    };

    const candidates: Candidate[] = [];

    for (const track of activeTracks) {
      const lastDetection = track.detections[track.detections.length - 1];

      for (const [bleId, bleData] of bleEntries) {
        // Compute bearing from user to BLE device
        const bleBearing = haversineBearing(
          this.userPosition.latitude, this.userPosition.longitude,
          bleData.uavLatitude!, bleData.uavLongitude!,
        );

        const bDiff = bearingDifference(lastDetection.bearingDegrees, bleBearing);
        if (bDiff > BEARING_THRESHOLD_DEG) continue;

        const tDiff = Math.abs(lastDetection.timestamp - (bleData.lastSeen || 0));
        if (tDiff > TIME_THRESHOLD_MS) continue;

        // Score: lower is better (bearing weight + time weight)
        const score = bDiff / BEARING_THRESHOLD_DEG + tDiff / TIME_THRESHOLD_MS;

        candidates.push({ track, bleId, bleData, bearingDiff: bDiff, timeDiff: tDiff, score });
      }
    }

    // Greedy 1:1 matching (best score first)
    candidates.sort((a, b) => a.score - b.score);

    const usedTracks = new Set<string>();
    const usedBLE = new Set<string>();
    const results: FusedDetection[] = [];

    for (const c of candidates) {
      if (usedTracks.has(c.track.id) || usedBLE.has(c.bleId)) continue;

      usedTracks.add(c.track.id);
      usedBLE.add(c.bleId);

      const lastDetection = c.track.detections[c.track.detections.length - 1];

      // Compute GPS-based distance
      const gpsDistance = haversineDistance(
        this.userPosition.latitude, this.userPosition.longitude,
        c.bleData.uavLatitude!, c.bleData.uavLongitude!,
      );

      const fusedConfidence = Math.min(lastDetection.confidence * CONFIDENCE_BOOST, MAX_CONFIDENCE);

      const fused: FusedDetection = {
        ...lastDetection,
        id: `fused_${c.track.id}_${c.bleId}`,
        source: 'FUSED',
        confidence: fusedConfidence,
        distanceMeters: Math.round(gpsDistance),
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
