import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { useDependencies } from '../../di';
import { useDownloadsStore } from '../../stores';

/**
 * useDownloads — indirme durumunu okur ve indir/sil işlemlerini yürütür.
 *
 * Kalıcı kaynak DownloadRepository (use case'ler üzerinden); UI için reaktif
 * ayna downloadsStore. `hydrate` açılışta listeyi yükler.
 */
export const useDownloads = () => {
  const { getDownloads, downloadEpisode, removeDownload } = useDependencies();
  const items = useDownloadsStore(s => s.items);
  const setAll = useDownloadsStore(s => s.setAll);
  const upsert = useDownloadsStore(s => s.upsert);
  const remove = useDownloadsStore(s => s.remove);

  const hydrate = useCallback(async () => {
    const result = await getDownloads.execute();
    if (result.ok) {
      setAll(result.value);
    }
  }, [getDownloads, setAll]);

  const start = useCallback(
    async (episode: Episode) => {
      // Optimistik: hemen "indiriliyor" göster.
      upsert({
        episodeId: episode.id,
        status: 'downloading',
        episodeTitle: episode.title,
        showId: episode.showId,
        artworkUrl: episode.imageUrl,
        durationSec: episode.durationSec,
        publishedAt: episode.publishedAt,
      });
      const result = await downloadEpisode.execute({ episode });
      if (result.ok) {
        upsert(result.value);
      } else {
        upsert({ episodeId: episode.id, status: 'failed' });
      }
    },
    [downloadEpisode, upsert],
  );

  const del = useCallback(
    async (episodeId: string) => {
      await removeDownload.execute({ episodeId });
      remove(episodeId);
    },
    [removeDownload, remove],
  );

  return { items, hydrate, start, remove: del };
};

/** Tek bir bölümün indirme durumunu döner (kart/rozet için). */
export const useDownloadStatus = (episodeId: string) =>
  useDownloadsStore(s => s.items[episodeId]?.status);
