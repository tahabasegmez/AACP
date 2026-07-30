import { Result, isOk } from '@core/error';
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
  CarPlaySection,
  buildList,
  episodesToItems,
  playlistsToItems,
  resumeToItems,
  showsToItems,
  withoutImages,
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

  constructor(
    private readonly title: string,
    config: {
      systemImage: string;
      emptyTitle: string;
      emptySubtitle: string;
    },
    private readonly logger: Logger,
  ) {
    this.template = new ListTemplate({
      title,
      tabTitle: title,
      tabSystemImageName: config.systemImage,
      // Boş sekmede kullanıcıya ne yapacağını söyler (Apple'ın boş görünümü).
      emptyViewTitleVariants: [config.emptyTitle],
      emptyViewSubtitleVariants: [config.emptySubtitle],
      sections: [],
      onItemSelect: async ({ index }) => {
        try {
          await this.actions[index]?.();
        } catch (error) {
          // CarPlay geri çağrısından fırlayan hata "unhandled rejection" olur.
          this.logger.error(`CarPlay: "${title}" satırı açılamadı`, error);
        }
      },
    });
  }

  update(list: CarPlayList): void {
    this.actions = list.actions;
    try {
      this.template.updateSections(list.sections);
    } catch (error) {
      // Kapak çözümlemesi patlarsa sekmeyi boş bırakma: kapaksız da olsa
      // içerik göster (bkz. docs/CARPLAY.md — "object is not a function").
      this.logger.error(`CarPlay: "${this.title}" kapakları çizilemedi`, error);
      this.template.updateSections(withoutImages(list.sections));
    }
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

  /**
   * Paylaşılan Now Playing şablonu — CarPlay'de tek bir örnek vardır, biz de
   * tek örnek tutarız (bkz. `showNowPlaying`).
   */
  private nowPlayingTemplate?: NowPlayingTemplate;

  /** Katalog — Kitaplığın sekmesi ve Now Playing'deki şov düğmesi için. */
  private shows: readonly Show[] = [];

  private currentEpisodeId: string | null = null;
  private unsubscribePlayback?: () => void;

  /** Süren tazeleme; aynı anda ikinci bir tur başlatılmaz. */
  private refreshing?: Promise<void>;
  /** Tazeleme sürerken yeni istek geldi mi? (tur sonunda bir kez tekrarlanır) */
  private refreshQueued = false;

  constructor(
    private readonly deps: CarPlayDependencies,
    private readonly logger: Logger,
  ) {}

  /** CarPlay bağlandığında çağrılır. */
  async onConnect(): Promise<void> {
    this.logger.info('CarPlay bağlandı');
    // Sistem oynatma ekranını bir kez etkinleştir: her çalışta çağırmak
    // gözlemciyi tekrar tekrar bağlamaya çalışmak olurdu.
    CarPlay.enableNowPlaying(true);
    this.watchPlayback();
    await this.buildRoot();
  }

  /** CarPlay bağlantısı koptuğunda çağrılır. */
  onDisconnect(): void {
    this.logger.info('CarPlay bağlantısı koptu');
    this.unsubscribePlayback?.();
    this.unsubscribePlayback = undefined;
    CarPlay.enableNowPlaying(false);
    // Şablonlar araçla birlikte gider; yeniden bağlanınca kök baştan kurulur.
    this.nowPlayingTemplate = undefined;
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
      this.home = new TabList(
        'Ana Sayfa',
        {
          systemImage: 'house.fill',
          emptyTitle: 'Henüz bir şey dinlemedin',
          emptySubtitle: 'Telefonda bir bölüm başlat, buradan devam et',
        },
        this.logger,
      );

      this.library = new TabList(
        'Kitaplığın',
        {
          systemImage: 'books.vertical.fill',
          emptyTitle: 'Kitaplığın boş',
          emptySubtitle: 'Telefonda liste oluştur ya da podcast takip et',
        },
        this.logger,
      );

      this.downloads = new TabList(
        'İndirilenler',
        {
          systemImage: 'arrow.down.circle.fill',
          emptyTitle: 'İndirilen bölüm yok',
          emptySubtitle: 'Telefonda indir, şebeke olmadan dinle',
        },
        this.logger,
      );

      CarPlay.setRootTemplate(
        new TabBarTemplate({
          templates: [this.home.template, this.library.template, this.downloads.template],
          onTemplateSelect: () => {
            // Sekmeye dönüldüğünde içerik tazelenir: telefonda ya da başka bir
            // cihazda yapılan değişiklikler araçta da görünsün.
            this.refresh();
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
    this.shows = (await this.read('katalog', () => this.deps.getShowCatalog.execute())) ?? [];
  }

  /**
   * Tazelemeyi ateşle-unut olarak başlatır.
   *
   * Sekme değiştirme, oynatma değişimi ve kaydetme aynı anda tazeleme
   * isteyebilir. Turlar BİRLEŞTİRİLİR: süren bir tur varsa yenisi başlatılmaz,
   * yalnızca "bitince bir kez daha" işaretlenir. Aksi halde araçta her dokunuşta
   * üst üste depolama/ağ turları birikirdi.
   *
   * CarPlay geri çağrıları senkrondur; buradan sızan bir promise hatası
   * "unhandled rejection" olur — bu yüzden hata her zaman loglanır.
   */
  private refresh(): void {
    if (this.refreshing) {
      this.refreshQueued = true;
      return;
    }

    this.refreshing = this.refreshAll()
      .catch(error => {
        this.logger.error('CarPlay: içerik tazelenemedi', error);
      })
      .finally(() => {
        this.refreshing = undefined;
        if (this.refreshQueued) {
          this.refreshQueued = false;
          this.refresh();
        }
      });
  }

  /**
   * Ateşle-unut bir işi loglayarak çalıştırır.
   *
   * CarPlay düğme geri çağrıları senkron olduğu için promise'i bekleyemezler;
   * hatanın kaybolmaması adına tek yerden geçirilir.
   */
  private run(label: string, work: () => Promise<void>): void {
    work().catch(error => {
      this.logger.error(`CarPlay: ${label}`, error);
    });
  }

  /**
   * Üç sekmeyi tazeler. Kaynaklar tek seferde okunur; listeler hem Ana Sayfa
   * hem Kitaplığın sekmesinde kullanıldığı için iki kez sorgulanmaz.
   *
   * Kaynaklar birbirinden BAĞIMSIZ ele alınır: biri hata verirse (ör. bozuk
   * kayıt, kapalı depolama) diğer sekmeler yine dolar.
   */
  private async refreshAll(): Promise<void> {
    const [resume, playlists, downloads] = await Promise.all([
      this.read('devam listesi', () => this.deps.getResumeList.execute()),
      this.read('listeler', () => this.deps.getPlaylists.execute()),
      this.read('indirilenler', () => this.deps.getDownloads.execute()),
    ]);

    const resumeItems = [...(resume ?? [])]
      .filter(progress => progress.audioUrl)
      // En son dinlenen en üstte; araçta aranan genellikle budur.
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, MAX_SHELF);

    const allPlaylists = playlists ?? [];
    const downloaded = (downloads ?? []).filter(item => item.status === 'downloaded');

    this.home?.update(this.homeList(resumeItems, allPlaylists));
    this.library?.update(this.libraryList(allPlaylists));
    this.downloads?.update(this.downloadsList(downloaded));
  }

  /**
   * Bir kaynağı okur; hata Result'ı ya da fırlatılan hatayı loglayıp `null`
   * döner. Böylece tek bir kaynağın çökmesi tüm arayüzü boşaltmaz ve sebep
   * konsolda görünür.
   */
  private async read<T>(label: string, load: () => Promise<Result<T>>): Promise<T | null> {
    try {
      const result = await load();
      if (isOk(result)) {
        return result.value;
      }
      this.logger.warn(`CarPlay: ${label} alınamadı`, result.error);
    } catch (error) {
      this.logger.error(`CarPlay: ${label} okunurken hata`, error);
    }
    return null;
  }

  /** Ana Sayfa: "Dinlemeye devam" ve "Sonra dinle" rafları. */
  private homeList(
    resumeItems: readonly PlaybackProgress[],
    playlists: readonly Playlist[],
  ): CarPlayList {
    const saved = playlists.find(playlist => playlist.id === SAVED_PLAYLIST_ID);
    const savedEpisodes = (saved?.episodes ?? []).slice(0, MAX_SHELF);

    // Devam rafındaki bölüm "Sonra dinle"de de olabilir; aynı ekranda iki kez
    // görünmesin — üstteki raf kazanır.
    const resumeIds = new Set(resumeItems.map(progress => progress.episodeId));
    const savedOnly = savedEpisodes.filter(episode => !resumeIds.has(episode.id));

    // Devam rafından çalınca kuyruk = rafın kendisi; böylece "Sıradakiler" ve
    // direksiyon tuşları boş kalmaz.
    const resumeEpisodes = resumeItems.map(progressToEpisode);

    return buildList([
      {
        header: 'Dinlemeye devam',
        items: resumeToItems(resumeItems, this.currentEpisodeId),
        actions: resumeEpisodes.map(
          (episode, index) => () => this.playEpisode(episode, resumeEpisodes, index),
        ),
      },
      {
        header: 'Sonra dinle',
        items: episodesToItems(savedOnly, this.currentEpisodeId),
        actions: savedOnly.map(
          (episode, index) => () => this.playEpisode(episode, savedOnly, index),
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

    const open = (sections: CarPlaySection[]): void => {
      CarPlay.pushTemplate(
        new ListTemplate({
          title,
          sections,
          onItemSelect: async ({ index }) => {
            try {
              await list.actions[index]?.();
            } catch (error) {
              this.logger.error(`CarPlay: "${title}" satırı açılamadı`, error);
            }
          },
        }),
      );
    };

    try {
      open(list.sections);
    } catch (error) {
      // Sekmelerdeki ile aynı yedek: kapaksız da olsa listeyi göster.
      this.logger.error(`CarPlay: "${title}" kapakları çizilemedi`, error);
      open(withoutImages(list.sections));
    }
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
   * Bölümü kaldığı yerden çalar, kuyruğu kurar ve Now Playing'i gösterir.
   *
   * Kuyruk her zaman verilir: dokunulan listenin kendisi bağlam olur. Böylece
   * direksiyon tuşları, kilit ekranı ve "Sıradakiler" aynı sırayı görür.
   */
  private async playEpisode(
    episode: Episode,
    queue: readonly Episode[] = [episode],
    index = 0,
  ): Promise<void> {
    // Kuyruk oynatmadan ÖNCE kurulur: oynatma başlar başlamaz gelen
    // "sonraki bölüm" komutu doğru sırayı bulsun.
    this.deps.playbackQueue.setQueue(queue, index);

    const result = await this.deps.continueEpisode.execute({ episode });
    if (!isOk(result)) {
      this.logger.error('CarPlay: oynatma başlatılamadı', result.error);
      return;
    }
    this.currentEpisodeId = episode.id;
    this.showNowPlaying();
  }

  /**
   * Now Playing ekranını gösterir.
   *
   * CarPlay'in Now Playing şablonu bir SİNGLETON'dır (`CPNowPlayingTemplate`
   * paylaşılan örnek). Bu yüzden:
   *
   *  - şablon bir kez kurulur (`nowPlaying`), her çalışta yeniden yaratılmaz —
   *    aksi halde her oynatmada bir olay dinleyicisi daha eklenirdi,
   *  - yığına aynı örneği İKİ KEZ eklemek iOS'ta istisna fırlatır ve uygulamayı
   *    ÇÖKERTİR; bu yüzden önce köke dönülür, sonra eklenir. Böylece Now Playing
   *    her zaman kökün bir üstündedir ve durum takibi gerekmez.
   */
  private showNowPlaying(): void {
    CarPlay.popToRootTemplate();
    CarPlay.pushTemplate(this.nowPlaying());
  }

  /** Paylaşılan Now Playing şablonunu kurar (bir kez). */
  private nowPlaying(): NowPlayingTemplate {
    if (this.nowPlayingTemplate) {
      return this.nowPlayingTemplate;
    }

    this.nowPlayingTemplate = new NowPlayingTemplate({
      // Düğmeler sabit kalır; ne yapacaklarına dokunulduğu anda güncel duruma
      // bakarak karar verilir (şablon yeniden yaratılamadığı için).
      upNextButtonEnabled: true,
      upNextButtonTitle: 'Sıradakiler',
      onUpNextButtonPressed: () => this.showUpNext(),
      // Şov adına dokunmak o şovun bölümlerine götürür (Spotify davranışı).
      albumArtistButtonEnabled: true,
      onAlbumArtistButtonPressed: () => this.openCurrentShow(),
      buttons: [
        // Oynatma hızı — sistem hız düğmesi.
        { id: 'rate', type: 'playback' },
        // Çalan bölümü "Sonra dinle" listesine ekler.
        { id: 'save', type: 'add-to-library' },
      ],
      onButtonPressed: ({ id }) => {
        if (id === 'rate') {
          this.run('hız değiştirilemedi', () => this.cycleSpeed());
        } else if (id === 'save') {
          this.run('kaydedilemedi', () => this.toggleSaved());
        }
      },
    });

    return this.nowPlayingTemplate;
  }

  /** "Sıradakiler" — uygulamanın kuyruğundan, çalan bölümden itibaren. */
  private showUpNext(): void {
    const { episodes, index } = this.deps.playbackQueue.getQueue();
    const upcoming = episodes.slice(Math.max(0, index));
    if (upcoming.length === 0) {
      this.logger.info('CarPlay: kuyruk boş, "Sıradakiler" açılmadı');
      return;
    }
    this.pushEpisodes('Sıradakiler', upcoming);
  }

  /** Çalan bölümün şovunu açar (Now Playing'deki şov düğmesi). */
  private openCurrentShow(): void {
    const episode = this.currentEpisode();
    const show = episode
      ? this.shows.find(candidate => candidate.id === episode.showId)
      : undefined;
    if (!show) {
      this.logger.info('CarPlay: çalan bölümün şovu bulunamadı');
      return;
    }
    this.run('şov açılamadı', () => this.openShow(show));
  }

  /** Kuyruktaki çalan bölüm — düğmeler bunun üzerinden çalışır. */
  private currentEpisode(): Episode | undefined {
    const { episodes, index } = this.deps.playbackQueue.getQueue();
    return episodes[index] ?? episodes.find(e => e.id === this.currentEpisodeId);
  }

  /** Çalan bölümü "Sonra dinle" listesine ekler/çıkarır. */
  private async toggleSaved(): Promise<void> {
    const episode = this.currentEpisode();
    if (!episode) {
      return;
    }
    await this.deps.toggleSavedEpisode.execute({ episode });
    this.refresh();
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
      this.refresh();
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
