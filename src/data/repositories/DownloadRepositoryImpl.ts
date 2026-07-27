import { AppError, Result, fail, ok } from '@core/error';
import { Downloader, KeyValueStorage } from '@core/ports';
import { DownloadItem, Episode } from '@domain/entities';
import { DownloadRepository } from '@domain/repositories';

const STORAGE_KEY = 'downloads_v1';

/** episodeId'den güvenli bir dosya adı üretir. */
const safeName = (episodeId: string): string =>
  `${episodeId.replace(/[^a-zA-Z0-9-]/g, '_')}.mp3`;

/** Bir yolun son parçasını (dosya adı) verir. */
const baseName = (path: string): string => path.split('/').pop() ?? path;

/**
 * DownloadRepository'nin somut implementasyonu.
 *
 * Dosyayı `Downloader` (blob-util) ile indirir; kaydı (durum + dosya adı + meta)
 * `KeyValueStorage` (MMKV) içinde bir JSON haritada tutar. İki teknik bağımlılık
 * da port arkasında — motor/depolama değişse bu sınıf değişmez.
 *
 * DAYANIKLILIK — iki kural:
 *
 * 1. **Mutlak yol SAKLANMAZ, yalnızca dosya adı.** iOS'ta Documents dizini bir
 *    container UUID'si içerir ve bu UUID yeniden kurulumda değişir; saklanan
 *    mutlak yol bir sonraki kurulumda geçersiz olur. Tam yol her okumada güncel
 *    dizinle birleştirilir.
 *
 * 2. **Dosyası olmayan kayıt "indirilmiş" sayılmaz.** Listeleme sırasında
 *    dosyanın gerçekten var olduğu doğrulanır; yoksa kayıt temizlenir. Böylece
 *    kullanıcıya çalmayacak bir bölüm gösterilmez.
 */
export class DownloadRepositoryImpl implements DownloadRepository {
  constructor(
    private readonly downloader: Downloader,
    private readonly storage: KeyValueStorage,
  ) {}

  async get(episodeId: string): Promise<Result<DownloadItem | null>> {
    try {
      const raw = this.readAll()[episodeId];
      if (!raw) {
        return ok(null);
      }
      const [item] = await this.verify([raw]);
      return ok(item ?? null);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async list(): Promise<Result<readonly DownloadItem[]>> {
    try {
      return ok(await this.verify(Object.values(this.readAll())));
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async download(episode: Episode): Promise<Result<DownloadItem>> {
    try {
      const fileName = safeName(episode.id);
      const destPath = `${this.downloader.downloadsDir()}/${fileName}`;

      // Aynı bölüm daha önce yarım indirilmişse üstüne yazılır; eski dosyayı
      // temizlemek indirme motorunun kısmi dosyayla karışmasını önler.
      await this.downloader.remove(destPath).catch(() => undefined);
      await this.downloader.download(episode.audioUrl, destPath);

      const item: DownloadItem = {
        episodeId: episode.id,
        status: 'downloaded',
        fileName,
        localPath: destPath,
        // Uzak adres saklanır: indirme silinse bile bölüm çalınabilir/yeniden
        // indirilebilir.
        audioUrl: episode.audioUrl,
        episodeTitle: episode.title,
        showId: episode.showId,
        artworkUrl: episode.imageUrl,
        durationSec: episode.durationSec,
        publishedAt: episode.publishedAt,
      };

      const map = this.readAll();
      // Depoya yalnızca göreli ad yazılır (localPath türetilmiş bir alandır).
      map[episode.id] = this.toStored(item);
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
      const path = this.resolvePath(item);
      if (path) {
        // Dosya zaten yoksa da sorun değil; kayıt her hâlükârda silinir.
        await this.downloader.remove(path).catch(() => undefined);
      }
      delete map[episodeId];
      this.writeAll(map);
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  /**
   * Kayıtları güncel dizine çözer ve dosyası olmayanları eler.
   *
   * "İndiriliyor" durumundaki kayıtlar dokunulmadan geçirilir (dosya henüz
   * oluşmamış olabilir). Kaybolan dosyaların kaydı kalıcı olarak temizlenir ki
   * liste gerçeği yansıtsın.
   */
  private async verify(items: readonly DownloadItem[]): Promise<DownloadItem[]> {
    const out: DownloadItem[] = [];
    const missing: string[] = [];

    for (const item of items) {
      if (item.status === 'downloading') {
        out.push(item);
        continue;
      }

      const path = this.resolvePath(item);
      if (path && (await this.downloader.exists(path))) {
        out.push({ ...item, localPath: path });
      } else {
        missing.push(item.episodeId);
      }
    }

    if (missing.length > 0) {
      const map = this.readAll();
      missing.forEach(id => delete map[id]);
      this.writeAll(map);
    }
    return out;
  }

  /**
   * Kaydın güncel tam yolunu üretir.
   * Eski kayıtlarda yalnızca mutlak `localPath` bulunabilir; bu durumda dosya
   * adı ondan çıkarılır (geriye dönük uyum — göç ayrı bir adım gerektirmez).
   */
  private resolvePath(item: DownloadItem | undefined): string | undefined {
    if (!item) {
      return undefined;
    }
    const name = item.fileName ?? (item.localPath ? baseName(item.localPath) : undefined);
    return name ? `${this.downloader.downloadsDir()}/${name}` : undefined;
  }

  /** Depoya yazılacak biçim — türetilebilir `localPath` saklanmaz. */
  private toStored(item: DownloadItem): DownloadItem {
    const stored: Record<string, unknown> = { ...item };
    delete stored.localPath;
    return stored as unknown as DownloadItem;
  }

  private readAll(): Record<string, DownloadItem> {
    const raw = this.storage.getString(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, DownloadItem>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {}; // bozuk kayıt tüm indirmeleri düşürmesin
    }
  }

  private writeAll(map: Record<string, DownloadItem>): void {
    this.storage.set(STORAGE_KEY, JSON.stringify(map));
  }
}
