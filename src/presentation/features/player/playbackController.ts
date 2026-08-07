import { Episode } from '@domain/entities';
import { AudioPlayerService } from '@domain/services';
import { AppDependencies } from '../../di';
import { usePlayerQueueStore, usePlayerStore } from '../../stores';
import { syncQueueFromPlayer } from './syncQueueFromPlayer';

export interface PlayContext {
  readonly episodes: Episode[];
  readonly index: number;
}

/** İlk 10 sn içindeyken geri → önceki bölüm; sonrası → başa sar. */
const BACK_TO_PREVIOUS_THRESHOLD_SEC = 10;

/** Oynatma akışının ihtiyaç duyduğu use case'ler ve oynatıcı. */
export type PlaybackControllerDeps = Pick<
  AppDependencies,
  'analytics' | 'audioPlayer' | 'continueEpisode' | 'pausePlayback' | 'resumePlayback'
>;

export interface PlaybackController {
  /** Yeni bir bağlam kurar (kuyruk + çalan bölüm) ve kaldığı yerden çalar. */
  play(episode: Episode, context?: PlayContext): Promise<void>;
  /** MEVCUT kuyrukta başka bir bölüme atlar — kuyruğu yeniden kurmaz. */
  playIndex(index: number): Promise<void>;
  /** Açık olan bölüm için oynat/duraklat'ın doğru olanını yapar. */
  togglePlay(): Promise<void>;
  /** Kuyruktaki sonraki bölüm. */
  next(): Promise<void>;
  /** Kuyruktaki önceki bölüm; başa yakın değilse bölümü başa sarar. */
  previous(positionSec: number): Promise<void>;
  /** Kullanıcı eklemesi — çalanın hemen ardına, bağlamın önüne. */
  enqueue(episode: Episode): Promise<void>;
  /** Kuyruktan çıkarır. */
  removeAt(index: number): Promise<void>;
  /** Kuyrukta taşır (sürükle-bırak). */
  moveItem(from: number, to: number): Promise<void>;
}

/**
 * createPlaybackController — oynatma akışının çekirdeği (navigasyonsuz).
 *
 * REACT'TEN BAĞIMSIZ bir nesnedir: aynı komutlar araçtan, kilit ekranından ve
 * direksiyon tuşlarından da gelir ve o anda telefonda bir ekran açık
 * olmayabilir.
 *
 * SIRALAMA MANTIĞI BURADA DEĞİL, oynatıcıdadır. Bu nesne yalnızca niyeti
 * porta çevirir ve arayüzün yansımasını tazeler; kuyruğun tek gerçek kaynağı
 * track-player'ın kendi kuyruğudur (bkz. AudioPlayerService).
 */
export const createPlaybackController = (
  deps: PlaybackControllerDeps,
): PlaybackController => {
  const { analytics, audioPlayer, continueEpisode, pausePlayback, resumePlayback } =
    deps;

  /** Kuyruk her değiştiğinde arayüzün yansımasını oynatıcıdan tazele. */
  const syncQueue = (): Promise<void> => syncQueueFromPlayer(audioPlayer);

  const track = (episode: Episode): void => {
    // Telemetri: hangi bölüm/şov çalındı (kişisel veri içermez).
    analytics.track('episode_play', {
      episodeId: episode.id,
      showId: episode.showId,
      durationSec: episode.durationSec,
    });
  };

  const play = async (episode: Episode, context?: PlayContext): Promise<void> => {
    track(episode);
    // Bir şovdan/listeden çalmak, ardındaki bölümlerin de sıraya girmesi
    // demektir; bağlam verilmezse kuyruk tek bölümden oluşur.
    await continueEpisode.execute({
      episode,
      queue: context?.episodes ?? [episode],
      index: context?.index ?? 0,
    });
    await syncQueue();
  };

  const playIndex = async (index: number): Promise<void> => {
    const { items } = usePlayerQueueStore.getState();
    const episode = items[index]?.episode;
    if (!episode) {
      return;
    }
    track(episode);
    // Kuyruk YENİDEN KURULMAZ: `play` çağırmak kullanıcının sıraya eklediği
    // bölümleri sıradan bağlam öğelerine çevirir, ayrım kaybolurdu.
    await continueEpisode.execute({ episode, index });
    await syncQueue();
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
      // yeniden kurulmaz: kurmak, bir listeden ya da CarPlay'den gelen sırayı
      // tek bölüme indirirdi.
      const at = usePlayerQueueStore
        .getState()
        .items.findIndex(item => item.episode.id === currentEpisode.id);
      await (at >= 0 ? playIndex(at) : play(currentEpisode));
      return;
    }
    await resumePlayback.execute();
  };

  const next = async (): Promise<void> => {
    await audioPlayer.skipToNext();
    await syncQueue();
  };

  const previous = async (positionSec: number): Promise<void> => {
    if (positionSec > BACK_TO_PREVIOUS_THRESHOLD_SEC) {
      await audioPlayer.seekTo(0);
      return;
    }
    await audioPlayer.skipToPrevious();
    await syncQueue();
  };

  const mutate =
    (apply: (player: AudioPlayerService) => Promise<void>) =>
    async (): Promise<void> => {
      await apply(audioPlayer);
      await syncQueue();
    };

  return {
    play,
    playIndex,
    togglePlay,
    next,
    previous,
    enqueue: episode => mutate(player => player.enqueue(episode))(),
    removeAt: index => mutate(player => player.removeAt(index))(),
    moveItem: (from, to) => mutate(player => player.moveItem(from, to))(),
  };
};
