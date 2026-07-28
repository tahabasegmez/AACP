import { useCallback, useEffect, useState } from 'react';
import { INITIAL_SYNC_STATUS, SyncStatus } from '@domain/entities';
import { useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../di';

/**
 * useSyncStatus — senkron motorunun durumunu UI'a bağlar.
 *
 * Motor durumu kendisi yayınlar (data katmanı); burada yalnızca React'e
 * köprülenir. Böylece "ne zaman senkronlandı, kaç değişiklik bekliyor, son
 * denemede ne oldu" bilgisi tek kaynaktan gelir.
 */
export const useSyncStatus = (): SyncStatus => {
  const { sync } = useDependencies();
  const [status, setStatus] = useState<SyncStatus>(
    () => sync?.getStatus() ?? INITIAL_SYNC_STATUS,
  );

  useEffect(() => {
    if (!sync) {
      return;
    }
    return sync.subscribe(setStatus);
  }, [sync]);

  return status;
};

/**
 * useSyncNow — elle senkron tetikler.
 *
 * Başarılı senkron sonrası TÜM sorgular tazelenir: sunucudan inen veri
 * (listeler, kaldığın yer, takipler) ekranlara hemen yansımalıdır.
 */
export const useSyncNow = () => {
  const { sync } = useDependencies();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (): Promise<SyncStatus | undefined> => {
    if (!sync?.enabled || busy) {
      return undefined;
    }
    setBusy(true);
    try {
      const result = await sync.syncAll();
      await queryClient.invalidateQueries();
      return result;
    } finally {
      setBusy(false);
    }
  }, [sync, queryClient, busy]);

  return { run, busy, enabled: !!sync?.enabled };
};

/**
 * useRefreshPending — bekleyen değişiklik sayısını tazeler.
 *
 * Ağa çıkmaz (yalnızca yerel adaptörlere sorar), bu yüzden ekran her
 * açıldığında çağrılması ucuzdur.
 */
export const useRefreshPending = (): void => {
  const { sync } = useDependencies();

  useEffect(() => {
    if (sync?.enabled) {
      void sync.countPending();
    }
  }, [sync]);
};
