import { Result, ok } from '@core/error';
import { paginate, searchEpisodes, sortEpisodes } from '@domain/entities';
import {
  EpisodePageQuery,
  EpisodePageRepository,
  EpisodePageResult,
  PodcastFeedRepository,
} from '@domain/repositories';

/**
 * FeedEpisodePageRepository — bölümleri CİHAZDA çözülen RSS'ten sayfalar.
 *
 * Sunucu kapalıyken ya da erişilemezken devreye giren yedek kaynaktır. Feed
 * bir kez indirilip önbelleğe alınır (`PodcastFeedRepository`), sayfalama
 * bellekte yapılır — bu yüzden burada imleç, listedeki KONUMDUR.
 *
 * İmlecin biçimi kaynağa özgüdür ve dışarıya sızmaz: çağıran taraf onu opak
 * bir metin olarak taşır, sunucu imleciyle aynı şekilde kullanır.
 */
export class FeedEpisodePageRepository implements EpisodePageRepository {
  constructor(private readonly feeds: PodcastFeedRepository) {}

  async getPage(query: EpisodePageQuery): Promise<Result<EpisodePageResult>> {
    const feed = await this.feeds.getFeed(query.feedUrl);
    if (!feed.ok) {
      return feed;
    }

    // Sırayla: arama → sıralama → dilimleme. Sıralamadan önce aramak, gereksiz
    // yere tüm listeyi sıralamayı önler.
    const searched = query.search
      ? searchEpisodes(feed.value.episodes, query.search)
      : feed.value.episodes;
    const sorted = sortEpisodes(searched, query.sort);

    const offset = readOffset(query.cursor);
    const page = paginate(sorted, query.limit, offset);

    return ok({
      page: {
        items: page.items,
        nextCursor: page.hasMore ? String(page.offset + page.limit) : undefined,
      },
      // RSS kaynağı şov meta verisini de bilir; sunucu kapalıyken katalog da
      // boş olabileceği için bu değerli.
      show: feed.value.show,
    });
  }
}

/** İmleci konuma çevirir; bozuk/eksik imleç listenin başı sayılır. */
const readOffset = (cursor?: string): number => {
  const parsed = Number(cursor);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};
