import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

/**
 * Tip güvenli navigasyon erişimi. İç içe (sekme içindeki) ekranlar da kök stack'e
 * (ShowDetail/Player/SeeAll) bu hook ile gider.
 */
export const useAppNavigation = () =>
  useNavigation<NativeStackNavigationProp<RootStackParamList>>();
