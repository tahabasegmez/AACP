import { spacing } from '../theme/tokens';

/**
 * Başlık (header) ölçüleri — TEK kaynak.
 *
 * Ana sayfanın logolu başlığı ile Ara/Kütüphane'nin metin başlığı AYNI dikey
 * ölçüleri kullanır; böylece sekmeler arasında geçerken başlığın alt hizası
 * zıplamaz. Bir ölçü değişecekse yalnızca burada değişir.
 */
export const headerMetrics = {
  /** İçerik satırının en az yüksekliği (dokunma hedefi + hizalama). */
  minHeight: 44,
  /** Güvenli alandan sonra üstte bırakılan boşluk. */
  paddingTop: spacing(1),
  /** Başlığın altındaki boşluk. */
  paddingBottom: spacing(1),
  /** Yatay kenar boşluğu. */
  paddingHorizontal: spacing(2),
} as const;
