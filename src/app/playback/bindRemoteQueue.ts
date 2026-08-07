import { setRemoteQueueHandlers } from '@infrastructure';
import {
  PlaybackControllerDeps,
  createPlaybackController,
} from '@presentation/features/player/playbackController';
import { usePlayerStore } from '@presentation/stores';

/**
 * bindRemoteQueue — "sonraki/önceki bölüm" uzaktan komutlarını kuyruğa bağlar.
 *
 * Bu komutlar CarPlay'den, kilit ekranından ve direksiyon tuşlarından gelir ve
 * arka plan servisinde (`playbackService`) karşılanır; hangi bölümün sıradaki
 * olduğunu ise kuyruk bilir. İkisini buluşturmak composition root'un işidir:
 * altyapı yalnızca sözleşmeyi tanır, kuyruğun nerede yaşadığını bilmez.
 *
 * Bağlama BİR EKRANA BAĞLI DEĞİLDİR. Eskiden bunu bir React bileşeni yapıyordu
 * ve bileşen sökülünce bağlantı kopuyordu; uygulamayı araç açtığında telefon
 * arayüzü hiç görünmediği için komutlar sessizce yok sayılıyor, araçta
 * "sonraki bölüm" çalışmıyor ve bölüm bitince sıradakine geçilmiyordu.
 */
export const bindRemoteQueue = (deps: PlaybackControllerDeps): void => {
  const controller = createPlaybackController(deps);

  setRemoteQueueHandlers({
    next: () => controller.next(),
    // Konum, komutun geldiği ANDA okunur: "geri" tuşu bölümün başındaysa
    // önceki bölüme geçer, değilse bölümü başa sarar (telefondaki kuralla aynı).
    previous: () => controller.previous(usePlayerStore.getState().playback.positionSec),
  });
};
