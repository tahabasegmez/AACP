import { Result, isOk } from '@core/error';
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
  ListTemplateConfig,
  NowPlayingTemplate,
  TabBarTemplate,
} from 'react-native-carplay';
import { QueueSnapshot } from '@domain/services';
import { CarPlayDependencies } from '../CarPlayDependencies';
import {
  CarPlayList,
  CarPlayListItem,
  CarPlayRowAction,
  CarPlaySection,
  buildList,
  episodesToItems,
  imageUrls,
  playlistsToItems,
  resumeToItems,
  showsToItems,
  withLocalImages,
  withoutImages,
} from '../templates/sections';
import { TemplateStack } from '../templates/templateStack';

/**
 * Sürücü dikkatini dağıtmamak için liste uzunlukları sınırlıdır.
 * Apple da sürüş sırasında uzun listeleri kısıtlar; baştan sınırlamak
 * listelerin araçta kırpılmasından iyidir.
 */
const MAX_EPISODES = 50;
/** Ana sayfadaki her bölümün satır sınırı (Spotify de kısa raflar gösterir). */
const MAX_SHELF = 8;

/**
 * Bölümleri kütüphanenin beklediği tipe geçirir.
 *
 * `react-native-carplay` 2.3.0'ın tip tanımında `ListItem.imgUrl?: null` yazar
 * ama native taraf orada bir METİN okur (`RNCarPlay.m`); tanım hatalıdır.
 * Dönüşüm tek bir yerde ve gerekçesiyle yapılır ki kütüphane düzeltildiğinde
 * kaldırılacak nokta belli olsun.
 */
const asListSections = (
  sections: readonly CarPlaySection[],
): ListTemplateConfig['sections'] =>
  sections as unknown as ListTemplateConfig['sections'];

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
    private readonly render: (sections: readonly CarPlaySection[]) => Promise<CarPlaySection[]>,
    onAppear: (templateId: string) => void,
  ) {
    this.template = new ListTemplate({
      title,
      tabTitle: title,
      tabSystemImageName: config.systemImage,
      // Boş sekmede kullanıcıya ne yapacağını söyler (Apple'ın boş görünümü).
      emptyViewTitleVariants: [config.emptyTitle],
      emptyViewSubtitleVariants: [config.emptySubtitle],
      sections: [],
      // Kök sekme göründü = yığın boşaldı. Kullanıcının "geri" tuşunu
      // öğrenebileceğimiz tek yer budur.
      onDidAppear: () => onAppear(this.template.id),
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

  async update(list: CarPlayList): Promise<void> {
    this.actions = list.actions;
    const sections = await this.render(list.sections);
    try {
      this.template.updateSections(asListSections(sections));
    } catch (error) {
      // Kapaklar çizilemezse sekmeyi boş bırakma: kapaksız da olsa içerik
      // göster (bkz. docs/CARPLAY.md).
      this.logger.error(`CarPlay: "${this.title}" kapakları çizilemedi`, error);
      this.template.updateSections(asListSections(withoutImages(sections)));
    }
  }
}

/**
 * CarPlayController — CarPlay yaşam döngüsünü ve şablon akışını yönetir.
 *
 * Kök dört sekmedir; her sekme başlıklı gruplar ve kapaklı satırlardan oluşur.
 *
 *   1. **Ana Sayfa** — "Dinlemeye devam" girişi ve tüm podcast'ler,
 *   2. **Kitaplığın** — kullanıcı listeleri ("Sonra dinle" dahil),
 *   3. **İndirilenler** — çevrimdışı çalışır; araçta şebeke kopabilir,
 *   4. **Şimdi çalan** — çalan bölüm ve kuyruk; sekmeye dokunmak oynatıcıyı açar.
 *
 * İş mantığı tamamen domain use case'lerinden gelir ve mobil UI ile PAYLAŞILIR;
 * burada yalnızca CarPlay'e özgü şablon/etkileşim kodu vardır. Şablon
 * dönüşümleri (`sections`) saftır ve ayrı test edilir.
 */
export class CarPlayController {
  private home?: TabList;
  private library?: TabList;
  private downloads?: TabList;
  private playing?: TabList;
  /**
   * Kök sekme çubuğu — bir kez yaratılır, her bağlantıda yeniden kök yapılır
   * (bkz. buildRoot).
   */
  private tabBar?: TabBarTemplate;

  /**
   * Paylaşılan Now Playing şablonu — CarPlay'de tek bir örnek vardır, biz de
   * tek örnek tutarız (bkz. `showNowPlaying`).
   */
  private nowPlayingTemplate?: NowPlayingTemplate;

  /**
   * Şablon yığınının modeli — itme/geri dönme kararları buradan verilir.
   * Sistemin "göründü" olaylarıyla kendini düzeltir (bkz. TemplateStack).
   */
  private readonly stack = new TemplateStack();
  /** Kök sekmelerin şablon kimlikleri — yığın modelinde "kök" sayılırlar. */
  private rootTemplateIds: string[] = [];
  /**
   * Sistem oynatma ekranı gözlemcisi bağlandı mı? Denetleyici uygulama ömrü
   * boyunca tek örnektir, dolayısıyla yeniden bağlanmalar bunu korur.
   */
  private nowPlayingEnabled = false;

  /** Katalog — Kitaplığın sekmesi ve Now Playing'deki şov düğmesi için. */
  private shows: readonly Show[] = [];

  /**
   * Kuyruğun son okunan hâli.
   *
   * Kuyruğun sahibi oynatıcıdır ve okuması ASENKRONDUR; CarPlay geri
   * çağrıları ise senkron. Bu yüzden her tazeleme turunda bir kez okunup
   * burada tutulur — şablonlar hep aynı anlık görüntüyü görür.
   */
  private queue: QueueSnapshot = { items: [], index: -1 };

  private currentEpisodeId: string | null = null;
  /** Oynatıcı ŞU AN çalıyor mu? Duraklamış bölüme dokunmak devam ettirmeli. */
  private isPlaying = false;
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
    // Oynatıcı henüz KURULMAMIŞ olabilir: uygulamayı araç açtığında telefon
    // arayüzü hiç görünmez ve kurulumu isteyen başka kimse olmaz. Kurulmadan
    // ses oturumu açılmaz, uzaktan kontroller bağlanmaz ve sistemin oynatma
    // kartı (MPNowPlayingInfoCenter) boş kalır — araçta "hiçbir şey
    // görünmüyor" şikâyetinin sebebi buydu. Kurulum tekrar çağrılabilir.
    await this.ensurePlayerReady();
    this.prepareNowPlaying();
    this.watchPlayback();
    await this.buildRoot();
  }

  /** Oynatıcıyı hazırlar; kurulamazsa arayüz yine de açılır (liste gezilebilir). */
  private async ensurePlayerReady(): Promise<void> {
    try {
      await this.deps.audioPlayer.setup();
    } catch (error) {
      this.logger.error('CarPlay: oynatıcı kurulamadı', error);
    }
  }

  /**
   * Sistem oynatma ekranını hazırlar — UYGULAMA ÖMRÜNDE BİR KEZ.
   *
   * Şablon ÖNCE yaratılır, gözlemci SONRA bağlanır; ikisi de tekrarlanmaz.
   * Sıra da teklik de bilinçlidir:
   *
   * 1. `CPNowPlayingTemplate` PAYLAŞILAN bir örnektir ve onu sistem de açabilir
   *    (aracın kendi "şimdi çalıyor" düğmesi). Kütüphane şablonun kimliğini
   *    native tarafa ancak biz onu yarattığımızda yazar; yazılmadan önce gelen
   *    "göründü" olayı kimliği nil okuyup sözlüğe koymaya çalışır ve ANA İŞ
   *    PARÇACIĞINDA NSInvalidArgumentException ile çöker. Bu yüzden şablon ilk
   *    oynatmayı beklemez: bağlantı anında kurulur.
   * 2. `enableNowPlaying` 2.3.0'da bir bayrağı okur ama hiç yazmaz
   *    (`isNowPlayingActive` atanmıyor): her `true` çağrısı BİR GÖZLEMCİ DAHA
   *    ekler, `false` çağrısı hiçbir şey yapmaz. Yeniden bağlanmalarda tekrar
   *    çağırmak, "Sıradakiler" ve şov düğmelerinin tek dokunuşta iki-üç kez
   *    tetiklenmesi demekti.
   */
  private prepareNowPlaying(): void {
    if (this.nowPlayingEnabled) {
      return;
    }
    this.nowPlayingEnabled = true;
    this.nowPlaying();
    CarPlay.enableNowPlaying(true);
  }

  /** CarPlay bağlantısı koptuğunda çağrılır. */
  onDisconnect(): void {
    this.logger.info('CarPlay bağlantısı koptu');
    this.unsubscribePlayback?.();
    this.unsubscribePlayback = undefined;
    // `enableNowPlaying(false)` ve şablonların atılması BİLİNÇLİ olarak
    // yapılmaz: paylaşılan Now Playing şablonu ile kök sekmeler native tarafta
    // yaşamaya devam eder, yeniden yaratmak yalnızca bir olay dinleyicisi daha
    // bağlamak olurdu (bkz. prepareNowPlaying).
    // Yığın modeli sıfırlanır: araçtaki ekranlar bağlantıyla birlikte gitti.
    this.stack.clear();
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

  /**
   * Sekmeli kök şablonu kurar (bir kez) ve içeriğini doldurur.
   *
   * Şablonlar yeniden bağlanmada YENİDEN YARATILMAZ: native taraf onları
   * kimlikleriyle saklar ve her `new ListTemplate` bir olay dinleyicisi daha
   * bağlar. Araç her bağlandığında dört sekme daha yaratmak, tek dokunuşun
   * birden çok kez işlenmesi demekti.
   */
  private async buildRoot(): Promise<void> {
    try {
      if (this.tabBar) {
        CarPlay.setRootTemplate(this.tabBar);
        this.stack.clear();
        await this.refreshAll();
        return;
      }

      this.home = new TabList(
        'Ana Sayfa',
        {
          systemImage: 'house.fill',
          emptyTitle: 'Henüz bir şey dinlemedin',
          emptySubtitle: 'Telefonda bir bölüm başlat, buradan devam et',
        },
        this.logger,
        sections => this.localize(sections),
        id => this.onTemplateAppear(id),
      );

      this.library = new TabList(
        'Kitaplığın',
        {
          systemImage: 'books.vertical.fill',
          emptyTitle: 'Kitaplığın boş',
          emptySubtitle: 'Telefonda liste oluştur ya da podcast takip et',
        },
        this.logger,
        sections => this.localize(sections),
        id => this.onTemplateAppear(id),
      );

      this.downloads = new TabList(
        'İndirilenler',
        {
          systemImage: 'arrow.down.circle.fill',
          emptyTitle: 'İndirilen bölüm yok',
          emptySubtitle: 'Telefonda indir, şebeke olmadan dinle',
        },
        this.logger,
        sections => this.localize(sections),
        id => this.onTemplateAppear(id),
      );

      this.playing = new TabList(
        'Şimdi çalan',
        {
          systemImage: 'play.circle.fill',
          emptyTitle: 'Bir şey çalmıyor',
          emptySubtitle: 'Bir bölüm seç, buradan takip et',
        },
        this.logger,
        sections => this.localize(sections),
        id => this.onTemplateAppear(id),
      );

      this.tabBar = new TabBarTemplate({
        templates: [
          this.home.template,
          this.library.template,
          this.downloads.template,
          this.playing.template,
        ],
        onTemplateSelect: (_template, { selectedTemplateId }) => {
          // Sekmeye dönüldüğünde içerik tazelenir: telefonda ya da başka bir
          // cihazda yapılan değişiklikler araçta da görünsün.
          this.refresh();

          // "Şimdi çalan" sekmesi doğrudan oynatıcıyı açar — sürücü ikinci
          // kez dokunmak zorunda kalmasın. Bir şey çalmıyorsa sekmenin boş
          // görünümü kalır.
          if (selectedTemplateId === this.playing?.template.id && this.currentEpisodeId) {
            this.showNowPlaying();
          }
        },
      });

      CarPlay.setRootTemplate(this.tabBar);

      // Kök sekmeler: bunlardan biri göründüğünde yığın boşalmış demektir.
      this.rootTemplateIds = [
        this.home.template.id,
        this.library.template.id,
        this.downloads.template.id,
        this.playing.template.id,
      ];
      this.stack.clear();

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
    // Kuyruk oynatıcıdan okunur; şablonlar bu anlık görüntüyü kullanır.
    this.queue = await this.deps.audioPlayer.getQueue();

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

    await Promise.all([
      this.home?.update(this.homeList(resumeItems)),
      this.library?.update(this.libraryList(allPlaylists)),
      this.downloads?.update(this.downloadsList(downloaded)),
      this.playing?.update(this.nowPlayingList()),
    ]);
  }

  /**
   * Kapakları yerel dosyalara çevirir.
   *
   * CarPlay şablonları uzak görsel KABUL ETMEZ: `https://` adresi verilen satır
   * kapaksız çizilir ve native taraf ana iş parçacığında hata üretir. Bu yüzden
   * görseller önceden indirilip `file://` adresiyle verilir. İndirilemeyen
   * kapaklar sessizce düşer, satır yine görünür.
   */
  private async localize(sections: readonly CarPlaySection[]): Promise<CarPlaySection[]> {
    const urls = imageUrls(sections);
    if (urls.length === 0) {
      return [...sections];
    }

    const resolved = new Map<string, string>();
    await Promise.all(
      urls.map(async url => {
        try {
          const local = await this.deps.artwork.localUri(url);
          if (local) {
            resolved.set(url, local);
          }
        } catch (error) {
          this.logger.warn('CarPlay: kapak indirilemedi', error);
        }
      }),
    );

    return withLocalImages(sections, resolved);
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

  /**
   * Ana Sayfa: "Dinlemeye devam" girişi ve tüm podcast'ler.
   *
   * "Dinlemeye devam" bir liste gibi davranır (üstüne dokun → bölümler). Araçta
   * kök ekranın kısa kalması, uzun bir rafta gezinmekten güvenlidir.
   */
  private homeList(resumeItems: readonly PlaybackProgress[]): CarPlayList {
    // Devam listesinden çalınca kuyruk = o listenin kendisi; böylece
    // "Sıradakiler" ve direksiyon tuşları boş kalmaz.
    const resumeEpisodes = resumeItems.map(progressToEpisode);

    return buildList([
      {
        items:
          resumeItems.length > 0
            ? [
                {
                  text: 'Dinlemeye devam',
                  detailText: `${resumeItems.length} bölüm`,
                  // Kapak, en son dinlenen bölümden gelir.
                  imgUrl: resumeItems[0]?.artworkUrl,
                  showsDisclosureIndicator: true,
                },
              ]
            : [],
        actions:
          resumeItems.length > 0
            ? [
                () =>
                  this.pushEpisodes(
                    'Dinlemeye devam',
                    resumeEpisodes,
                    // Toplam süre yerine KALAN süre: sürücü için daha yararlı.
                    resumeToItems(resumeItems, this.currentEpisodeId),
                  ),
              ]
            : [],
      },
      {
        header: "Podcast'ler",
        items: showsToItems(this.shows),
        actions: this.shows.map(show => () => this.openShow(show)),
      },
    ]);
  }

  /** Kitaplığın: kullanıcı listeleri ("Sonra dinle" sistem listesi dahil). */
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
    ]);
  }

  /**
   * Şimdi çalan: çalan bölüm ve kuyruğun devamı.
   *
   * Sistemin Now Playing ekranı yalnızca taşıma kontrollerini (oynat/duraklat,
   * sarma) gösterir ve içeriğini iOS kendisi doldurur. Sürücünün "ne çalıyor,
   * sırada ne var" sorusunu bu sekme yanıtlar — içeriği bizim durumumuzdan
   * gelir, dolayısıyla her zaman günceldir. Üstteki satır sistem ekranını açar.
   */
  private nowPlayingList(): CarPlayList {
    const episodes = this.queue.items.map(item => item.episode);
    const { index } = this.queue;
    const current =
      episodes[index] ?? episodes.find(episode => episode.id === this.currentEpisodeId);
    const upcoming = index >= 0 ? episodes.slice(index + 1) : [];

    return buildList([
      {
        header: 'Çalıyor',
        items: current ? episodesToItems([current], this.currentEpisodeId) : [],
        actions: current ? [() => this.showNowPlaying()] : [],
      },
      {
        header: 'Sıradakiler',
        items: episodesToItems(upcoming, this.currentEpisodeId),
        actions: upcoming.map(
          (episode, offset) => () => this.playEpisode(episode, episodes, index + 1 + offset),
        ),
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

  /**
   * Bölüm listesi açar (liste, şov ya da kuyruk içeriği).
   *
   * `items` verilmezse standart bölüm satırları kullanılır; "Dinlemeye devam"
   * gibi durumlarda çağıran kendi satırlarını geçer (kalan süre gösterimi).
   */
  private async pushEpisodes(
    title: string,
    episodes: readonly Episode[],
    items: CarPlayListItem[] = episodesToItems(episodes, this.currentEpisodeId),
  ): Promise<void> {
    const list = buildList([
      {
        items,
        actions: episodes.map(
          (episode, index) => () => this.playEpisode(episode, episodes, index),
        ),
      },
    ]);

    // Liste ÖNCE kapaksız açılır: kapak indirmesini beklemek, dokunuşla ekranın
    // gelmesi arasında sessiz bir gecikme yaratıyordu. Kapaklar hazır olunca
    // aynı şablon yerinde güncellenir.
    const template = new ListTemplate({
      title,
      sections: asListSections(withoutImages(list.sections)),
      onDidAppear: () => this.onTemplateAppear(template.id),
      onItemSelect: async ({ index }) => {
        try {
          await list.actions[index]?.();
        } catch (error) {
          this.logger.error(`CarPlay: "${title}" satırı açılamadı`, error);
        }
      },
    });
    CarPlay.pushTemplate(template);
    this.stack.pushed(template.id);

    try {
      const sections = await this.localize(list.sections);
      template.updateSections(asListSections(sections));
    } catch (error) {
      // Kapaklar gelmedi: liste kapaksız haliyle çalışmaya devam eder.
      this.logger.error(`CarPlay: "${title}" kapakları çizilemedi`, error);
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
    // Oynatıcıda ZATEN yüklü olan bölüme dokunmak onu baştan başlatmamalı:
    // kullanıcı dinlediği yeri kaybederdi. Ama duraklatılmışsa (ör. telefondan
    // duraklatıldı) dokunuş DEVAM ETTİRMELİ — eskiden yalnızca ekran açılıyor,
    // ses gelmiyordu ve düğme bozuk görünüyordu.
    if (episode.id === this.currentEpisodeId) {
      if (!this.isPlaying) {
        const resumed = await this.deps.resumePlayback.execute();
        if (!isOk(resumed)) {
          this.logger.error('CarPlay: oynatma sürdürülemedi', resumed.error);
        }
      }
      this.showNowPlaying();
      return;
    }

    // Kuyruk oynatmayla BİRLİKTE kurulur: sıra oynatıcının kendi kuyruğudur,
    // böylece kilit ekranı ve direksiyon tuşları da aynı sırayı görür.
    const result = await this.deps.continueEpisode.execute({
      episode: this.withShow(episode),
      queue: queue.map(item => this.withShow(item)),
      index,
    });
    if (!isOk(result)) {
      this.logger.error('CarPlay: oynatma başlatılamadı', result.error);
      return;
    }
    this.currentEpisodeId = episode.id;
    // Kuyruk ve "çalıyor" işaretleri değişti; oynatıcı olayını beklemeden
    // tazele ki "Şimdi çalan" sekmesi anında doğru olsun.
    this.refresh();
    this.showNowPlaying();
  }

  /**
   * Now Playing ekranını gösterir.
   *
   * CarPlay'in Now Playing şablonu bir SİNGLETON'dır (`CPNowPlayingTemplate`
   * paylaşılan örnek) ve aynı örneği yığına İKİ KEZ eklemek iOS'ta istisna
   * fırlatıp uygulamayı çökertir. Bu yüzden üç durum ayrılır:
   *
   *  - **ekranda** → yapacak bir şey yok,
   *  - **yığında ama ekranda değil** (üstüne bir liste itilmiş) → o listeler
   *    kaldırılıp şablona dönülür,
   *  - **yığında değil** → eklenir.
   *
   * Körlemesine `popToRootTemplate` çağrılmaz: kökteyken CarPlay bunu
   * *"No templates were available to be popped"* hatasıyla bildirir.
   *
   * Karar üç boolean'la TAHMİN EDİLMEZ; `TemplateStack` sistemin "göründü"
   * olaylarıyla kendini düzelttiği için sistemin bizden habersiz açtığı bir
   * Now Playing de modelde görünür — eskiden bu durum bir sonraki itişi
   * çökme sebebine çeviriyordu.
   */
  private showNowPlaying(): void {
    const template = this.nowPlaying();
    if (this.stack.top() === template.id) {
      return;
    }
    if (this.stack.contains(template.id)) {
      CarPlay.popToTemplate(template);
      this.stack.poppedTo(template.id);
      return;
    }
    CarPlay.pushTemplate(template);
    this.stack.pushed(template.id);
  }

  /**
   * Bir şablon göründü — yığın modeli düzeltilir.
   *
   * Kullanıcının "geri" tuşunu ve sistemin kendi gezinmesini öğrenebildiğimiz
   * tek kanal budur; kütüphane yığını sorgulamaya izin vermez.
   */
  private onTemplateAppear(templateId: string): void {
    this.stack.didAppear(templateId, this.rootTemplateIds.includes(templateId));
  }

  /** Paylaşılan Now Playing şablonunu kurar (bir kez). */
  private nowPlaying(): NowPlayingTemplate {
    if (this.nowPlayingTemplate) {
      return this.nowPlayingTemplate;
    }

    this.nowPlayingTemplate = new NowPlayingTemplate({
      // Sistem de bu şablonu açabilir (aracın kendi "şimdi çalıyor" düğmesi);
      // model bunu ancak buradan öğrenir.
      onDidAppear: () => this.onTemplateAppear(this.nowPlayingTemplate!.id),
      // Düğmeler sabit kalır; ne yapacaklarına dokunulduğu anda güncel duruma
      // bakarak karar verilir (şablon yeniden yaratılamadığı için).
      upNextButtonEnabled: true,
      upNextButtonTitle: 'Sıradakiler',
      onUpNextButtonPressed: () => this.showUpNext(),
      // Şov adına dokunmak o şovun bölümlerine götürür (Spotify davranışı).
      albumArtistButtonEnabled: true,
      onAlbumArtistButtonPressed: () => this.openCurrentShow(),
      // Özel düğme YOK. Hız ve "Sonra dinle'ye ekle" araçta anlamlı eylemler
      // değil; sürüş sırasında ayar değil dinleme yapılır. Taşıma kontrolleri
      // (oynat/duraklat, sarma, bölüm değiştirme) sistemden gelir.
      buttons: [],
    });

    return this.nowPlayingTemplate;
  }

  /** "Sıradakiler" — uygulamanın kuyruğundan, çalan bölümden itibaren. */
  private showUpNext(): void {
    const { items, index } = this.queue;
    const upcoming = items.slice(Math.max(0, index)).map(item => item.episode);
    if (upcoming.length === 0) {
      this.logger.info('CarPlay: kuyruk boş, "Sıradakiler" açılmadı');
      return;
    }
    this.run('sıradakiler açılamadı', () => this.pushEpisodes('Sıradakiler', upcoming));
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

  /**
   * Bölüme şov adını ekler.
   *
   * İndirme ve "kaldığın yer" kayıtları yalnızca şov kimliğini taşır; oynatma
   * kartında (kilit ekranı / CarPlay) şov adının görünmesi için katalogdan
   * tamamlanır. Ad zaten varsa dokunulmaz.
   */
  private withShow(episode: Episode): Episode {
    if (episode.showTitle) {
      return episode;
    }
    const show = this.shows.find(candidate => candidate.id === episode.showId);
    return show ? { ...episode, showTitle: show.title } : episode;
  }

  /** Kuyruktaki çalan bölüm — düğmeler bunun üzerinden çalışır. */
  private currentEpisode(): Episode | undefined {
    const episodes = this.queue.items.map(item => item.episode);
    return episodes[this.queue.index] ?? episodes.find(e => e.id === this.currentEpisodeId);
  }

  /**
   * Oynatma durumunu izler: çalan bölüm değişince sekmeler tazelenir. Böylece
   * hem "çalıyor" işareti hem de "Dinlemeye devam" rafı güncel kalır.
   */
  private watchPlayback(): void {
    // Bağlantı olayı yinelenebilir; ikinci bir abonelik her durum değişiminde
    // iki tazeleme turu demek olurdu.
    if (this.unsubscribePlayback) {
      return;
    }
    this.unsubscribePlayback = this.deps.audioPlayer.subscribe(state => {
      const playing = state.status === 'playing';
      const episodeChanged = state.currentEpisodeId !== this.currentEpisodeId;

      // Çalıyor/duraklatıldı bilgisi de İZLENİR. Yalnızca bölüm değişimini
      // dinlemek yetmiyordu: telefondan duraklatınca CarPlay hem satırlardaki
      // "çalıyor" işaretini eski gösteriyor, hem de dokunulan bölümü
      // sürdürmesi gerektiğini bilemiyordu.
      this.isPlaying = playing;
      if (!episodeChanged) {
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
