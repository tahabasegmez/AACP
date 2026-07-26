import React from 'react';
import { Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scrimValue } from './scrimValue';

/**
 * TopScrim — aşağı kaydırıldıkça island çevresini koyulaştıran üst overlay.
 * (Blur yerine yarı-şeffaf koyu degrade — native bağımlılık gerektirmez, her
 * temada ve her ekranda tutarlı.) Kök seviyede tek örnek render edilir.
 */
export const TopScrim: React.FC = () => {
  const insets = useSafeAreaInsets();
  const opacity = scrimValue.interpolate({
    inputRange: [0, 44],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top + 10,
        opacity,
      }}>
      <LinearGradient
        colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0)']}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
};
