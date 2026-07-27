import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../../theme';
import { BottomSheet, Text } from '../../../ui';

/** Seçilebilir uyku süreleri (dakika). 0 = kapat. */
const OPTIONS: ReadonlyArray<{ label: string; minutes: number }> = [
  { label: 'Kapalı', minutes: 0 },
  { label: '5 dk', minutes: 5 },
  { label: '10 dk', minutes: 10 },
  { label: '15 dk', minutes: 15 },
  { label: '30 dk', minutes: 30 },
  { label: '45 dk', minutes: 45 },
  { label: '60 dk', minutes: 60 },
];

/**
 * SleepTimerSheet — uyku zamanlayıcı seçenekleri.
 *
 * Platforma özgü ActionSheet/Alert yerine uygulamanın ortak alttan açılan
 * panelini kullanır: her platformda aynı görünür ve tema ile tutarlıdır.
 * Seçenekler kompakt bir ızgarada durur.
 */
export const SleepTimerSheet: React.FC<{
  visible: boolean;
  /** Etkin süre (dakika); yoksa hiçbiri seçili değildir. */
  activeMinutes?: number;
  onSelect: (minutes: number) => void;
  onClose: () => void;
}> = ({ visible, activeMinutes, onSelect, onClose }) => {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(1) }}>
        <Text variant="label" color={theme.colors.textMuted} uppercase>
          Uyku zamanlayıcı
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing(1),
            marginTop: theme.spacing(1.5),
          }}>
          {OPTIONS.map(option => {
            const active = option.minutes === (activeMinutes ?? 0);
            return (
              <Pressable
                key={option.minutes}
                onPress={() => {
                  onSelect(option.minutes);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
                style={{
                  paddingVertical: theme.spacing(1),
                  paddingHorizontal: theme.spacing(2),
                  borderRadius: theme.radius.pill,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                }}>
                <Text
                  variant="subtitle"
                  color={active ? theme.colors.onAccent : theme.colors.text}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
};
