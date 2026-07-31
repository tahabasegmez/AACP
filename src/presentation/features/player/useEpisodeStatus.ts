import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@core/error';
import { Episode } from '@domain/entities';
import { useDependencies } from '../../di';
import { queryKeys } from '../../query';

/** Bir bölümün dinlenme durumu. */
export interface EpisodeStatus {
  /** Bölüm dinlendi (ya da elle işaretlendi) mi? */
  completed: boolean;
  /** 0..1 arası kaldığın yer; hiç başlanmamışsa 0. */
  fraction: number;
  /** Bölüme hiç dokunulmuş mu? (yarım ile hiç başlanmamışı ayırır) */
  started: boolean;
}

const NOT_STARTED: EpisodeStatus = { completed: false, fraction: 0, started: false };

/**
 * Tüm "kaldığın yer" kayıtları, bölüm kimliğine göre indekslenmiş.
 *
 * Tek sorgu, çok satır: her satırın ayrı ayrı depoya sorması listeleri
 * yavaşlatırdı. Kayıtlar yereldir, indeks ucuzdur.
 */
export const useProgressIndex = () => {
  const { getAllProgress } = useDependencies();
  return useQuery({
    queryKey: queryKeys.progress,
    queryFn: async () => unwrap(await getAllProgress.execute()),
    select: items => new Map(items.map(item => [item.episodeId, item])),
    // Oynatma sırasında konum sürekli yazılır; her tikte yeniden çekmek
    // gereksiz, bayatlık payı listeler için yeterince taze.
    staleTime: 5_000,
  });
};

/**
 * useEpisodeStatus — bir bölümün dinlenme durumu.
 *
 * Listeler bunu KENDİLERİ sorar; durumu ekranlar boyunca prop olarak taşımak
 * her yeni liste türünde unutulmaya açıktı — nitekim "dinlendi" işareti yalnızca
 * şov detayında görünüyordu.
 */
export const useEpisodeStatus = (episodeId: string): EpisodeStatus => {
  const { data } = useProgressIndex();
  const progress = data?.get(episodeId);
  if (!progress) {
    return NOT_STARTED;
  }
  return {
    completed: progress.completed,
    fraction:
      progress.durationSec > 0
        ? Math.min(1, progress.positionSec / progress.durationSec)
        : 0,
    started: progress.positionSec > 0,
  };
};

/**
 * Bölümü elle "dinlendi" işaretler / işareti kaldırır.
 *
 * Kayıt değiştiği için hem indeks hem "Dinlemeye devam" listesi tazelenir:
 * işaretlenen bölüm o listeden düşmeli.
 */
export const useSetEpisodeCompleted = () => {
  const { setEpisodeCompleted } = useDependencies();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (params: { episode: Episode; completed: boolean }) =>
      unwrap(await setEpisodeCompleted.execute(params)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.progress });
      void client.invalidateQueries({ queryKey: queryKeys.resume });
    },
  });
};
