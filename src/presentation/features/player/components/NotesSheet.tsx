import React, { useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { Text } from '../../../ui';

const stripHtml = (html: string): string =>
  html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * NotesSheet — bölüm notlarını aşağıdan yukarıya kayan bir panelde gösterir.
 *
 * Player tam ekran (fullScreenModal) olduğu için gorhom portal'ı arkada kalır;
 * bu yüzden native RN Modal kullanıyoruz (Player'ın üstünde açılır). Arka plana
 * dokununca veya paneli aşağı sürükleyince kapanır.
 */
export const NotesSheet: React.FC<{
  visible: boolean;
  title: string;
  notes: string;
  onClose: () => void;
}> = ({ visible, title, notes, onClose }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6,
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
          maxHeight: height * 0.7,
          backgroundColor: theme.colors.elevated,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          paddingBottom: insets.bottom + theme.spacing(2),
          transform: [{ translateY }],
        }}>
        <View {...pan.panHandlers} style={{ alignItems: 'center', paddingVertical: theme.spacing(1.25) }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.textMuted }} />
        </View>
        <Text variant="heading" style={{ paddingHorizontal: theme.spacing(2.5) }}>
          {title}
        </Text>
        <ScrollView contentContainerStyle={{ padding: theme.spacing(2.5), paddingTop: theme.spacing(1.5) }}>
          <Text variant="body" color={theme.colors.textMuted}>
            {stripHtml(notes)}
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};
