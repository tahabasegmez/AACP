import { Logger } from '@core/logger';
import { Result } from '@core/error';
import {
  EpisodePageQuery,
  EpisodePageRepository,
  EpisodePageResult,
} from '@domain/repositories';

/**
 * FallbackEpisodePageRepository — önce sunucu, olmazsa RSS.
 *
 * Aynı portun iki implementasyonunu sıraya dizen bir SARMALAYICIDIR; kendi
 * başına veri kaynağı değildir. Böylece "hangi kaynak" kararı tek yerde durur
 * ve use case iki kaynağın varlığından habersiz kalır.
 *
 * YEDEĞE DÜŞME KOŞULU dar tutulur: yalnızca ilk sayfada düşülür. Sayfalar
 * arasında kaynak değiştirmek, imlecin karşı tarafta anlamsız olması demekti —
 * kullanıcı listenin ortasında başa dönerdi. Devam eden sayfalarda hata
 * olduğu gibi bildirilir.
 */
export class FallbackEpisodePageRepository implements EpisodePageRepository {
  constructor(
    private readonly primary: EpisodePageRepository,
    private readonly fallback: EpisodePageRepository,
    private readonly logger: Logger,
  ) {}

  async getPage(query: EpisodePageQuery): Promise<Result<EpisodePageResult>> {
    const result = await this.primary.getPage(query);
    if (result.ok || query.cursor) {
      return result;
    }

    this.logger.info('Bölümler sunucudan alınamadı, RSS yedeğine düşülüyor', {
      showId: query.showId,
    });
    return this.fallback.getPage(query);
  }
}
