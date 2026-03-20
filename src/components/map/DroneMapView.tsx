/**
 * DroneMapView — v1.0
 *
 * Displays drone detections on a map using react-native-maps.
 * - BLE devices: blue pin markers with serial/altitude/speed callouts
 * - Acoustic detections: radius circles showing estimated range
 * - Fused detections: green enhanced markers combining both sources
 * - Operator positions: orange markers
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Circle, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTranslation } from '@/src/i18n/useTranslation';
import type { MapMarker, UserLocation } from '@/src/hooks/useMapData';

interface DroneMapViewProps {
  userLocation: UserLocation | null;
  markers: MapMarker[];
  selectedMarkerId?: string | null;
  onMarkerPress?: (marker: MapMarker) => void;
}

export default function DroneMapView({ userLocation, markers, selectedMarkerId, onMarkerPress }: DroneMapViewProps) {
  const t = useTranslation();

  if (!userLocation) {
    return (
      <View style={styles.noLocation}>
        <Text style={styles.noLocationIcon}>📍</Text>
        <Text style={styles.noLocationText}>{t.mapNoLocation}</Text>
      </View>
    );
  }

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={styles.map}
      initialRegion={{
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
      showsMyLocationButton
      showsCompass
    >
      {markers.map((marker) => {
        // Acoustic markers: render as circles
        if (marker.type === 'acoustic' && marker.radius) {
          return (
            <React.Fragment key={marker.id}>
              <Circle
                center={{ latitude: marker.latitude, longitude: marker.longitude }}
                radius={marker.radius}
                fillColor={`${marker.color}22`}
                strokeColor={`${marker.color}88`}
                strokeWidth={2}
              />
              <Marker
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                pinColor={marker.color}
                opacity={selectedMarkerId === marker.id ? 1.0 : 0.8}
                onPress={() => onMarkerPress?.(marker)}
              >
                <Callout>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{t.mapAcousticRadius}</Text>
                    <Text style={styles.calloutText}>
                      {marker.detection?.threatCategory} — {(isFinite(marker.detection?.confidence ?? 0) ? ((marker.detection?.confidence ?? 0) * 100).toFixed(0) : '0')}%
                    </Text>
                    <Text style={styles.calloutText}>
                      ~{isFinite(marker.detection?.distanceMeters ?? 0) ? marker.detection?.distanceMeters : '?'}m
                    </Text>
                  </View>
                </Callout>
              </Marker>
            </React.Fragment>
          );
        }

        // BLE markers
        if (marker.type === 'ble') {
          const rid = marker.remoteIdData;
          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              pinColor={marker.color}
              onPress={() => onMarkerPress?.(marker)}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{t.mapBLEDevice}</Text>
                  {rid?.serialNumber && (
                    <Text style={styles.calloutText}>{t.mapSerial}: {rid.serialNumber}</Text>
                  )}
                  {rid?.uavAltitude != null && isFinite(rid.uavAltitude) && (
                    <Text style={styles.calloutText}>{t.mapAltitude}: {rid.uavAltitude.toFixed(0)}m</Text>
                  )}
                  {rid?.speed != null && isFinite(rid.speed) && (
                    <Text style={styles.calloutText}>{t.mapSpeed}: {rid.speed.toFixed(1)} m/s</Text>
                  )}
                  {rid?.heading != null && isFinite(rid.heading) && (
                    <Text style={styles.calloutText}>{t.mapHeading}: {rid.heading.toFixed(0)}°</Text>
                  )}
                  {rid?.manufacturer && (
                    <Text style={styles.calloutText}>{rid.manufacturer}</Text>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        }

        // Fused markers
        if (marker.type === 'fused') {
          const rid = marker.remoteIdData;
          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              pinColor={marker.color}
              onPress={() => onMarkerPress?.(marker)}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{t.mapFusedDetection}</Text>
                  <Text style={styles.calloutText}>
                    {marker.detection?.threatCategory} — {(isFinite(marker.detection?.confidence ?? 0) ? ((marker.detection?.confidence ?? 0) * 100).toFixed(0) : '0')}%
                  </Text>
                  {rid?.serialNumber && (
                    <Text style={styles.calloutText}>{t.mapSerial}: {rid.serialNumber}</Text>
                  )}
                  {rid?.uavAltitude != null && isFinite(rid.uavAltitude) && (
                    <Text style={styles.calloutText}>{t.mapAltitude}: {rid.uavAltitude.toFixed(0)}m</Text>
                  )}
                  {rid?.speed != null && isFinite(rid.speed) && (
                    <Text style={styles.calloutText}>{t.mapSpeed}: {rid.speed.toFixed(1)} m/s</Text>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        }

        // Operator markers
        if (marker.type === 'operator') {
          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              pinColor={marker.color}
              opacity={0.7}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{t.mapOperator}</Text>
                  <Text style={styles.calloutText}>{marker.title}</Text>
                </View>
              </Callout>
            </Marker>
          );
        }

        return null;
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  noLocation: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noLocationIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noLocationText: {
    fontSize: 15,
    textAlign: 'center',
    color: '#999',
  },
  callout: {
    minWidth: 150,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
});
