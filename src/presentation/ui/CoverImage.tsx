import React, { useRef, useState } from 'react';
import { Animated, StyleProp, View, ViewStyle } from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme';
import { useReducedMotion } from './useReducedMotion';
import { Waveform } from './Waveform';

/**
 * CoverImage — kapak görseli soyutlaması.
 *
 * Sürdürülebilirlik: görsel kütüphanesi (fast-image: disk cache) yalnızca burada
 * import edilir. İleride expo-image gibi bir şeye geçmek istersek tek dosya değişir.
 *
 * Davranış: yüklenirken marka degrade placeholder, yüklenince yumuşak fade-in;
 * görsel yoksa/başarısızsa AA dalga işaretli fallback.
 */
export const CoverImage: React.FC<{
  uri?: string;
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ uri, size, radius, style }) => {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);

  const br = radius ?? theme.radius.lg;
  const showImage = Boolean(uri) && !failed;

  const onLoad = () => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: theme.duration.base,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: br, overflow: 'hidden' },
        style,
      ]}>
      {/* Placeholder / fallback zemin */}
      <LinearGradient
        colors={[theme.colors.brand, theme.colors.elevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {!showImage && <Waveform height={Math.max(12, size * 0.16)} bars={5} opacity={0.85} />}
      </LinearGradient>

      {showImage && (
        <Animated.View style={{ opacity, width: size, height: size }}>
          <FastImage
            source={{ uri, priority: FastImage.priority.normal }}
            resizeMode={FastImage.resizeMode.cover}
            style={{ width: size, height: size }}
            onLoad={onLoad}
            onError={() => setFailed(true)}
          />
        </Animated.View>
      )}
    </View>
  );
};
