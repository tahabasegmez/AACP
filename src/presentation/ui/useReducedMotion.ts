import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * useReducedMotion — iOS/Android "Hareketi Azalt" sistem ayarı açıksa true döner.
 * Animasyonlu bileşenler buna saygı gösterir (erişilebilirlik). Uygulama içi
 * animasyon ayarı kaldırıldı; yalnızca sistem tercihi dikkate alınır.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) {
        setReduced(value);
      }
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
};
