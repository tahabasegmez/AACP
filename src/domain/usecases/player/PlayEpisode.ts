import { Result } from '@core/error';
import { Episode, isPlayableOffline } from '../../entities';
import { DownloadRepository } from '../../repositories';
import { AudioPlayerService } from '../../services';
import { UseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

export interface PlayEpisodeParams {
  readonly episode: Episode;
  /**
   * Verilirse kuyruk bu bölümlerle KURULUR (şov/liste bağlamı). Verilmezse
   * oynatıcıdaki mevcut kuyruk korunur ve yalnızca `index`e atlanır.
   */
  readonly queue?: readonly Episode[];
  /** Kuyruktaki başlangıç konumu (varsayılan: başı). */
  readonly index?: number;
  /** Verilirse oynatma bu saniyeden başlar (kaldığı yerden devam için). */
  readonly startPositionSec?: number;
}

/**
 * PlayEpisode — bir bölümü çalmaya başlar (opsiyonel olarak belirli bir konumdan).
 *
 * Oynatma kütüphanesini (track-player) doğrudan çağırmak yerine bu use case
 * kullanılır; böylece hem mobil UI hem CarPlay aynı giriş noktasını paylaşır.
 *
 * OFFLINE: DownloadRepository verilmişse ve bölüm indirilmişse, ağ URL'i yerine
 * YEREL dosya çalınır (çevrimdışı dinleme). Domain, kaynağın yerel mi uzak mı
 * olduğuna burada karar verir; oynatıcı yalnızca bir URL görür.
 */
export class PlayEpisode implements UseCase<PlayEpisodeParams, void> {
  constructor(
    private readonly player: AudioPlayerService,
    private readonly downloads?: DownloadRepository,
  ) {}

  execute(params: PlayEpisodeParams): Promise<Result<void>> {
    return runPlayback(async () => {
      const start = params.startPositionSec ?? 0;

      // Kuyruk verilmediyse sıra oynatıcıda zaten kuruludur; yalnızca konuma
      // atlanır. Yeniden kurmak, kullanıcının sıraya eklediklerini silerdi.
      if (!params.queue) {
        await this.player.skipTo(params.index ?? 0, start);
        return;
      }

      // Çevrimdışı kaynak kuyruğun TAMAMI için çözülür: sıra oynatıcıya
      // toptan verildiği için her bölümün adresi girerken belli olmalı.
      const episodes = await Promise.all(
        params.queue.map(episode => this.resolveSource(episode)),
      );
      await this.player.setQueue(episodes, params.index ?? 0, start);
    });
  }

  /**
   * İndirilmişse audioUrl'i yerel dosyaya çevirir; değilse olduğu gibi döner.
   *
   * Repository yalnızca dosyası GERÇEKTEN var olan kayıtlara `localPath` verir
   * (kaybolan dosyaların kaydı temizlenir), bu yüzden burada ek kontrol gerekmez
   * ve silinmiş/taşınmış bir indirme sessizce uzak adrese düşer.
   *
   * Bölümün kendi `audioUrl`'i boşsa (ör. "İndirilenler"den üretilmiş bir kayıt)
   * indirme kaydında saklanan uzak adres kullanılır.
   */
  private async resolveSource(episode: Episode): Promise<Episode> {
    if (!this.downloads) {
      return episode;
    }
    const result = await this.downloads.get(episode.id);
    if (!result.ok || !result.value) {
      return episode;
    }

    const item = result.value;
    if (isPlayableOffline(item) && item.localPath) {
      const path = item.localPath;
      const url = path.startsWith('file://') ? path : `file://${path}`;
      return { ...episode, audioUrl: url };
    }

    // İndirme yok/geçersiz: bölümün adresi boşsa kayıttaki uzak adrese düş.
    return episode.audioUrl ? episode : { ...episode, audioUrl: item.audioUrl ?? '' };
  }
}
