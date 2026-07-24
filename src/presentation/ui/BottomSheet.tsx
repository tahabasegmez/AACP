import React, { useRef } from 'react';
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
 * panel. Saf React Native (Modal + Animated + PanResponder) ile; ağır native
 * bağımlılık (reanimated/gorhom) GEREKTİRMEZ. Tam ekran modal Player'ın üstünde
 * de sorunsuz açılır.
 */
export const BottomSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightRatio?: number;
}> = ({ visible, onClose, children, maxHeightRatio = 0.85 }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;

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
          translateY.setValue(0);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: height * maxHeightRatio,
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
