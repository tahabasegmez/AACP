import { Result } from '@core/error';

/**
 * FollowRepository — kullanıcının takip ettiği şovları saklar.
 *
 * PORT. İlk implementasyon YERELDE tutar (KeyValueStorage). İleride sunucu/hesap
 * senkronu gelirse yalnızca implementasyon değişir; use case'ler ve UI aynı kalır.
 * Bu yüzden arayüz kasıtlı olarak "nerede saklandığından" bağımsızdır.
 */
export interface FollowRepository {
  /** Takip edilen şov id'leri (slug). */
  getFollowedIds(): Promise<Result<readonly string[]>>;
  isFollowed(showId: string): Promise<Result<boolean>>;
  /** Takip durumunu tersine çevirir; yeni durumu (takipte mi) döner. */
  toggle(showId: string): Promise<Result<boolean>>;
}
