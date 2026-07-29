import { isOk } from '@core/error';
import { Logger } from '@core/logger';
import {
  DownloadItem,
  Episode,
  PlaybackProgress,
  Playlist,
  Show,
} from '@domain/entities';
import {
  CarPlay,
  ListTemplate,
  NowPlayingTemplate,
  TabBarTemplate,
} from 'react-native-carplay';
import { CarPlayDependencies } from '../CarPlayDependencies';
import { episodesToItems, playlistsToItems, resumeToItems } from '../templates/sections';

/**
 * Sürücü dikkatini dağıtmamak için liste uzunlukları sınırlıdır.
 * Apple da sürüş sırasında uzun listeleri kısıtlar; baştan sınırlamak
 * listelerin araçta kırpılmasından iyidir.
 */
const MAX_EPISODES = 50;
const MAX_RESUME = 12;

/** Now Playing'deki hız düğmesinin dolaştığı değerler. */
const SPEEDS = [1, 1.25, 1.5, 2];

/**
 * CarPlayController — CarPlay yaşam döngüsünü ve şablon akışını yönetir.
 *
 * KÖK: sekmeli düzen (TabBarTemplate)
 *   1. **Dinlemeye devam** — yarıda bırakılanlar; araçtaki en sık ihtiyaç,
 *      tek dokunuşla kaldığın yerden başlar,
 *   2. **İndirilenler** — çevrimdışı çalışır; araçta şebeke kopabilir,
 *   3. **Listelerim** — kullanıcı listeleri ve "Sonra dinle" → bölümler.
 *
 * Her sekme bir bölüme dokunulduğunda "kaldığın yerden" çalar ve Now Playing
 * şablonunu açar.
 *
 * İş mantığı tamamen domain use case'lerinden gelir ve mobil UI ile PAYLAŞILIR;
 * burada yalnızca CarPlay'e özgü şablon/etkileşim kodu vardır. Şablon
 * dönüşümleri (`sections`) saftır ve ayrı test edilir.
 */
export class CarPlayController {
  /** Sekme şablonları — veri değiştikçe yerinde güncellenir. */
  private resumeTemplate?: ListTemplate;
  private downloadsTemplate?: ListTemplate;
  private playlistsTemplate?: ListTemplate;

  /** Son bilinen kuyruk/oynatma durumu (şablon güncellemeleri için). */
  private currentEpisodeId: string | null = null;
  private unsubscribePlayback?: () => void;

  /** Sekmelerin gösterdiği veri — dokunulan öğeyi çözmek için saklanır. */
  private resumeItems: readonly PlaybackProgress[] = [];
  private downloadItems: readonly DownloadItem[] = [];
  private playlists: readonly Playlist[] = [];

  constructor(
    private readonly deps: CarPlayDependencies,
    private readonly logger: Logger,
  ) {}

  /** CarPlay bağlandığında çağrılır. */
  async onConnect(): Promise<void> {
    this.logger.info('CarPlay bağlandı');
    this.watchPlayback();
    await this.buildRoot();
  }

  /** CarPlay bağlantısı koptuğunda çağrılır. */
  onDisconnect(): void {
    this.logger.info('CarPlay bağlantısı koptu');
    this.unsubscribePlayback?.();
    this.unsubscribePlayback = undefined;
  }

  /**
   * Sesli komutla çalma (Siri / sesli arama).
   *
   * Native intent katmanı yalnızca metni iletir; ne çalınacağına domain karar
   * verir. Böylece aynı akış CarPlay, Siri ve derin bağlantılarda çalışır.
   */
  async playFromVoice(query: string): Promise<boolean> {
    const result = await this.deps.resolveVoiceQuery.execute({ query });
    if (!isOk(result) || !result.value) {
      this.logger.warn('Sesli sorgu eşleşmedi', query);
      return false;
    }
    await this.playEpisode(result.value.episode);
    return true;
  }

  // --- kök şablon ---------------------------------------------------------

  /** Sekmeli kök şablonu kurar ve içeriğini doldurur. */
  private async buildRoot(): Promise<void> {
    try {
      this.resumeTemplate = new ListTemplate({
        title: 'Devam et',
        tabTitle: 'Devam et',
        tabSystemImageName: 'play.circle',
        sections: [{ items: [] }],
        onItemSelect: async ({ index }) => this.onResumeSelect(index),
      });

      this.downloadsTemplate = new ListTemplate({
        title: 'İndirilenler',
        tabTitle: 'İndirilenler',
        tabSystemImageName: 'arrow.down.circle',
        sections: [{ items: [] }],
        onItemSelect: async ({ index }) => this.onDownloadSelect(index),
      });

      this.playlistsTemplate = new ListTemplate({
        title: 'Listelerim',
        tabTitle: 'Listelerim',
        tabSystemImageName: 'music.note.list',
        sections: [{ items: [] }],
        onItemSelect: async ({ index }) => this.onPlaylistSelect(index),
      });

      CarPlay.setRootTemplate(
        new TabBarTemplate({
          title: 'AA Podcast',
          templates: [this.resumeTemplate, this.downloadsTemplate, this.playlistsTemplate],
          onTemplateSelect: () => {
            // Sekmeye dönüldüğünde içerik tazelenir: başka bir cihazda ya da
            // telefonda yapılan değişiklikler araçta da görünsün.
            void this.refreshTabs();
          },
        }),
      );

      await this.refreshTabs();
    } catch (error) {
      this.logger.error('CarPlay kök şablon hatası', error);
    }
  }

  /** Üç sekmenin içeriğini paralel tazeler. */
  private async refreshTabs(): Promise<void> {
    await Promise.all([this.refreshResume(), this.refreshDownloads(), this.refreshPlaylists()]);
  }

  private async refreshResume(): Promise<void> {
    const result = await this.deps.getResumeList.execute();
    if (!isOk(result)) {
      this.logger.warn('CarPlay: devam listesi alınamadı', result.error);
      return;
    }
    // En son dinlenen en üstte; araçta aranan genellikle budur.
    this.resumeItems = [...result.value]
      .filter(p => p.audioUrl)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, MAX_RESUME);

    this.resumeTemplate?.updateSections([
      { items: resumeToItems(this.resumeItems, this.currentEpisodeId) },
    ]);
  }

  private async refreshDownloads(): Promise<void> {
    const result = await this.deps.getDownloads.execute();
    if (!isOk(result)) {
      this.logger.warn('CarPlay: indirilenler alınamadı', result.error);
      return;
    }
    this.downloadItems = result.value.filter(d => d.status === 'downloaded');
    this.downloadsTemplate?.updateSections([
      {
        items: episodesToItems(
          this.downloadItems.map(downloadToEpisode),
          this.currentEpisodeId,
        ),
      },
    ]);
  }

  private async refreshPlaylists(): Promise<void> {
    const result = await this.deps.getPlaylists.execute();
    if (!isOk(result)) {
      this.logger.warn('CarPlay: listeler alınamadı', result.error);
      return;
    }
    // Boş listeler araçta yer kaplamasın.
    this.playlists = result.value.filter(p => p.episodes.length > 0);
    this.playlistsTemplate?.updateSections([{ items: playlistsToItems(this.playlists) }]);
  }

  // --- seçim akışları -----------------------------------------------------

  private async onResumeSelect(index: number): Promise<void> {
    const progress = this.resumeItems[index];
    if (progress) {
      await this.playEpisode(progressToEpisode(progress));
    }
  }

  private async onDownloadSelect(index: number): Promise<void> {
    const item = this.downloadItems[index];
    if (item) {
      await this.playEpisode(downloadToEpisode(item), this.downloadItems.map(downloadToEpisode), index);
    }
  }

  /** Listeye dokunma → o listenin bölümleri. */
  private async onPlaylistSelect(index: number): Promise<void> {
    const playlist = this.playlists[index];
    if (!playlist) {
      return;
    }
    const episodes = playlist.episodes;
    CarPlay.pushTemplate(
      new ListTemplate({
        title: playlist.name,
        sections: [{ items: episodesToItems(episodes, this.currentEpisodeId) }],
        onItemSelect: async ({ index: i }) => {
          const episode = episodes[i];
          if (episode) {
            await this.playEpisode(episode, episodes, i);
          }
        },
      }),
    );
  }

  /** Şov listesi → bölümler (sesli komut ve derin bağlantılar için korunur). */
  async openShow(show: Show): Promise<void> {
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
          sections: [{ items: episodesToItems(episodes, this.currentEpisodeId) }],
          onItemSelect: async ({ index }) => {
            const episode = episodes[index];
            if (episode) {
              await this.playEpisode(episode, episodes, index);
            }
          },
        }),
      );
    } catch (error) {
      this.logger.error('CarPlay şov şablonu hatası', error);
    }
  }

  // --- oynatma ------------------------------------------------------------

  /**
   * Bölümü kaldığı yerden çalar ve Now Playing şablonunu gösterir.
   * `context` verilirse ileri/geri o kuyruk üzerinde çalışır.
   */
  private async playEpisode(
    episode: Episode,
    queue?: readonly Episode[],
    index?: number,
  ): Promise<void> {
    const result = await this.deps.continueEpisode.execute({ episode });
    if (!isOk(result)) {
      this.logger.error('CarPlay: oynatma başlatılamadı', result.error);
      return;
    }
    this.currentEpisodeId = episode.id;
    this.showNowPlaying(episode, queue, index);
  }

  /** Now Playing şablonu — kuyruk, hız ve kaydetme düğmeleriyle. */
  private showNowPlaying(
    episode: Episode,
    queue?: readonly Episode[],
    index?: number,
  ): void {
    CarPlay.enableNowPlaying(true);

    CarPlay.pushTemplate(
      new NowPlayingTemplate({
        // "Sıradakiler" — kuyruğu liste olarak açar.
        upNextButtonEnabled: !!queue && queue.length > 1,
        upNextButtonTitle: 'Sıradakiler',
        onUpNextButtonPressed: () => this.showQueue(queue ?? [], index ?? 0),
        // Şov adına dokunmak o şovun bölümlerine götürür.
        albumArtistButtonEnabled: false,
        buttons: [
          // Oynatma hızı — sistem hız düğmesi.
          { id: 'rate', type: 'playback' },
          // Çalan bölümü "Sonra dinle" listesine ekler.
          { id: 'save', type: 'add-to-library' },
        ],
        onButtonPressed: ({ id }) => {
          if (id === 'rate') {
            void this.cycleSpeed();
          } else if (id === 'save') {
            void this.deps.toggleSavedEpisode.execute({ episode });
          }
        },
      }),
    );
  }

  /** Kuyruğu liste olarak gösterir; dokunulan bölüme atlar. */
  private showQueue(queue: readonly Episode[], currentIndex: number): void {
    // Çalan bölüm ve sonrası — geçmiş araçta işe yaramaz.
    const upcoming = queue.slice(currentIndex);
    CarPlay.pushTemplate(
      new ListTemplate({
        title: 'Sıradakiler',
        sections: [{ items: episodesToItems(upcoming, this.currentEpisodeId) }],
        onItemSelect: async ({ index }) => {
          const episode = upcoming[index];
          if (episode) {
            await this.playEpisode(episode, queue, currentIndex + index);
          }
        },
      }),
    );
  }

  /** Hız düğmesi — sabit değerler arasında dolaşır. */
  private async cycleSpeed(): Promise<void> {
    const state = await this.deps.audioPlayer.getState();
    const next = SPEEDS[(SPEEDS.indexOf(state.rate) + 1) % SPEEDS.length];
    await this.deps.setPlaybackRate.execute({ rate: next });
  }

  /**
   * Oynatma durumunu izler: çalan bölüm değişince listelerdeki "çalıyor"
   * işareti güncellenir. Böylece araçta hangi bölümde olunduğu görülür.
   */
  private watchPlayback(): void {
    this.unsubscribePlayback = this.deps.audioPlayer.subscribe(state => {
      if (state.currentEpisodeId === this.currentEpisodeId) {
        return;
      }
      this.currentEpisodeId = state.currentEpisodeId;
      // Yalnızca işaretler değişti; ağa çıkmadan mevcut veriyle yeniden çiz.
      this.resumeTemplate?.updateSections([
        { items: resumeToItems(this.resumeItems, this.currentEpisodeId) },
      ]);
      this.downloadsTemplate?.updateSections([
        {
          items: episodesToItems(
            this.downloadItems.map(downloadToEpisode),
            this.currentEpisodeId,
          ),
        },
      ]);
    });
  }
}

/** İndirme kaydından çalınabilir bölüm (yerel dosya PlayEpisode'da çözülür). */
const downloadToEpisode = (d: DownloadItem): Episode => ({
  id: d.episodeId,
  showId: d.showId ?? '',
  title: d.episodeTitle ?? 'Bölüm',
  description: '',
  audioUrl: d.audioUrl ?? '',
  durationSec: d.durationSec ?? 0,
  publishedAt: d.publishedAt ?? '',
  imageUrl: d.artworkUrl,
});

/** "Kaldığın yer" kaydından çalınabilir bölüm. */
const progressToEpisode = (p: PlaybackProgress): Episode => ({
  id: p.episodeId,
  showId: p.showId ?? '',
  title: p.episodeTitle ?? 'Bölüm',
  description: '',
  audioUrl: p.audioUrl ?? '',
  durationSec: p.durationSec,
  publishedAt: '',
  imageUrl: p.artworkUrl,
});
