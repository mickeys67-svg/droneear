/**
 * Tests for RealBLEAdapter
 *
 * Mocks react-native-ble-plx to test the adapter without native modules.
 */

// Mock react-native-ble-plx before imports
const mockStartDeviceScan = jest.fn();
const mockStopDeviceScan = jest.fn();
const mockDestroy = jest.fn();
const mockState = jest.fn();
const mockOnStateChange = jest.fn();

jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn().mockImplementation(() => ({
    state: mockState,
    onStateChange: mockOnStateChange,
    startDeviceScan: mockStartDeviceScan,
    stopDeviceScan: mockStopDeviceScan,
    destroy: mockDestroy,
  })),
  State: {
    PoweredOn: 'PoweredOn',
    PoweredOff: 'PoweredOff',
    Unknown: 'Unknown',
  },
}));

import { RealBLEAdapter, base64ToUint8Array } from '../src/core/ble/RealBLEAdapter';
import { ODID_SERVICE_UUID } from '../src/core/ble/RemoteIDParser';
import type { BLEAdapterDevice } from '../src/core/ble/BLERemoteIDScanner';

describe('RealBLEAdapter', () => {
  let adapter: RealBLEAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new RealBLEAdapter();
  });

  afterEach(() => {
    adapter.dispose();
  });

  describe('isAvailable', () => {
    it('returns true when BLE is PoweredOn', async () => {
      mockState.mockResolvedValue('PoweredOn');
      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('waits for state change and returns true on PoweredOn', async () => {
      mockState.mockResolvedValue('PoweredOff');
      mockOnStateChange.mockImplementation((callback: (state: string) => void) => {
        // Simulate state change after short delay
        setTimeout(() => callback('PoweredOn'), 100);
        return { remove: jest.fn() };
      });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('returns false on timeout', async () => {
      mockState.mockResolvedValue('PoweredOff');
      mockOnStateChange.mockImplementation(() => {
        // Never calls callback
        return { remove: jest.fn() };
      });

      // Use fake timers for the 5s timeout
      jest.useFakeTimers();
      const promise = adapter.isAvailable();
      // Flush microtask queue so the mockState promise resolves
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(5100);
      const result = await promise;
      expect(result).toBe(false);
      jest.useRealTimers();
    });

    it('returns false on error', async () => {
      mockState.mockRejectedValue(new Error('BLE error'));
      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('startScan', () => {
    it('calls BleManager.startDeviceScan with ODID UUID', async () => {
      const onDevice = jest.fn();
      await adapter.startScan(onDevice);

      expect(mockStartDeviceScan).toHaveBeenCalledTimes(1);
      const args = mockStartDeviceScan.mock.calls[0];
      expect(args[0]).toEqual([ODID_SERVICE_UUID]);
      expect(args[1]).toEqual({ allowDuplicates: true });
    });

    it('adapts device with serviceData and calls onDevice', async () => {
      const onDevice = jest.fn();
      mockStartDeviceScan.mockImplementation(
        (_uuids: string[], _opts: any, callback: (error: any, device: any) => void) => {
          // Simulate a device discovery
          callback(null, {
            id: 'AA:BB:CC:DD:EE:FF',
            name: 'DJI-RID',
            rssi: -72,
            serviceData: {
              [ODID_SERVICE_UUID]: 'AQIDBA==', // base64 for [1, 2, 3, 4]
            },
            manufacturerData: null,
          });
        },
      );

      await adapter.startScan(onDevice);

      expect(onDevice).toHaveBeenCalledTimes(1);
      const device: BLEAdapterDevice = onDevice.mock.calls[0][0];
      expect(device.id).toBe('AA:BB:CC:DD:EE:FF');
      expect(device.name).toBe('DJI-RID');
      expect(device.rssi).toBe(-72);
      expect(device.serviceData).toBeInstanceOf(Uint8Array);
      expect(Array.from(device.serviceData!)).toEqual([1, 2, 3, 4]);
    });

    it('skips devices without data', async () => {
      const onDevice = jest.fn();
      mockStartDeviceScan.mockImplementation(
        (_uuids: string[], _opts: any, callback: (error: any, device: any) => void) => {
          callback(null, {
            id: 'XX:XX',
            name: null,
            rssi: -90,
            serviceData: null,
            manufacturerData: null,
          });
        },
      );

      await adapter.startScan(onDevice);
      expect(onDevice).not.toHaveBeenCalled();
    });

    it('handles scan errors gracefully', async () => {
      const onDevice = jest.fn();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockStartDeviceScan.mockImplementation(
        (_uuids: string[], _opts: any, callback: (error: any, device: any) => void) => {
          callback({ message: 'Scan failed' }, null);
        },
      );

      await adapter.startScan(onDevice);
      expect(onDevice).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('stopScan', () => {
    it('calls BleManager.stopDeviceScan', async () => {
      await adapter.startScan(jest.fn());
      await adapter.stopScan();
      expect(mockStopDeviceScan).toHaveBeenCalled();
    });

    it('is idempotent when not scanning', async () => {
      await adapter.stopScan();
      expect(mockStopDeviceScan).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('destroys BleManager', () => {
      adapter.dispose();
      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});

describe('base64ToUint8Array', () => {
  it('decodes simple base64', () => {
    // "AQIDBA==" = [1, 2, 3, 4]
    const result = base64ToUint8Array('AQIDBA==');
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('decodes base64 without padding', () => {
    // "AQID" = [1, 2, 3]
    const result = base64ToUint8Array('AQID');
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it('decodes empty string', () => {
    const result = base64ToUint8Array('');
    expect(result.length).toBe(0);
  });

  it('decodes longer payloads correctly', () => {
    // "SGVsbG8gV29ybGQ=" = "Hello World"
    const result = base64ToUint8Array('SGVsbG8gV29ybGQ=');
    const text = String.fromCharCode(...result);
    expect(text).toBe('Hello World');
  });
});
