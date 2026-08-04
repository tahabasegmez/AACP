import { Logger } from '@core/logger';
import { Result } from '@core/error';
import {
  EpisodePageQuery,
  EpisodePageRepository,
  EpisodePageResult,
} from '@domain/repositories';

/**
 * İmleci üreten kaynağın etiketi.
 *
 * İmlecin biçimi kaynağa özgüdür: sunucu sıralama anahtarını taşır, yerel RSS
 * kaynağı listedeki konumu. Etiket olmasaydı ikinci sayfa, ilk sayfayı
 * üretenden BAŞKA bir kaynağa gidebilir ve imleç orada anlamsız olurdu.
 */
type Source = 'p' | 'f';

const SEPARATOR = ':';

/**
 * FallbackEpisodePageRepository — önce sunucu, olmazsa RSS.
 *
 * Aynı portun iki implementasyonunu sıraya dizen bir SARMALAYICIDIR; kendi
 * başına veri kaynağı değildir. Böylece "hangi kaynak" kararı tek yerde durur
 * ve use case iki kaynağın varlığından habersiz kalır.
 *
 * **Bir liste başladığı kaynakta devam eder.** Yedeğe yalnızca ilk sayfada
 * düşülür; sonraki sayfalar imlecin etiketine bakarak aynı kaynağa gider.
 * Kaynak ortada değişseydi imleç karşı tarafta anlamsız olur, "daha fazla
 * yükle" kırılırdı.
 */
export class FallbackEpisodePageRepository implements EpisodePageRepository {
  constructor(
    private readonly primary: EpisodePageRepository,
    private readonly fallback: EpisodePageRepository,
    private readonly logger: Logger,
  ) {}

  async getPage(query: EpisodePageQuery): Promise<Result<EpisodePageResult>> {
    const tagged = read(query.cursor);

    // Devam eden sayfa: ilk sayfayı hangi kaynak ürettiyse ona gidilir.
    if (tagged) {
      return this.from(
        tagged.source,
        { ...query, cursor: tagged.cursor },
        tagged.source,
      );
    }

    const primary = await this.from('p', { ...query, cursor: undefined }, 'p');
    if (primary.ok) {
      return primary;
    }

    this.logger.warn('Bölümler sunucudan alınamadı, RSS yedeğine düşülüyor', {
      showId: query.showId,
      // Sebep loglanır: yapılandırma eksikliği (ör. şema göçü yapılmamış)
      // yedek sayesinde SESSİZCE gizlenirdi.
      reason: primary.error.message,
    });
    return this.from('f', { ...query, cursor: undefined }, 'f');
  }

  /** Seçilen kaynaktan sayfayı alır ve dönen imleci etiketler. */
  private async from(
    source: Source,
    query: EpisodePageQuery,
    tag: Source,
  ): Promise<Result<EpisodePageResult>> {
    const repository = source === 'p' ? this.primary : this.fallback;
    const result = await repository.getPage(query);
    if (!result.ok) {
      return result;
    }

    const { nextCursor } = result.value.page;
    return {
      ok: true,
      value: {
        ...result.value,
        page: {
          ...result.value.page,
          nextCursor: nextCursor === undefined ? undefined : write(tag, nextCursor),
        },
      },
    };
  }
}

/** İmleci kaynak etiketiyle sarar. */
const write = (source: Source, cursor: string): string =>
  `${source}${SEPARATOR}${cursor}`;

/**
 * Etiketli imleci çözer.
 *
 * Etiketsiz ya da tanınmayan imleç YOK SAYILIR (listeye baştan başlanır):
 * uydurma bir imleci kaynağa geçirmek, çözülemeyen bir hataya dönüşürdü.
 */
const read = (
  cursor: string | undefined,
): { source: Source; cursor: string } | undefined => {
  if (!cursor) {
    return undefined;
  }
  const at = cursor.indexOf(SEPARATOR);
  const source = cursor.slice(0, at);
  if (at !== 1 || (source !== 'p' && source !== 'f')) {
    return undefined;
  }
  return { source, cursor: cursor.slice(at + SEPARATOR.length) };
};
