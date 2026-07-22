import { Result } from '@core/error';
import { PlaybackProgress } from '../entities';

/**
 * PlaybackProgressRepository — bölüm dinleme konumlarını kalıcı saklar.
 *
 * PORT (arayüz). Implementasyon `data` katmanında; kalıcılık motoru (KeyValueStorage
 * → ileride MMKV) `infrastructure`'dan enjekte edilir. Domain nerede saklandığını
 * bilmez.
 */
export interface PlaybackProgressRepository {
  /** Tek bir bölümün kaydını getirir (yoksa null). */
  get(episodeId: string): Promise<Result<PlaybackProgress | null>>;

  /** Bir bölümün konumunu kaydeder/günceller. */
  save(progress: PlaybackProgress): Promise<Result<void>>;

  /** Tüm kayıtları döner ("Dinlemeye devam" listesi için). */
  getAll(): Promise<Result<readonly PlaybackProgress[]>>;

  /** Bir bölümün kaydını siler (ör. tamamlanınca temizlemek için). */
  remove(episodeId: string): Promise<Result<void>>;
}
