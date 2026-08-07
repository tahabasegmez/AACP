import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@core/error';
import {
  PlaybackCommand,
  activeDevice,
  commandEpisode,
  commandPositionSec,
  isAnonymous,
  playCommand,
  playbackTakenOver,
} from '@domain/entities';
import { AppDependencies, useDependencies } from '../../di';
import { queryKeys } from '../../query/queryKeys';
import { useCurrentUser } from '../../query';
import { useDeviceSessionStore, usePlayerStore } from '../../stores';
import { usePlaybackController } from './usePlaybackController';

/**
 * Tur sıklıkları.
 *
 * ÇALARKEN sık sorulur: kullanıcı başka cihazından oynatmayı devraldığında
 * sesin burada devam etmesi kabul edilemez, birkaç saniyeden fazla sürmemeli.
 * BOŞTAYKEN daha seyrek: burada beklenen tek şey "bu cihazda çal" komutunun
 * gelmesidir ve kullanıcı zaten diğer cihazın başındadır.
 *
 * Gerçek zamanlı bir kanal (websocket/push) daha iyi olurdu; bugün ne push
 * yapılandırması ne de kalıcı bağlantı altyapısı var. Sıklık, o altyapı
 * geldiğinde tek yerden düşürülebilsin diye burada.
 */
const PLAYING_TICK_MS = 5_000;
const IDLE_TICK_MS = 10_000;

/**
 * Konum yayınlama sıklığı — turdan AYRI ve daha seyrek.
 *
 * Tur bir okumadır (ucuz); yayın bir yazmadır. Konum, sunucunun ölçtüğü yaşla
 * ilerletilebildiği için her turda yazmaya gerek yok: 15 saniyede bir yayın,
 * saniye altı doğrulukla aynı sonucu verir ve yazma sayısını üçte bire indirir.
 */
const PUBLISH_MS = 15_000;

/** Hesabın cihazları — cihaz panelinin kaynağı (salt okunur). */
export const usePlaybackDevices = () => {
  const { deviceSession } = useDependencies();

  return useQuery({
    queryKey: queryKeys.playbackDevices,
    enabled: deviceSession.available,
    queryFn: async () => unwrap(await deviceSession.list()),
    // Panel açıkken taze kalsın; kapalıyken sorgu zaten çalışmaz.
    refetchInterval: IDLE_TICK_MS,
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
  const { deviceSession, playEpisode } = useDependencies();
  const { togglePlay } = usePlaybackController();
  const setTakenOverBy = useDeviceSessionStore(s => s.setTakenOverBy);
  const qc = useQueryClient();

  return useCallback(async () => {
    const result = await deviceSession.claim();
    if (!result.ok) {
      return;
    }
    setTakenOverBy(null);
    qc.setQueryData(queryKeys.playbackDevices, result.value.devices);

    // Devralınan cihaz bir şey çalıyorduysa ORADAN devam edilir: bölüm ve
    // saniye karşı cihazın bildirdiğidir. Bu cihazın kendi yerel kaydından
    // devam etmek, çoğu zaman başka bir bölümü başka bir saniyeden çalmaktı.
    const nowPlaying = result.value.nowPlaying;
    if (nowPlaying) {
      await playHere(nowPlaying, playEpisode);
      return;
    }

    // Devralınacak bir oynatma yoksa bu cihaz kendi bölümüne devam eder.
    if (usePlayerStore.getState().playback.status !== 'playing') {
      await togglePlay();
    }
  }, [deviceSession, playEpisode, qc, setTakenOverBy, togglePlay]);
};

/**
 * Bir komutu (bölüm + saniye) bu cihazda çalar.
 *
 * Devralma ve aktarım aynı işi yapar; tek fonksiyonda tutulması ikisinin
 * ayrışmasını engeller. Kuyruk tek bölümle kurulur: kaynak cihazın kuyruğunu
 * taşımak, orada sıraya eklenmiş bölümleri de getirirdi — kullanıcı cihaz
 * değiştirdi, kuyruğunu taşımadı.
 */
const playHere = async (
  command: PlaybackCommand,
  playEpisode: AppPlayEpisode,
): Promise<void> => {
  const episode = commandEpisode(command);
  // Konum, yayının yaşı kadar ilerletilir: karşı cihaz yayından bu yana
  // çalmaya devam etti, kullanıcı o sesi zaten duydu.
  await playEpisode.execute({
    episode,
    queue: [episode],
    index: 0,
    startPositionSec: commandPositionSec(command),
  });
};

/** `playEpisode` use case'inin burada kullanılan yüzeyi. */
type AppPlayEpisode = AppDependencies['playEpisode'];

/**
 * Bu cihazın o an çaldığı bölüm + saniye.
 *
 * Store'dan ÇAĞRI ANINDA okunur (abonelikle değil): yayın her turda tazelenmeli
 * ve bir saniyelik konum değişimi için efekt yeniden kurulmamalı.
 */
const currentCommand = (): PlaybackCommand | undefined => {
  const { currentEpisode, playback } = usePlayerStore.getState();
  return currentEpisode
    ? playCommand(currentEpisode, playback.positionSec, playback.rate)
    : undefined;
};

/**
 * Oynatmayı başka bir cihaza gönderir.
 *
 * Kaynak cihaz ANINDA duraklatılır ve şerit gösterilir; sunucudan onay
 * beklenmez. Beklemek, iki cihazda birkaç saniye birden ses çalması demekti
 * ve kullanıcı düğmeye bastığında hiçbir şey olmamış gibi görünürdü.
 */
export const useTransferPlayback = () => {
  const { deviceSession, pausePlayback } = useDependencies();
  const setTakenOverBy = useDeviceSessionStore(s => s.setTakenOverBy);
  const qc = useQueryClient();
  /** Aktarım sürerken düğmeyi kilitlemek için (çift dokunuş). */
  const [pending, setPending] = useState<string | null>(null);

  const transfer = useCallback(
    async (toDeviceId: string, toDeviceName: string) => {
      const { currentEpisode, playback } = usePlayerStore.getState();
      if (!currentEpisode) {
        return false;
      }

      setPending(toDeviceId);
      try {
        const command = playCommand(currentEpisode, playback.positionSec);
        // Ses önce susar: hedef cihaz komutu birkaç saniye içinde alacak,
        // o aralıkta iki cihazdan birden ses gelmemeli.
        await pausePlayback.execute();
        setTakenOverBy(toDeviceName);

        const result = await deviceSession.transfer(toDeviceId, command);
        if (!result.ok) {
          // Aktarım gitmediyse şerit yanıltıcı olurdu; geri alınır.
          setTakenOverBy(null);
          return false;
        }
        await qc.invalidateQueries({ queryKey: queryKeys.playbackDevices });
        return true;
      } finally {
        setPending(null);
      }
    },
    [deviceSession, pausePlayback, qc, setTakenOverBy],
  );

  return { transfer, pendingDeviceId: pending };
};

/**
 * PlaybackSessionGuard — "aynı hesapta tek cihaz" kuralını uygular ve bu
 * cihaza bırakılan komutları alır.
 *
 * Akış:
 *   - çalmaya başlayınca oturum DEVRALINIR,
 *   - düzenli olarak TUR atılır: "hâlâ bende mi" ve "bana komut var mı",
 *   - oturum kaybedilmişse oynatma duraklatılır ve şerit gösterilir,
 *   - "şunu çal" komutu geldiyse oynatma burada başlar,
 *   - duraklatınca oturum bırakılır.
 *
 * Tur, oturumu TAZELEMEK için `claim` kullanmaz: bu, oynatmayı başka cihazdan
 * geri çalardı. Tur yalnızca okur (ve kendi gelen kutusunu boşaltır).
 *
 * Sunucu yapılandırılmamışsa ya da kullanıcı misafirse hiçbir şey yapılmaz:
 * misafir her cihazda ayrı bir kimliktir, kuralın uygulanacağı bir hesap yok.
 */
export const usePlaybackSessionGuard = (): void => {
  const { deviceSession, pausePlayback, playEpisode } = useDependencies();
  const status = usePlayerStore(s => s.playback.status);
  const setTakenOverBy = useDeviceSessionStore(s => s.setTakenOverBy);
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  /** Aynı oynatma turunda oturumu iki kez devralmamak için. */
  const claimed = useRef(false);
  /** Arka plandayken boşta tur atmamak için. */
  const foreground = useRef(AppState.currentState !== 'background');
  /** Son yayının zamanı ve bölümü — seyrek yayın için. */
  const lastPublish = useRef(0);
  const published = useRef<string | null>(null);

  const playing = status === 'playing';
  const enabled = deviceSession.available && !!user && !isAnonymous(user);

  /** Gelen "şunu çal" komutunu uygular. */
  const applyCommand = useCallback(
    async (command: PlaybackCommand) => {
      claimed.current = true;
      setTakenOverBy(null);
      await playHere(command, playEpisode);
    },
    [playEpisode, setTakenOverBy],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      foreground.current = next !== 'background';
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!playing && claimed.current) {
      claimed.current = false;
      void deviceSession.release();
    }

    const thisDevice = deviceSession.deviceId();

    const tick = async (): Promise<void> => {
      // Çalan cihaz ne çaldığını YAYINLAR — devralan cihazın bölümü ve
      // saniyeyi öğrenebileceği tek kaynak budur. Yayın her turda değil,
      // PUBLISH_MS'te bir yapılır: aradaki boşluğu sunucunun ölçtüğü yaş
      // kapatır, yazma sayısı düşer. Bölüm değişimi beklemeden yayınlanır.
      const episodeId = usePlayerStore.getState().currentEpisode?.id ?? null;
      const due =
        Date.now() - lastPublish.current >= PUBLISH_MS || episodeId !== published.current;
      const publish = playing && due;
      if (publish) {
        lastPublish.current = Date.now();
        published.current = episodeId;
      }

      const result = await deviceSession.poll(publish ? currentCommand() : undefined);
      if (!result.ok) {
        // Ağ hatası oturum kaybı SAYILMAZ: çevrimdışı bir cihazda müziği
        // susturmak, kuralın korumaya çalıştığı şeyden daha zararlı olurdu.
        return;
      }
      const { devices, command } = result.value;

      // Liste her turda tazedir; panel açıksa ayrıca sormasına gerek yok.
      qc.setQueryData(queryKeys.playbackDevices, devices);

      if (command) {
        await applyCommand(command);
        return;
      }

      if (playing && playbackTakenOver(devices, thisDevice)) {
        claimed.current = false;
        setTakenOverBy(activeDevice(devices)?.name ?? 'Başka cihaz');
        await pausePlayback.execute();
      }
    };

    if (playing && !claimed.current) {
      claimed.current = true;
      setTakenOverBy(null);
      void deviceSession.claim();
    }

    const timer = setInterval(() => {
      // Boştayken yalnızca uygulama önplandayken tur atılır: arka planda
      // beklenen bir komut yoktur ve pil harcamanın anlamı olmazdı.
      if (playing || foreground.current) {
        void tick();
      }
    }, playing ? PLAYING_TICK_MS : IDLE_TICK_MS);

    return () => clearInterval(timer);
  }, [applyCommand, deviceSession, enabled, pausePlayback, playing, qc, setTakenOverBy]);
};
