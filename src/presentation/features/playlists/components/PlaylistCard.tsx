import React from 'react';
import { Pressable, View } from 'react-native';
import { Playlist, playlistCoverUri } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, Text } from '../../../ui';

const DEFAULT_W = 132;

/**
 * PlaylistCard — yatay listelerde kullanılan liste kartı.
 *
 * ShowCard ile aynı ölçü ve dizilimi kullanır; böylece Kütüphane'deki tüm
 * yatay şeritler aynı ritimde görünür. Kapak yoksa listenin ilk bölümünün
 * görseline düşer; o da yoksa nötr bir yer tutucu gösterilir.
 */
export const PlaylistCard: React.FC<{
  playlist: Playlist;
  onPress: () => void;
  width?: number;
}> = ({ playlist, onPress, width = DEFAULT_W }) => {
  const theme = useTheme();
  const cover = playlistCoverUri(playlist);
  const count = playlist.episodes.length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${playlist.name}, ${count} bölüm`}
      style={{ width }}>
      {cover ? (
        <CoverImage uri={cover} size={width} radius={theme.radius.lg} />
      ) : (
        <View
          style={{
            width,
            height: width,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={playlist.system ? 'bookmark' : 'list'}
            size={30}
            color={theme.colors.textDim}
          />
        </View>
      )}
      <Text variant="subtitle" numberOfLines={1} style={{ marginTop: theme.spacing(1) }}>
        {playlist.name}
      </Text>
      <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
        {count === 0 ? 'Boş liste' : `${count} bölüm`}
      </Text>
    </Pressable>
  );
};

/**
 * NewPlaylistCard — yatay şeridin başındaki "yeni liste" kutusu.
 * PlaylistCard ile aynı ölçüde durur ki şeridin hizası bozulmasın.
 */
export const NewPlaylistCard: React.FC<{ onPress: () => void; width?: number }> = ({
  onPress,
  width = DEFAULT_W,
}) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Yeni liste oluştur"
      style={{ width }}>
      <View
        style={{
          width,
          height: width,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="display" color={theme.colors.accent}>
          +
        </Text>
      </View>
      <Text variant="subtitle" numberOfLines={1} style={{ marginTop: theme.spacing(1) }}>
        Yeni liste
      </Text>
      <Text variant="caption" color={theme.colors.textMuted}>
        Oluştur
      </Text>
    </Pressable>
  );
};
