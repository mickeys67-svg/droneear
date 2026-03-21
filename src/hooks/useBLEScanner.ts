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
  const scannerRef = useRef<BLERemoteIDScanner | null>(null);
  if (!scannerRef.current) {
    scannerRef.current = new BLERemoteIDScanner(createBLEAdapter());
  }
  const [bleAvailable, setBleAvailable] = useState(false);

  const bleDevices = useDetectionStore((s) => s.bleDevices);
  const bleScanActive = useDetectionStore((s) => s.bleScanActive);
  const setBLEScanActive = useDetectionStore((s) => s.setBLEScanActive);
  const addBLEDevice = useDetectionStore((s) => s.addBLEDevice);
  const clearBLEDevices = useDetectionStore((s) => s.clearBLEDevices);

  const bleScanEnabled = useSettingsStore((s) => s.bleScanEnabled);

  // Check availability on mount — stable deps (access store via getState to avoid re-init)
  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    scanner.isAvailable().then((available) => {
      setBleAvailable(available);
    }).catch(() => {
      setBleAvailable(false);
    });

    // Wire discovery callback — use getState() to avoid dependency on addBLEDevice
    scanner.onRemoteID((deviceId: string, data: RemoteIDData) => {
      useDetectionStore.getState().addBLEDevice(deviceId, data);
    });

    return () => {
      scanner.stopScanning().catch(() => {});
      // Do NOT dispose — scannerRef persists for component lifetime
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startBLE = useCallback(async () => {
    if (!bleAvailable || !bleScanEnabled) return false;

    // Request BLE permissions (Android 12+)
    const granted = await requestBLEPermissions();
    if (!granted) {
      console.warn('[BLE] Permissions denied');
      return false;
    }

    const scanner = scannerRef.current;
    if (!scanner) return false;
    clearBLEDevices();
    const started = await scanner.startScanning();
    setBLEScanActive(started);
    return started;
  }, [bleAvailable, bleScanEnabled, clearBLEDevices, setBLEScanActive]);

  const stopBLE = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    await scanner.stopScanning();
    setBLEScanActive(false);
  }, [setBLEScanActive]);

  return {
    bleAvailable,
    bleScanActive,
    bleDevices,
    bleDeviceCount: Object.keys(bleDevices).length,
    startBLE,
    stopBLE,
  };
}
