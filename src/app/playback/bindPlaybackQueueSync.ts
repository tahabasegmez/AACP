import { Logger } from '@core/logger';
import { AudioPlayerService } from '@domain/services';
import { syncQueueFromPlayer } from '@presentation/features/player/syncQueueFromPlayer';

/**
 * bindPlaybackQueueSync — kuyruk uygulama DIŞINDAN değiştiğinde arayüzü tazeler.
 *
 * Kuyruğun sahibi oynatıcı olduğu için sıra artık uygulamaya sorulmadan da
 * ilerleyebilir: kilit ekranındaki "sonraki bölüm", Dynamic Island, CarPlay,
 * direksiyon tuşu ya da bölüm bitince kütüphanenin kendi geçişi. Bunların
 * hiçbiri uygulama kodundan geçmez; arayüzün haberi ancak buradan olur.
 *
 * Bir EKRANA bağlı değildir: araçla açılan uygulamada React ağacı hiç monte
 * edilmeden de kuyruğun doğru okunması gerekir.
 */
export const bindPlaybackQueueSync = (deps: {
  audioPlayer: AudioPlayerService;
  logger: Logger;
}): (() => void) => {
  const { audioPlayer, logger } = deps;

  /** En son yansıtılan bölüm — her durum yayınında kuyruk okunmaz. */
  let lastEpisodeId: string | null = null;

  return audioPlayer.subscribe(state => {
    if (state.currentEpisodeId === lastEpisodeId) {
      return;
    }
    lastEpisodeId = state.currentEpisodeId;

    void syncQueueFromPlayer(audioPlayer).catch(error => {
      logger.warn('Kuyruk yansıması tazelenemedi', error);
    });
  });
};
