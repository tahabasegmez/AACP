import { useWindowDimensions } from 'react-native';

/**
 * useHeroCoverSize — Player ve şov detayındaki büyük kapak için ORTAK boyut.
 * İki ekran da aynı hook'u kullanır → kapak boyutları eşit olur.
 */
export const useHeroCoverSize = (): number => {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width * 0.62, 260));
};
