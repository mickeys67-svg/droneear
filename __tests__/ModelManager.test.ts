import { ModelManager } from '../src/core/ml/ModelManager';

describe('ModelManager', () => {
  // ===== Model Loading =====
  describe('loadModel', () => {
    it('should initialize with UNLOADED status', () => {
      const mm = new ModelManager();
      expect(mm.currentStatus).toBe('UNLOADED');
    });

    it('should transition to READY after loading', async () => {
      const mm = new ModelManager();
      await mm.loadModel();
      expect(mm.currentStatus).toBe('READY');
    });

    it('should not reload if already READY', async () => {
      const mm = new ModelManager();
      await mm.loadModel();
      const start = performance.now();
      await mm.loadModel(); // Should be instant (no-op)
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50); // Should not wait 500ms again
    });

    it('should emit status changes', async () => {
      const mm = new ModelManager();
      const statuses: string[] = [];
      mm.onStatus((s) => statuses.push(s));

      await mm.loadModel();
      expect(statuses).toContain('LOADING');
      expect(statuses).toContain('READY');
    });
  });

  // ===== Model Info =====
  describe('info', () => {
    it('should have correct model metadata', () => {
      const mm = new ModelManager();
      const info = mm.info;
      expect(info).not.toBeNull();
      expect(info!.name).toBe('DroneEar-YAMNet-v2');
      expect(info!.quantization).toBe('INT8');
      expect(info!.outputClasses.length).toBe(6);
      expect(info!.inputShape).toEqual([1, 96, 128]);
    });
  });

  // ===== Prediction =====
  describe('predict', () => {
    it('should throw if model not loaded', async () => {
      const mm = new ModelManager();
      const frames = [new Float32Array(128)];
      await expect(mm.predict(frames)).rejects.toThrow('Model not ready');
    });

    it('should return probabilities for all 6 classes', async () => {
      const mm = new ModelManager();
      await mm.loadModel();

      const frames: Float32Array[] = [];
      for (let i = 0; i < 10; i++) {
        const frame = new Float32Array(128);
        for (let j = 0; j < 128; j++) frame[j] = Math.random() * 0.5 - 0.25;
        frames.push(frame);
      }

      const predictions = await mm.predict(frames);
      expect(predictions.size).toBe(6);

      // All probabilities should be valid
      for (const [cat, prob] of predictions) {
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
        expect(isNaN(prob)).toBe(false);
      }
    });

    it('should produce probabilities that sum to ~1.0 (softmax)', async () => {
      const mm = new ModelManager();
      await mm.loadModel();

      const frames: Float32Array[] = [];
      for (let i = 0; i < 10; i++) {
        const frame = new Float32Array(128);
        for (let j = 0; j < 128; j++) frame[j] = Math.random() - 0.5;
        frames.push(frame);
      }

      const predictions = await mm.predict(frames);
      let sum = 0;
      for (const prob of predictions.values()) sum += prob;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should return READY status after inference completes', async () => {
      const mm = new ModelManager();
      await mm.loadModel();

      const frames = [new Float32Array(128).fill(0.1)];
      await mm.predict(frames);
      expect(mm.currentStatus).toBe('READY');
    });

    it('should handle single frame input', async () => {
      const mm = new ModelManager();
      await mm.loadModel();

      const frames = [new Float32Array(128).fill(0.5)];
      const predictions = await mm.predict(frames);
      expect(predictions.size).toBe(6);
    });
  });

  // ===== Output Classes =====
  describe('OUTPUT_CLASSES', () => {
    it('should contain all expected acoustic pattern categories', () => {
      expect(ModelManager.OUTPUT_CLASSES).toContain('MULTIROTOR');
      expect(ModelManager.OUTPUT_CLASSES).toContain('SINGLE_ENGINE');
      expect(ModelManager.OUTPUT_CLASSES).toContain('SINGLE_ROTOR');
      expect(ModelManager.OUTPUT_CLASSES).toContain('JET_PROPULSION');
      expect(ModelManager.OUTPUT_CLASSES).toContain('PROPELLER_FIXED');
      expect(ModelManager.OUTPUT_CLASSES).toContain('BACKGROUND');
    });
  });
});
