import { AppError, Result, fail, ok } from '@core/error';
import { Episode } from '@domain/entities';
import {
  EpisodePageQuery,
  EpisodePageRepository,
  EpisodePageResult,
} from '@domain/repositories';

/** Sunucudan dönen tek bölüm. */
interface EpisodeDto {
  readonly id?: string;
  readonly showId?: string;
  readonly title?: string;
  readonly description?: string;
  readonly audioUrl?: string;
  readonly imageUrl?: string;
  readonly durationSec?: number;
  readonly publishedAt?: string;
}

interface EpisodePageDto {
  readonly items?: readonly EpisodeDto[];
  readonly nextCursor?: string;
}

/** Bu deponun ihtiyaç duyduğu API yüzeyi (bağımlılığı daraltır). */
export interface EpisodeApi {
  readonly enabled: boolean;
  get<T>(path: string): Promise<T | undefined>;
}

/**
 * ApiEpisodePageRepository — bölümleri KENDİ SUNUCUMUZDAN sayfa sayfa çeker.
 *
 * Varsayılan kaynak budur. Yayıncının RSS'ini her şov açılışında indirmek,
 * tek şovda 4 MB'a varan bir aktarım demekti; kullanıcı sayısıyla çarpıldığında
 * ne yayıncının bant genişliğine ne kullanıcının veri paketine sığar.
 *
 * Sayfalama İMLEÇLİDİR ve imlecin içeriği burada YORUMLANMAZ: sunucu ne
 * verdiyse bir sonraki istekte aynen geri gönderilir. Böylece sıralama
 * anahtarı sunucuda değiştiğinde istemci güncellenmek zorunda kalmaz.
 */
export class ApiEpisodePageRepository implements EpisodePageRepository {
  constructor(private readonly api: EpisodeApi) {}

  async getPage(query: EpisodePageQuery): Promise<Result<EpisodePageResult>> {
    if (!this.api.enabled) {
      return fail(AppError.validation('Sunucu yapılandırılmadı'));
    }

    try {
      const dto = await this.api.get<EpisodePageDto>(
        `/v1/catalog/shows/${encodeURIComponent(query.showId)}/episodes${search(query)}`,
      );
      if (!dto?.items) {
        return fail(AppError.network('Bölümler alınamadı'));
      }

      return ok({
        page: {
          items: dto.items
            .map(item => toEpisode(item, query.showId))
            .filter((episode): episode is Episode => episode !== null),
          nextCursor: dto.nextCursor,
        },
      });
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }
}

/** Sorgu dizesini kurar; boş alanlar hiç gönderilmez. */
const search = (query: EpisodePageQuery): string => {
  const params = new URLSearchParams({
    limit: String(query.limit),
    sort: query.sort === 'oldest' ? 'oldest' : 'newest',
  });
  if (query.cursor) {
    params.set('cursor', query.cursor);
  }
  if (query.search) {
    params.set('search', query.search);
  }
  return `?${params.toString()}`;
};

/**
 * DTO'yu domain nesnesine çevirir.
 *
 * Çalınamayan kayıt (ses adresi yok) ATLANIR — listede yer tutup dokunulunca
 * hiçbir şey yapmayan bir satır, hatadan daha kötüdür.
 */
const toEpisode = (dto: EpisodeDto, showId: string): Episode | null => {
  if (!dto.id || !dto.audioUrl) {
    return null;
  }
  return {
    id: dto.id,
    showId: dto.showId ?? showId,
    title: dto.title ?? 'İsimsiz bölüm',
    description: dto.description ?? '',
    audioUrl: dto.audioUrl,
    imageUrl: dto.imageUrl,
    durationSec: dto.durationSec ?? 0,
    publishedAt: dto.publishedAt ?? '',
  };
};
