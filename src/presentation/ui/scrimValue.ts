import { Animated } from 'react-native';

/**
 * Ortak scroll değeri — üstteki island scrim'inin (koyulaşma) opaklığını sürer.
 * Ekranlar scroll bileşenlerine `scrimScrollHandler`'ı bağlar; kök seviyedeki
 * TopScrim bu değeri okur. Tek örnek: her ekran aynı davranışı çağırır.
 * (useNativeDriver:false → herhangi bir ScrollView/FlashList onScroll'una takılır.)
 */
export const scrimValue = new Animated.Value(0);

export const scrimScrollHandler = Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrimValue } } }],
  { useNativeDriver: false },
);

/** Ekran değişince scroll konumunu sıfırla (yeni ekran en üstte başlar). */
export const resetScrim = (): void => scrimValue.setValue(0);
