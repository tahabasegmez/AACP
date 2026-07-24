import { AppError, Result, fail, ok } from '@core/error';
import { Downloader, KeyValueStorage } from '@core/ports';
import { DownloadItem, Episode } from '@domain/entities';
import { DownloadRepository } from '@domain/repositories';

const STORAGE_KEY = 'downloads_v1';

/** episodeId'den güvenli bir dosya adı üretir. */
const safeName = (episodeId: string): string =>
  `${episodeId.replace(/[^a-zA-Z0-9-]/g, '_')}.mp3`;

/**
 * DownloadRepository'nin somut implementasyonu.
 *
 * Dosyayı `Downloader` (blob-util) ile indirir; kaydı (durum + yerel yol + meta)
 * `KeyValueStorage` (MMKV) içinde bir JSON haritada tutar. İki teknik bağımlılık
 * da port arkasında — motor/depolama değişse bu sınıf değişmez.
 */
export class DownloadRepositoryImpl implements DownloadRepository {
  constructor(
    private readonly downloader: Downloader,
    private readonly storage: KeyValueStorage,
  ) {}

  async get(episodeId: string): Promise<Result<DownloadItem | null>> {
    try {
      return ok(this.readAll()[episodeId] ?? null);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async list(): Promise<Result<readonly DownloadItem[]>> {
    try {
      return ok(Object.values(this.readAll()));
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async download(episode: Episode): Promise<Result<DownloadItem>> {
    try {
      const destPath = `${this.downloader.downloadsDir()}/${safeName(episode.id)}`;
      await this.downloader.download(episode.audioUrl, destPath);

      const item: DownloadItem = {
        episodeId: episode.id,
        status: 'downloaded',
        localPath: destPath,
        episodeTitle: episode.title,
        showId: episode.showId,
        artworkUrl: episode.imageUrl,
        durationSec: episode.durationSec,
        publishedAt: episode.publishedAt,
      };
      const map = this.readAll();
      map[episode.id] = item;
      this.writeAll(map);
      return ok(item);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async remove(episodeId: string): Promise<Result<void>> {
    try {
      const map = this.readAll();
      const item = map[episodeId];
      if (item?.localPath) {
        await this.downloader.remove(item.localPath);
      }
      delete map[episodeId];
      this.writeAll(map);
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  private readAll(): Record<string, DownloadItem> {
    const raw = this.storage.getString(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, DownloadItem>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  private writeAll(map: Record<string, DownloadItem>): void {
    this.storage.set(STORAGE_KEY, JSON.stringify(map));
  }
}
