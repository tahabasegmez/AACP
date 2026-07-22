import { FEED_CATALOG, env } from '@core/config';
import { ConsoleLogger } from '@core/logger';
import {
  ContinueEpisode,
  GetPlaybackProgress,
  GetPodcastFeed,
  GetResumeList,
  GetShowCatalog,
  GetShowEpisodes,
  PausePlayback,
  PlayEpisode,
  ResumePlayback,
  SavePlaybackProgress,
  SeekTo,
  SetPlaybackRate,
  SkipBy,
  StopPlayback,
} from '@domain/usecases';
import {
  HybridShowCatalogRepository,
  InMemoryFeedCacheDataSource,
  PlaybackProgressRepositoryImpl,
  PodcastFeedRepositoryImpl,
  RemoteCatalogDataSource,
  RssFeedDataSource,
} from '@data';
import {
  FastXmlParser,
  FetchHttpClient,
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
  const audioPlayer = new TrackPlayerAudioService();
  // Cihazda MMKV (kalıcı); MMKV yoksa bellek-içi'ne güvenle düşer.
  const storage = createPersistentStorage(logger);

  // data (kaynaklar + repository implementasyonları)
  const rssDataSource = new RssFeedDataSource(http, xmlParser);
  const remoteCatalog = new RemoteCatalogDataSource(http);
  const feedCache = new InMemoryFeedCacheDataSource(env.feedCacheTtlMs);
  const feedRepo = new PodcastFeedRepositoryImpl(rssDataSource, feedCache, logger);
  // Hibrit katalog: bundled fallback + (varsa) uzak remote-config.
  const catalogRepo = new HybridShowCatalogRepository(
    FEED_CATALOG,
    remoteCatalog,
    storage,
    logger,
    { remoteUrl: env.remoteCatalogUrl, ttlMs: env.remoteCatalogTtlMs },
  );
  const progressRepo = new PlaybackProgressRepositoryImpl(storage);

  // domain use case'leri — kataloglar
  const getShowCatalog = new GetShowCatalog(catalogRepo);
  const getPodcastFeed = new GetPodcastFeed(feedRepo, catalogRepo);
  const getShowEpisodes = new GetShowEpisodes(feedRepo, catalogRepo);

  // domain use case'leri — oynatıcı transport
  const playEpisode = new PlayEpisode(audioPlayer);
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

  return {
    getShowCatalog,
    getPodcastFeed,
    getShowEpisodes,
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
    audioPlayer,
  };
};
