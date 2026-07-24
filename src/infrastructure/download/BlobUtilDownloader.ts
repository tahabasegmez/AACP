import { AppError } from '@core/error';
import { Downloader } from '@core/ports';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * Downloader portunun react-native-blob-util implementasyonu.
 *
 * Dosyaları uygulamanın Documents dizini altındaki `aacp_downloads/` klasörüne
 * indirir. Sürdürülebilirlik: indirme motoru yalnızca burada import edilir;
 * değiştirmek gerekirse tek dosya yeter.
 */
export class BlobUtilDownloader implements Downloader {
  private readonly dir = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/aacp_downloads`;

  downloadsDir(): string {
    return this.dir;
  }

  async download(
    url: string,
    destPath: string,
    onProgress?: (fraction: number) => void,
  ): Promise<void> {
    try {
      if (!(await ReactNativeBlobUtil.fs.isDir(this.dir))) {
        await ReactNativeBlobUtil.fs.mkdir(this.dir);
      }
      const task = ReactNativeBlobUtil.config({ path: destPath, fileCache: true }).fetch(
        'GET',
        url,
      );
      if (onProgress) {
        task.progress((received, total) => {
          const r = Number(received);
          const t = Number(total);
          onProgress(t > 0 ? Math.min(1, r / t) : 0);
        });
      }
      await task;
    } catch (error) {
      throw AppError.from(error, 'STORAGE');
    }
  }

  async remove(path: string): Promise<void> {
    if (await this.exists(path)) {
      await ReactNativeBlobUtil.fs.unlink(path);
    }
  }

  async exists(path: string): Promise<boolean> {
    return ReactNativeBlobUtil.fs.exists(path);
  }
}
