import { RefObject, useEffect, useRef } from 'react';

/**
 * Listenin başa sarılabilmesi için gereken en dar yüzey.
 *
 * FlashList tipine bağlanmak yerine yalnızca kullandığımız metot tanımlanır;
 * `ui` katmanı liste kütüphanesini tanımak zorunda kalmaz.
 */
export interface ScrollableToOffset {
  scrollToOffset(params: { offset: number; animated?: boolean }): void;
}

/**
 * Verilen değer değiştiğinde listeyi başa sarar.
 *
 * NEDEN GEREKLİ: arama terimi değiştiğinde liste TÜMÜYLE başka bir listeye
 * dönüşür. FlashList v2 varsayılan olarak görünür öğeyi sabit tutmaya çalışır
 * (`maintainVisibleContentPosition`); veri baştan sona değiştiğinde bu,
 * ekrandaki öğeyi yeni listedeki karşılığında aramaya ve oraya atlamaya yol
 * açar — kullanıcı arama kutusunu temizlediğinde liste bir anda çok aşağı
 * kayar. Sabitlemeyi kapatmak sıçramayı önler, başa sarmak ise sonucun
 * beklenen yerden (baştan) başlamasını sağlar.
 *
 * Sarma ANİMASYONSUZDUR: yeni bir listeye geçiş bir "kaydırma" değildir,
 * animasyon burada hareketi olduğundan uzun gösterirdi.
 */
export const useScrollToTopOnChange = <T extends ScrollableToOffset>(
  value: unknown,
): RefObject<T | null> => {
  const ref = useRef<T | null>(null);
  const previous = useRef(value);

  useEffect(() => {
    // İlk render'da sarma yapılmaz; liste zaten baştadır.
    if (previous.current === value) {
      return;
    }
    previous.current = value;
    ref.current?.scrollToOffset({ offset: 0, animated: false });
  }, [value]);

  return ref;
};
