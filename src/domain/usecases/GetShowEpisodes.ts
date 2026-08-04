import { AppError, Result, fail, ok } from '@core/error';
import { CursorPage, Episode, EpisodeSortOrder, Show, mergeShow } from '../entities';
import {
  EpisodePageRepository,
  ShowCatalogRepository,
} from '../repositories';
import { UseCase } from './UseCase';

export interface GetShowEpisodesParams {
  readonly feedUrl?: string;
  readonly showId?: string;
  /** Sayfa boyutu (varsayılan 20). */
  readonly limit?: number;
  /** Önceki sayfanın imleci; ilk sayfada boştur. */
  readonly cursor?: string;
  /** Başlık/açıklamada arama (opsiyonel). */
  readonly search?: string;
  /** Sıralama (varsayılan: en yeni önce). */
  readonly sort?: EpisodeSortOrder;
}

export interface ShowEpisodesResult {
  /** Katalog ve (varsa) feed meta verisinin birleşimi. */
  readonly show: Show;
  /** İmleçle sayfalanmış bölümler. */
  readonly episodes: CursorPage<Episode>;
}

const DEFAULT_LIMIT = 20;

/**
 * GetShowEpisodes — bir şovun bölümlerini sayfalı, aranabilir ve sıralı getirir;
 * şov meta verisini katalog + kaynak birleşimiyle zenginleştirir.
 *
 * Sayfalama, arama ve sıralama artık burada YAPILMAZ; `EpisodePageRepository`
 * portuna devredilir. Sebebi ölçek: bunları bellekte yapabilmek için önce tüm
 * listenin belleğe alınmış olması gerekir ve bu, her şov açılışında binlerce
 * bölümü indirmek demektir. Port, işi veriyi tutan tarafa (sunucu) bırakır;
 * yerel RSS kaynağı aynı sözleşmeyi bellekte karşılar.
 */
export class GetShowEpisodes
  implements UseCase<GetShowEpisodesParams, ShowEpisodesResult>
{
  constructor(
    private readonly episodes: EpisodePageRepository,
    private readonly catalog: ShowCatalogRepository,
  ) {}

  async execute(
    params: GetShowEpisodesParams,
  ): Promise<Result<ShowEpisodesResult>> {
    if (!params.feedUrl && !params.showId) {
      return fail(
        AppError.notFound('feedUrl veya showId sağlanmalı (GetShowEpisodes).'),
      );
    }

    // Sunucu şovu KİMLİKLE sorgular, RSS kaynağı ADRESLE. Çağıran taraf
    // genellikle yalnızca birini bilir; eksik olan diğerinden türetilir.
    const showId = params.showId ?? slugFromFeedUrl(params.feedUrl ?? '');

    // Katalog HER DURUMDA sorgulanır. Yalnızca `showId` verildiğinde sormak,
    // sunucu kaynağı kullanıldığında şovun adının/kapağının hiç çözülememesi
    // demekti: sunucu yalnızca bölüm döner, meta veri katalogdan gelir.
    const found = await this.catalog.getShowById(showId);
    const catalogShow: Show | undefined = found.ok ? found.value : undefined;
    const feedUrl = params.feedUrl ?? catalogShow?.feedUrl ?? '';

    const result = await this.episodes.getPage({
      showId,
      feedUrl,
      limit: params.limit ?? DEFAULT_LIMIT,
      cursor: params.cursor,
      search: params.search,
      sort: params.sort ?? 'newest',
    });
    if (!result.ok) {
      return result;
    }

    // Kaynak meta veri biliyorsa (RSS) o önceliklidir — feed her zaman en
    // günceldir; bilmiyorsa katalog tek başına yeterlidir.
    const show = result.value.show
      ? mergeShow(result.value.show, catalogShow)
      : catalogShow;

    if (!show) {
      return fail(AppError.notFound('Şov bulunamadı'));
    }

    return ok({ show, episodes: result.value.page });
  }
}

/**
 * Feed adresinden şov kimliği türetir.
 *
 * Kural SUNUCUDAKİYLE birebir aynıdır; ayrışsalardı istemcinin sorduğu şov
 * sunucudakiyle eşleşmezdi.
 */
const slugFromFeedUrl = (feedUrl: string): string => {
  const withoutQuery = feedUrl.split('?')[0].replace(/\/+$/, '');
  return withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
};
