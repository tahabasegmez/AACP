import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Bir NetInfo durumundan "çevrimiçi miyiz" kararını üretir.
 *
 * İki alan birlikte değerlendirilir:
 *  - `isConnected`: ağ arayüzü bağlı mı,
 *  - `isInternetReachable`: internete gerçekten çıkılabiliyor mu.
 *
 * `isInternetReachable` BİLİNMİYORSA (null/undefined) yok sayılır — aksi halde
 * ölçüm tamamlanana kadar uygulama yanlışlıkla "çevrimdışı" görünürdü. Yalnızca
 * kesin `false` olduğunda çevrimdışı sayılır.
 */
const resolveOnline = (state: NetInfoState): boolean => {
  if (state.isConnected === false) {
    return false;
  }
  return state.isInternetReachable !== false;
};

/**
 * useOnlineStatus — cihaz çevrimiçi mi? Ağ kütüphanesi yalnızca burada import
 * edilir; değiştirmek gerekirse tek dosya yeter.
 *
 * DAYANIKLILIK: yalnızca olay akışına güvenilmez. Bağlantı geri geldiğinde
 * NetInfo bazı platformlarda (özellikle iOS simülatöründe) yeni bir olay
 * yayınlamayabilir ve uygulama kalıcı olarak "çevrimdışı" takılır. Bunu önlemek
 * için durum ayrıca şu anlarda taze olarak sorgulanır:
 *   - ilk mount'ta,
 *   - uygulama arka plandan öne geldiğinde.
 */
export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;

    const apply = (state: NetInfoState): void => {
      if (active) {
        setOnline(resolveOnline(state));
      }
    };

    /** Durumu taze olarak sorgular (olay beklemeden). */
    const refresh = (): void => {
      NetInfo.fetch()
        .then(apply)
        .catch(() => {
          /* sorgulanamazsa mevcut durumu koru */
        });
    };

    refresh();
    const unsubscribeNet = NetInfo.addEventListener(apply);

    // Uygulama öne geldiğinde yeniden ölç: arka plandayken kaçan bağlantı
    // değişiklikleri böylece yakalanır.
    const appStateSub = AppState.addEventListener('change', status => {
      if (status === 'active') {
        refresh();
      }
    });

    return () => {
      active = false;
      unsubscribeNet();
      appStateSub.remove();
    };
  }, []);

  return online;
};
