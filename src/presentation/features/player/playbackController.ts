import { Episode } from '@domain/entities';
import { AppDependencies } from '../../di';
import { setPlaybackSession, usePlayerQueueStore, usePlayerStore } from '../../stores';

export interface PlayContext {
  readonly episodes: Episode[];
  readonly index: number;
}

/** İlk 10 sn içindeyken geri → önceki bölüm; sonrası → başa sar. */
const BACK_TO_PREVIOUS_THRESHOLD_SEC = 10;

/** Oynatma akışının ihtiyaç duyduğu use case'ler. */
export type PlaybackControllerDeps = Pick<
  AppDependencies,
  'analytics' | 'continueEpisode' | 'pausePlayback' | 'resumePlayback' | 'seekTo'
>;

export interface PlaybackController {
  /** Yeni bir bağlam kurar (kuyruk + çalan bölüm) ve kaldığı yerden çalar. */
  play(episode: Episode, context?: PlayContext): Promise<void>;
  /** MEVCUT kuyrukta başka bir bölüme atlar — kuyruğu yeniden kurmaz. */
  playIndex(index: number): void;
  /** Açık olan bölüm için oynat/duraklat'ın doğru olanını yapar. */
  togglePlay(): Promise<void>;
  /** Kuyruktaki sonraki bölüm. */
  next(): void;
  /** Kuyruktaki önceki bölüm; başa yakın değilse bölümü başa sarar. */
  previous(positionSec: number): void;
}

/**
 * createPlaybackController — oynatma akışının çekirdeği (navigasyonsuz).
 *
 * REACT'TEN BAĞIMSIZ bir nesnedir; durumu bileşen ağacında değil, modül
 * seviyesindeki store'larda yaşar. Bu bilinçlidir: aynı komutlar araçtan,
 * kilit ekranından ve direksiyon tuşlarından da gelir ve o anda telefonda
 * BİR EKRAN AÇIK OLMAYABİLİR. Mantık bir kancanın içinde yaşadığı sürece
 * "React ağacı monte edilmemişse sonraki bölüm çalışmıyor" kaçınılmazdı.
 *
 * İki giriş noktası vardır ve ikisi de bu tek uygulamayı kullanır:
 *  - `usePlaybackController()` — ekranlar için ince bir kanca,
 *  - `setRemoteQueueHandlers()` — uzaktan kumanda komutları (composition root).
 */
export const createPlaybackController = (
  deps: PlaybackControllerDeps,
): PlaybackController => {
  const { analytics, continueEpisode, pausePlayback, resumePlayback, seekTo } = deps;

  /** Oynatmayı başlatır; KUYRUĞA DOKUNMAZ. */
  const start = async (episode: Episode): Promise<void> => {
    // Telemetri: hangi bölüm/şov çalındı (kişisel veri içermez).
    analytics.track('episode_play', {
      episodeId: episode.id,
      showId: episode.showId,
      durationSec: episode.durationSec,
    });
    await continueEpisode.execute({ episode });
  };

  const play = async (episode: Episode, context?: PlayContext): Promise<void> => {
    // Kuyruk ve çalan bölüm tek yerden kurulur (bkz. setPlaybackSession);
    // CarPlay de aynı noktadan geçer, iki yüzey ayrışamaz.
    setPlaybackSession(context?.episodes ?? [episode], context?.index ?? 0);
    await start(episode);
  };

  /**
   * Kuyrukta başka bir bölüme atlar.
   *
   * `play` çağırmak kuyruğu YENİDEN KURARDI ve tüm öğeler `context` olurdu —
   * yani kullanıcının sıraya eklediği bölümler sıradan bağlam öğelerine
   * dönüşür, ayrım kaybolurdu.
   */
  const playIndex = (i: number): void => {
    const { items } = usePlayerQueueStore.getState();
    const episode = items[i]?.episode;
    if (!episode) {
      return;
    }
    usePlayerQueueStore.setState({ index: i });
    usePlayerStore.getState().setCurrentEpisode(episode);
    void start(episode);
  };

  /**
   * Oynat/duraklat — açık olan bölüm için doğru eylemi seçer.
   *
   * Uygulama yeni açıldığında mini player'da bir bölüm durur ama o bölüm henüz
   * oynatıcıya YÜKLENMEMİŞTİR; orada "devam et" demek hiçbir şey yapmaz. Bu
   * durumda kaldığı yerden baştan yüklenir. Ayrım `currentEpisodeId`
   * karşılaştırmasıyla yapılır: oynatıcının gerçekten neyi tuttuğunu o söyler.
   */
  const togglePlay = async (): Promise<void> => {
    const { currentEpisode, playback } = usePlayerStore.getState();
    if (!currentEpisode) {
      return;
    }
    if (playback.status === 'playing') {
      await pausePlayback.execute();
      return;
    }
    if (playback.currentEpisodeId !== currentEpisode.id) {
      // Bölüm oynatıcıya henüz yüklenmemiş. KUYRUK ZATEN ONU İÇERİYORSA
      // yeniden kurulmaz: `play` kuyruğu tek bölüme indirger ve CarPlay'de
      // ya da bir listeden kurulmuş sırayı yok ederdi — telefondan "oynat"a
      // basmak araçtaki "Sıradakiler" listesini boşaltıyordu.
      const inQueue = usePlayerQueueStore
        .getState()
        .items.some(item => item.episode.id === currentEpisode.id);
      await (inQueue ? start(currentEpisode) : play(currentEpisode));
      return;
    }
    await resumePlayback.execute();
  };

  const next = (): void => {
    const { items, index } = usePlayerQueueStore.getState();
    if (index >= 0 && index < items.length - 1) {
      playIndex(index + 1);
    }
  };

  const previous = (positionSec: number): void => {
    const { index } = usePlayerQueueStore.getState();
    if (positionSec <= BACK_TO_PREVIOUS_THRESHOLD_SEC && index > 0) {
      playIndex(index - 1);
    } else {
      void seekTo.execute({ positionSec: 0 });
    }
  };

  return { play, playIndex, togglePlay, next, previous };
};
