import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../theme';
import { useReducedMotion } from './useReducedMotion';

/** Çubukların döngü süreleri (ms) — eşit olmaması dalgayı doğal gösterir. */
const BAR_DURATIONS = [520, 380, 620, 450];

/**
 * NowPlayingBars — "şu an çalıyor" göstergesi: yukarı aşağı oynayan ses
 * çubukları (Spotify'ın liste göstergesinden esinlenir).
 *
 * Listelerde çalan satırı işaretlemek için kullanılır; metin yerine geçer.
 * Duraklatıldığında animasyon durur ve çubuklar sabit kalır — durum
 * göstergenin kendisinden okunur.
 *
 * Erişilebilirlik: sistemde "hareketi azalt" açıksa animasyon çalışmaz.
 */
export const NowPlayingBars: React.FC<{
  /** Çalıyor mu? false ise çubuklar donar (duraklatıldı). */
  playing?: boolean;
  color?: string;
  size?: number;
}> = ({ playing = true, color, size = 14 }) => {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const animated = playing && !reducedMotion;

  // Her çubuk için 0..1 arası bir değer; yüksekliğe eşlenir.
  const values = useRef(BAR_DURATIONS.map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    if (!animated) {
      // Donmuş hâl: sabit, dengeli bir örüntü.
      values.forEach((v, i) => v.setValue([0.5, 0.9, 0.4, 0.7][i] ?? 0.5));
      return;
    }

    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: BAR_DURATIONS[i],
            useNativeDriver: false, // yükseklik animasyonu native driver desteklemez
          }),
          Animated.timing(value, {
            toValue: 0.25,
            duration: BAR_DURATIONS[i],
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [animated, values]);

  return (
    <View
      accessible={false}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height: size,
      }}>
      {values.map((value, i) => (
        <Animated.View
          key={i}
          style={{
            width: 2.5,
            borderRadius: 2,
            backgroundColor: color ?? theme.colors.accent,
            height: value.interpolate({
              inputRange: [0, 1],
              outputRange: [size * 0.2, size],
            }),
          }}
        />
      ))}
    </View>
  );
};
