import {
  env,
  isAdsEnabled,
  isAnalyticsEnabled,
  isSyncEnabled,
  resolveCatalogUrl,
} from '@core/config';
import { DEFAULT_AD_POLICY } from '@domain/entities';
import { ConsoleLogger } from '@core/logger';
import {
  AddEpisodeToPlaylist,
  ContinueEpisode,
  CreatePlaylist,
  DeletePlaylist,
  GetPlaylists,
  RemoveEpisodeFromPlaylist,
  ResolveVoiceQuery,
  UpdatePlaylist,
  DownloadEpisode,
  GetDownloads,
  GetFollowedShows,
  GetAllProgress,
  GetLatestEpisodes,
  GetPlaybackProgress,
  GetPodcastFeed,
  GetPreferences,
  GetResumeList,
  GetSavedEpisodes,
  GetShowCatalog,
  GetShowEpisodes,
  IsFollowed,
  PausePlayback,
  PlayEpisode,
  RemoveDownload,
  ResumePlayback,
  SavePlaybackProgress,
  SeekTo,
  SetEpisodeCompleted,
  SetPlaybackRate,
  SetPreference,
  SkipBy,
  StopPlayback,
  ToggleFollow,
  ToggleSavedEpisode,
} from '@domain/usecases';
import {
  ApiEpisodePageRepository,
  ApiSyncTransport,
  DownloadRepositoryImpl,
  FallbackEpisodePageRepository,
  FeedEpisodePageRepository,
  FeedSource,
  FollowRepositoryImpl,
  FollowsSyncAdapter,
  PlaylistSyncAdapter,
  PreferencesRepositoryImpl,
  PreferencesSyncAdapter,
  ProgressSyncAdapter,
  UserRepositoryImpl,
  SyncEngine,
  RemoteShowCatalogRepository,
  InMemoryFeedCacheDataSource,
  PlaybackProgressRepositoryImpl,
  PodcastFeedRepositoryImpl,
  RemoteCatalogDataSource,
  RssFeedDataSource,
  RssFeedSource,
  PlaylistBackedSavedEpisodes,
  PlaylistRepositoryImpl,
  VastAdRepository,
} from '@data';
import {
  AdAwareAudioPlayer,
  ApiClient,
  BatchingAnalytics,
  BlobUtilDownloader,
  FastXmlParser,
  FetchHttpClient,
  ImageColorsPalette,
  LibraryImagePicker,
  NativeRoutePicker,
  LoggingErrorReporter,
  NoopAnalytics,
  RetryingHttpClient,
  TrackPlayerAudioService,
  createPersistentStorage,
} from '@infrastructure';
import { AppDependencies } from '@presentation/di';

/**
 * COMPOSITION ROOT — tüm somut bağımlılıklar burada, tek yerde kurulur ve
 * birbirine bağlanır. Uygulamada `new XyzImpl(...)` çağrısının yapılması
 * gereken TEK yer burasıdır. Diğer katmanlar yalnızca arayüzleri görür.
 *
 * Yeni bir servis/use case eklerken: örneğini burada oluştur, döndürülen
 * nesneye ekle (AppDependencies / CarPlayDependencies şekline uygun).
 */
export const composeDependencies = (): AppDependencies => {
  const logger = new ConsoleLogger();

  // infrastructure (somut teknoloji)
  // Geçici ağ hatalarında retry veri katmanında (tüm yüzeyler için tutarlı).
  const http = new RetryingHttpClient(
    new FetchHttpClient(env.requestTimeoutMs),
    env.networkRetryCount,
  );
  const xmlParser = new FastXmlParser();
  const imagePalette = new ImageColorsPalette();
  // Görsel seçici kurulu değilse kapak seçimi UI'da sessizce pasifleşir.
  const imagePicker = new LibraryImagePicker(logger);
  // AirPlay: yalnızca iOS'ta ve native modül varsa etkin.
  const routePicker = new NativeRoutePicker();
  // Cihazda MMKV (kalıcı); MMKV yoksa bellek-içi'ne güvenle düşer.
  const storage = createPersistentStorage(logger);

  // Backend erişimi — apiBaseUrl yoksa "kapalı" durumda kalır ve sunucu
  // gerektiren tüm özellikler (senkron, telemetri) sessizce devre dışı olur.
  const api = new ApiClient(http, storage, logger, env.apiBaseUrl);
  const analytics = isAnalyticsEnabled(env)
    ? new BatchingAnalytics(api, logger, true)
    : new NoopAnalytics();
  const errorReporter = new LoggingErrorReporter(logger, analytics);
  // Kullanıcı kimliği — sunucu kapalıysa yalnızca yerel profil önbelleği çalışır.
  const userRepository = new UserRepositoryImpl(api, storage);

  // Oynatıcı: reklam yapılandırılmışsa gerçek oynatıcı bir DECORATOR ile sarılır.
  // Reklam mantığı tek yerde toplanır; use case'ler, UI ve CarPlay aynı portu
  // görmeye devam eder ve reklamdan haberdar olmak zorunda kalmaz.
  const basePlayer = new TrackPlayerAudioService();
  const audioPlayer = isAdsEnabled(env)
    ? new AdAwareAudioPlayer(
        basePlayer,
        new VastAdRepository(http, logger, { adTagUrl: env.adTagUrl ?? '' }),
        logger,
        { ...DEFAULT_AD_POLICY, enabled: true, everyNEpisodes: env.adEveryNEpisodes },
      )
    : basePlayer;

  // Cihazlar arası senkron: kaldığın yer, takipler, sonra dinle, listeler.
  // Playlist adaptörü ayrıca tutulur çünkü silmeleri repository ona bildirir.
  const playlistSync = new PlaylistSyncAdapter(storage);
  const syncEngine = new SyncEngine(
    new ApiSyncTransport(api),
    [
      new ProgressSyncAdapter(storage),
      new FollowsSyncAdapter(storage),
      // "Sonra dinle" ayrı bir koleksiyon DEĞİL: playlist sisteminin sistem
      // listesi olarak `playlists` içinde senkronlanır.
      playlistSync,
      // Tercihler: misafirde cihazda kalır, hesap açılınca hesaba taşınır.
      new PreferencesSyncAdapter(storage),
    ],
    storage,
    logger,
  );

  // data (kaynaklar + repository implementasyonları)
  const remoteCatalog = new RemoteCatalogDataSource(http);
  const feedCache = new InMemoryFeedCacheDataSource(env.feedCacheTtlMs);
  // Bölümler RSS'ten okunur — podcast dünyasının ortak, sağlayıcıdan bağımsız
  // arayüzü budur. `FeedSource` portu, kaynağı ileride değiştirmek (ör. bölüm
  // listesini sunucudan sunmak) gerekirse tek bağlama noktası olarak durur.
  const feedSource: FeedSource = new RssFeedSource(new RssFeedDataSource(http, xmlParser));
  const feedRepo = new PodcastFeedRepositoryImpl(feedSource, feedCache, logger);
  // Bölüm sayfaları ÖNCE sunucudan istenir: her şov açılışında tek şovda 4 MB'a
  // varan RSS indirmek, kullanıcı sayısıyla çarpıldığında sürdürülebilir değil.
  // Sunucu kapalı/erişilemez olduğunda RSS yedeği devreye girer ve uygulama
  // çalışmaya devam eder.
  const episodePages = new FallbackEpisodePageRepository(
    new ApiEpisodePageRepository(api),
    new FeedEpisodePageRepository(feedRepo),
    logger,
  );
  // Katalog sunucudaki `shows` tablosundan gelir; uygulamaya gömülü liste YOK.
  // Adres yoksa (backend kapalı) katalog boş kalır — bu bilinçli: iki ayrı
  // kaynak tutmak, ikisinin sessizce ayrışması demekti.
  const catalogRepo = new RemoteShowCatalogRepository(
    remoteCatalog,
    storage,
    logger,
    { remoteUrl: resolveCatalogUrl(env) ?? '', ttlMs: env.remoteCatalogTtlMs },
  );
  const progressRepo = new PlaybackProgressRepositoryImpl(storage);
  const followRepo = new FollowRepositoryImpl(storage);
  const downloadRepo = new DownloadRepositoryImpl(new BlobUtilDownloader(), storage);
  // Kullanıcı listeleri — "Sonra dinle" burada bir sistem listesi olarak yaşar.
  const playlistRepo = new PlaylistRepositoryImpl(storage, undefined, (id, nowMs) =>
    playlistSync.markDeleted(id, nowMs),
  );
  // "Sonra dinle" bağımsız bir depo DEĞİL, playlist sisteminin sistem
  // listesidir. Tek kaynak: aynı veri iki yerde tutulmaz, bir kez senkronlanır.
  const savedRepo = new PlaylistBackedSavedEpisodes(playlistRepo);
  const preferencesRepo = new PreferencesRepositoryImpl(storage);

  // domain use case'leri — kataloglar
  const getShowCatalog = new GetShowCatalog(catalogRepo);
  const getPodcastFeed = new GetPodcastFeed(feedRepo, catalogRepo);
  const getShowEpisodes = new GetShowEpisodes(episodePages, catalogRepo);
  const getLatestEpisodes = new GetLatestEpisodes(feedRepo);

  // domain use case'leri — takip (follow)
  const toggleFollow = new ToggleFollow(followRepo);
  const isFollowed = new IsFollowed(followRepo);
  const getFollowedShows = new GetFollowedShows(followRepo, catalogRepo);

  // domain use case'leri — indirmeler (offline)
  const downloadEpisode = new DownloadEpisode(downloadRepo);
  const removeDownload = new RemoveDownload(downloadRepo);
  const getDownloads = new GetDownloads(downloadRepo);

  // domain use case'leri — sonra dinle
  const toggleSavedEpisode = new ToggleSavedEpisode(savedRepo);
  const getSavedEpisodes = new GetSavedEpisodes(savedRepo);

  const getPlaylists = new GetPlaylists(playlistRepo);
  const createPlaylist = new CreatePlaylist(playlistRepo);
  const updatePlaylist = new UpdatePlaylist(playlistRepo);
  const deletePlaylist = new DeletePlaylist(playlistRepo);
  const addEpisodeToPlaylist = new AddEpisodeToPlaylist(playlistRepo);
  const removeEpisodeFromPlaylist = new RemoveEpisodeFromPlaylist(playlistRepo);

  // domain use case'leri — oynatıcı transport
  // PlayEpisode indirilen bölümlerde yerel dosyayı tercih eder (downloadRepo).
  const playEpisode = new PlayEpisode(audioPlayer, downloadRepo);
  const pausePlayback = new PausePlayback(audioPlayer);
  const resumePlayback = new ResumePlayback(audioPlayer);
  const stopPlayback = new StopPlayback(audioPlayer);
  const seekTo = new SeekTo(audioPlayer);
  const skipBy = new SkipBy(audioPlayer);
  const setPlaybackRate = new SetPlaybackRate(audioPlayer);

  // domain use case'leri — son dinlenen konum
  const savePlaybackProgress = new SavePlaybackProgress(progressRepo);
  const getPlaybackProgress = new GetPlaybackProgress(progressRepo);
  const continueEpisode = new ContinueEpisode(progressRepo, playEpisode);
  const getResumeList = new GetResumeList(progressRepo);
  const getAllProgress = new GetAllProgress(progressRepo);
  const setEpisodeCompleted = new SetEpisodeCompleted(progressRepo);

  // domain use case'leri — tercihler
  const getPreferences = new GetPreferences(preferencesRepo);
  const setPreference = new SetPreference(preferencesRepo);

  // Sesli komut çözümleyicisi — CarPlay/Siri ve ileride sesli arama kullanır.
  const resolveVoiceQuery = new ResolveVoiceQuery(catalogRepo, feedRepo);

  return {
    resolveVoiceQuery,
    getShowCatalog,
    getPodcastFeed,
    getShowEpisodes,
    getLatestEpisodes,
    toggleFollow,
    isFollowed,
    getFollowedShows,
    imagePalette,
    imagePicker,
    userRepository,
    routePicker,
    downloadEpisode,
    removeDownload,
    getDownloads,
    toggleSavedEpisode,
    getSavedEpisodes,
    getPlaylists,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addEpisodeToPlaylist,
    removeEpisodeFromPlaylist,
    playEpisode,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    seekTo,
    skipBy,
    setPlaybackRate,
    savePlaybackProgress,
    getPlaybackProgress,
    continueEpisode,
    getResumeList,
    getAllProgress,
    setEpisodeCompleted,
    getPreferences,
    setPreference,
    audioPlayer,
    analytics,
    errorReporter,
    // Senkron ayarla kapatılabilir; kapalıysa motor yerine boş bir yüzey verilir.
    sync: isSyncEnabled(env) ? syncEngine : undefined,
  };
};
