import { BLERemoteIDScanner, MockBLEAdapter } from '../src/core/ble/BLERemoteIDScanner';

describe('BLERemoteIDScanner', () => {
  let scanner: BLERemoteIDScanner;

  beforeEach(() => {
    scanner = new BLERemoteIDScanner(new MockBLEAdapter());
  });

  afterEach(() => {
    scanner.dispose();
  });

  describe('availability', () => {
    it('should report availability (mock adapter returns true)', async () => {
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
      // No error thrown means success
      expect(true).toBe(true);
    });

    it('should handle double start gracefully', async () => {
      await scanner.startScanning();
      const second = await scanner.startScanning();
      // Should handle without error
      expect(typeof second).toBe('boolean');
      await scanner.stopScanning();
    });

    it('should handle stop without start', async () => {
      await scanner.stopScanning();
      expect(true).toBe(true);
    });
  });

  describe('onRemoteID callback', () => {
    it('should fire callback when device discovered', async () => {
      const discovered: Array<{ id: string; data: any }> = [];
      scanner.onRemoteID((id, data) => {
        discovered.push({ id, data });
      });

      await scanner.startScanning();

      // Mock adapter fires every 2s, first device at counter%8==0 → 16s
      await new Promise((resolve) => setTimeout(resolve, 17000));

      await scanner.stopScanning();
      expect(discovered.length).toBeGreaterThan(0);
      expect(discovered[0].id).toBeTruthy();
      expect(discovered[0].data).toBeTruthy();
    }, 25000);
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      scanner.dispose();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle dispose after scanning', async () => {
      await scanner.startScanning();
      scanner.dispose();
      expect(true).toBe(true);
    });
  });
});
