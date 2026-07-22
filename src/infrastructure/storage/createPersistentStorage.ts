import { Logger } from '@core/logger';
import { KeyValueStorage } from '@core/ports';
import { InMemoryKeyValueStorage } from './KeyValueStorage';
import { MmkvKeyValueStorage } from './MmkvKeyValueStorage';

/**
 * createPersistentStorage — ortam için uygun KeyValueStorage'ı seçer.
 *
 * Cihazda (iOS/Android) MMKV ile KALICI depolama döner. MMKV başlatılamazsa
 * (ör. native modül henüz yok, testler, geliştirme ortamı) bellek-içi bir
 * implementasyona güvenle düşer — uygulama çökmemeli, sadece kalıcılık olmaz.
 *
 * Bu factory sayesinde çağıran kod (composeDependencies) hangi motorun
 * kullanıldığını bilmeden tek bir `KeyValueStorage` alır.
 */
export const createPersistentStorage = (logger?: Logger): KeyValueStorage => {
  try {
    return new MmkvKeyValueStorage();
  } catch (error) {
    logger?.warn(
      'MMKV başlatılamadı; bellek-içi depolamaya düşülüyor (veriler kalıcı olmayacak).',
      error,
    );
    return new InMemoryKeyValueStorage();
  }
};
