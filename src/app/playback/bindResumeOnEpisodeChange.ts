import { Logger } from '@core/logger';
import { AudioPlayerService } from '@domain/services';
import { GetPlaybackProgress } from '@domain/usecases';

/**
 * bindResumeOnEpisodeChange — kuyruk kendiliğinden ilerlediğinde bölümü
 * kaldığı yerden sürdürür.
 *
 * Sıra artık oynatıcının kendi kuyruğu olduğu için bölüm değişimini KÜTÜPHANE
 * yapar: bir bölüm bitince ya da kilit ekranından "sonraki" denince yeni parça
 * baştan başlar. Kullanıcı o bölümü daha önce yarım bıraktıysa bu bir geriye
 * gidiştir — eskiden komut uygulamanın kendi kuyruğundan geçtiği için konum
 * korunuyordu.
 *
 * Bu yüzden tek kural burada durur: **çalan bölüm değiştiğinde, o bölümün
 * kayıtlı konumu varsa oraya atla.** Kullanıcının açıkça bir konumdan
 * başlattığı durumlarda hedef zaten aynı olduğu için atlama fark yaratmaz.
 *
 * Bir EKRANA bağlı değildir: aynı davranış araçta ve uygulama arayüzü hiç
 * açılmadan da geçerli olmalı.
 */
export const bindResumeOnEpisodeChange = (deps: {
  audioPlayer: AudioPlayerService;
  getPlaybackProgress: GetPlaybackProgress;
  logger: Logger;
}): (() => void) => {
  const { audioPlayer, getPlaybackProgress, logger } = deps;

  /** En son işlenen bölüm — aynı bölüm için tekrar atlanmaz. */
  let handled: string | null = null;

  return audioPlayer.subscribe(state => {
    const episodeId = state.currentEpisodeId;
    if (!episodeId || episodeId === handled) {
      return;
    }
    handled = episodeId;

    void getPlaybackProgress
      .execute({ episodeId })
      .then(result => {
        if (!result.ok || !result.value) {
          return;
        }
        const { positionSec, completed } = result.value;
        // Tamamlanmış bölüm baştan başlar: "devam et" demek sona atlamak olmaz.
        if (completed || positionSec <= 0) {
          return;
        }
        // Arada kullanıcı başka bir bölüme geçtiyse artık geç kalmışızdır.
        if (handled !== episodeId) {
          return;
        }
        return audioPlayer.seekTo(positionSec);
      })
      .catch(error => {
        // Konum okunamazsa bölüm baştan çalar; oynatma engellenmemeli.
        logger.warn('Kaldığın yer geri yüklenemedi', error);
      });
  });
};
