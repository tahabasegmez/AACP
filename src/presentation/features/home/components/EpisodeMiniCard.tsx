import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, Text } from '../../../ui';

const DEFAULT_W = 236;

/**
 * EpisodeMiniCard — kompakt yatay bölüm kartı: kapak + başlık/şov + hızlı çal.
 * "Dinlemeye devam" (ilerleme çubuklu) ve "Sonra dinle" (çubuksuz) yatay
 * menülerinde AYNI kart olarak kullanılır. Sunumsaldır: veri kaynağından
 * (PlaybackProgress / Episode) bağımsız, ilkel proplar alır.
 *
 * Tarih/süre gibi ayrıntılar burada gösterilmez; "Tümü" ile açılan dikey
 * listede (EpisodeRow) görülür.
 */
export const EpisodeMiniCard: React.FC<{
  artworkUrl?: string;
  title: string;
  subtitle: string;
  /** 0..1 arası ilerleme; verilirse alt çubuk gösterilir. */
  fraction?: number;
  onPress: () => void;
  width?: number;
}> = ({ artworkUrl, title, subtitle, fraction, onPress, width = DEFAULT_W }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        width,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.25),
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing(1.25),
      }}>
      <CoverImage uri={artworkUrl} size={54} radius={theme.radius.md} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="subtitle" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
          {subtitle}
        </Text>
        {fraction != null && (
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: theme.colors.border,
              marginTop: theme.spacing(1),
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: '100%',
                width: `${Math.min(1, fraction) * 100}%`,
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>
        )}
      </View>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="play" size={16} color={theme.colors.bg} />
      </View>
    </Pressable>
  );
};
