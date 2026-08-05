import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@core/error';
import { activeDevice, playbackTakenOver } from '@domain/entities';
import { useDependencies } from '../../di';
import { queryKeys } from '../../query/queryKeys';
import { useDeviceSessionStore, usePlayerStore } from '../../stores';
import { usePlaybackController } from './usePlaybackController';

/**
 * Oturumun hâlâ bizde olduğunu doğrulama sıklığı.
 *
 * Yalnızca ÇALARKEN sorulur. Sık sormak gereksiz: devralma nadir bir olaydır
 * ve yarım dakikalık gecikme, sesin iki cihazda birden çalmasına yol açmaz —
 * devralan cihaz zaten anında oturumu almıştır.
 */
const HEARTBEAT_MS = 30_000;

/** Hesabın cihazları — cihaz panelinin kaynağı. */
export const usePlaybackDevices = () => {
  const { deviceSession } = useDependencies();

  return useQuery({
    queryKey: queryKeys.playbackDevices,
    enabled: deviceSession.available,
    queryFn: async () => unwrap(await deviceSession.list()),
    // Panel açıkken taze kalsın; kapalıyken sorgu zaten çalışmaz.
    refetchInterval: HEARTBEAT_MS,
  });
};

/** Bu cihazın kimliği — listede "bu cihaz" işaretini koymak için. */
export const useThisDeviceId = (): string => {
  const { deviceSession } = useDependencies();
  return deviceSession.deviceId();
};

/**
 * Oturumu bu cihaza alır ve oynatmayı sürdürür.
 *
 * Hem şeritteki "Buraya al" hem cihaz panelindeki seçim bunu çağırır: ikisi
 * de aynı işi yapar, iki ayrı yol yazmak davranışın ayrışması demekti.
 */
export const useTakeOverPlayback = () => {
  const { deviceSession } = useDependencies();
  const { togglePlay } = usePlaybackController();
  const setTakenOverBy = useDeviceSessionStore(s => s.setTakenOverBy);
  const qc = useQueryClient();

  return useCallback(async () => {
    const result = await deviceSession.claim();
    if (!result.ok) {
      return;
    }
    setTakenOverBy(null);
    await qc.invalidateQueries({ queryKey: queryKeys.playbackDevices });

    // Duraklatılmış durumdaysa devam ettir; zaten çalıyorsa dokunma.
    if (usePlayerStore.getState().playback.status !== 'playing') {
      await togglePlay();
    }
  }, [deviceSession, qc, setTakenOverBy, togglePlay]);
};

/**
 * PlaybackSessionGuard — "aynı hesapta tek cihaz" kuralını uygular.
 *
 * Akış:
 *   - çalmaya başlayınca oturum DEVRALINIR,
 *   - çalarken periyodik olarak "hâlâ bende mi" diye BAKILIR (devralmadan;
 *     tazeleme için `claim` kullanmak, başka cihazdan oturumu geri çalardı),
 *   - kaybedilmişse oynatma duraklatılır ve şerit gösterilir,
 *   - duraklatınca oturum bırakılır.
 *
 * Sunucu yapılandırılmamışsa hiçbir şey yapmaz: yerel kurulumda hesap kavramı
 * yoktur, kuralı uygulamak anlamsız olurdu.
 */
export const usePlaybackSessionGuard = (): void => {
  const { deviceSession, pausePlayback } = useDependencies();
  const status = usePlayerStore(s => s.playback.status);
  const setTakenOverBy = useDeviceSessionStore(s => s.setTakenOverBy);
  /** Aynı oynatma turunda oturumu iki kez devralmamak için. */
  const claimed = useRef(false);

  useEffect(() => {
    if (!deviceSession.available) {
      return;
    }

    if (status !== 'playing') {
      if (claimed.current) {
        claimed.current = false;
        void deviceSession.release();
      }
      return;
    }

    const thisDevice = deviceSession.deviceId();

    const check = async (): Promise<void> => {
      const result = await deviceSession.list();
      if (!result.ok) {
        // Ağ hatası oturum kaybı SAYILMAZ: çevrimdışı bir cihazda müziği
        // susturmak, kuralın korumaya çalıştığı şeyden daha zararlı olurdu.
        return;
      }
      if (playbackTakenOver(result.value, thisDevice)) {
        claimed.current = false;
        setTakenOverBy(activeDevice(result.value)?.name ?? 'Başka cihaz');
        await pausePlayback.execute();
      }
    };

    if (!claimed.current) {
      claimed.current = true;
      setTakenOverBy(null);
      void deviceSession.claim();
    }

    const timer = setInterval(() => void check(), HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [deviceSession, pausePlayback, setTakenOverBy, status]);
};
