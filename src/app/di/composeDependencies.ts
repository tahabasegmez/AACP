import { FEED_CATALOG, env } from '@core/config';
import { ConsoleLogger } from '@core/logger';
import {
  GetPodcastFeed,
  GetShowCatalog,
  PlayEpisode,
} from '@domain/usecases';
import {
  InMemoryFeedCacheDataSource,
  PodcastFeedRepositoryImpl,
  RssFeedDataSource,
  ShowCatalogRepositoryImpl,
} from '@data';
import {
  FastXmlParser,
  FetchHttpClient,
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

  // data (kaynaklar + repository implementasyonları)
  const rssDataSource = new RssFeedDataSource(http, xmlParser);
  const feedCache = new InMemoryFeedCacheDataSource(env.feedCacheTtlMs);
  const feedRepo = new PodcastFeedRepositoryImpl(rssDataSource, feedCache, logger);
  const catalogRepo = new ShowCatalogRepositoryImpl(FEED_CATALOG);

  // domain (use case'ler — arayüzlere bağlanır)
  const getShowCatalog = new GetShowCatalog(catalogRepo);
  const getPodcastFeed = new GetPodcastFeed(feedRepo, catalogRepo);
  const playEpisode = new PlayEpisode(audioPlayer);

  return { getShowCatalog, getPodcastFeed, playEpisode, audioPlayer };
};
