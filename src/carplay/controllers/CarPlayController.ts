import { unwrap } from '@core/error';
import { Logger } from '@core/logger';
import { CarPlayDependencies } from '../CarPlayDependencies';

/**
 * CarPlayController — CarPlay yaşam döngüsünü ve şablonlarını yönetir.
 *
 * react-native-carplay bağlanınca (CarPlay.registerOnConnect), bu controller
 * kök liste şablonunu (şovlar) kurar; şova girince bölüm listesi, bölüme
 * dokununca oynatma + Now Playing şablonu gösterir.
 *
 * İş mantığı domain use case'lerinden gelir — mobil UI ile paylaşılır. Burada
 * yalnızca CarPlay'e özel şablon/etkileşim kodu olur.
 *
 * NOT: react-native-carplay henüz kurulmadığı için şablon çağrıları iskelet.
 * Paket + iOS native (CarPlay scene / entitlement) hazır olunca doldurulacak.
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
    // TODO: CarPlay.dismissTemplate vb. temizlik
  }

  /** Kök şablon: AA şovlarının listesi. */
  private async showRootTemplate(): Promise<void> {
    const shows = unwrap(await this.deps.getShowCatalog.execute());
    this.logger.debug(`CarPlay: ${shows.length} şov listelenecek`);
    // TODO: new ListTemplate({ title: 'Podcastler', sections: [...] })
    //       item seçilince this.showEpisodesTemplate(show.feedUrl)
  }

  /** Seçilen şovun bölüm listesi şablonu. */
  // private async showEpisodesTemplate(feedUrl: string): Promise<void> { ... }

  /** Now Playing şablonu (oynatma kontrolleri). */
  // private showNowPlayingTemplate(): void { ... }
}
