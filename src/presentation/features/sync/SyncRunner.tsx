import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../../di';
import { queryKeys } from '../../query/queryKeys';

/** Ön plandayken periyodik senkron aralığı (ms). */
const INTERVAL_MS = 5 * 60_000;

/**
 * SyncRunner — cihazlar arası senkronu uygulama yaşam döngüsüne bağlar.
 *
 * Ne zaman senkronlanır:
 *   - açılışta bir kez,
 *   - uygulama ön plana geldiğinde (başka cihazdaki değişiklikler gelsin),
 *   - ön plandayken periyodik olarak,
 *   - arka plana geçerken (yerel değişiklikler gitsin).
 *
 * Senkron bittiğinde ilgili sorgular tazelenir ki ekranlar yeni veriyi göstersin.
 * Sunucu yapılandırılmamışsa bileşen hiçbir şey yapmaz.
 */
export const SyncRunner: React.FC = () => {
  const { sync, errorReporter } = useDependencies();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sync?.enabled) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        await sync.syncAll();
        if (!cancelled) {
          // Senkron sonrası ekranlar güncel veriyi görsün.
          void queryClient.invalidateQueries({ queryKey: queryKeys.resume });
          void queryClient.invalidateQueries({ queryKey: queryKeys.followedShows });
          void queryClient.invalidateQueries({ queryKey: queryKeys.saved });
        }
      } catch (error) {
        errorReporter.report(error, { scope: 'sync' });
      }
    };

    void run();
    const timer = setInterval(() => void run(), INTERVAL_MS);

    const onAppStateChange = (state: AppStateStatus): void => {
      // Hem ön plana dönüşte (çek) hem arka plana geçişte (gönder) senkronla.
      if (state === 'active' || state === 'background') {
        void run();
      }
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [sync, queryClient, errorReporter]);

  return null;
};
