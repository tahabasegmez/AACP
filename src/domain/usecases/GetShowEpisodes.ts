import { AppError, Result, fail, ok } from '@core/error';
import {
  Episode,
  EpisodeSortOrder,
  Page,
  Show,
  mergeShow,
  paginate,
  searchEpisodes,
  sortEpisodes,
} from '../entities';
import { PodcastFeedRepository, ShowCatalogRepository } from '../repositories';
import { UseCase } from './UseCase';

export interface GetShowEpisodesParams {
  readonly feedUrl?: string;
  readonly showId?: string;
  /** Sayfa boyutu (varsayılan 20). */
  readonly limit?: number;
  /** Kaçıncı öğeden başlanacağı (varsayılan 0). */
  readonly offset?: number;
  /** Başlık/açıklamada arama (opsiyonel). */
  readonly search?: string;
  /** Sıralama (varsayılan: en yeni önce). */
  readonly sort?: EpisodeSortOrder;
}

export interface ShowEpisodesResult {
  /** Feed'den gelen güncel şov meta verisi (katalog ile birleştirilmiş). */
  readonly show: Show;
  /** Arama + sıralama uygulanmış, sayfalanmış bölümler. */
  readonly episodes: Page<Episode>;
}

const DEFAULT_LIMIT = 20;

/**
 * GetShowEpisodes — bir şovun bölümlerini sayfalı, aranabilir ve sıralı getirir;
 * şov meta verisini feed + katalog birleşimiyle zenginleştirir.
 *
 * Büyük feed'ler (1900+ bölüm) tek seferde UI'a verilmez: feed bir kez çekilip
 * cache'lenir (PodcastFeedRepository), ardından bu use case arama/sıralama/
 * sayfalama uygular. "Daha fazla yükle" için sonraki çağrı artan offset ile
 * gelir ve cache sayesinde ağa çıkmaz.
 */
export class GetShowEpisodes
  implements UseCase<GetShowEpisodesParams, ShowEpisodesResult>
{
  constructor(
    private readonly feedRepo: PodcastFeedRepository,
    private readonly catalog: ShowCatalogRepository,
  ) {}

  async execute(
    params: GetShowEpisodesParams,
  ): Promise<Result<ShowEpisodesResult>> {
    let feedUrl = params.feedUrl;
    let catalogShow: Show | undefined;

    // showId verilmişse katalogdan fallback meta veri + feedUrl çöz.
    if (params.showId) {
      const showResult = await this.catalog.getShowById(params.showId);
      if (showResult.ok) {
        catalogShow = showResult.value;
        feedUrl = feedUrl ?? showResult.value.feedUrl;
      }
    }

    if (!feedUrl) {
      return fail(
        AppError.notFound('feedUrl veya showId sağlanmalı (GetShowEpisodes).'),
      );
    }

    const feedResult = await this.feedRepo.getFeed(feedUrl);
    if (!feedResult.ok) {
      return feedResult;
    }

    const show = mergeShow(feedResult.value.show, catalogShow);

    // Sırayla: arama → sıralama → sayfalama.
    let episodes: readonly Episode[] = feedResult.value.episodes;
    if (params.search) {
      episodes = searchEpisodes(episodes, params.search);
    }
    episodes = sortEpisodes(episodes, params.sort ?? 'newest');

    const page = paginate(episodes, params.limit ?? DEFAULT_LIMIT, params.offset ?? 0);
    return ok({ show, episodes: page });
  }
}
