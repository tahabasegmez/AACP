import { useEffect } from 'react';
import { Linking } from 'react-native';
import { parseShareUrl } from '@domain/entities';
import { openShareTarget } from './navigationRef';

/**
 * useDeepLinks — paylaşılan bir bağlantıyla açılan uygulamayı doğru ekrana taşır.
 *
 * İki giriş vardır ve ikisi de karşılanır:
 *  - uygulama KAPALIYKEN tıklanan bağlantı (`getInitialURL`),
 *  - uygulama AÇIKKEN gelen bağlantı (`url` olayı).
 *
 * Adresin çözümü `parseShareUrl`'e (domain) aittir; burada yalnızca platform
 * olayları dinlenir. Böylece bağlantı biçimi tek yerde tanımlı kalır ve
 * paylaşma ile açma birbirinden ayrışmaz.
 */
export const useDeepLinks = (): void => {
  useEffect(() => {
    let cancelled = false;

    const handle = (url: string | null): void => {
      if (cancelled || !url) {
        return;
      }
      const target = parseShareUrl(url);
      if (target) {
        openShareTarget(target);
      }
    };

    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', event => handle(event.url));

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
};
