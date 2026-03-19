import { KalmanFilter2D } from '../src/core/detection/KalmanFilter';

describe('KalmanFilter2D', () => {
  // ===== Initialization =====
  describe('init', () => {
    it('should set initial position correctly', () => {
      const kf = new KalmanFilter2D();
      const state = kf.init(100, 200);
      expect(state.x).toBe(100);
      expect(state.y).toBe(200);
      expect(state.vx).toBe(0);
      expect(state.vy).toBe(0);
    });

    it('should set initial covariance as 4x4 matrix', () => {
      const kf = new KalmanFilter2D();
      const state = kf.init(0, 0);
      expect(state.P.length).toBe(4);
      state.P.forEach(row => expect(row.length).toBe(4));
    });

    it('should have positive diagonal covariance', () => {
      const kf = new KalmanFilter2D();
      const state = kf.init(0, 0);
      for (let i = 0; i < 4; i++) {
        expect(state.P[i][i]).toBeGreaterThan(0);
      }
    });
  });

  // ===== Predict =====
  describe('predict', () => {
    it('should advance position by velocity * dt', () => {
      const kf = new KalmanFilter2D(1.0); // dt = 1 second
      let state = kf.init(0, 0);
      state.vx = 10; // 10 m/s east
      state.vy = -5; // 5 m/s south

      const predicted = kf.predict(state);
      expect(predicted.x).toBeCloseTo(10, 5);
      expect(predicted.y).toBeCloseTo(-5, 5);
    });

    it('should preserve velocity', () => {
      const kf = new KalmanFilter2D(0.5);
      let state = kf.init(100, 200);
      state.vx = 20;
      state.vy = -10;

      const predicted = kf.predict(state);
      expect(predicted.vx).toBe(20);
      expect(predicted.vy).toBe(-10);
    });

    it('should increase covariance (uncertainty grows)', () => {
      const kf = new KalmanFilter2D(1.0, 1.0);
      const state = kf.init(0, 0);
      const predicted = kf.predict(state);

      // Position uncertainty should increase
      expect(predicted.P[0][0]).toBeGreaterThan(state.P[0][0]);
      expect(predicted.P[1][1]).toBeGreaterThan(state.P[1][1]);
    });

    it('should keep covariance matrix symmetric', () => {
      const kf = new KalmanFilter2D(0.5, 0.5, 10);
      let state = kf.init(100, 200);
      state.vx = 5;
      state.vy = -3;

      const predicted = kf.predict(state);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          expect(predicted.P[i][j]).toBeCloseTo(predicted.P[j][i], 8);
        }
      }
    });
  });

  // ===== Update =====
  describe('update', () => {
    it('should move state toward measurement', () => {
      const kf = new KalmanFilter2D(1.0, 1.0, 5);
      const state = kf.init(0, 0);
      const updated = kf.update(state, 100, 50);

      // After update, position should be closer to measurement
      expect(updated.x).toBeGreaterThan(0);
      expect(updated.y).toBeGreaterThan(0);
    });

    it('should reduce position covariance', () => {
      const kf = new KalmanFilter2D(1.0, 1.0, 5);
      const state = kf.init(0, 0);
      const updated = kf.update(state, 100, 50);

      // Position uncertainty should decrease after measurement
      expect(updated.P[0][0]).toBeLessThan(state.P[0][0]);
      expect(updated.P[1][1]).toBeLessThan(state.P[1][1]);
    });

    it('should estimate velocity from consecutive updates', () => {
      const kf = new KalmanFilter2D(1.0, 0.1, 1);
      let state = kf.init(0, 0);

      // Simulate object moving at 10 m/s east
      for (let t = 0; t < 10; t++) {
        state = kf.predict(state);
        state = kf.update(state, t * 10, 0);
      }

      // Velocity should converge toward ~10 m/s east
      expect(state.vx).toBeGreaterThan(5); // Should be approaching 10
      expect(Math.abs(state.vy)).toBeLessThan(5); // Should be near 0
    });
  });

  // ===== ETA Prediction =====
  describe('predictETA', () => {
    it('should return null for stationary object', () => {
      const kf = new KalmanFilter2D();
      const state = kf.init(100, 0);
      expect(kf.predictETA(state)).toBeNull();
    });

    it('should return null for object moving away', () => {
      const kf = new KalmanFilter2D();
      let state = kf.init(100, 0);
      state.vx = 10; // Moving away from origin
      expect(kf.predictETA(state)).toBeNull();
    });

    it('should return positive ETA for approaching object', () => {
      const kf = new KalmanFilter2D();
      let state = kf.init(100, 0);
      state.vx = -20; // Moving toward origin at 20 m/s
      const eta = kf.predictETA(state);
      expect(eta).not.toBeNull();
      expect(eta!).toBeCloseTo(5, 0); // 100m / 20 m/s = 5 seconds
    });
  });

  // ===== Coordinate Conversion =====
  describe('polarToCartesian', () => {
    it('should convert North bearing correctly', () => {
      const { x, y } = KalmanFilter2D.polarToCartesian(0, 100);
      expect(x).toBeCloseTo(0, 5);
      expect(y).toBeCloseTo(100, 5);
    });

    it('should convert East bearing correctly', () => {
      const { x, y } = KalmanFilter2D.polarToCartesian(90, 100);
      expect(x).toBeCloseTo(100, 5);
      expect(y).toBeCloseTo(0, 1);
    });

    it('should convert South bearing correctly', () => {
      const { x, y } = KalmanFilter2D.polarToCartesian(180, 100);
      expect(x).toBeCloseTo(0, 1);
      expect(y).toBeCloseTo(-100, 5);
    });
  });
});
