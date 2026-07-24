import { Result, ok } from '@core/error';
import { Episode, sortEpisodes } from '../entities';
import { PodcastFeedRepository } from '../repositories';
import { UseCase } from './UseCase';

export interface GetLatestEpisodesParams {
  /** Hangi şovların feed'lerinden toplanacak (genelde takip edilenler). */
  readonly feedUrls: readonly string[];
  /** Her şovdan en fazla kaç bölüm alınsın (varsayılan 3). */
  readonly perShow?: number;
  /** Toplam sonuç sınırı (varsayılan 15). */
  readonly limit?: number;
}

/**
 * GetLatestEpisodes — verilen şovların en yeni bölümlerini birleştirip döner.
 *
 * PERFORMANS: Yalnızca verilen feed'ler çekilir (feed cache'li). Ana ekranda bu
 * genelde TAKİP EDİLEN şovlarla sınırlıdır — böylece tüm katalogu (onlarca büyük
 * feed) indirmeyiz. Feed başına en yeni birkaç bölüm alınır, tarihe göre sıralanır.
 * Tek tek feed hataları atlanır (best-effort); biri patlarsa satır tümden düşmez.
 */
export class GetLatestEpisodes
  implements UseCase<GetLatestEpisodesParams, readonly Episode[]>
{
  constructor(private readonly feedRepo: PodcastFeedRepository) {}

  async execute(
    params: GetLatestEpisodesParams,
  ): Promise<Result<readonly Episode[]>> {
    const perShow = params.perShow ?? 3;
    const limit = params.limit ?? 15;

    const results = await Promise.all(
      params.feedUrls.map(url => this.feedRepo.getFeed(url)),
    );

    const collected: Episode[] = [];
    for (const result of results) {
      if (result.ok) {
        collected.push(...sortEpisodes(result.value.episodes, 'newest').slice(0, perShow));
      }
    }

    return ok(sortEpisodes(collected, 'newest').slice(0, limit));
  }
}
