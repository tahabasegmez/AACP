import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent } from 'react-native';
import { useTheme } from '../theme';
import { useReducedMotion } from './useReducedMotion';

/** Kapanırken içeriğin yukarı kayacağı mesafe (px). */
const LIFT = 20;
/** Ölçüm gürültüsünü yok saymak için eşik. */
const EPSILON = 1;

/**
 * Collapsible — içeriği yukarı kaydırarak açıp kapatan sarmalayıcı.
 *
 * Aramaya başlandığında şov/liste tanıtımının (kapak, başlık, düğmeler) yer
 * açmasını sağlar: içerik yukarı kayıp kaybolur, liste ekranın tepesine
 * yerleşir ve sonuçlar ilk satırdan itibaren görünür. Kullanıcı aramayı
 * temizlediğinde tanıtım geri gelir.
 *
 * Yükseklik ÖLÇÜLEREK animasyonlanır (`useNativeDriver: false`): içeriğin
 * doğal yüksekliği baştan bilinemez ve sabit bir değer yazmak, farklı
 * ekran/yazı boyutlarında kırpardı.
 *
 * Hareket azaltma açıksa geçiş anında olur — animasyon bir süsleme, davranış
 * değil.
 */
export const Collapsible: React.FC<{
  collapsed: boolean;
  children: React.ReactNode;
}> = ({ collapsed, children }) => {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [height, setHeight] = useState<number>();
  const progress = useRef(new Animated.Value(collapsed ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(collapsed ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: collapsed ? 1 : 0,
      duration: theme.duration.base,
      useNativeDriver: false,
    }).start();
  }, [collapsed, reduced, progress, theme.duration.base]);

  /**
   * İçeriğin doğal yüksekliğini izler.
   *
   * Dış kapsayıcı kapalıyken 0 yüksekliğinde olsa da çocuk kendi doğal
   * ölçüsünü bildirmeye devam eder; bu yüzden ölçüm her zaman güvenlidir.
   * Yalnızca anlamlı değişimlerde durum güncellenir, aksi halde ölçüm →
   * render → ölçüm döngüsü oluşurdu.
   */
  const measure = (event: LayoutChangeEvent): void => {
    const next = event.nativeEvent.layout.height;
    setHeight(current =>
      current === undefined || Math.abs(current - next) > EPSILON ? next : current,
    );
  };

  return (
    <Animated.View
      // Ölçüm gelene kadar yükseklik SERBEST bırakılır; aksi halde ilk kare
      // 0 yükseklikle çizilir ve içerik bir an kaybolur.
      style={{
        overflow: 'hidden',
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
        }),
        ...(height === undefined
          ? {}
          : {
              height: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [height, 0],
              }),
            }),
      }}>
      <Animated.View
        onLayout={measure}
        style={{
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -LIFT],
              }),
            },
          ],
        }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
};
