import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/**
 * BottomSheet — aşağıdan yukarıya kayan, sürükleyip/arka plana dokunup kapatılan
 * panel. TEK yerde tanımlı; her kullanan (EpisodeSheet, notlar, açıklama) çağırır.
 *
 * Karartma (backdrop) panelle birlikte YUKARI KAYMAZ — yerinde yavaşça belirir;
 * yalnızca panel aşağıdan kayar. Saf React Native (Modal + Animated + PanResponder),
 * ağır native bağımlılık gerektirmez.
 */
export const BottomSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Panelin ekranın en fazla ne kadarını kaplayacağı (0..1). */
  maxHeightRatio?: number;
  /**
   * Panelin AÇILDIĞINDA kaplayacağı yükseklik oranı. Verilmezse içerik kadar
   * yer kaplar. Örn. kuyruk paneli için 0.5 → ekranın yarısı.
   */
  heightRatio?: number;
}> = ({ visible, onClose, children, maxHeightRatio = 0.85, heightRatio }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 2 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: height, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.overlay, opacity: backdrop }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: height * maxHeightRatio,
          ...(heightRatio ? { height: height * heightRatio } : null),
          backgroundColor: theme.colors.elevated,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          paddingBottom: insets.bottom + theme.spacing(2),
          transform: [{ translateY }],
        }}>
        <View {...pan.panHandlers} style={{ alignItems: 'center', paddingVertical: theme.spacing(1.25) }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.textMuted }} />
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
};
