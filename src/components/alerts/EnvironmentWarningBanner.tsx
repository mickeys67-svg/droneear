/**
 * Environment Notice Banner — v1.0
 *
 * Shows persistent notice when:
 * 1. Indoor environment detected → detection limited
 * 2. Accuracy degraded → 3-step guided flow:
 *    Step 1: Check current location
 *    Step 2: Move to outdoor listening position
 *    Step 3: Position microphone optimally
 * 3. Mic is OFF → persistent notice until enabled
 *
 * Features:
 * - Collapsible/expandable detailed guidance
 * - Detection capability percentage meter
 * - Step-by-step progress indicator
 * - Pulsing animation for attention
 * - Integrates with TTS for voice guidance
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Linking, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useTheme } from '@/src/hooks/useTheme';
import { useTranslation } from '@/src/i18n/useTranslation';
import type { EnvironmentState, EnvironmentType } from '@/src/core/sensors/EnvironmentDetector';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && Platform.Version >= 23 && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  environmentState: EnvironmentState | null;
  micPermissionDenied: boolean;
  isScanning: boolean;
  onRequestMicPermission: () => void;
  onOpenSettings: () => void;
}

type GuidanceStep = 'shelter' | 'move' | 'position';

export function EnvironmentWarningBanner({
  environmentState,
  micPermissionDenied,
  isScanning,
  onRequestMicPermission,
  onOpenSettings,
}: Props) {
  const theme = useTheme();
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState<GuidanceStep>('shelter');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const capabilityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Pulsing animation — ref-tracked to prevent zombie loops on rapid toggles
  useEffect(() => {
    const shouldPulse = micPermissionDenied ||
      (environmentState?.environment === 'INDOOR');

    // Always stop previous animation first
    if (pulseAnimRef.current) {
      pulseAnimRef.current.stop();
      pulseAnimRef.current = null;
    }

    if (shouldPulse) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      pulseAnimRef.current = anim;
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
        pulseAnimRef.current = null;
      }
    };
  }, [micPermissionDenied, environmentState?.environment, pulseAnim]);

  // Animate detection capability meter — FIXED: cleanup on re-render/unmount
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (environmentState) {
      anim = Animated.timing(capabilityAnim, {
        toValue: environmentState.detectionCapability / 100,
        duration: 600,
        useNativeDriver: false,
      });
      anim.start();
    }
    return () => { if (anim) anim.stop(); };
  }, [environmentState?.detectionCapability, capabilityAnim]);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const STEP_SEQUENCE: GuidanceStep[] = ['shelter', 'move', 'position'];

  const advanceStep = () => {
    const idx = STEP_SEQUENCE.indexOf(currentStep);
    if (idx < STEP_SEQUENCE.length - 1) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentStep(STEP_SEQUENCE[idx + 1]);
    }
  };

  const goBackStep = () => {
    const idx = STEP_SEQUENCE.indexOf(currentStep);
    if (idx > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentStep(STEP_SEQUENCE[idx - 1]);
    }
  };

  const resetSteps = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentStep('shelter');
  };

  // ===== Determine what to show =====

  // Priority 1: Mic is OFF
  if (micPermissionDenied) {
    return (
      <Animated.View style={[
        styles.banner,
        { backgroundColor: `${theme.danger}15`, borderColor: theme.danger, opacity: pulseAnim },
      ]}>
        <View style={styles.headerRow}>
          <Text style={[styles.icon, { color: theme.danger }]}>🎙️</Text>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.danger }]}>{t.micOffAlarmTitle}</Text>
            <Text style={[styles.desc, { color: theme.textDim }]}>{t.micOffAlarmDesc}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.danger }]}
            onPress={onRequestMicPermission}
            accessibilityLabel={t.enableMicNow}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{t.enableMicNow}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: theme.danger }]}
            onPress={onOpenSettings}
            accessibilityLabel={t.openSettings}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryBtnText, { color: theme.danger }]}>{t.openSettings}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  // Priority 2: Indoor detected or accuracy degraded
  if (!environmentState || !isScanning) return null;

  const { environment, detectionCapability, confidence } = environmentState;

  // Only show if indoor or uncertain with low capability
  if (environment === 'OUTDOOR' && detectionCapability >= 70) return null;

  const isIndoor = environment === 'INDOOR';
  const bannerColor = isIndoor ? theme.danger : theme.warning;
  const envLabel = isIndoor ? t.environmentIndoor :
    environment === 'OUTDOOR' ? t.environmentOutdoor : t.environmentUncertain;

  return (
    <Animated.View style={[
      styles.banner,
      {
        backgroundColor: `${bannerColor}12`,
        borderColor: bannerColor,
        opacity: isIndoor ? pulseAnim : 1,
      },
    ]}>
      {/* Header — always visible */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={toggleExpand}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t.accuracyDegradedTitle}
      >
        <Text style={[styles.icon, { color: bannerColor }]}>
          {isIndoor ? '🏠' : '📡'}
        </Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: bannerColor }]}>
            {isIndoor ? t.indoorWarningTitle : t.accuracyDegradedTitle}
          </Text>
          <Text style={[styles.desc, { color: theme.textDim }]} numberOfLines={expanded ? 5 : 2}>
            {isIndoor ? t.indoorWarningDesc : t.accuracyDegradedDesc}
          </Text>
        </View>
        <Text style={[styles.expandIcon, { color: theme.textMuted }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {/* Detection Capability Meter — always visible */}
      <View
        style={styles.capabilitySection}
        accessibilityLabel={`${t.detectionCapability} ${detectionCapability}%`}
        accessibilityRole="progressbar"
      >
        <View style={styles.capabilityHeader}>
          <Text style={[styles.capabilityLabel, { color: theme.textDim }]}>
            {t.detectionCapability}
          </Text>
          <Text style={[styles.capabilityValue, {
            color: detectionCapability < 30 ? theme.danger :
              detectionCapability < 60 ? theme.warning : theme.success,
          }]}>
            {detectionCapability}%
          </Text>
        </View>
        <View style={[styles.capabilityTrack, { backgroundColor: `${theme.textMuted}20` }]}>
          <Animated.View style={[styles.capabilityFill, {
            width: capabilityAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            backgroundColor: detectionCapability < 30 ? theme.danger :
              detectionCapability < 60 ? theme.warning : theme.success,
          }]} />
        </View>
        <Text style={[styles.envBadge, { color: theme.textMuted }]}>
          {t.currentAccuracy}: {envLabel} ({confidence > 0 ? `${Math.round(confidence * 100)}%` : '?'})
        </Text>
      </View>

      {/* Expanded: Step-by-step guidance */}
      {expanded && (
        <View style={styles.stepsSection}>
          {/* Step indicators */}
          <View style={styles.stepIndicators}>
            {(['shelter', 'move', 'position'] as GuidanceStep[]).map((step, idx) => {
              const isActive = currentStep === step;
              const isCompleted = (
                (step === 'shelter' && (currentStep === 'move' || currentStep === 'position')) ||
                (step === 'move' && currentStep === 'position')
              );
              const stepColor = isCompleted ? theme.success : isActive ? bannerColor : theme.textMuted;
              const labels = [t.stepShelter, t.stepMoveOutdoor, t.stepPositionMic];
              return (
                <View key={step} style={styles.stepItem}>
                  <View style={[styles.stepCircle, {
                    backgroundColor: isCompleted ? theme.success : 'transparent',
                    borderColor: stepColor,
                  }]}>
                    <Text style={[styles.stepNum, { color: isCompleted ? '#000' : stepColor }]}>
                      {isCompleted ? '✓' : idx + 1}
                    </Text>
                  </View>
                  <Text style={[styles.stepLabel, { color: stepColor }]} numberOfLines={1}>
                    {labels[idx]}
                  </Text>
                  {idx < 2 && (
                    <View style={[styles.stepLine, { backgroundColor: isCompleted ? theme.success : `${theme.textMuted}40` }]} />
                  )}
                </View>
              );
            })}
          </View>

          {/* Current step detail */}
          <View style={[styles.stepDetail, { backgroundColor: `${bannerColor}08`, borderColor: `${bannerColor}30` }]}>
            {currentStep === 'shelter' && (
              <>
                <Text style={[styles.stepTitle, { color: bannerColor }]}>{t.shelterCheckTitle}</Text>
                <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.shelterCheckDesc}</Text>
              </>
            )}
            {currentStep === 'move' && (
              <>
                <Text style={[styles.stepTitle, { color: bannerColor }]}>{t.moveToDetectionTitle}</Text>
                <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.moveToDetectionDesc}</Text>
              </>
            )}
            {currentStep === 'position' && (
              <>
                <Text style={[styles.stepTitle, { color: bannerColor }]}>{t.optimalPositionTitle}</Text>
                <Text style={[styles.stepDesc, { color: theme.textDim }]}>{t.optimalPositionDesc}</Text>
              </>
            )}
          </View>

          {/* Step navigation — back + forward */}
          <View style={styles.stepActions}>
            {currentStep !== 'shelter' && (
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: theme.textMuted }]}
                onPress={goBackStep}
                accessibilityRole="button"
                accessibilityLabel={STEP_SEQUENCE[STEP_SEQUENCE.indexOf(currentStep) - 1] === 'shelter' ? t.stepShelter : t.stepMoveOutdoor}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.textMuted }]}>
                  ← {STEP_SEQUENCE.indexOf(currentStep) === 2 ? t.stepMoveOutdoor : t.stepShelter}
                </Text>
              </TouchableOpacity>
            )}
            {currentStep !== 'position' && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: bannerColor }]}
                onPress={advanceStep}
                accessibilityRole="button"
                accessibilityLabel={currentStep === 'shelter' ? t.stepMoveOutdoor : t.stepPositionMic}
              >
                <Text style={styles.primaryBtnText}>
                  {currentStep === 'shelter' ? t.stepMoveOutdoor : t.stepPositionMic} →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 22,
    marginRight: 10,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  desc: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  expandIcon: {
    fontSize: 12,
    marginLeft: 8,
    marginTop: 4,
  },

  // Detection capability meter
  capabilitySection: {
    marginTop: 10,
    paddingTop: 8,
  },
  capabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  capabilityLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  capabilityValue: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
  },
  capabilityTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  capabilityFill: {
    height: '100%',
    borderRadius: 3,
  },
  envBadge: {
    fontFamily: 'monospace',
    fontSize: 9,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Steps
  stepsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  stepLine: {
    position: 'absolute',
    top: 14,
    right: -20,
    width: 40,
    height: 2,
    zIndex: -1,
  },
  stepDetail: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  stepTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  stepDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 16,
  },
  stepActions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },

  // Buttons
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  primaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
