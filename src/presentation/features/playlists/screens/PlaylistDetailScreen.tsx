import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Episode, playlistDurationSec } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { Icon, ImmersiveHeader, SearchField, Text, scrimScrollHandler } from '../../../ui';
import { PlaylistCover } from '../components/PlaylistCover';
import { EmptyState } from '../../../shared/components';
import {
  useDeletePlaylist,
  usePlaylist,
  useRemoveEpisodeFromPlaylist,
  useShowsQuery,
} from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import type { RootStackParamList } from '../../../navigation/types';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useEpisodeSheetStore } from '../../../stores';
import { SwipeableEpisodeRow } from '../../episode/SwipeableEpisodeRow';
import { PlaylistEditorSheet } from '../components/PlaylistEditorSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaylistDetail'>;

/**
 * PlaylistDetailScreen — bir listenin içeriği.
 *
 * Şov detayıyla aynı düzeni kullanır (hero kapak + bölüm listesi) ve bölümleri
 * uygulamanın ortak `EpisodeRow` bileşeniyle gösterir; böylece listeler ve
 * şovlar aynı dilde görünür.
 */
export const PlaylistDetailScreen: React.FC<Props> = ({ route }) => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const play = usePlayEpisode();
  const openSheet = useEpisodeSheetStore(s => s.open);
  const shows = useShowsQuery();

  const { playlistId } = route.params;
  const { data: playlist } = usePlaylist(playlistId);
  const removeEpisode = useRemoveEpisodeFromPlaylist();
  const deletePlaylist = useDeletePlaylist();
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');

  const showTitleOf = (showId: string): string =>
    (shows.data ?? []).find(s => s.id === showId)?.title ?? '';

  if (!playlist) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <ImmersiveHeader title="Liste" onBack={() => navigation.goBack()} />
        <EmptyState title="Liste bulunamadı" description="Bu liste silinmiş olabilir." />
      </View>
    );
  }

  const totalSec = playlistDurationSec(playlist);
  // Liste içi arama — kayıtlar zaten bellekte olduğu için yerelde süzülür.
  const needle = query.trim().toLocaleLowerCase('tr-TR');
  const episodes = needle
    ? playlist.episodes.filter(
        e =>
          e.title.toLocaleLowerCase('tr-TR').includes(needle) ||
          showTitleOf(e.showId).toLocaleLowerCase('tr-TR').includes(needle),
      )
    : playlist.episodes;

  const confirmDelete = (): void => {
    Alert.alert(
      'Listeyi sil',
      `"${playlist.name}" listesi silinecek. Bölümler silinmez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            deletePlaylist.mutate(playlist.id, { onSuccess: () => navigation.goBack() });
          },
        },
      ],
    );
  };

  const confirmRemoveEpisode = (episode: Episode): void => {
    Alert.alert('Listeden çıkar', `"${episode.title}" listeden çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: () =>
          removeEpisode.mutate({ playlistId: playlist.id, episodeId: episode.id }),
      },
    ]);
  };

  const Header = (
    <View style={{ paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(2) }}>
      <View style={{ alignItems: 'center' }}>
        <PlaylistCover playlist={playlist} size={180} />
      </View>

      <Text variant="title" numberOfLines={2} style={{ marginTop: theme.spacing(2) }}>
        {playlist.name}
      </Text>
      <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
        {episodes.length} bölüm
        {totalSec > 0 ? ` · ${formatDuration(totalSec)}` : ''}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginTop: theme.spacing(2) }}>
        <Pressable
          onPress={() => episodes[0] && play(episodes[0], { episodes: [...episodes], index: 0 })}
          disabled={episodes.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Listeyi çal"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: theme.spacing(1.25),
            paddingHorizontal: theme.spacing(2.5),
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.accent,
            opacity: episodes.length === 0 ? 0.4 : 1,
          }}>
          <Icon name="play" size={18} color={theme.colors.onAccent} />
          <Text variant="bodyStrong" color={theme.colors.onAccent}>
            Çal
          </Text>
        </Pressable>

        {/* Sistem listesi düzenlenemez/silinemez. */}
        {!playlist.system && (
          <>
            <Pressable
              onPress={() => setEditorOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Listeyi düzenle">
              <Icon name="settings" size={22} color={theme.colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Listeyi sil">
              <Icon name="close" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </>
        )}
      </View>

      {/* Liste içi arama — yalnızca birkaç bölümlük listelerde gereksiz yer
          kaplamasın diye eşik uygulanır. */}
      {playlist.episodes.length > 5 && (
        <SearchField value={query} onChangeText={setQuery} placeholder="Bu listede ara" />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ImmersiveHeader title={playlist.name} onBack={() => navigation.goBack()} />

      {episodes.length === 0 ? (
        <>
          {Header}
          <EmptyState
            title={query ? 'Sonuç yok' : 'Liste boş'}
            description={
              query
                ? `"${query}" için bu listede bölüm bulunamadı.`
                : 'Bir bölümün ayrıntı panelinden bu listeye ekleyebilirsin.'
            }
          />
        </>
      ) : (
        <FlashList
          data={episodes}
          keyExtractor={item => item.id}
          ListHeaderComponent={Header}
          contentInsetAdjustmentBehavior="never"
          onScroll={scrimScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: theme.spacing(14) }}
          renderItem={({ item, index }) => (
            <SwipeableEpisodeRow
              episode={item}
              // Bağlam verildiği için sola kaydırma "listeye ekle" değil
              // "listeden çıkar" olur.
              context={{ playlistId: playlist.id }}
              // Listelerde "kaldığın yer" yerine bölümün ait olduğu ŞOV yazar.
              subtitle={showTitleOf(item.showId)}
              onPress={() => openSheet(item)}
              onPlay={() => play(item, { episodes: [...episodes], index })}
              onLongPress={() => confirmRemoveEpisode(item)}
            />
          )}
        />
      )}

      <PlaylistEditorSheet
        visible={editorOpen}
        playlist={playlist}
        onClose={() => setEditorOpen(false)}
      />
    </View>
  );
};
