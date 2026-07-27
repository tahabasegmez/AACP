import React from 'react';
import { View } from 'react-native';
import { Playlist } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverImage, Icon } from '../../../ui';

/**
 * PlaylistCover — bir listenin kapak görseli.
 *
 * Öncelik sırası (Spotify davranışı):
 *  1. Kullanıcının seçtiği kapak,
 *  2. listedeki İLK 4 bölümün kapağından 2×2 ızgara (4'ten azsa tek görsel),
 *  3. hiç görsel yoksa nötr bir yer tutucu.
 *
 * Tek yerde tanımlıdır; kart, panel ve detay ekranı aynı bileşeni çağırır.
 */
export const PlaylistCover: React.FC<{
  playlist: Playlist;
  size: number;
  radius?: number;
}> = ({ playlist, size, radius }) => {
  const theme = useTheme();
  const cornerRadius = radius ?? theme.radius.lg;

  // Kullanıcı kapağı varsa doğrudan onu kullan.
  if (playlist.coverUri) {
    return <CoverImage uri={playlist.coverUri} size={size} radius={cornerRadius} />;
  }

  // Bölüm kapaklarından benzersiz olanları topla (aynı şovun tekrarını önler).
  const covers: string[] = [];
  for (const episode of playlist.episodes) {
    if (episode.imageUrl && !covers.includes(episode.imageUrl)) {
      covers.push(episode.imageUrl);
      if (covers.length === 4) {
        break;
      }
    }
  }

  if (covers.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: cornerRadius,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon
          name={playlist.system ? 'bookmark' : 'list'}
          size={size * 0.28}
          color={theme.colors.textDim}
        />
      </View>
    );
  }

  // Tek görsel varsa ızgaraya gerek yok.
  if (covers.length < 4) {
    return <CoverImage uri={covers[0]} size={size} radius={cornerRadius} />;
  }

  // 2×2 ızgara — dış köşeler yuvarlatılır, parçalar köşesiz durur.
  const half = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: cornerRadius,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: theme.colors.surface,
      }}>
      {covers.map((uri, i) => (
        <CoverImage key={`${uri}-${i}`} uri={uri} size={half} radius={0} />
      ))}
    </View>
  );
};
