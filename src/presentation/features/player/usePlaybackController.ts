import { useMemo } from 'react';
import { useDependencies } from '../../di';
import { PlaybackController, createPlaybackController } from './playbackController';

export type { PlayContext, PlaybackController } from './playbackController';

/**
 * usePlaybackController — oynatma akışının ekranlara açılan yüzü.
 *
 * Mantık burada DEĞİL, `createPlaybackController` içindedir: aynı komutlar
 * araçtan ve kilit ekranından da geliyor ve o an açık bir ekran olmayabiliyor
 * (bkz. playbackController). Kanca yalnızca bağımlılıkları bağlar.
 *
 * usePlayEpisode bunu sarıp Player'ı açar; Player içi ileri/geri navigasyonsuz
 * kullanır.
 */
export const usePlaybackController = (): PlaybackController => {
  const dependencies = useDependencies();
  return useMemo(() => createPlaybackController(dependencies), [dependencies]);
};
