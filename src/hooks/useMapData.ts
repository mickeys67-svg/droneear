/**
 * Map Data Hook — v1.0
 *
 * Transforms acoustic tracks, BLE devices, and fused detections
 * into map markers. Also provides user location via expo-location.
 */

import { useEffect, useState, useMemo } from 'react';
import * as Location from 'expo-location';
import { useDetectionStore } from '../stores/detectionStore';
import type { FusedDetection } from '../core/detection/DetectionFusionEngine';
import type { RemoteIDData, ThreatTrack, DetectionResult } from '../types';

export type MarkerType = 'acoustic' | 'ble' | 'fused' | 'operator';

export interface MapMarker {
  id: string;
  type: MarkerType;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  /** For acoustic: detection radius in meters */
  radius?: number;
  /** BLE Remote ID data (if applicable) */
  remoteIdData?: RemoteIDData;
  /** Detection result (for acoustic/fused) */
  detection?: DetectionResult;
  /** Color hint for the marker */
  color: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Compute a lat/lon position from the user's position + bearing + distance.
 */
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

export function useMapData() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const { currentThreats, bleDevices, fusedDetections } = useDetectionStore();

  // Watch user location
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (loc) => {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        },
      );
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  const markers = useMemo(() => {
    const result: MapMarker[] = [];

    // Track which BLE devices are already fused
    const fusedBleIds = new Set(
      fusedDetections
        .map((d) => d.bleDeviceId)
        .filter(Boolean),
    );

    const fusedTrackIds = new Set(
      fusedDetections
        .map((d) => d.acousticTrackId)
        .filter(Boolean),
    );

    // 1. Acoustic tracks → radius circles (only unfused)
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

    // 2. BLE devices → pin markers (only unfused)
    for (const [id, data] of Object.entries(bleDevices)) {
      if (fusedBleIds.has(id)) continue;
      if (data.uavLatitude == null || data.uavLongitude == null) continue;

      result.push({
        id: `ble_${id}`,
        type: 'ble',
        latitude: data.uavLatitude,
        longitude: data.uavLongitude,
        title: data.serialNumber || id,
        description: data.manufacturer,
        remoteIdData: data,
        color: '#4488FF',
      });

      // Operator position
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

    // 3. Fused detections → enhanced markers
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
        description: rid.serialNumber,
        remoteIdData: rid,
        detection: fused,
        color: '#00FFAA',
      });
    }

    return result;
  }, [currentThreats, bleDevices, fusedDetections, userLocation]);

  return { userLocation, markers };
}
