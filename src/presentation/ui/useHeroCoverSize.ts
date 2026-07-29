import { useWindowDimensions } from 'react-native';

/** Kapağın kullanıldığı bağlam — ölçü buna göre belirlenir. */
export type HeroCoverVariant = 'player' | 'detail';

/**
 * useHeroCoverSize — büyük kapak görselleri için ORTAK ölçü kaynağı.
 *
 * Boyut ekran genişliğine göre hesaplanır (küçük telefonlarda taşmaz) ve bir
 * üst sınırla kapatılır (tabletlerde orantısız büyümez).
 *
 * İki bağlam vardır çünkü ihtiyaçları farklıdır:
 *  - **player**: kapak ekranın kahramanıdır, olabildiğince büyük durur,
 *  - **detail**: kapağın yanında başlık/açıklama ve aksiyonlar yer alır,
 *    bu yüzden daha ölçülüdür.
 *
 * Tek yerde tanımlıdır; ölçü değişecekse yalnızca burası düzenlenir.
 */
export const useHeroCoverSize = (variant: HeroCoverVariant = 'detail'): number => {
  const { width } = useWindowDimensions();
  const ratio = variant === 'player' ? 0.78 : 0.62;
  const max = variant === 'player' ? 340 : 260;
  return Math.round(Math.min(width * ratio, max));
};
