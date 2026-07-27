import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Episode, Playlist, playlistCoverUri, playlistHasEpisode } from '@domain/entities';
import { useTheme } from '../../../theme';
import { BottomSheet, CoverImage, Icon, Text } from '../../../ui';
import { useAddEpisodeToPlaylist, usePlaylists } from '../../../query';
import { PlaylistEditorSheet } from './PlaylistEditorSheet';

/**
 * AddToPlaylistSheet — "bölümü listeye ekle" paneli.
 *
 * Kullanıcının listelerini gösterir; birine dokunmak bölümü o listeye ekler.
 * Bölüm zaten listedeyse eklemeden ÖNCE onay sorulur ("yine de ekle" / "iptal")
 * — sessizce yok saymak kullanıcıya işlemin neden sonuçsuz kaldığını
 * anlatmazdı.
 *
 * Panelin başında yeni liste oluşturma kısayolu vardır; oluşturulan listeye
 * bölüm doğrudan eklenir (akış kesilmez).
 */
export const AddToPlaylistSheet: React.FC<{
  visible: boolean;
  episode?: Episode | null;
  onClose: () => void;
  onFeedback?: (message: string) => void;
}> = ({ visible, episode, onClose, onFeedback }) => {
  const theme = useTheme();
  const playlists = usePlaylists();
  const addEpisode = useAddEpisodeToPlaylist();
  const [editorOpen, setEditorOpen] = useState(false);

  const add = (playlist: Playlist): void => {
    if (!episode) {
      return;
    }
    addEpisode.mutate(
      { playlistId: playlist.id, episode },
      {
        onSuccess: () => onFeedback?.(`"${playlist.name}" listesine eklendi`),
      },
    );
    onClose();
  };

  const onSelect = (playlist: Playlist): void => {
    if (!episode) {
      return;
    }
    // Zaten listedeyse kullanıcıya sor — kopya kayıt istemeyebilir.
    if (playlistHasEpisode(playlist, episode.id)) {
      Alert.alert(
        'Bölüm zaten listede',
        `"${episode.title}" bölümü "${playlist.name}" listesinde zaten var. Yine de eklemek istiyor musun?`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Yine de ekle', onPress: () => add(playlist) },
        ],
      );
      return;
    }
    add(playlist);
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} heightRatio={0.5}>
        <View style={{ paddingHorizontal: theme.spacing(2.5), paddingBottom: theme.spacing(1) }}>
          <Text variant="heading">Listeye ekle</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing(2) }}>
          <Pressable
            onPress={() => setEditorOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Yeni liste oluştur"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing(1.5),
              paddingHorizontal: theme.spacing(2.5),
              paddingVertical: theme.spacing(1.25),
            }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text variant="title" color={theme.colors.accent}>
                +
              </Text>
            </View>
            <Text variant="bodyStrong">Yeni liste</Text>
          </Pressable>

          {(playlists.data ?? []).map(playlist => (
            <Pressable
              key={playlist.id}
              onPress={() => onSelect(playlist)}
              accessibilityRole="button"
              accessibilityLabel={playlist.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(1.5),
                paddingHorizontal: theme.spacing(2.5),
                paddingVertical: theme.spacing(1.25),
              }}>
              {playlistCoverUri(playlist) ? (
                <CoverImage
                  uri={playlistCoverUri(playlist)}
                  size={44}
                  radius={theme.radius.md}
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon
                    name={playlist.system ? 'bookmark' : 'list'}
                    size={18}
                    color={theme.colors.textDim}
                  />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {playlist.name}
                </Text>
                <Text variant="caption" color={theme.colors.textMuted}>
                  {playlist.episodes.length === 0
                    ? 'Boş liste'
                    : `${playlist.episodes.length} bölüm`}
                </Text>
              </View>
              {episode && playlistHasEpisode(playlist, episode.id) && (
                <Icon name="checkmark" size={18} color={theme.colors.accent} />
              )}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Yeni liste oluşturulunca bölüm doğrudan o listeye eklenir. */}
      <PlaylistEditorSheet
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        onCreated={created => {
          add(created);
        }}
      />
    </>
  );
};
