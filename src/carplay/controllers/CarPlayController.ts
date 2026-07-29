import { isOk } from '@core/error';
import { Logger } from '@core/logger';
import {
  DownloadItem,
  Episode,
  PlaybackProgress,
  Playlist,
  SAVED_PLAYLIST_ID,
  Show,
} from '@domain/entities';
import {
  CarPlay,
  ListTemplate,
  NowPlayingTemplate,
  TabBarTemplate,
} from 'react-native-carplay';
import { CarPlayDependencies } from '../CarPlayDependencies';
import {
  CarPlayList,
  CarPlayRowAction,
  buildList,
  episodesToItems,
  playlistsToItems,
  resumeToItems,
  showsToItems,
} from '../templates/sections';

/**
 * Sürücü dikkatini dağıtmamak için liste uzunlukları sınırlıdır.
 * Apple da sürüş sırasında uzun listeleri kısıtlar; baştan sınırlamak
 * listelerin araçta kırpılmasından iyidir.
 */
const MAX_EPISODES = 50;
/** Ana sayfadaki her bölümün satır sınırı (Spotify de kısa raflar gösterir). */
const MAX_SHELF = 8;

/** Now Playing'deki hız düğmesinin dolaştığı değerler. */
const SPEEDS = [1, 1.25, 1.5, 2];

/**
 * Sekme listesi — şablonu ve o an gösterdiği satır davranışlarını BİRLİKTE tutar.
 *
 * İçerik tazelendiğinde bölümler ve davranışlar aynı anda değişmek zorunda;
 * ikisini ayrı alanlarda tutmak index kaymasına açıktır.
 */
class TabList {
  readonly template: ListTemplate;
  private actions: readonly CarPlayRowAction[] = [];

  constructor(config: {
    title: string;
    systemImage: string;
    emptyTitle: string;
    emptySubtitle: string;
  }) {
    this.template = new ListTemplate({
      title: config.title,
      tabTitle: config.title,
      tabSystemImageName: config.systemImage,
      // Boş sekmede kullanıcıya ne yapacağını söyler (Apple'ın boş görünümü).
      emptyViewTitleVariants: [config.emptyTitle],
      emptyViewSubtitleVariants: [config.emptySubtitle],
      sections: [],
      onItemSelect: async ({ index }) => {
        await this.actions[index]?.();
      },
    });
  }

  update(list: CarPlayList): void {
    this.actions = list.actions;
    this.template.updateSections(list.sections);
  }
}

/**
 * CarPlayController — CarPlay yaşam döngüsünü ve şablon akışını yönetir.
 *
 * Düzen Spotify'ın CarPlay arayüzünü izler: üç sekme, başlıklı raflar ve her
 * satırda kapak görseli.
 *
 *   1. **Ana Sayfa** — "Dinlemeye devam" ve "Sonra dinle" rafları; araçta en
 *      sık ihtiyaç duyulan tek dokunuşluk giriş noktası,
 *   2. **Kitaplığın** — listeler ve podcast'ler; alt seviyeye iner,
 *   3. **İndirilenler** — çevrimdışı çalışır; araçta şebeke kopabilir.
 *
 * İş mantığı tamamen domain use case'lerinden gelir ve mobil UI ile PAYLAŞILIR;
 * burada yalnızca CarPlay'e özgü şablon/etkileşim kodu vardır. Şablon
 * dönüşümleri (`sections`) saftır ve ayrı test edilir.
 */
export class CarPlayController {
  private home?: TabList;
  private library?: TabList;
  private downloads?: TabList;

  /** Katalog — Kitaplığın sekmesi ve Now Playing'deki şov düğmesi için. */
  private shows: readonly Show[] = [];

  private currentEpisodeId: string | null = null;
  private unsubscribePlayback?: () => void;

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
      this.home = new TabList({
        title: 'Ana Sayfa',
        systemImage: 'house.fill',
        emptyTitle: 'Henüz bir şey dinlemedin',
        emptySubtitle: 'Telefonda bir bölüm başlat, buradan devam et',
      });

      this.library = new TabList({
        title: 'Kitaplığın',
        systemImage: 'books.vertical.fill',
        emptyTitle: 'Kitaplığın boş',
        emptySubtitle: 'Telefonda liste oluştur ya da podcast takip et',
      });

      this.downloads = new TabList({
        title: 'İndirilenler',
        systemImage: 'arrow.down.circle.fill',
        emptyTitle: 'İndirilen bölüm yok',
        emptySubtitle: 'Telefonda indir, şebeke olmadan dinle',
      });

      CarPlay.setRootTemplate(
        new TabBarTemplate({
          templates: [this.home.template, this.library.template, this.downloads.template],
          onTemplateSelect: () => {
            // Sekmeye dönüldüğünde içerik tazelenir: telefonda ya da başka bir
            // cihazda yapılan değişiklikler araçta da görünsün.
            void this.refreshAll();
          },
        }),
      );

      await this.loadCatalog();
      await this.refreshAll();
    } catch (error) {
      this.logger.error('CarPlay kök şablon hatası', error);
    }
  }

  /** Katalog sürüş boyunca değişmez; bir kez yüklenir. */
  private async loadCatalog(): Promise<void> {
    const result = await this.deps.getShowCatalog.execute();
    if (isOk(result)) {
      this.shows = result.value;
    } else {
      this.logger.warn('CarPlay: katalog alınamadı', result.error);
    }
  }

  /**
   * Üç sekmeyi tazeler. Kaynaklar tek seferde okunur; listeler hem Ana Sayfa
   * hem Kitaplığın sekmesinde kullanıldığı için iki kez sorgulanmaz.
   */
  private async refreshAll(): Promise<void> {
    const [resume, playlists, downloads] = await Promise.all([
      this.deps.getResumeList.execute(),
      this.deps.getPlaylists.execute(),
      this.deps.getDownloads.execute(),
    ]);

    const resumeItems = isOk(resume)
      ? [...resume.value]
          .filter(progress => progress.audioUrl)
          // En son dinlenen en üstte; araçta aranan genellikle budur.
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
          .slice(0, MAX_SHELF)
      : [];

    const allPlaylists = isOk(playlists) ? playlists.value : [];
    const downloaded = isOk(downloads)
      ? downloads.value.filter(item => item.status === 'downloaded')
      : [];

    this.home?.update(this.homeList(resumeItems, allPlaylists));
    this.library?.update(this.libraryList(allPlaylists));
    this.downloads?.update(this.downloadsList(downloaded));
  }

  /** Ana Sayfa: "Dinlemeye devam" ve "Sonra dinle" rafları. */
  private homeList(
    resumeItems: readonly PlaybackProgress[],
    playlists: readonly Playlist[],
  ): CarPlayList {
    const saved = playlists.find(playlist => playlist.id === SAVED_PLAYLIST_ID);
    const savedEpisodes = (saved?.episodes ?? []).slice(0, MAX_SHELF);

    return buildList([
      {
        header: 'Dinlemeye devam',
        items: resumeToItems(resumeItems, this.currentEpisodeId),
        actions: resumeItems.map(
          progress => () => this.playEpisode(progressToEpisode(progress)),
        ),
      },
      {
        header: 'Sonra dinle',
        items: episodesToItems(savedEpisodes, this.currentEpisodeId),
        actions: savedEpisodes.map(
          (episode, index) => () => this.playEpisode(episode, savedEpisodes, index),
        ),
      },
    ]);
  }

  /** Kitaplığın: listeler ve podcast'ler — ikisi de alt seviyeye iner. */
  private libraryList(playlists: readonly Playlist[]): CarPlayList {
    // Boş listeler araçta yer kaplamasın.
    const filled = playlists.filter(playlist => playlist.episodes.length > 0);

    return buildList([
      {
        header: 'Listelerim',
        items: playlistsToItems(filled),
        actions: filled.map(
          playlist => () => this.pushEpisodes(playlist.name, playlist.episodes),
        ),
      },
      {
        header: "Podcast'ler",
        items: showsToItems(this.shows),
        actions: this.shows.map(show => () => this.openShow(show)),
      },
    ]);
  }

  /** İndirilenler: çevrimdışı çalınabilir bölümler. */
  private downloadsList(items: readonly DownloadItem[]): CarPlayList {
    const episodes = items.map(downloadToEpisode);
    return buildList([
      {
        header: 'Çevrimdışı dinle',
        items: episodesToItems(episodes, this.currentEpisodeId),
        actions: episodes.map(
          (episode, index) => () => this.playEpisode(episode, episodes, index),
        ),
      },
    ]);
  }

  // --- alt seviye listeler -------------------------------------------------

  /** Bölüm listesi açar (liste, şov ya da kuyruk içeriği). */
  private pushEpisodes(title: string, episodes: readonly Episode[]): void {
    const list = buildList([
      {
        items: episodesToItems(episodes, this.currentEpisodeId),
        actions: episodes.map(
          (episode, index) => () => this.playEpisode(episode, episodes, index),
        ),
      },
    ]);

    CarPlay.pushTemplate(
      new ListTemplate({
        title,
        sections: list.sections,
        onItemSelect: async ({ index }) => {
          await list.actions[index]?.();
        },
      }),
    );
  }

  /** Şov listesi → bölümler (Kitaplığın, Now Playing ve sesli komut için). */
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
      this.pushEpisodes(show.title, result.value.episodes.items);
    } catch (error) {
      this.logger.error('CarPlay şov şablonu hatası', error);
    }
  }

  // --- oynatma ------------------------------------------------------------

  /**
   * Bölümü kaldığı yerden çalar ve Now Playing şablonunu gösterir.
   * `queue` verilirse "Sıradakiler" o kuyruk üzerinden çalışır.
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

  /** Now Playing şablonu — kuyruk, şov, hız ve kaydetme düğmeleriyle. */
  private showNowPlaying(
    episode: Episode,
    queue?: readonly Episode[],
    index?: number,
  ): void {
    CarPlay.enableNowPlaying(true);

    const show = this.shows.find(candidate => candidate.id === episode.showId);

    CarPlay.pushTemplate(
      new NowPlayingTemplate({
        // "Sıradakiler" — kuyruğu liste olarak açar.
        upNextButtonEnabled: !!queue && queue.length > 1,
        upNextButtonTitle: 'Sıradakiler',
        onUpNextButtonPressed: () =>
          this.pushEpisodes('Sıradakiler', (queue ?? []).slice(index ?? 0)),
        // Şov adına dokunmak o şovun bölümlerine götürür (Spotify davranışı).
        albumArtistButtonEnabled: !!show,
        onAlbumArtistButtonPressed: () => {
          if (show) {
            void this.openShow(show);
          }
        },
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

  /** Hız düğmesi — sabit değerler arasında dolaşır. */
  private async cycleSpeed(): Promise<void> {
    const state = await this.deps.audioPlayer.getState();
    const next = SPEEDS[(SPEEDS.indexOf(state.rate) + 1) % SPEEDS.length];
    await this.deps.setPlaybackRate.execute({ rate: next });
  }

  /**
   * Oynatma durumunu izler: çalan bölüm değişince sekmeler tazelenir. Böylece
   * hem "çalıyor" işareti hem de "Dinlemeye devam" rafı güncel kalır.
   */
  private watchPlayback(): void {
    this.unsubscribePlayback = this.deps.audioPlayer.subscribe(state => {
      if (state.currentEpisodeId === this.currentEpisodeId) {
        return;
      }
      this.currentEpisodeId = state.currentEpisodeId;
      void this.refreshAll();
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
