import React from 'react';
import { Pressable, View } from 'react-native';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, Text } from '../../../ui';

const DEFAULT_W = 250;

const formatDate = (iso: string): string => {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

/** EpisodeCard — "en son bölümler" kartı: kapak + şov + başlık + tarih/süre + çal. */
export const EpisodeCard: React.FC<{
  episode: Episode;
  showTitle: string;
  onPress: () => void;
  width?: number;
}> = ({ episode, showTitle, onPress, width = DEFAULT_W }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={episode.title}
      style={{
        width,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing(1.5),
      }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing(1.25) }}>
        <CoverImage uri={episode.imageUrl} size={46} radius={theme.radius.md} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" color={theme.colors.accent} uppercase numberOfLines={1}>
            {showTitle}
          </Text>
          <Text
            variant="subtitle"
            numberOfLines={2}
            style={{ marginTop: 2 }}>
            {episode.title}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing(1),
          marginTop: theme.spacing(1.25),
        }}>
        <Text variant="caption" color={theme.colors.textMuted}>
          {formatDate(episode.publishedAt)}
        </Text>
        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.colors.textMuted }} />
        <Text variant="caption" color={theme.colors.textMuted}>
          {formatDuration(episode.durationSec)}
        </Text>
        <View
          style={{
            marginLeft: 'auto',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: theme.colors.accentSoft,
            paddingVertical: 5,
            paddingHorizontal: theme.spacing(1.25),
            borderRadius: theme.radius.pill,
          }}>
          <Icon name="play" size={12} color={theme.colors.accent} />
          <Text variant="caption" color={theme.colors.accent}>
            Çal
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
