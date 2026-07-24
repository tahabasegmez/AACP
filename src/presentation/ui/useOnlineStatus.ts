import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * useOnlineStatus — cihaz çevrimiçi mi? (netinfo). Ağ kütüphanesi yalnızca burada
 * import edilir; değiştirmek gerekirse tek dosya yeter.
 */
export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // isConnected null olabilir (bilinmiyor) → çevrimiçi varsay.
      setOnline(state.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  return online;
};
