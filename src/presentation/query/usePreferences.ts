import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@core/error';
import { DEFAULT_PREFERENCES, PreferenceKey, Preferences } from '@domain/entities';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

/**
 * Tercihler — misafir ve giriş yapmış kullanıcı için AYNI akış.
 *
 * Fark yalnızca verinin senkronlanıp senkronlanmadığıdır ve o karar senkron
 * motorundadır; arayüz ikisini ayırt etmez.
 */
export const usePreferences = () => {
  const { getPreferences } = useDependencies();
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: async () => unwrap(await getPreferences.execute()),
    // Tercih okuması ucuzdur ama sık sık yeniden çekmenin de anlamı yok.
    staleTime: 60_000,
  });
};

/**
 * Tek bir tercihi okur ve yazar.
 *
 * Yazma İYİMSERDİR: kullanıcı bir filtreyi açtığında arayüz beklemeden
 * tepki vermeli; depolama zaten yereldir ve hata olasılığı ihmal edilebilir.
 */
export const usePreference = <K extends PreferenceKey>(key: K) => {
  const { setPreference } = useDependencies();
  const client = useQueryClient();
  const { data } = usePreferences();

  const mutation = useMutation({
    mutationFn: async (value: Preferences[K]) =>
      unwrap(await setPreference.execute({ key, value })),
    onMutate: async (value: Preferences[K]) => {
      await client.cancelQueries({ queryKey: queryKeys.preferences });
      const previous = client.getQueryData<Preferences>(queryKeys.preferences);
      client.setQueryData<Preferences>(queryKeys.preferences, {
        ...(previous ?? DEFAULT_PREFERENCES),
        [key]: value,
      });
      return { previous };
    },
    onError: (_error, _value, context) => {
      // Yazılamadıysa arayüz gerçeği yansıtmalı: eski değere dön.
      if (context?.previous) {
        client.setQueryData(queryKeys.preferences, context.previous);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.preferences }),
  });

  return {
    value: (data ?? DEFAULT_PREFERENCES)[key],
    set: (value: Preferences[K]) => mutation.mutate(value),
  };
};
