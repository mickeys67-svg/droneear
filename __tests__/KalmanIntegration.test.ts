import { KalmanFilter2D } from '../src/core/detection/KalmanFilter';

describe('Kalman Integration — Store-level behavior', () => {
  const kalman = new KalmanFilter2D(0.5, 0.5, 10);

  it('should initialize kalmanState from polar coordinates', () => {
    const { x, y } = KalmanFilter2D.polarToCartesian(90, 500);
    const state = kalman.init(x, y);

    // 90° bearing, 500m → x≈500, y≈0
    expect(state.x).toBeCloseTo(500, 0);
    expect(state.y).toBeCloseTo(0, 0);
    expect(state.vx).toBe(0);
    expect(state.vy).toBe(0);
    expect(state.P).toBeDefined();
  });

  it('should predict and update state on subsequent detections', () => {
    // First detection: bearing=45°, distance=1000m
    const { x: x1, y: y1 } = KalmanFilter2D.polarToCartesian(45, 1000);
    let state = kalman.init(x1, y1);

    // Second detection: closer, same bearing
    const { x: x2, y: y2 } = KalmanFilter2D.polarToCartesian(45, 900);
    state = kalman.predict(state);
    state = kalman.update(state, x2, y2);

    // Position should have moved closer to the new measurement
    const dist = Math.sqrt(state.x ** 2 + state.y ** 2);
    expect(dist).toBeLessThan(1000);
    expect(dist).toBeGreaterThan(800);
  });

  it('should compute ETA when approaching', () => {
    // Simulate 5 measurements of approaching target
    const { x: x0, y: y0 } = KalmanFilter2D.polarToCartesian(0, 1000);
    let state = kalman.init(x0, y0);

    // Each step: 100m closer
    for (let dist = 900; dist >= 500; dist -= 100) {
      const { x, y } = KalmanFilter2D.polarToCartesian(0, dist);
      state = kalman.predict(state);
      state = kalman.update(state, x, y);
    }

    const eta = kalman.predictETA(state);
    // Should have an ETA since target is approaching
    expect(eta).not.toBeNull();
    expect(eta!).toBeGreaterThan(0);
  });

  it('should return null ETA when target is moving away', () => {
    const { x: x0, y: y0 } = KalmanFilter2D.polarToCartesian(0, 500);
    let state = kalman.init(x0, y0);

    // Each step: 100m farther
    for (let dist = 600; dist <= 1000; dist += 100) {
      const { x, y } = KalmanFilter2D.polarToCartesian(0, dist);
      state = kalman.predict(state);
      state = kalman.update(state, x, y);
    }

    const eta = kalman.predictETA(state);
    expect(eta).toBeNull();
  });

  it('should return null ETA when target is stationary', () => {
    const { x, y } = KalmanFilter2D.polarToCartesian(180, 500);
    let state = kalman.init(x, y);

    // Same position 3 times
    for (let i = 0; i < 3; i++) {
      state = kalman.predict(state);
      state = kalman.update(state, x, y);
    }

    const eta = kalman.predictETA(state);
    expect(eta).toBeNull();
  });

  it('should handle multiple tracks independently', () => {
    // Track A
    const { x: xa, y: ya } = KalmanFilter2D.polarToCartesian(0, 1000);
    let stateA = kalman.init(xa, ya);

    // Track B
    const { x: xb, y: yb } = KalmanFilter2D.polarToCartesian(180, 500);
    let stateB = kalman.init(xb, yb);

    // Update A closer
    const { x: xa2, y: ya2 } = KalmanFilter2D.polarToCartesian(0, 800);
    stateA = kalman.predict(stateA);
    stateA = kalman.update(stateA, xa2, ya2);

    // Update B farther
    const { x: xb2, y: yb2 } = KalmanFilter2D.polarToCartesian(180, 700);
    stateB = kalman.predict(stateB);
    stateB = kalman.update(stateB, xb2, yb2);

    // States should be independent
    expect(Math.sqrt(stateA.x ** 2 + stateA.y ** 2)).toBeLessThan(1000);
    expect(Math.sqrt(stateB.x ** 2 + stateB.y ** 2)).toBeGreaterThan(500);
  });
});
