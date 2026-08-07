import { Result, ok } from '@core/error';
import { PlaybackProgress } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { NoParamUseCase } from '../UseCase';

/**
 * GetResumeList — "Dinlemeye devam" listesi: yarıda bırakılmış (tamamlanmamış)
 * bölümlerin konum kayıtları, en son dinlenen en üstte.
 *
 * Ana ekranda bir "kaldığın yerden devam et" satırı için kullanılır.
 */
export class GetResumeList implements NoParamUseCase<readonly PlaybackProgress[]> {
  constructor(private readonly repo: PlaybackProgressRepository) {}

  async execute(): Promise<Result<readonly PlaybackProgress[]>> {
    const result = await this.repo.getAll();
    if (!result.ok) {
      return result;
    }
    const open = result.value.filter(p => !p.completed && p.positionSec > 0);
    return ok(dedupeByEpisode(open));
  }
}

/**
 * Bölüm başına TEK kayıt bırakır (en yeni damgalı kazanır).
 *
 * İki ayrı anahtarla ayıklanır ve ikisi de gereklidir:
 *
 *  1. **Bölüm kimliği** — depoda kayıtlar kimliğe göre tutulur, ama
 *     senkronizasyonla gelen veri geçmişte farklı bir anahtarla yazılmış
 *     olabilir.
 *  2. **Şov + başlık** — kullanıcıya AYNI görünen iki kayıt. Bir dönem kayıtlar
 *     yanlış meta ile yazılabiliyordu (bir bölümün kaydı başka bir bölümün
 *     başlığını alıyordu, bkz. progressRecord); sebep düzeltildi ama cihazda
 *     kalmış eski kayıtlar hâlâ çift görünürdü. Bu ayıklama onları da toplar.
 *
 * Aynı bölümün listede iki kez görünmesi her yüzeyde (telefon, CarPlay)
 * hatalıdır; bu yüzden ayıklama tek noktada — use case'te — yapılır.
 */
const dedupeByEpisode = (
  items: readonly PlaybackProgress[],
): readonly PlaybackProgress[] =>
  // Sıra önemli: önce kimlikler tekilleşir, sonra kalanlar başlığa göre.
  // Tek turda iki anahtarla ayıklamak, bir kaydın bir anahtar altında
  // değişip diğerinde kalmasına ve ikisinin birden dönmesine yol açardı.
  collapse(collapse(items, item => `id:${item.episodeId}`), displayKey);

/**
 * Kullanıcıya AYNI görünen kayıtların anahtarı: şov + bölüm başlığı.
 *
 * İkisinden biri bilinmiyorsa kayıt kendi kimliğine düşer — başlıksız kayıtlar
 * birbirine karışmamalı.
 */
const displayKey = (item: PlaybackProgress): string =>
  item.showId && item.episodeTitle
    ? `title:${item.showId} ${item.episodeTitle}`
    : `id:${item.episodeId}`;

/** Anahtar başına en yeni damgalı kaydı bırakır; giriş sırasını korur. */
const collapse = (
  items: readonly PlaybackProgress[],
  keyOf: (item: PlaybackProgress) => string,
): readonly PlaybackProgress[] => {
  const newest = new Map<string, PlaybackProgress>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = newest.get(key);
    if (!existing || existing.updatedAt.localeCompare(item.updatedAt) < 0) {
      newest.set(key, item);
    }
  }
  return [...newest.values()];
};
