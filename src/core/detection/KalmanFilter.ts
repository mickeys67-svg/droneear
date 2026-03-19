/**
 * 2D Kalman Filter for signal track trajectory prediction.
 *
 * State vector: [x, y, vx, vy]
 * Measurement: [x, y] (from bearing + distance)
 *
 * Used to smooth noisy position estimates and predict future positions/ETA.
 */

import type { KalmanState } from '../../types';

export class KalmanFilter2D {
  private dt: number; // Time step in seconds

  // Process noise
  private processNoise: number;
  // Measurement noise
  private measurementNoise: number;

  constructor(dt: number = 0.5, processNoise: number = 0.5, measurementNoise: number = 10) {
    this.dt = dt;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  /**
   * Initialize state from first measurement.
   */
  init(x: number, y: number): KalmanState {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      P: [
        [100, 0, 0, 0],
        [0, 100, 0, 0],
        [0, 0, 10, 0],
        [0, 0, 0, 10],
      ],
    };
  }

  /**
   * Predict step: advance state forward in time.
   */
  predict(state: KalmanState): KalmanState {
    const { x, y, vx, vy, P } = state;
    const dt = this.dt;
    const q = this.processNoise;

    // State prediction: x_new = F * x
    // F = [[1, 0, dt, 0], [0, 1, 0, dt], [0, 0, 1, 0], [0, 0, 0, 1]]
    const newX = x + vx * dt;
    const newY = y + vy * dt;

    // Covariance prediction: P_new = F * P * F' + Q
    // Computed correctly using full matrix multiplication
    // Step 1: FP = F * P
    const FP: number[][] = [
      [P[0][0] + dt * P[2][0], P[0][1] + dt * P[2][1], P[0][2] + dt * P[2][2], P[0][3] + dt * P[2][3]],
      [P[1][0] + dt * P[3][0], P[1][1] + dt * P[3][1], P[1][2] + dt * P[3][2], P[1][3] + dt * P[3][3]],
      [P[2][0], P[2][1], P[2][2], P[2][3]],
      [P[3][0], P[3][1], P[3][2], P[3][3]],
    ];

    // Step 2: newP = FP * F' + Q (Q is diagonal with q for all states)
    const newP: number[][] = [
      [FP[0][0] + dt * FP[0][2] + q, FP[0][1] + dt * FP[0][3],     FP[0][2], FP[0][3]],
      [FP[1][0] + dt * FP[1][2],     FP[1][1] + dt * FP[1][3] + q, FP[1][2], FP[1][3]],
      [FP[2][0] + dt * FP[2][2],     FP[2][1] + dt * FP[2][3],     FP[2][2] + q, FP[2][3]],
      [FP[3][0] + dt * FP[3][2],     FP[3][1] + dt * FP[3][3],     FP[3][2], FP[3][3] + q],
    ];

    return { x: newX, y: newY, vx, vy, P: newP };
  }

  /**
   * Update step: incorporate a new measurement [mx, my].
   */
  update(state: KalmanState, mx: number, my: number): KalmanState {
    const { x, y, vx, vy, P } = state;
    const R = this.measurementNoise;

    // Innovation: z - H*x (H extracts position: [1,0,0,0; 0,1,0,0])
    const dx = mx - x;
    const dy = my - y;

    // Innovation covariance: S = H*P*H' + R
    const S00 = P[0][0] + R;
    const S01 = P[0][1];
    const S10 = P[1][0];
    const S11 = P[1][1] + R;

    // Kalman gain: K = P*H'*inv(S)
    const detS = S00 * S11 - S01 * S10;
    if (Math.abs(detS) < 1e-10) return state; // Singular, skip update

    const invS00 = S11 / detS;
    const invS01 = -S01 / detS;
    const invS10 = -S10 / detS;
    const invS11 = S00 / detS;

    // K = P * H' * S^-1 (4x2 matrix)
    const K = [
      [P[0][0] * invS00 + P[0][1] * invS10, P[0][0] * invS01 + P[0][1] * invS11],
      [P[1][0] * invS00 + P[1][1] * invS10, P[1][0] * invS01 + P[1][1] * invS11],
      [P[2][0] * invS00 + P[2][1] * invS10, P[2][0] * invS01 + P[2][1] * invS11],
      [P[3][0] * invS00 + P[3][1] * invS10, P[3][0] * invS01 + P[3][1] * invS11],
    ];

    // State update: x = x + K * innovation
    const newX = x + K[0][0] * dx + K[0][1] * dy;
    const newY = y + K[1][0] * dx + K[1][1] * dy;
    const newVx = vx + K[2][0] * dx + K[2][1] * dy;
    const newVy = vy + K[3][0] * dx + K[3][1] * dy;

    // Covariance update: P = (I - K*H) * P
    const newP: number[][] = Array.from({ length: 4 }, () => new Array(4).fill(0));
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        newP[i][j] = P[i][j] - K[i][0] * P[0][j] - K[i][1] * P[1][j];
      }
    }

    return { x: newX, y: newY, vx: newVx, vy: newVy, P: newP };
  }

  /**
   * Predict ETA (Estimated Time of Arrival) to origin (0,0).
   * Returns seconds, or null if not approaching.
   */
  predictETA(state: KalmanState): number | null {
    const distance = Math.sqrt(state.x * state.x + state.y * state.y);
    const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);

    if (speed < 0.1) return null; // Essentially stationary

    // Check if approaching (dot product of position and velocity is negative)
    const dot = state.x * state.vx + state.y * state.vy;
    if (dot >= 0) return null; // Moving away

    return distance / speed;
  }

  /**
   * Convert bearing + distance to x,y coordinates.
   */
  static polarToCartesian(bearingDegrees: number, distanceMeters: number): { x: number; y: number } {
    const rad = (bearingDegrees * Math.PI) / 180;
    return {
      x: distanceMeters * Math.sin(rad),
      y: distanceMeters * Math.cos(rad),
    };
  }
}
