import { isOk } from '@core/error';
import { Logger } from '@core/logger';
import { Episode, Show } from '@domain/entities';
import { CarPlay, ListTemplate, NowPlayingTemplate } from 'react-native-carplay';
import { CarPlayDependencies } from '../CarPlayDependencies';
import { episodesToItems, showsToItems } from '../templates/sections';

/** Sürücü güvenliği için CarPlay'de gösterilecek maksimum bölüm sayısı. */
const MAX_EPISODES = 50;

/**
 * CarPlayController — CarPlay yaşam döngüsünü ve şablon akışını yönetir.
 *
 * Akış: Şovlar (kök liste) → seçilen şovun bölümleri (liste) → bölüm seçilince
 * "kaldığın yerden" çal + Now Playing şablonu. İş mantığı tamamen domain use
 * case'lerinden gelir; mobil UI ile paylaşılır. Burada yalnızca CarPlay'e özel
 * şablon/etkileşim kodu vardır. Şablon dönüşümleri (sections) saf ve ayrı test edilir.
 */
export class CarPlayController {
  constructor(
    private readonly deps: CarPlayDependencies,
    private readonly logger: Logger,
  ) {}

  /** CarPlay bağlandığında çağrılır. */
  async onConnect(): Promise<void> {
    this.logger.info('CarPlay bağlandı');
    await this.showRootTemplate();
  }

  /** CarPlay bağlantısı koptuğunda çağrılır. */
  onDisconnect(): void {
    this.logger.info('CarPlay bağlantısı koptu');
  }

  /** Kök şablon: AA şovlarının listesi. */
  private async showRootTemplate(): Promise<void> {
    try {
      const result = await this.deps.getShowCatalog.execute();
      if (!isOk(result)) {
        this.logger.error('CarPlay: şovlar alınamadı', result.error);
        return;
      }
      const shows = result.value;
      CarPlay.setRootTemplate(
        new ListTemplate({
          title: 'Podcastler',
          sections: [{ items: showsToItems(shows) }],
          onItemSelect: async ({ index }) => {
            const show = shows[index];
            if (show) {
              await this.openShow(show);
            }
          },
        }),
      );
    } catch (error) {
      this.logger.error('CarPlay kök şablon hatası', error);
    }
  }

  /** Seçilen şovun bölüm listesi şablonu. */
  private async openShow(show: Show): Promise<void> {
    try {
      const result = await this.deps.getShowEpisodes.execute({
        feedUrl: show.feedUrl,
        limit: MAX_EPISODES,
      });
      if (!isOk(result)) {
        this.logger.error('CarPlay: bölümler alınamadı', result.error);
        return;
      }
      const episodes = result.value.episodes.items;
      CarPlay.pushTemplate(
        new ListTemplate({
          title: show.title,
          sections: [{ items: episodesToItems(episodes) }],
          onItemSelect: async ({ index }) => {
            const episode = episodes[index];
            if (episode) {
              await this.playSelected(episode);
            }
          },
        }),
      );
    } catch (error) {
      this.logger.error('CarPlay şov şablonu hatası', error);
    }
  }

  /** Bölümü kaldığı yerden çalar ve Now Playing şablonunu gösterir. */
  private async playSelected(episode: Episode): Promise<void> {
    const result = await this.deps.continueEpisode.execute({ episode });
    if (!isOk(result)) {
      this.logger.error('CarPlay: oynatma başlatılamadı', result.error);
      return;
    }
    CarPlay.enableNowPlaying(true);
    CarPlay.pushTemplate(new NowPlayingTemplate({}));
  }
}
