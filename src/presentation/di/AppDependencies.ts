import { AudioPlayerService } from '@domain/services';
import { GetPodcastFeed, GetShowCatalog, PlayEpisode } from '@domain/usecases';

/**
 * AppDependencies — UI'ın ihtiyaç duyduğu use case ve servislerin sözleşmesi.
 *
 * presentation, hangi somut sınıfların kullanıldığını BİLMEZ; yalnızca bu şekle
 * ihtiyaç duyar. Somut örnekler `app/di` içinde oluşturulup DependencyProvider
 * ile sağlanır (Dependency Inversion).
 *
 * Yeni bir ekran yeni bir use case gerektirdiğinde: use case'i buraya ekle,
 * app/di'da örneğini ver, `useDependencies()` ile ekranında kullan.
 */
export interface AppDependencies {
  readonly getShowCatalog: GetShowCatalog;
  readonly getPodcastFeed: GetPodcastFeed;
  readonly playEpisode: PlayEpisode;
  readonly audioPlayer: AudioPlayerService;
}
