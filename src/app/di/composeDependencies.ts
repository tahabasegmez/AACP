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
  InMemoryFeedCacheDataSource,
  PlaybackProgressRepositoryImpl,
  PodcastFeedRepositoryImpl,
  RssFeedDataSource,
  ShowCatalogRepositoryImpl,
} from '@data';
import {
  FastXmlParser,
  FetchHttpClient,
  InMemoryKeyValueStorage,
  TrackPlayerAudioService,
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
  const http = new FetchHttpClient(env.requestTimeoutMs);
  const xmlParser = new FastXmlParser();
  const audioPlayer = new TrackPlayerAudioService();
  const storage = new InMemoryKeyValueStorage();

  // data (kaynaklar + repository implementasyonları)
  const rssDataSource = new RssFeedDataSource(http, xmlParser);
  const feedCache = new InMemoryFeedCacheDataSource(env.feedCacheTtlMs);
  const feedRepo = new PodcastFeedRepositoryImpl(rssDataSource, feedCache, logger);
  const catalogRepo = new ShowCatalogRepositoryImpl(FEED_CATALOG);
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
