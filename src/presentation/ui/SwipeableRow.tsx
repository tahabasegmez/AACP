import React, { useRef } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

/** Eylemin tetiklenmesi için gereken yatay mesafe (px). */
const ACTION_THRESHOLD = 96;
/** Kaydırmanın gidebileceği en fazla mesafe. */
const MAX_TRANSLATE = 140;
/** Bu eğimden dikeyse jest listeye bırakılır (kaydırma listesi bozulmasın). */
const HORIZONTAL_BIAS = 1.6;

export interface SwipeAction {
  readonly icon: IconName;
  readonly label: string;
  readonly color: string;
  readonly onTrigger: () => void;
}

/**
 * SwipeableRow — bir satırı yatay kaydırarak eylem tetikleyen sarmalayıcı.
 *
 * Sağa kaydırmada `right`, sola kaydırmada `left` eylemi çalışır. Eşiği aşan
 * kaydırma bırakıldığında eylem tetiklenir; aşmayan kaydırma geri yaylanır.
 * Arkadaki eylem alanı, kaydırma yönüne göre renk ve simgeyle belirir.
 *
 * Saf React Native (Animated + PanResponder) ile yazılmıştır; listelerin dikey
 * kaydırmasını engellememek için jest yalnızca belirgin şekilde YATAY
 * hareketlerde üstlenilir.
 *
 * TEK yerde tanımlıdır: bölüm satırları (şov, liste, arama sonuçları) aynı
 * bileşeni kullanır, davranış her yerde aynıdır.
 */
export const SwipeableRow: React.FC<{
  children: React.ReactNode;
  /** Sağa kaydırınca çalışan eylem. */
  right?: SwipeAction;
  /** Sola kaydırınca çalışan eylem. */
  left?: SwipeAction;
}> = ({ children, right, left }) => {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  // Hangi yönde kaydırıldığını render için tutar (arka plan rengi/simgesi).
  const [direction, setDirection] = React.useState<'right' | 'left' | null>(null);

  const springBack = (): void => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => setDirection(null));
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        // Yalnızca belirgin yatay hareketlerde devral.
        if (Math.abs(g.dx) < 12 || Math.abs(g.dx) < Math.abs(g.dy) * HORIZONTAL_BIAS) {
          return false;
        }
        // Yönde tanımlı eylem yoksa jesti alma.
        return g.dx > 0 ? !!right : !!left;
      },
      onPanResponderMove: (_e, g) => {
        const limited = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, g.dx));
        translateX.setValue(limited);
        setDirection(limited > 0 ? 'right' : limited < 0 ? 'left' : null);
      },
      onPanResponderRelease: (_e, g) => {
        const action = g.dx > 0 ? right : left;
        if (action && Math.abs(g.dx) >= ACTION_THRESHOLD) {
          action.onTrigger();
        }
        springBack();
      },
      onPanResponderTerminate: springBack,
    }),
  ).current;

  const action = direction === 'right' ? right : direction === 'left' ? left : undefined;

  return (
    <View>
      {/* Arka plandaki eylem göstergesi — yalnızca kaydırılırken görünür. */}
      {action && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: direction === 'right' ? 'flex-start' : 'flex-end',
            paddingHorizontal: theme.spacing(2.5),
            gap: theme.spacing(1),
            backgroundColor: action.color,
          }}>
          <Icon name={action.icon} size={20} color={theme.colors.onAccent} />
          <Text variant="caption" color={theme.colors.onAccent}>
            {action.label}
          </Text>
        </View>
      )}

      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
};
