/**
 * BLE Remote ID Scanner Hook — v1.0
 *
 * Manages BLE scanner lifecycle, wires discoveries to detectionStore.
 * Gracefully handles BLE unavailability (returns bleAvailable: false).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { BLERemoteIDScanner } from '../core/ble/BLERemoteIDScanner';
import { createBLEAdapter } from '../core/ble/createBLEAdapter';
import { requestBLEPermissions } from '../utils/blePermissions';
import { useDetectionStore } from '../stores/detectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { RemoteIDData } from '../types';

export function useBLEScanner() {
  const scannerRef = useRef<BLERemoteIDScanner>(
    new BLERemoteIDScanner(createBLEAdapter())
  );
  const [bleAvailable, setBleAvailable] = useState(false);

  const {
    bleDevices, bleScanActive,
    setBLEScanActive, addBLEDevice, clearBLEDevices,
  } = useDetectionStore();

  const bleScanEnabled = useSettingsStore((s) => s.bleScanEnabled);

  // Check availability on mount
  useEffect(() => {
    const scanner = scannerRef.current;

    scanner.isAvailable().then((available) => {
      setBleAvailable(available);
    });

    // Wire discovery callback
    scanner.onRemoteID((deviceId: string, data: RemoteIDData) => {
      addBLEDevice(deviceId, data);
    });

    return () => {
      scanner.dispose();
    };
  }, []);

  const startBLE = useCallback(async () => {
    if (!bleAvailable || !bleScanEnabled) return false;

    // Request BLE permissions (Android 12+)
    const granted = await requestBLEPermissions();
    if (!granted) {
      console.warn('[BLE] Permissions denied');
      return false;
    }

    const scanner = scannerRef.current;
    clearBLEDevices();
    const started = await scanner.startScanning();
    setBLEScanActive(started);
    return started;
  }, [bleAvailable, bleScanEnabled]);

  const stopBLE = useCallback(async () => {
    const scanner = scannerRef.current;
    await scanner.stopScanning();
    setBLEScanActive(false);
  }, []);

  return {
    bleAvailable,
    bleScanActive,
    bleDevices,
    bleDeviceCount: Object.keys(bleDevices).length,
    startBLE,
    stopBLE,
  };
}
