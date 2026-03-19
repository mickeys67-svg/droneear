import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import { Colors } from '@/constants/theme';

interface RadarProps {
  isActive: boolean;
  hasThreat?: boolean;
}

export const RadarComponent: React.FC<RadarProps> = ({ isActive, hasThreat }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      rotation.setValue(0);
      pulse.setValue(0);
    }
  }, [isActive]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Outer Circles */}
      <View style={[styles.circle, styles.outerCircle]} />
      <View style={[styles.circle, styles.midCircle]} />
      <View style={[styles.circle, styles.innerCircle]} />
      
      {/* Crosshair */}
      <View style={styles.axisV} />
      <View style={styles.axisH} />

      {/* Bearings */}
      <Text style={[styles.bearingText, { top: 5 }]}>N</Text>
      <Text style={[styles.bearingText, { right: 5 }]}>E</Text>
      <Text style={[styles.bearingText, { bottom: 5 }]}>S</Text>
      <Text style={[styles.bearingText, { left: 5 }]}>W</Text>

      {/* Rotating Sweep */}
      {isActive && (
        <Animated.View style={[styles.sweep, { transform: [{ rotate: spin }] }]}>
          <View style={styles.sweepGlow} />
        </Animated.View>
      )}

      {/* Threat Indicator */}
      {hasThreat && (
        <Animated.View style={[styles.threatDot, { opacity: pulse }]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 81, 0.2)',
  },
  outerCircle: { width: 180, height: 180 },
  midCircle: { width: 120, height: 120 },
  innerCircle: { width: 60, height: 60 },
  axisV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 200, 81, 0.1)',
  },
  axisH: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 200, 81, 0.1)',
  },
  sweep: {
    position: 'absolute',
    width: 100,
    height: 100,
    left: '50%',
    top: '50%',
    marginLeft: -100,
    marginTop: -100,
  },
  sweepGlow: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 200, 81, 0.15)',
    borderTopLeftRadius: 100,
  },
  threatDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    top: 50,
    right: 60,
    shadowColor: '#ff4444',
    shadowRadius: 10,
    elevation: 10,
  },
  bearingText: {
    position: 'absolute',
    color: 'rgba(0, 200, 81, 0.6)',
    fontSize: 10,
    fontWeight: 'bold',
  }
});
