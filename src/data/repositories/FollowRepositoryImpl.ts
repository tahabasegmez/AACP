import { AppError, Result, fail, ok } from '@core/error';
import { KeyValueStorage } from '@core/ports';
import { FollowRepository } from '@domain/repositories';

const STORAGE_KEY = 'followed_shows_v1';

/**
 * FollowRepository'nin yerel implementasyonu.
 *
 * Takip edilen şov id'lerini KeyValueStorage'da bir JSON dizisi olarak tutar
 * (MMKV → kalıcı). İleride uzak senkron eklenecekse bu sınıfın yerine (ya da
 * önüne) bir RemoteFollowRepository konur; arayüz değişmez.
 */
export class FollowRepositoryImpl implements FollowRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async getFollowedIds(): Promise<Result<readonly string[]>> {
    try {
      return ok(this.read());
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async isFollowed(showId: string): Promise<Result<boolean>> {
    try {
      return ok(this.read().includes(showId));
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async toggle(showId: string): Promise<Result<boolean>> {
    try {
      const set = new Set(this.read());
      const nowFollowed = !set.has(showId);
      if (nowFollowed) {
        set.add(showId);
      } else {
        set.delete(showId);
      }
      this.write([...set]);
      return ok(nowFollowed);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  private read(): string[] {
    const raw = this.storage.getString(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  }

  private write(ids: string[]): void {
    this.storage.set(STORAGE_KEY, JSON.stringify(ids));
  }
}
