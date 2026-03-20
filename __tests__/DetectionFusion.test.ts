/**
 * Tests for DetectionFusionEngine
 *
 * Tests bearing matching, time matching, confidence boost,
 * haversine distance/bearing, greedy 1:1 matching, 360° wrap-around.
 */

import {
  DetectionFusionEngine,
  haversineDistance,
  haversineBearing,
} from '../src/core/detection/DetectionFusionEngine';
import type { ThreatTrack, DetectionResult, RemoteIDData } from '../src/types';

function makeDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    id: 'det_1',
    threatCategory: 'DRONE_SMALL',
    severity: 'HIGH',
    confidence: 0.75,
    distanceMeters: 500,
    bearingDegrees: 45,
    approachRate: -5,
    timestamp: Date.now(),
    spectralSignature: new Array(128).fill(0),
    frequencyPeaks: [1000, 2000],
    source: 'ACOUSTIC',
    ...overrides,
  };
}

function makeTrack(detection: DetectionResult, id?: string): ThreatTrack {
  return {
    id: id || detection.id,
    detections: [detection],
    firstSeen: detection.timestamp,
    lastSeen: detection.timestamp,
    predictedETA: null,
    kalmanState: null,
    isActive: true,
  };
}

function makeBLEDevice(overrides: Partial<RemoteIDData> = {}): RemoteIDData {
  return {
    serialNumber: 'SN-001',
    uavLatitude: 37.5670,
    uavLongitude: 126.9785,
    uavAltitude: 120,
    speed: 15,
    heading: 45,
    lastSeen: Date.now(),
    rssi: -70,
    ...overrides,
  };
}

describe('DetectionFusionEngine', () => {
  let engine: DetectionFusionEngine;
  const userPos = { latitude: 37.5665, longitude: 126.9780 };

  beforeEach(() => {
    engine = new DetectionFusionEngine();
    engine.setUserPosition(userPos);
  });

  describe('fuse', () => {
    it('returns empty when user position is not set', () => {
      engine.setUserPosition(null);
      const det = makeDetection();
      const track = makeTrack(det);
      const bleDevices = { 'ble1': makeBLEDevice() };

      const result = engine.fuse([track], bleDevices);
      expect(result).toEqual([]);
    });

    it('returns empty when no active tracks', () => {
      const track = makeTrack(makeDetection());
      track.isActive = false;
      const result = engine.fuse([track], { 'ble1': makeBLEDevice() });
      expect(result).toEqual([]);
    });

    it('returns empty when no BLE devices', () => {
      const track = makeTrack(makeDetection());
      const result = engine.fuse([track], {});
      expect(result).toEqual([]);
    });

    it('returns empty when BLE devices have no GPS', () => {
      const track = makeTrack(makeDetection());
      const bleDevices = {
        'ble1': makeBLEDevice({ uavLatitude: undefined, uavLongitude: undefined }),
      };
      const result = engine.fuse([track], bleDevices);
      expect(result).toEqual([]);
    });

    it('matches acoustic track with BLE device when bearing aligns', () => {
      // BLE device is northeast of user — bearing ~45°
      const bleLat = userPos.latitude + 0.0005;
      const bleLon = userPos.longitude + 0.0005;
      const expectedBearing = haversineBearing(
        userPos.latitude, userPos.longitude, bleLat, bleLon,
      );

      const det = makeDetection({
        bearingDegrees: expectedBearing,
        timestamp: Date.now(),
      });
      const track = makeTrack(det);

      const bleDevices = {
        'ble1': makeBLEDevice({
          uavLatitude: bleLat,
          uavLongitude: bleLon,
          lastSeen: Date.now(),
        }),
      };

      const result = engine.fuse([track], bleDevices);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('FUSED');
      expect(result[0].bleDeviceId).toBe('ble1');
      expect(result[0].acousticTrackId).toBe(det.id);
    });

    it('boosts confidence by 1.3x (capped at 0.99)', () => {
      const bleLat = userPos.latitude + 0.0005;
      const bleLon = userPos.longitude + 0.0005;
      const bearing = haversineBearing(
        userPos.latitude, userPos.longitude, bleLat, bleLon,
      );

      const det = makeDetection({
        bearingDegrees: bearing,
        confidence: 0.85,
        timestamp: Date.now(),
      });
      const track = makeTrack(det);

      const result = engine.fuse([track], {
        'ble1': makeBLEDevice({
          uavLatitude: bleLat, uavLongitude: bleLon,
          lastSeen: Date.now(),
        }),
      });

      expect(result).toHaveLength(1);
      // 0.85 * 1.3 = 1.105 → capped at 0.99
      expect(result[0].confidence).toBe(0.99);
    });

    it('uses GPS-based distance instead of acoustic estimate', () => {
      const bleLat = userPos.latitude + 0.001;
      const bleLon = userPos.longitude;
      const bearing = haversineBearing(
        userPos.latitude, userPos.longitude, bleLat, bleLon,
      );

      const det = makeDetection({
        bearingDegrees: bearing,
        distanceMeters: 999, // acoustic estimate
        timestamp: Date.now(),
      });
      const track = makeTrack(det);

      const result = engine.fuse([track], {
        'ble1': makeBLEDevice({
          uavLatitude: bleLat, uavLongitude: bleLon,
          lastSeen: Date.now(),
        }),
      });

      expect(result).toHaveLength(1);
      // GPS distance should be ~111m (0.001 degree latitude)
      expect(result[0].distanceMeters).toBeGreaterThan(90);
      expect(result[0].distanceMeters).toBeLessThan(130);
      expect(result[0].distanceMeters).not.toBe(999);
    });

    it('rejects match when bearing difference > 30°', () => {
      const bleLat = userPos.latitude + 0.0005;
      const bleLon = userPos.longitude + 0.0005;
      const bearing = haversineBearing(
        userPos.latitude, userPos.longitude, bleLat, bleLon,
      );

      // Acoustic bearing is 40° off from BLE bearing
      const det = makeDetection({
        bearingDegrees: (bearing + 40) % 360,
        timestamp: Date.now(),
      });
      const track = makeTrack(det);

      const result = engine.fuse([track], {
        'ble1': makeBLEDevice({
          uavLatitude: bleLat, uavLongitude: bleLon,
          lastSeen: Date.now(),
        }),
      });

      expect(result).toHaveLength(0);
    });

    it('rejects match when time difference > 5 seconds', () => {
      const bleLat = userPos.latitude + 0.0005;
      const bleLon = userPos.longitude + 0.0005;
      const bearing = haversineBearing(
        userPos.latitude, userPos.longitude, bleLat, bleLon,
      );

      const now = Date.now();
      const det = makeDetection({
        bearingDegrees: bearing,
        timestamp: now - 10000, // 10 seconds ago
      });
      const track = makeTrack(det);

      const result = engine.fuse([track], {
        'ble1': makeBLEDevice({
          uavLatitude: bleLat, uavLongitude: bleLon,
          lastSeen: now,
        }),
      });

      expect(result).toHaveLength(0);
    });

    it('performs greedy 1:1 matching', () => {
      const now = Date.now();

      // Two tracks at different bearings
      const bleLat1 = userPos.latitude + 0.0005;
      const bleLon1 = userPos.longitude;
      const bearing1 = haversineBearing(userPos.latitude, userPos.longitude, bleLat1, bleLon1);

      const bleLat2 = userPos.latitude;
      const bleLon2 = userPos.longitude + 0.0005;
      const bearing2 = haversineBearing(userPos.latitude, userPos.longitude, bleLat2, bleLon2);

      const det1 = makeDetection({ id: 'det_1', bearingDegrees: bearing1, timestamp: now });
      const det2 = makeDetection({ id: 'det_2', bearingDegrees: bearing2, timestamp: now });
      const track1 = makeTrack(det1, 'det_1');
      const track2 = makeTrack(det2, 'det_2');

      const bleDevices = {
        'ble1': makeBLEDevice({ uavLatitude: bleLat1, uavLongitude: bleLon1, lastSeen: now }),
        'ble2': makeBLEDevice({ uavLatitude: bleLat2, uavLongitude: bleLon2, lastSeen: now }),
      };

      const result = engine.fuse([track1, track2], bleDevices);
      expect(result).toHaveLength(2);

      // Each BLE device should be used exactly once
      const usedBle = result.map((r) => r.bleDeviceId);
      expect(new Set(usedBle).size).toBe(2);
    });

    it('handles 360° bearing wrap-around', () => {
      // BLE device at bearing ~355° (nearly due north)
      const bleLat = userPos.latitude + 0.001;
      const bleLon = userPos.longitude - 0.0001;
      const bearing = haversineBearing(
        userPos.latitude, userPos.longitude, bleLat, bleLon,
      );

      // Acoustic detection at bearing 5° (should be within 30° of ~355°)
      const det = makeDetection({
        bearingDegrees: (bearing + 10) % 360,
        timestamp: Date.now(),
      });
      const track = makeTrack(det);

      const result = engine.fuse([track], {
        'ble1': makeBLEDevice({
          uavLatitude: bleLat, uavLongitude: bleLon,
          lastSeen: Date.now(),
        }),
      });

      expect(result).toHaveLength(1);
    });
  });
});

describe('Haversine utilities', () => {
  it('computes distance between two points', () => {
    // Seoul (37.5665, 126.978) to ~111m north
    const dist = haversineDistance(37.5665, 126.978, 37.5675, 126.978);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  it('returns 0 for same point', () => {
    const dist = haversineDistance(37.5665, 126.978, 37.5665, 126.978);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('computes bearing due north', () => {
    const bearing = haversineBearing(37.5665, 126.978, 37.5675, 126.978);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('computes bearing due east', () => {
    const bearing = haversineBearing(37.5665, 126.978, 37.5665, 126.979);
    expect(bearing).toBeGreaterThan(85);
    expect(bearing).toBeLessThan(95);
  });

  it('computes bearing due south', () => {
    const bearing = haversineBearing(37.5665, 126.978, 37.5655, 126.978);
    expect(bearing).toBeGreaterThan(175);
    expect(bearing).toBeLessThan(185);
  });
});
