import { ArtworkCache } from '@core/ports';
import ReactNativeBlobUtil from 'react-native-blob-util';

/** Bilinen görsel uzantıları — bilinmiyorsa `.jpg` varsayılır. */
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * ArtworkCache portunun react-native-blob-util implementasyonu.
 *
 * Görseller **önbellek dizinine** yazılır: kaybolmaları sorun değildir (yeniden
 * indirilir) ve iOS yer sıkıştığında kendisi temizleyebilir. İndirilenlerin
 * aksine kullanıcı verisi değildir, bu yüzden Documents'a konmaz.
 *
 * Aynı adres için eşzamanlı istekler TEK indirmede birleşir; araçta bir liste
 * tazelendiğinde aynı kapak defalarca indirilmesin.
 */
export class BlobUtilArtworkCache implements ArtworkCache {
  private readonly dir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/aacp_artwork`;
  private readonly inFlight = new Map<string, Promise<string | undefined>>();

  async localUri(remoteUrl: string): Promise<string | undefined> {
    if (!remoteUrl) {
      return undefined;
    }
    // Zaten yerel bir adresse indirmeye gerek yok.
    if (remoteUrl.startsWith('file://') || remoteUrl.startsWith('/')) {
      return remoteUrl.startsWith('file://') ? remoteUrl : `file://${remoteUrl}`;
    }

    const existing = this.inFlight.get(remoteUrl);
    if (existing) {
      return existing;
    }

    const task = this.fetch(remoteUrl).finally(() => this.inFlight.delete(remoteUrl));
    this.inFlight.set(remoteUrl, task);
    return task;
  }

  private async fetch(remoteUrl: string): Promise<string | undefined> {
    const path = `${this.dir}/${fileNameFor(remoteUrl)}`;
    try {
      if (await ReactNativeBlobUtil.fs.exists(path)) {
        return `file://${path}`;
      }
      if (!(await ReactNativeBlobUtil.fs.isDir(this.dir))) {
        await ReactNativeBlobUtil.fs.mkdir(this.dir);
      }
      await ReactNativeBlobUtil.config({ path }).fetch('GET', remoteUrl);
      return `file://${path}`;
    } catch {
      // Kapak indirilemedi: liste kapaksız devam etsin.
      return undefined;
    }
  }
}

/** Adresten kararlı bir dosya adı üretir (aynı adres → aynı dosya). */
const fileNameFor = (url: string): string => {
  const extension = EXTENSIONS.find(ext => url.toLowerCase().includes(ext)) ?? '.jpg';
  return `${hash(url)}${extension}`;
};

/**
 * FNV-1a — kısa, bağımlılıksız ve çakışması pratikte önemsiz bir özet.
 * Kriptografik amaç yok: tek iş dosya adı üretmek.
 */
const hash = (value: string): string => {
  let result = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result.toString(16).padStart(8, '0');
};
