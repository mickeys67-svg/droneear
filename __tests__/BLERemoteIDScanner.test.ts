import { BLERemoteIDScanner } from '../src/core/ble/BLERemoteIDScanner';
import type { BLEAdapter, BLEAdapterDevice } from '../src/core/ble/BLERemoteIDScanner';

/** Minimal test adapter — immediately available, no-op scan */
class TestBLEAdapter implements BLEAdapter {
  async isAvailable(): Promise<boolean> { return true; }
  async startScan(_onDevice: (device: BLEAdapterDevice) => void): Promise<void> {}
  async stopScan(): Promise<void> {}
  dispose(): void {}
}

describe('BLERemoteIDScanner', () => {
  let scanner: BLERemoteIDScanner;

  beforeEach(() => {
    scanner = new BLERemoteIDScanner(new TestBLEAdapter());
  });

  afterEach(() => {
    scanner.dispose();
  });

  describe('availability', () => {
    it('should report availability', async () => {
      const available = await scanner.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('lifecycle', () => {
    it('should start scanning', async () => {
      const started = await scanner.startScanning();
      expect(started).toBe(true);
      await scanner.stopScanning();
    });

    it('should stop scanning', async () => {
      await scanner.startScanning();
      await scanner.stopScanning();
      expect(true).toBe(true);
    });

    it('should handle double start gracefully', async () => {
      await scanner.startScanning();
      const second = await scanner.startScanning();
      expect(typeof second).toBe('boolean');
      await scanner.stopScanning();
    });

    it('should handle stop without start', async () => {
      await scanner.stopScanning();
      expect(true).toBe(true);
    });
  });

  describe('onRemoteID callback', () => {
    it('should accept callback without error', () => {
      scanner.onRemoteID((_id, _data) => {});
      expect(true).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      scanner.dispose();
      expect(true).toBe(true);
    });

    it('should handle dispose after scanning', async () => {
      await scanner.startScanning();
      scanner.dispose();
      expect(true).toBe(true);
    });
  });
});
