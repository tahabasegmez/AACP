import { AppError, Result, fail, ok } from '@core/error';
import { KeyValueStorage } from '@core/ports';
import { PlaybackProgress } from '@domain/entities';
import { PlaybackProgressRepository } from '@domain/repositories';

/** Tüm ilerleme kayıtlarının tutulduğu storage anahtarı. */
const STORAGE_KEY = 'playback_progress_v1';

/**
 * PlaybackProgressRepository'nin somut implementasyonu.
 *
 * Kayıtları tek bir JSON nesnesinde (episodeId → PlaybackProgress) saklar ve
 * kalıcılığı `KeyValueStorage` portu üzerinden yapar. Bugün bellek-içi bir
 * storage ile çalışır; `infrastructure` MMKV implementasyonuna geçince kayıtlar
 * uygulama yeniden açılınca da korunur — bu sınıf değişmez.
 */
export class PlaybackProgressRepositoryImpl
  implements PlaybackProgressRepository
{
  constructor(private readonly storage: KeyValueStorage) {}

  async get(episodeId: string): Promise<Result<PlaybackProgress | null>> {
    try {
      return ok(this.readAll()[episodeId] ?? null);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async getAll(): Promise<Result<readonly PlaybackProgress[]>> {
    try {
      // En son güncellenen en üstte ("Dinlemeye devam" sıralaması).
      const all = Object.values(this.readAll()).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      return ok(all);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async save(progress: PlaybackProgress): Promise<Result<void>> {
    try {
      const map = this.readAll();
      map[progress.episodeId] = progress;
      this.writeAll(map);
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async remove(episodeId: string): Promise<Result<void>> {
    try {
      const map = this.readAll();
      delete map[episodeId];
      this.writeAll(map);
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  private readAll(): Record<string, PlaybackProgress> {
    const raw = this.storage.getString(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, PlaybackProgress>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  private writeAll(map: Record<string, PlaybackProgress>): void {
    this.storage.set(STORAGE_KEY, JSON.stringify(map));
  }
}
