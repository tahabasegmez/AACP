import React from 'react';
import { Pressable, View } from 'react-native';
import { Episode } from '@domain/entities';
import { useTheme } from '../../../theme';
import { BottomSheet, Icon, IconName, Text } from '../../../ui';
import { usePlayerQueueStore } from '../../../stores';
import { shareEpisode } from '../../episode/shareEpisode';

/**
 * PlayerMenuSheet — tam ekran oynatıcının "…" menüsü.
 *
 * Ortak alttan açılan paneli kullanır. Buradaki eylemler o an çalan bölüme
 * uygulanır; oynatmayı kesmeyen ikincil işlemler için tasarlanmıştır.
 */
export const PlayerMenuSheet: React.FC<{
  visible: boolean;
  episode?: Episode | null;
  onClose: () => void;
  /** Kullanıcıya kısa geri bildirim göstermek için. */
  onFeedback?: (message: string) => void;
}> = ({ visible, episode, onClose, onFeedback }) => {
  const theme = useTheme();
  const enqueue = usePlayerQueueStore(s => s.enqueue);

  const run = (action: () => void, message: string): void => {
    action();
    onFeedback?.(message);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingBottom: theme.spacing(1) }}>
        <MenuItem
          icon="queue"
          label="Sıraya ekle"
          description="Şovun kalan bölümlerinin önüne geçer"
          disabled={!episode}
          onPress={() => episode && run(() => enqueue(episode), 'Sıraya eklendi')}
        />
        <MenuItem
          icon="share"
          label="Paylaş"
          description="Bağlantıya dokunan kişi bölümü uygulamada açar"
          disabled={!episode}
          onPress={() => {
            if (episode) {
              void shareEpisode(episode);
              onClose();
            }
          }}
        />
      </View>
    </BottomSheet>
  );
};

/** Menüdeki tek satır: ikon + başlık (+ açıklama). */
const MenuItem: React.FC<{
  icon: IconName;
  label: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, label, description, onPress, disabled }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.5),
        paddingVertical: theme.spacing(1.5),
        paddingHorizontal: theme.spacing(2.5),
        opacity: disabled ? 0.4 : 1,
      }}>
      <Icon name={icon} size={22} color={theme.colors.text} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong">{label}</Text>
        {!!description && (
          <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>
    </Pressable>
  );
};
