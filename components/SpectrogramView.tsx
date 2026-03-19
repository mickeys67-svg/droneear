import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/theme';

interface SpectrogramProps {
  level: number;
  isActive: boolean;
}

export const SpectrogramView: React.FC<SpectrogramProps> = ({ level, isActive }) => {
  const bars = useRef([...Array(20)].map(() => new Animated.Value(2))).current;

  useEffect(() => {
    let interval: string | number | NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        bars.forEach((bar) => {
          const target = 2 + Math.random() * 20 * (level + 0.2);
          Animated.spring(bar, {
            toValue: target,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
        });
      }, 100);
    } else {
      bars.forEach(bar => bar.setValue(2));
    }
    return () => clearInterval(interval);
  }, [isActive, level]);

  return (
    <View style={styles.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: bar,
              backgroundColor: level > 0.7 ? Colors.secondary : Colors.primary,
              opacity: bar.interpolate({
                inputRange: [2, 20],
                outputRange: [0.3, 1]
              })
            }
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 40,
    gap: 3,
    paddingHorizontal: 10,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    minHeight: 2,
  }
});
