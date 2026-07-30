import { usePlayerStore } from '../../stores';

/** Bir bölümün oynatıcıdaki durumu. */
export interface NowPlayingState {
  /** Oynatıcıda açık olan bölüm bu mu? */
  isCurrent: boolean;
  /** Şu anda gerçekten ses çıkıyor mu? (duraklatıldıysa false) */
  isPlaying: boolean;
}

/**
 * useNowPlaying — bir bölümün "çalıyor mu" durumu.
 *
 * Listeler bunu kendileri sorar; durumu ekranlar boyunca prop olarak taşımak
 * her yeni liste türünde unutulmaya açıktı. Store aboneliği yalnızca ilgili
 * alanları seçer, dolayısıyla satırlar her ilerleme tikinde yeniden çizilmez.
 */
export const useNowPlaying = (episodeId: string): NowPlayingState => {
  const isCurrent = usePlayerStore(s => s.currentEpisode?.id === episodeId);
  const isPlaying = usePlayerStore(
    s => s.currentEpisode?.id === episodeId && s.playback.status === 'playing',
  );
  return { isCurrent, isPlaying };
};
