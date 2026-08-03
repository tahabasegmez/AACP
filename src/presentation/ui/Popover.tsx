import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { useReducedMotion } from './useReducedMotion';

/** Kartın ekran kenarlarına en az bırakacağı boşluk. */
const EDGE_MARGIN = 12;
/** Kart ile tetikleyen düğme arasındaki boşluk. */
const ANCHOR_GAP = 8;
/** Ölçüm gelene kadar kullanılacak kart genişliği. */
const DEFAULT_WIDTH = 260;

/** Ölçülmüş tetikleyici konumu (ekran koordinatı). */
interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bir görünümü popover tetikleyicisi yapar.
 *
 * Ölçüm AÇILIRKEN yapılır, `onLayout`ta değil: ekran kaydırıldığında düğmenin
 * konumu değişir ve bayat bir ölçümle açılan kart yanlış yerde belirirdi.
 */
export const useAnchor = () => {
  const ref = useRef<View>(null);
  const [rect, setRect] = useState<AnchorRect | null>(null);

  const measure = (): void => {
    ref.current?.measureInWindow((x, y, width, height) =>
      setRect({ x, y, width, height }),
    );
  };

  return { ref, rect, measure };
};

/**
 * Popover — bir düğmeye bağlı olarak açılan küçük kart.
 *
 * Alttan açılan panelin (`BottomSheet`) aksine kart TETİKLEYİCİNİN YANINDA
 * belirir; kısa menülerde bağlamı korur — kullanıcı kartın nereden geldiğini
 * görür. Uzun içerik ve form için `BottomSheet` uygundur.
 *
 * Kart tetikleyicinin sağ kenarına hizalanır ve altında açılır; ekran dışına
 * taşacaksa kenar boşluğuna sıkıştırılır. Ölçüm yoksa (henüz alınmadıysa)
 * sağ üstte açılır — bu bileşenin bilinen tek kullanım yeri orası olduğu için
 * makul bir yedektir ve kart asla görünmez kalmaz.
 */
export const Popover: React.FC<{
  visible: boolean;
  onClose: () => void;
  /** `useAnchor().rect` — tetikleyicinin ekrandaki yeri. */
  anchor: AnchorRect | null;
  /** Kart genişliği. */
  width?: number;
  children: React.ReactNode;
}> = ({ visible, onClose, anchor, width = DEFAULT_WIDTH, children }) => {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: theme.duration.fast,
      useNativeDriver: true,
    }).start();
  }, [visible, reduced, progress, theme.duration.fast]);

  const screen = Dimensions.get('window');
  // Sağ kenara hizala; ekranın soluna taşarsa kenar boşluğuna sıkıştır.
  const right = anchor ? screen.width - (anchor.x + anchor.width) : EDGE_MARGIN;
  const top = anchor ? anchor.y + anchor.height + ANCHOR_GAP : EDGE_MARGIN;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Dışarı dokunma kapatır — küçük menülerde beklenen davranış. */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ flex: 1, backgroundColor: theme.colors.overlay }}
      />

      <Animated.View
        // Dokunuşlar karta ulaşmalı; konumlandırma mutlak olduğu için kart
        // kapatma katmanının ÜSTÜNDE ayrı bir düzlemde durur.
        style={{
          position: 'absolute',
          top,
          right: Math.max(EDGE_MARGIN, Math.min(right, screen.width - width - EDGE_MARGIN)),
          width,
          opacity: progress,
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        }}>
        {children}
      </Animated.View>
    </Modal>
  );
};
