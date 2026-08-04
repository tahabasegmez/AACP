import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Episode, playlistCoverUri, playlistDurationSec } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import {
  CoverGradient,
  FilterMenu,
  FilterOption,
  FilterSection,
  Icon,
  SearchField,
  Text,
  TextSheet,
  scrimScrollHandler,
  useHeroCoverSize,
} from '../../../ui';
import { PlaylistCover } from '../components/PlaylistCover';
import { EmptyState } from '../../../shared/components';
import {
  useDeletePlaylist,
  usePlaylist,
  usePreference,
  useRemoveEpisodeFromPlaylist,
  useShowsQuery,
} from '../../../query';
import { useProgressIndex } from '../../player/useEpisodeStatus';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import type { RootStackParamList } from '../../../navigation/types';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useEpisodeSheetStore } from '../../../stores';
import { SwipeableEpisodeRow } from '../../episode/SwipeableEpisodeRow';
import { PlaylistEditorSheet } from '../components/PlaylistEditorSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaylistDetail'>;

/** Liste içi aramanın görüneceği en küçük liste boyu. */
const SEARCH_THRESHOLD = 5;

/**
 * PlaylistDetailScreen — bir listenin içeriği.
 *
 * Şov detayıyla AYNI düzeni kullanır: kapaktan türeyen tam ekran degrade,
 * ortalanmış kapak, başlık, açıklama ve yalnızca simgeli yuvarlak çal düğmesi.
 * İki ekranın aynı dili konuşması, kullanıcının ikisinde de nerede ne
 * bulacağını bilmesini sağlar.
 */
export const PlaylistDetailScreen: React.FC<Props> = ({ route }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const play = usePlayEpisode();
  const openSheet = useEpisodeSheetStore(s => s.open);
  const shows = useShowsQuery();
  const coverSize = useHeroCoverSize();

  const { playlistId } = route.params;
  const { data: playlist } = usePlaylist(playlistId);
  const removeEpisode = useRemoveEpisodeFromPlaylist();
  const deletePlaylist = useDeletePlaylist();
  const [editorOpen, setEditorOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { value: hideCompleted, set: setHideCompleted } = usePreference('hideCompletedEpisodes');
  const { data: progressIndex } = useProgressIndex();

  const showTitleOf = (showId: string): string =>
    (shows.data ?? []).find(s => s.id === showId)?.title ?? '';

  const BackButton = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Geri"
      style={{
        position: 'absolute',
        top: insets.top + 6,
        left: theme.spacing(1.5),
        zIndex: 10,
      }}>
      <Icon name="chevron-back" size={28} color="#FFFFFF" />
    </Pressable>
  );

  /** Şov detayıyla aynı kabuk: full-bleed degrade + geri düğmesi. */
  const wrap = (body: React.ReactNode, coverUri?: string) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <CoverGradient
        uri={coverUri}
        locations={[0, 0.4, 0.62]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {body}
      {BackButton}
    </View>
  );

  if (!playlist) {
    return wrap(<EmptyState title="Liste bulunamadı" description="Bu liste silinmiş olabilir." />);
  }

  const totalSec = playlistDurationSec(playlist);
  // Liste içi arama — kayıtlar zaten bellekte olduğu için yerelde süzülür.
  const needle = query.trim().toLocaleLowerCase('tr-TR');
  const searched = needle
    ? playlist.episodes.filter(
        e =>
          e.title.toLocaleLowerCase('tr-TR').includes(needle) ||
          showTitleOf(e.showId).toLocaleLowerCase('tr-TR').includes(needle),
      )
    : playlist.episodes;

  // Dinlenmişleri gizleme tercihi KULLANICIYA aittir, ekrana değil: şov
  // detayında açıldığında listelerde de geçerli olur.
  const episodes = hideCompleted
    ? searched.filter(e => !progressIndex?.get(e.id)?.completed)
    : searched;

  const confirmDelete = (): void => {
    Alert.alert('Listeyi sil', `"${playlist.name}" listesi silinecek. Bölümler silinmez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          deletePlaylist.mutate(playlist.id, { onSuccess: () => navigation.goBack() });
        },
      },
    ]);
  };

  const confirmRemoveEpisode = (episode: Episode): void => {
    Alert.alert('Listeden çıkar', `"${episode.title}" listeden çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: () => removeEpisode.mutate({ playlistId: playlist.id, episodeId: episode.id }),
      },
    ]);
  };

  const Header = (
    <View>
      <View
        style={{
          paddingTop: insets.top + theme.spacing(6),
          paddingBottom: theme.spacing(2),
          alignItems: 'center',
        }}>
        <PlaylistCover playlist={playlist} size={coverSize} />

        <Text
          variant="title"
          numberOfLines={2}
          style={{
            marginTop: theme.spacing(2),
            textAlign: 'center',
            paddingHorizontal: theme.spacing(2),
          }}>
          {playlist.name}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
          {playlist.episodes.length} bölüm
          {totalSec > 0 ? ` · ${formatDuration(totalSec)}` : ''}
        </Text>

        {/* Açıklama — şovunkiyle aynı davranış: üç satır, devamı panelde. */}
        {!!playlist.description && (
          <Pressable
            onPress={() => setDescOpen(true)}
            style={{ paddingHorizontal: theme.spacing(2.5) }}>
            <Text
              variant="caption"
              color={theme.colors.textMuted}
              numberOfLines={3}
              style={{ textAlign: 'center', marginTop: theme.spacing(1.25) }}>
              {playlist.description}
            </Text>
            <Text
              variant="caption"
              color={theme.colors.text}
              style={{ textAlign: 'center', marginTop: 4 }}>
              devamını oku…
            </Text>
          </Pressable>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(2.5),
            marginTop: theme.spacing(2),
          }}>
          {/* Sistem listesi düzenlenemez/silinemez. */}
          {!playlist.system && (
            <Pressable
              onPress={() => setEditorOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Listeyi düzenle">
              <Icon name="settings" size={24} color={theme.colors.textMuted} />
            </Pressable>
          )}

          <Pressable
            onPress={() => episodes[0] && play(episodes[0], { episodes: [...episodes], index: 0 })}
            disabled={episodes.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Listeyi çal"
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.accent,
              opacity: episodes.length === 0 ? 0.4 : 1,
            }}>
            <Icon name="play" size={24} color={theme.colors.onAccent} />
          </Pressable>

          {!playlist.system && (
            <Pressable
              onPress={confirmDelete}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Listeyi sil">
              <Icon name="close" size={24} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Liste içi arama — yalnızca birkaç bölümlük listelerde gereksiz yer
          kaplamasın diye eşik uygulanır. Filtreler sağdaki panelde toplanır. */}
      {playlist.episodes.length > SEARCH_THRESHOLD && (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Bu listede ara"
          action={
            <FilterMenu active={hideCompleted}>
              <FilterSection title="Süzme" />
              <FilterOption
                label="Dinlenmişleri gizle"
                selected={hideCompleted}
                onPress={() => setHideCompleted(!hideCompleted)}
              />
            </FilterMenu>
          }
        />
      )}
    </View>
  );

  return wrap(
    <>
      <FlashList
        data={episodes}
        keyExtractor={item => item.id}
        ListHeaderComponent={Header}
        // Boş durum listenin İÇİNDE gösterilir. Ayrı bir dal döndürmek,
        // sonuçsuz her aramada listeyi ve başlıktaki arama kutusunu söküp
        // yeniden kurardı: klavye kapanır, kaydırma başa dönerdi.
        ListEmptyComponent={
          <EmptyState
            title={query ? 'Sonuç yok' : hideCompleted ? 'Hepsi dinlendi' : 'Liste boş'}
            description={
              query
                ? `"${query}" için bu listede bölüm bulunamadı.`
                : hideCompleted
                ? 'Bu listedeki tüm bölümleri dinledin. Filtreyi kapatarak hepsini görebilirsin.'
                : 'Bir bölümün ayrıntı panelinden bu listeye ekleyebilirsin.'
            }
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
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

      <PlaylistEditorSheet
        visible={editorOpen}
        playlist={playlist}
        onClose={() => setEditorOpen(false)}
      />

      <TextSheet
        visible={descOpen}
        title={playlist.name}
        text={playlist.description ?? ''}
        onClose={() => setDescOpen(false)}
      />
    </>,
    playlistCoverUri(playlist),
  );
};
