import { AppError, Result, fail, ok } from '@core/error';
import { KeyValueStorage } from '@core/ports';
import { Episode } from '@domain/entities';
import { SavedEpisodesRepository } from '@domain/repositories';

const STORAGE_KEY = 'saved_episodes_v1';

/**
 * SavedEpisodesRepository'nin yerel implementasyonu (KeyValueStorage → MMKV).
 * Bölümleri ekleme sırasına göre (en yeni eklenen en üstte) tutar.
 */
export class SavedEpisodesRepositoryImpl implements SavedEpisodesRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async list(): Promise<Result<readonly Episode[]>> {
    try {
      return ok(this.read());
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async isSaved(episodeId: string): Promise<Result<boolean>> {
    try {
      return ok(this.read().some(e => e.id === episodeId));
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async toggle(episode: Episode): Promise<Result<boolean>> {
    try {
      const current = this.read();
      const exists = current.some(e => e.id === episode.id);
      const next = exists
        ? current.filter(e => e.id !== episode.id)
        : [episode, ...current];
      this.write(next);
      return ok(!exists);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  private read(): Episode[] {
    const raw = this.storage.getString(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Episode[]) : [];
  }

  private write(episodes: Episode[]): void {
    this.storage.set(STORAGE_KEY, JSON.stringify(episodes));
  }
}
