import { Result } from '@core/error';
import { Episode } from '../entities';

/**
 * SavedEpisodesRepository — "Sonra dinle" listesi (kaydedilen bölümler).
 *
 * PORT. Bölümün tamamı saklanır (feed çekmeden gösterilip çalınabilsin diye).
 * İlk implementasyon yereldir (KeyValueStorage); ileride hesap senkronu gelirse
 * yalnızca implementasyon değişir.
 */
export interface SavedEpisodesRepository {
  list(): Promise<Result<readonly Episode[]>>;
  isSaved(episodeId: string): Promise<Result<boolean>>;
  /** Kayıtlıysa çıkarır, değilse ekler; yeni durumu (kayıtlı mı) döner. */
  toggle(episode: Episode): Promise<Result<boolean>>;
}
