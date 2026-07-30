import { ConsoleLogger } from '@core/logger';
import { CarPlayController } from '@carplay';
import { CarPlay } from 'react-native-carplay';
import { getDependencies } from '../di';
import { PlayerQueueAdapter } from './PlayerQueueAdapter';

/**
 * registerCarPlay — CarPlay sahnesini paylaşılan bağımlılık grafiğine bağlar.
 *
 * app katmanında (composition root) durur çünkü hem `@carplay`'i hem paylaşılan
 * `getDependencies()`'i bilmesi gerekir; `carplay` katmanı bunları bilmez (saf kalır).
 * index.js'de yalnızca iOS'ta çağrılır.
 */
export const registerCarPlay = (): void => {
  const controller = new CarPlayController(
    { ...getDependencies(), playbackQueue: new PlayerQueueAdapter() },
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
