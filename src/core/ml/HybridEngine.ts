/**
 * Hybrid Classification Engine — v1.0
 *
 * Combines rule-based (ModelManager) + probabilistic (GaussianClassifier)
 * for maximum accuracy with fault tolerance.
 *
 * Strategy:
 *   1. Rule-based runs first → instant preliminary result
 *   2. Gaussian ML runs in parallel → precise confirmation
 *   3. Fusion logic combines both → final prediction
 *
 * Fusion rules:
 *   Both agree (same category)    → confidence = max(A,B) × 1.2 (cap 0.99)
 *   Only ML detects               → confidence = B × 0.9  (ML trusted)
 *   Only rule-based detects       → confidence = A × 0.7  (preliminary)
 *   Both say BACKGROUND           → BACKGROUND
 *   Category mismatch             → ML category, confidence = B × 0.8
 *
 * Fallback: If GaussianClassifier fails/crashes, ModelManager continues alone.
 *
 * API contract (same as ModelManager):
 *   Input:  Float32Array[] (96 mel frames)
 *   Output: Map<AcousticPattern, number> (6 classes, sum ≈ 1.0)
 */

import { ModelManager } from './ModelManager';
import { GaussianClassifier } from './GaussianClassifier';
import type { AcousticPattern, ModelStatus } from '../../types';

type ThreatCategory = AcousticPattern;

const OUTPUT_CLASSES: AcousticPattern[] = [
  'MULTIROTOR', 'SINGLE_ENGINE', 'SINGLE_ROTOR',
  'JET_PROPULSION', 'PROPELLER_FIXED', 'BACKGROUND',
];

interface FusionResult {
  category: ThreatCategory;
  confidence: number;
  source: 'RULE' | 'ML' | 'HYBRID';
}

export class HybridEngine {
  private ruleEngine: ModelManager;
  private mlEngine: GaussianClassifier;
  private mlAvailable = false;

  // Expose same interface as ModelManager
  private statusCallback: ((status: ModelStatus) => void) | null = null;
  private currentModelStatus: ModelStatus = 'UNLOADED';

  constructor() {
    this.ruleEngine = new ModelManager();
    this.mlEngine = new GaussianClassifier();
  }

  // ===== Public API (mirrors ModelManager) =====

  async loadModel(): Promise<void> {
    this.setStatus('LOADING');

    // Load rule-based engine (always required)
    await this.ruleEngine.loadModel();

    // Load ML engine (optional — failure is non-fatal)
    try {
      await this.mlEngine.initialize();
      this.mlAvailable = true;
    } catch (e) {
      console.warn('[HybridEngine] GaussianClassifier init failed, rule-only mode:', e);
      this.mlAvailable = false;
    }

    this.setStatus('READY');
  }

  private inferencing = false;

  async predict(melFrames: Float32Array[]): Promise<Map<ThreatCategory, number>> {
    if (this.currentModelStatus !== 'READY' && this.currentModelStatus !== 'INFERENCE') {
      throw new Error(`HybridEngine not ready. Status: ${this.currentModelStatus}`);
    }

    // Guard against concurrent calls — return rule-based only if already inferencing
    if (this.inferencing) {
      return this.ruleEngine.predict(melFrames);
    }

    this.inferencing = true;
    this.setStatus('INFERENCE');

    try {
      // Step 1: Rule-based prediction (always runs)
      const rulePrediction = await this.ruleEngine.predict(melFrames);

      // Step 2: ML prediction (if available)
      let mlPrediction: Map<ThreatCategory, number> | null = null;
      if (this.mlAvailable) {
        try {
          mlPrediction = this.mlEngine.predict(melFrames);
        } catch {
          // ML failure — continue with rule-based only
          mlPrediction = null;
        }
      }

      // Step 3: Fuse predictions
      const fused = mlPrediction
        ? this.fuseResults(rulePrediction, mlPrediction)
        : rulePrediction;

      return fused;
    } finally {
      this.inferencing = false;
      this.setStatus('READY');
    }
  }

  onStatus(callback: (status: ModelStatus) => void): void {
    this.statusCallback = callback;
    // Do NOT forward to rule engine — HybridEngine owns status lifecycle
  }

  get currentStatus(): ModelStatus {
    return this.currentModelStatus;
  }

  get info() {
    const ruleInfo = this.ruleEngine.info;
    if (!ruleInfo) return null;
    return {
      ...ruleInfo,
      name: 'DroneEar-HybridEngine',
      version: '3.0.0',
    };
  }

  get isHybridMode(): boolean {
    return this.mlAvailable;
  }

  // ===== Fusion Logic =====

  private fuseResults(
    rulePred: Map<ThreatCategory, number>,
    mlPred: Map<ThreatCategory, number>,
  ): Map<ThreatCategory, number> {
    // Get top category from each
    const ruleTop = this.getTop(rulePred);
    const mlTop = this.getTop(mlPred);

    // Determine fusion strategy
    const fusion = this.determineFusion(ruleTop, mlTop);

    // Build fused probability map
    return this.buildFusedMap(rulePred, mlPred, fusion);
  }

  private determineFusion(
    rule: FusionResult,
    ml: FusionResult,
  ): FusionResult {
    const ruleIsDrone = rule.category !== 'BACKGROUND';
    const mlIsDrone = ml.category !== 'BACKGROUND';

    // Case 1: Both agree on same drone category
    if (ruleIsDrone && mlIsDrone && rule.category === ml.category) {
      return {
        category: ml.category,
        confidence: Math.min(Math.max(rule.confidence, ml.confidence) * 1.2, 0.99),
        source: 'HYBRID',
      };
    }

    // Case 2: Both say BACKGROUND
    if (!ruleIsDrone && !mlIsDrone) {
      return {
        category: 'BACKGROUND',
        confidence: Math.max(rule.confidence, ml.confidence),
        source: 'HYBRID',
      };
    }

    // Case 3: Only ML detects drone (rule says background)
    if (!ruleIsDrone && mlIsDrone) {
      return {
        category: ml.category,
        confidence: ml.confidence * 0.9,
        source: 'ML',
      };
    }

    // Case 4: Only rule-based detects drone (ML says background)
    if (ruleIsDrone && !mlIsDrone) {
      return {
        category: rule.category,
        confidence: rule.confidence * 0.7,
        source: 'RULE',
      };
    }

    // Case 5: Both detect drone but disagree on category → trust ML
    if (ruleIsDrone && mlIsDrone && rule.category !== ml.category) {
      return {
        category: ml.category,
        confidence: ml.confidence * 0.8,
        source: 'ML',
      };
    }

    // Fallback: shouldn't reach here
    return {
      category: ml.category,
      confidence: ml.confidence,
      source: 'ML',
    };
  }

  private buildFusedMap(
    rulePred: Map<ThreatCategory, number>,
    mlPred: Map<ThreatCategory, number>,
    fusion: FusionResult,
  ): Map<ThreatCategory, number> {
    const result = new Map<ThreatCategory, number>();

    // Weighted average of both distributions, boosting the fused winner
    for (const cat of OUTPUT_CLASSES) {
      const ruleP = rulePred.get(cat) || 0;
      const mlP = mlPred.get(cat) || 0;

      // Base: weighted average (60% ML, 40% rule)
      let fused = mlP * 0.6 + ruleP * 0.4;

      // Boost the winning category to match fusion confidence
      if (cat === fusion.category) {
        fused = Math.max(fused, fusion.confidence);
      }

      result.set(cat, fused);
    }

    // Re-normalize to sum = 1.0
    let total = 0;
    for (const v of result.values()) total += v;
    if (total > 0) {
      for (const [cat, v] of result) {
        result.set(cat, v / total);
      }
    }

    return result;
  }

  private getTop(predictions: Map<ThreatCategory, number>): FusionResult {
    let bestCat: ThreatCategory = 'BACKGROUND';
    let bestConf = 0;

    for (const [cat, conf] of predictions) {
      if (conf > bestConf) {
        bestConf = conf;
        bestCat = cat;
      }
    }

    return { category: bestCat, confidence: bestConf, source: 'RULE' };
  }

  private setStatus(status: ModelStatus): void {
    this.currentModelStatus = status;
    this.statusCallback?.(status);
  }
}
