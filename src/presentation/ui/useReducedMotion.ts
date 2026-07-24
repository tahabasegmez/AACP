import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { usePreferencesStore } from '../stores/preferencesStore';

/**
 * useReducedMotion — animasyonlar azaltılmalı mı? İki kaynağın birleşimi:
 *  1) iOS "Hareketi Azalt" sistem ayarı (erişilebilirlik),
 *  2) uygulama içi Ayarlar → Animasyon seviyesi = "Azaltılmış".
 * İkisinden biri açıksa animasyonlar sadeleşir.
 */
export const useReducedMotion = (): boolean => {
  const [systemReduced, setSystemReduced] = useState(false);
  const motionPref = usePreferencesStore(s => s.prefs.motion);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) {
        setSystemReduced(value);
      }
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return systemReduced || motionPref === 'reduced';
};
