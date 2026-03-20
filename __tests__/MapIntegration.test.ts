/**
 * Tests for map data transformation
 *
 * Tests BLE→marker, acoustic→radius circle, fused→enhanced marker,
 * coordinate conversion, and empty state handling.
 */

import type { DetectionResult, RemoteIDData, ThreatTrack } from '../src/types';

// We test the offsetPosition logic and marker construction
// without the React hook (which requires expo-location).

function offsetPosition(
  lat: number, lon: number,
  bearingDeg: number, distanceM: number,
): { latitude: number; longitude: number } {
  const R = 6_371_000;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const d = distanceM / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 + Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (lon2 * 180) / Math.PI,
  };
}

type MarkerType = 'acoustic' | 'ble' | 'fused' | 'operator';

interface MapMarker {
  id: string;
  type: MarkerType;
  latitude: number;
  longitude: number;
  title: string;
  radius?: number;
  remoteIdData?: RemoteIDData;
  detection?: DetectionResult;
  color: string;
}

/**
 * Pure function version of marker building (matches useMapData logic).
 */
function buildMarkers(
  currentThreats: ThreatTrack[],
  bleDevices: Record<string, RemoteIDData>,
  fusedDetections: DetectionResult[],
  userLocation: { latitude: number; longitude: number } | null,
): MapMarker[] {
  const result: MapMarker[] = [];

  const fusedBleIds = new Set(
    fusedDetections
      .filter((d) => d.source === 'FUSED')
      .map((d) => (d as any).bleDeviceId as string)
      .filter(Boolean),
  );
  const fusedTrackIds = new Set(
    fusedDetections
      .filter((d) => d.source === 'FUSED')
      .map((d) => (d as any).acousticTrackId as string)
      .filter(Boolean),
  );

  // Acoustic
  if (userLocation) {
    for (const track of currentThreats) {
      if (!track.isActive || track.detections.length === 0) continue;
      if (fusedTrackIds.has(track.id)) continue;
      const last = track.detections[track.detections.length - 1];
      const pos = offsetPosition(
        userLocation.latitude, userLocation.longitude,
        last.bearingDegrees, last.distanceMeters,
      );
      result.push({
        id: `acoustic_${track.id}`,
        type: 'acoustic',
        latitude: pos.latitude,
        longitude: pos.longitude,
        title: last.threatCategory,
        radius: Math.max(50, last.distanceMeters * 0.2),
        detection: last,
        color: last.severity === 'CRITICAL' ? '#FF4444' :
               last.severity === 'HIGH' ? '#FF8800' : '#00FF88',
      });
    }
  }

  // BLE
  for (const [id, data] of Object.entries(bleDevices)) {
    if (fusedBleIds.has(id)) continue;
    if (data.uavLatitude == null || data.uavLongitude == null) continue;
    result.push({
      id: `ble_${id}`,
      type: 'ble',
      latitude: data.uavLatitude,
      longitude: data.uavLongitude,
      title: data.serialNumber || id,
      remoteIdData: data,
      color: '#4488FF',
    });
    if (data.operatorLatitude != null && data.operatorLongitude != null) {
      result.push({
        id: `operator_${id}`,
        type: 'operator',
        latitude: data.operatorLatitude,
        longitude: data.operatorLongitude,
        title: `Operator: ${data.serialNumber || id}`,
        color: '#FFAA00',
      });
    }
  }

  // Fused
  for (const fused of fusedDetections) {
    if (fused.source !== 'FUSED') continue;
    const rid = fused.remoteIdData;
    if (!rid?.uavLatitude || !rid?.uavLongitude) continue;
    result.push({
      id: fused.id,
      type: 'fused',
      latitude: rid.uavLatitude,
      longitude: rid.uavLongitude,
      title: `${fused.threatCategory} (Fused)`,
      remoteIdData: rid,
      detection: fused,
      color: '#00FFAA',
    });
  }

  return result;
}

// Test helpers
function makeDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    id: 'det_1',
    threatCategory: 'DRONE_SMALL',
    severity: 'HIGH',
    confidence: 0.8,
    distanceMeters: 500,
    bearingDegrees: 90,
    approachRate: -5,
    timestamp: Date.now(),
    spectralSignature: [],
    frequencyPeaks: [],
    ...overrides,
  };
}

function makeTrack(det: DetectionResult): ThreatTrack {
  return {
    id: det.id,
    detections: [det],
    firstSeen: det.timestamp,
    lastSeen: det.timestamp,
    predictedETA: null,
    kalmanState: null,
    isActive: true,
  };
}

function makeBLE(overrides: Partial<RemoteIDData> = {}): RemoteIDData {
  return {
    serialNumber: 'SN-001',
    uavLatitude: 37.567,
    uavLongitude: 126.979,
    lastSeen: Date.now(),
    ...overrides,
  };
}

describe('Map marker building', () => {
  const userLoc = { latitude: 37.5665, longitude: 126.978 };

  describe('empty state', () => {
    it('returns empty array when no data', () => {
      const markers = buildMarkers([], {}, [], userLoc);
      expect(markers).toEqual([]);
    });

    it('returns empty when no user location for acoustic', () => {
      const det = makeDetection();
      const track = makeTrack(det);
      const markers = buildMarkers([track], {}, [], null);
      expect(markers.filter((m) => m.type === 'acoustic')).toHaveLength(0);
    });
  });

  describe('acoustic → radius circle', () => {
    it('creates acoustic marker with radius', () => {
      const det = makeDetection({ distanceMeters: 400 });
      const track = makeTrack(det);
      const markers = buildMarkers([track], {}, [], userLoc);

      expect(markers).toHaveLength(1);
      expect(markers[0].type).toBe('acoustic');
      expect(markers[0].radius).toBe(80); // 400 * 0.2
      expect(markers[0].id).toBe('acoustic_det_1');
    });

    it('sets minimum radius of 50m', () => {
      const det = makeDetection({ distanceMeters: 100 });
      const track = makeTrack(det);
      const markers = buildMarkers([track], {}, [], userLoc);

      expect(markers[0].radius).toBe(50); // max(50, 100*0.2=20) = 50
    });

    it('calculates position from bearing + distance', () => {
      const det = makeDetection({ bearingDegrees: 0, distanceMeters: 1000 });
      const track = makeTrack(det);
      const markers = buildMarkers([track], {}, [], userLoc);

      // Bearing 0 = due north, so latitude should increase
      expect(markers[0].latitude).toBeGreaterThan(userLoc.latitude);
      expect(markers[0].longitude).toBeCloseTo(userLoc.longitude, 3);
    });

    it('sets color based on severity', () => {
      const critical = makeDetection({ id: 'c', severity: 'CRITICAL' });
      const high = makeDetection({ id: 'h', severity: 'HIGH' });
      const low = makeDetection({ id: 'l', severity: 'LOW' });

      const markers = buildMarkers(
        [makeTrack(critical), makeTrack(high), makeTrack(low)],
        {}, [], userLoc,
      );

      expect(markers.find((m) => m.id === 'acoustic_c')?.color).toBe('#FF4444');
      expect(markers.find((m) => m.id === 'acoustic_h')?.color).toBe('#FF8800');
      expect(markers.find((m) => m.id === 'acoustic_l')?.color).toBe('#00FF88');
    });

    it('skips inactive tracks', () => {
      const det = makeDetection();
      const track = makeTrack(det);
      track.isActive = false;
      const markers = buildMarkers([track], {}, [], userLoc);
      expect(markers).toHaveLength(0);
    });
  });

  describe('BLE → pin markers', () => {
    it('creates BLE marker at GPS coordinates', () => {
      const ble = makeBLE({ uavLatitude: 37.567, uavLongitude: 126.979 });
      const markers = buildMarkers([], { 'ble1': ble }, [], userLoc);

      const bleMarker = markers.find((m) => m.type === 'ble');
      expect(bleMarker).toBeDefined();
      expect(bleMarker!.latitude).toBe(37.567);
      expect(bleMarker!.longitude).toBe(126.979);
      expect(bleMarker!.title).toBe('SN-001');
      expect(bleMarker!.color).toBe('#4488FF');
    });

    it('skips BLE devices without GPS', () => {
      const ble = makeBLE({ uavLatitude: undefined, uavLongitude: undefined });
      const markers = buildMarkers([], { 'ble1': ble }, [], userLoc);
      expect(markers.filter((m) => m.type === 'ble')).toHaveLength(0);
    });

    it('creates operator marker when operator position exists', () => {
      const ble = makeBLE({
        operatorLatitude: 37.565,
        operatorLongitude: 126.977,
      });
      const markers = buildMarkers([], { 'ble1': ble }, [], userLoc);

      const opMarker = markers.find((m) => m.type === 'operator');
      expect(opMarker).toBeDefined();
      expect(opMarker!.latitude).toBe(37.565);
      expect(opMarker!.color).toBe('#FFAA00');
    });
  });

  describe('fused → enhanced markers', () => {
    it('creates fused marker at BLE GPS position', () => {
      const fusedDet = makeDetection({
        id: 'fused_1',
        source: 'FUSED',
        remoteIdData: makeBLE({ uavLatitude: 37.568, uavLongitude: 126.980 }),
      }) as any;
      fusedDet.bleDeviceId = 'ble1';
      fusedDet.acousticTrackId = 'det_1';

      const markers = buildMarkers([], {}, [fusedDet], userLoc);

      const fusedMarker = markers.find((m) => m.type === 'fused');
      expect(fusedMarker).toBeDefined();
      expect(fusedMarker!.latitude).toBe(37.568);
      expect(fusedMarker!.color).toBe('#00FFAA');
    });

    it('excludes fused BLE devices from standalone BLE markers', () => {
      const fusedDet = makeDetection({
        id: 'fused_1',
        source: 'FUSED',
        remoteIdData: makeBLE({ uavLatitude: 37.568, uavLongitude: 126.980 }),
      }) as any;
      fusedDet.bleDeviceId = 'ble1';
      fusedDet.acousticTrackId = 'det_1';

      const ble = makeBLE({ uavLatitude: 37.568, uavLongitude: 126.980 });
      const det = makeDetection();
      const track = makeTrack(det);

      const markers = buildMarkers([track], { 'ble1': ble }, [fusedDet], userLoc);

      // BLE device 'ble1' should not appear as standalone
      expect(markers.filter((m) => m.type === 'ble')).toHaveLength(0);
      // Acoustic track 'det_1' should not appear as standalone
      expect(markers.filter((m) => m.type === 'acoustic')).toHaveLength(0);
      // Only fused marker should exist
      expect(markers.filter((m) => m.type === 'fused')).toHaveLength(1);
    });
  });
});

describe('offsetPosition', () => {
  it('moves north when bearing is 0', () => {
    const result = offsetPosition(37.5665, 126.978, 0, 1000);
    expect(result.latitude).toBeGreaterThan(37.5665);
    expect(result.longitude).toBeCloseTo(126.978, 3);
  });

  it('moves east when bearing is 90', () => {
    const result = offsetPosition(37.5665, 126.978, 90, 1000);
    expect(result.latitude).toBeCloseTo(37.5665, 3);
    expect(result.longitude).toBeGreaterThan(126.978);
  });

  it('moves south when bearing is 180', () => {
    const result = offsetPosition(37.5665, 126.978, 180, 1000);
    expect(result.latitude).toBeLessThan(37.5665);
  });

  it('handles 0 distance', () => {
    const result = offsetPosition(37.5665, 126.978, 45, 0);
    expect(result.latitude).toBeCloseTo(37.5665, 5);
    expect(result.longitude).toBeCloseTo(126.978, 5);
  });
});
