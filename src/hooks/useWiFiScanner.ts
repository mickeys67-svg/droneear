/**
 * WiFi Remote ID Scanner Hook — v1.0
 *
 * Android-only WiFi Remote ID scanning.
 * Mirrors useBLEScanner.ts pattern.
 * On iOS: wifiAvailable=false, all operations are no-ops.
 *
 * WiFi devices are stored in detectionStore.bleDevices with 'wifi_' prefix
 * so the existing fusion engine processes them seamlessly.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { WiFiRemoteIDScanner } from '../core/wifi/WiFiRemoteIDScanner';
import { useDetectionStore } from '../stores/detectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { RemoteIDData } from '../types';

export function useWiFiScanner() {
  const scannerRef = useRef<WiFiRemoteIDScanner | null>(null);
  if (!scannerRef.current && Platform.OS === 'android') {
    scannerRef.current = new WiFiRemoteIDScanner();
  }

  const [wifiAvailable, setWifiAvailable] = useState(false);
  const [wifiScanActive, setWifiScanActive] = useState(false);

  const wifiScanEnabled = useSettingsStore((s) => s.bleScanEnabled); // Share BLE toggle for now

  // Check availability on mount (Android only)
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const scanner = scannerRef.current;
    if (!scanner) return;

    scanner.isAvailable().then((available) => {
      setWifiAvailable(available);
    }).catch(() => {
      setWifiAvailable(false);
    });

    // Wire discovery callback — use getState() for stable reference
    scanner.onRemoteID((deviceId: string, data: RemoteIDData) => {
      useDetectionStore.getState().addBLEDevice(deviceId, data);
    });

    return () => {
      scanner.stopScanning().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startWiFi = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    if (!wifiAvailable || !wifiScanEnabled) return false;

    const scanner = scannerRef.current;
    if (!scanner) return false;

    const started = await scanner.startScanning();
    setWifiScanActive(started);
    return started;
  }, [wifiAvailable, wifiScanEnabled]);

  const stopWiFi = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    await scanner.stopScanning();
    setWifiScanActive(false);
  }, []);

  return {
    wifiAvailable,
    wifiScanActive,
    startWiFi,
    stopWiFi,
  };
}
