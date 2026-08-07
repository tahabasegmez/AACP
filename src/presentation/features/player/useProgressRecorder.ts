import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PlaybackState } from '@domain/entities';
import { useDependencies } from '../../di';
import { queryKeys } from '../../query';
import { queueEpisodes, usePlayerQueueStore, usePlayerStore } from '../../stores';
import { episodeForProgress } from './progressRecord';

/** Çalarken konumu en fazla bu aralıkla (saniye) kaydet. */
const SAVE_INTERVAL_SEC = 5;

/**
 * useProgressRecorder — "kaldığın yer" kaydını CİHAZDA, anında tutar.
 *
 * İki farklı yazma nedeni vardır ve ikisi bilinçli olarak ayrılmıştır:
 *
 *  - **Periyodik**: çalarken her `SAVE_INTERVAL_SEC` saniyede bir. Her konum
 *    yayınında diske yazmak gereksiz olurdu.
 *  - **Anında (flush)**: bölüm değiştiğinde ya da oynatma durumu değiştiğinde
 *    (duraklat/dur). Kullanıcı duraklatıp uygulamadan çıktığında son beş
 *    saniye kaybolmamalı — "geç işlenen kaldığın yer" hissinin asıl kaynağı
 *    buydu.
 *
 * Kayıt yereldir (MMKV) ve senkron ARKADA çalışır: liste ekranları sunucuyu
 * beklemez, kayıt yazılır yazılmaz tazelenir. Sunucudan gelen güncelleme
 * geldiğinde aynı sorgular normal akışında yeniden tazelenir.
 */
export const useProgressRecorder = (): ((state: PlaybackState) => void) => {
  const { savePlaybackProgress } = useDependencies();
  const queryClient = useQueryClient();

  const lastPositionRef = useRef(0);
  const lastEpisodeRef = useRef<string | null>(null);
  const lastStatusRef = useRef<PlaybackState['status'] | null>(null);

  return useCallback(
    (state: PlaybackState) => {
      // Reklam çalarken ilerleme KAYDEDİLMEZ: reklamın konumu bölümün konumu
      // değildir; kaydedilse "kaldığın yer" bozulurdu.
      if (state.ad) {
        return;
      }

      const { currentEpisodeId, positionSec, durationSec, status } = state;
      if (!currentEpisodeId || (status !== 'playing' && status !== 'paused')) {
        return;
      }

      const episodeChanged = lastEpisodeRef.current !== currentEpisodeId;
      const statusChanged = lastStatusRef.current !== status;
      const progressed =
        Math.abs(positionSec - lastPositionRef.current) >= SAVE_INTERVAL_SEC;
      const flush = episodeChanged || statusChanged;

      if (!flush && !progressed) {
        return;
      }

      lastEpisodeRef.current = currentEpisodeId;
      lastStatusRef.current = status;
      lastPositionRef.current = positionSec;

      // "Dinlemeye devam" kartının başlık/kapak gösterip doğrudan çalabilmesi
      // için bölümün meta'sını da kaydet — ama META, KAYDIN KİMLİĞİYLE AYNI
      // bölümden gelmeli. Bölüm değişiminde oynatıcı ile store kısa süreliğine
      // ayrışır; körlemesine "açık olan bölüm"ü yazmak kaydı yanlış başlık,
      // kapak ve audioUrl ile kalıcı olarak zehirliyordu (bkz. progressRecord).
      const episode = episodeForProgress(
        currentEpisodeId,
        usePlayerStore.getState().currentEpisode,
        queueEpisodes(usePlayerQueueStore.getState().items),
      );

      void savePlaybackProgress
        .execute({
          episodeId: currentEpisodeId,
          positionSec,
          durationSec,
          episodeTitle: episode?.title,
          showId: episode?.showId,
          artworkUrl: episode?.imageUrl,
          audioUrl: episode?.audioUrl,
        })
        .then(() => {
          // Ekranlar yalnızca kayıt gerçekten değiştiğinde tazelenir; her beş
          // saniyede bir tüm listeleri yeniden çizmek gereksiz olurdu.
          if (!flush) {
            return;
          }
          void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
          void queryClient.invalidateQueries({ queryKey: queryKeys.resume });
        })
        .catch(() => {
          /* progress kaydı best-effort; hatada sessiz geç */
        });
    },
    [queryClient, savePlaybackProgress],
  );
};
