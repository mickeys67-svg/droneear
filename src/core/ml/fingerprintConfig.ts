/**
 * Canonical acoustic-fingerprint front-end spec.
 *
 * The reference fingerprints bundled in the app and the live fingerprints
 * computed at inference time MUST be produced with the EXACT same parameters,
 * or matching silently fails (the front-end parity rule). This file is the
 * single source of truth — both the offline reference generator and the app's
 * AudioClassifier import these constants.
 *
 * These values are the spec validated in __tests__/FingerprintRealData.test.ts
 * (real DroneAudioDataset recordings — 80% balanced accuracy, 95% recall on
 * unseen drone types). Do not change them without re-validating against real
 * audio and regenerating the reference library.
 */

export const FP_SAMPLE_RATE = 16000; // Hz — drone signature lives below 8 kHz
export const FP_FFT_SIZE = 1024;     // ~64 ms analysis window at 16 kHz
export const FP_HOP = 512;           // 50% overlap
export const FP_MEL_BINS = 64;       // fewer bins → no low-freq filter collapse
export const FP_FMIN = 125;          // Hz
export const FP_FMAX = 8000;         // Hz — Nyquist at 16 kHz

/**
 * Discriminative matching parameters — calibrated on real recordings across
 * four simulation stages (cross-check → accuracy sweep + held-out check →
 * sustained-detection tuning → full-flow simulation).
 *
 * A window is a raw match when:
 *     droneSim >= FP_MATCH_FLOOR  AND  droneSim - bgSim >= FP_MATCH_MARGIN
 * where droneSim / bgSim are the best cosine similarities to the drone and
 * background reference libraries. Comparing against background references
 * (not a fixed threshold alone) is what rejects drone-like background sounds
 * — it lifted window-level balanced accuracy from 73.5% to ~89%.
 */
export const FP_MATCH_FLOOR = 0.70;
export const FP_MATCH_MARGIN = 0.0;

/**
 * Sustained-detection temporal voting: a detection is declared only when at
 * least FP_VOTE_NEEDED of the last FP_VOTE_WINDOW inference windows matched.
 * 12/8 gave 100% drone detection AND 100% background-clean per session;
 * plain 3/2 voting left ~64% of background sessions false-firing. The cost is
 * ~5 s detection latency — acceptable for the secondary (beta) acoustic tier.
 */
export const FP_VOTE_WINDOW = 12;
export const FP_VOTE_NEEDED = 8;
