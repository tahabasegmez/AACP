import { ConsoleLogger } from '@core/logger';
import { CarPlayController } from '@carplay';
import { BlobUtilArtworkCache } from '@infrastructure';
import { CarPlay } from 'react-native-carplay';
import { getDependencies } from '../di';
import { PlaybackSessionAdapter } from './PlaybackSessionAdapter';

/**
 * registerCarPlay — CarPlay sahnesini paylaşılan bağımlılık grafiğine bağlar.
 *
 * app katmanında (composition root) durur çünkü hem `@carplay`'i hem paylaşılan
 * `getDependencies()`'i bilmesi gerekir; `carplay` katmanı bunları bilmez (saf kalır).
 * index.js'de yalnızca iOS'ta çağrılır.
 */
export const registerCarPlay = (): void => {
  const controller = new CarPlayController(
    {
      ...getDependencies(),
      playbackSession: new PlaybackSessionAdapter(),
      // Kapaklar CarPlay'e yerel dosya olarak verilmeli (uzak adres kabul
      // edilmez); önbellek yalnızca araç yüzeyinde kullanılır.
      artwork: new BlobUtilArtworkCache(),
    },
    new ConsoleLogger('CarPlay'),
  );
  CarPlay.registerOnConnect(() => {
    controller.onConnect().catch(() => {
      /* onConnect kendi içinde loglar; burada yutuyoruz */
    });
  });
  CarPlay.registerOnDisconnect(() => {
    controller.onDisconnect();
  });
};
