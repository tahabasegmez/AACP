import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { useTheme } from '../theme';

/**
 * useCoverColor — bir kapak görselinin baskın rengini döner (kalıcı cache'li).
 * Renk çıkarılamazsa/uri yoksa marka rengine düşer. Arka plan renklendirmede kullanılır.
 */
export const useCoverColor = (uri?: string): string => {
  const { imagePalette } = useDependencies();
  const theme = useTheme();

  const { data } = useQuery({
    queryKey: ['coverColor', uri ?? ''],
    enabled: !!uri,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => (uri ? await imagePalette.getDominant(uri) : null),
  });

  return data ?? theme.colors.brand;
};
