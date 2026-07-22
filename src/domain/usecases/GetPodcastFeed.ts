import { AppError, Result, fail } from '@core/error';
import { PodcastFeed } from '../entities';
import { PodcastFeedRepository, ShowCatalogRepository } from '../repositories';
import { UseCase } from './UseCase';

export interface GetPodcastFeedParams {
  /** feedUrl doğrudan verilebilir ya da showId üzerinden çözülür. */
  readonly feedUrl?: string;
  readonly showId?: string;
}

/**
 * GetPodcastFeed — bir şovun feed'ini (şov + bölümler) getirir.
 *
 * feedUrl verilmişse doğrudan onu kullanır; sadece showId verilmişse önce
 * katalogdan şovu bulup feedUrl'ini çözer. Böylece hem şov detay ekranı hem
 * deep-link senaryoları desteklenir.
 */
export class GetPodcastFeed
  implements UseCase<GetPodcastFeedParams, PodcastFeed>
{
  constructor(
    private readonly feedRepo: PodcastFeedRepository,
    private readonly catalog: ShowCatalogRepository,
  ) {}

  async execute(params: GetPodcastFeedParams): Promise<Result<PodcastFeed>> {
    let feedUrl = params.feedUrl;

    if (!feedUrl && params.showId) {
      const showResult = await this.catalog.getShowById(params.showId);
      if (!showResult.ok) {
        return showResult;
      }
      feedUrl = showResult.value.feedUrl;
    }

    if (!feedUrl) {
      return fail(
        AppError.notFound('feedUrl veya showId sağlanmalı (GetPodcastFeed).'),
      );
    }

    return this.feedRepo.getFeed(feedUrl);
  }
}
