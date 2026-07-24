import { unwrap } from '@core/error';
import { Episode } from '@domain/entities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

/** "Sonra dinle" listesi (kaydedilen bölümler). */
export const useSavedEpisodes = () => {
  const { getSavedEpisodes } = useDependencies();
  return useQuery({
    queryKey: queryKeys.saved,
    queryFn: async () => unwrap(await getSavedEpisodes.execute()),
  });
};

/** Bölümü "Sonra dinle"ye ekle/çıkar; başarınca listeyi tazeler. */
export const useToggleSaved = () => {
  const { toggleSavedEpisode } = useDependencies();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (episode: Episode) =>
      unwrap(await toggleSavedEpisode.execute({ episode })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.saved }),
  });
};
