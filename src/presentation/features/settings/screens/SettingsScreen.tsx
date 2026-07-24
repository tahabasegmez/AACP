import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MotionLevel, ThemeMode } from '@domain/entities';
import { useTheme } from '../../../theme';
import { Icon, Screen, Text } from '../../../ui';
import { usePreferences } from '../usePreferences';

/** Bir ayar grubu için seçenek satırı (segment benzeri). */
function OptionGroup<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
}: {
  title: string;
  description?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing(3) }}>
      <Text variant="heading">{title}</Text>
      {!!description && (
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 2 }}>
          {description}
        </Text>
      )}
      <View
        style={{
          marginTop: theme.spacing(1.5),
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
        }}>
        {options.map((opt, i) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing(1.75),
                paddingHorizontal: theme.spacing(2),
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.colors.divider,
              }}>
              <Text variant="body" color={selected ? theme.colors.accent : theme.colors.text}>
                {opt.label}
              </Text>
              {selected && <Icon name="checkmark" size={20} color={theme.colors.accent} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** SettingsScreen — tema ve animasyon tercihleri. */
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const { prefs, update } = usePreferences();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(2) }}>
        <Text variant="title" style={{ marginBottom: theme.spacing(2.5) }}>
          Ayarlar
        </Text>

        <OptionGroup<ThemeMode>
          title="Görünüm"
          description="Uygulama teması"
          value={prefs.themeMode}
          onChange={themeMode => update({ themeMode })}
          options={[
            { value: 'system', label: 'Sistem' },
            { value: 'dark', label: 'Koyu' },
            { value: 'light', label: 'Açık' },
          ]}
        />

        <OptionGroup<MotionLevel>
          title="Animasyonlar"
          description="Daha az hareket için azaltılmışı seç"
          value={prefs.motion}
          onChange={motion => update({ motion })}
          options={[
            { value: 'full', label: 'Zengin' },
            { value: 'reduced', label: 'Azaltılmış' },
          ]}
        />
      </ScrollView>
    </Screen>
  );
};
