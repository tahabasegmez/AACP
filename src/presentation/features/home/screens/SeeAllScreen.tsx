import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import React, { useMemo } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Episode, PlaybackProgress, Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { EmptyState, LoadingView } from '../../../shared/components';
import { ImmersiveHeader, scrimScrollHandler } from '../../../ui';
import {
  useFollowedShows,
  useLatestEpisodes,
  useResumeList,
  useSavedEpisodes,
  useShowsQuery,
  usePlaylists,
  userPlaylists,
} from '../../../query';
import { PlaylistCard } from '../../playlists/components/PlaylistCard';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { useEpisodeSheetStore } from '../../../stores';
import type { RootStackParamList } from '../../../navigation/types';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { SwipeableEpisodeRow } from '../../episode/SwipeableEpisodeRow';
import { ShowCard } from '../components/ShowCard';

type Props = NativeStackScreenProps<RootStackParamList, 'SeeAll'>;

const progressToEpisode = (p: PlaybackProgress): Episode => ({
  id: p.episodeId,
  showId: p.showId ?? '',
  title: p.episodeTitle ?? 'Bölüm',
  description: '',
  audioUrl: p.audioUrl ?? '',
  durationSec: p.durationSec,
  publishedAt: '',
  imageUrl: p.artworkUrl,
});

/**
 * SeeAll — bir carousel'in tam dikey listesi. Şovlar grid; bölümler ise TÜM
 * uygulamada ortak olan EpisodeRow (şov detayındaki listeleme) ile gösterilir —
 * böylece "Dinlemeye devam / Yeni / Sonra dinle" Tümü listeleri şov içi
 * listelemeyle aynı görünür. Satıra dokunma bölüm panelini (notlar) açar.
 */
export const SeeAllScreen: React.FC<Props> = ({ route }) => {
  const { kind, title } = route.params;
  const theme = useTheme();
  const navigation = useAppNavigation();
  const play = usePlayEpisode();
  const openSheet = useEpisodeSheetStore(s => s.open);
  const { width } = useWindowDimensions();

  const shows = useShowsQuery();
  const resume = useResumeList();
  const saved = useSavedEpisodes();
  const playlists = usePlaylists();
  const followed = useFollowedShows();
  const followedFeedUrls = useMemo(
    () => (followed.data ?? []).map(s => s.feedUrl),
    [followed.data],
  );
  const latest = useLatestEpisodes(followedFeedUrls);

  const pad = theme.spacing(2);
  const gap = theme.spacing(1.5);
  const colW = Math.floor((width - pad * 2 - gap) / 2);

  const openShow = (show: Show) =>
    navigation.navigate('ShowDetail', {
      showId: show.id,
      feedUrl: show.feedUrl,
      title: show.title,
    });

  // Bölüm listeli türler için satırlar. Dinlenme/ilerleme bilgisini satırın
  // kendisi sorar (bkz. useEpisodeStatus); burada yalnızca bölümler taşınır.
  const episodeRows: readonly Episode[] = useMemo(() => {
    if (kind === 'continue') {
      return (resume.data ?? []).filter(p => p.audioUrl).map(progressToEpisode);
    }
    if (kind === 'latest') {
      return latest.data ?? [];
    }
    if (kind === 'saved') {
      return saved.data ?? [];
    }
    return [];
  }, [kind, resume.data, latest.data, saved.data]);

  const renderBody = () => {
    // Kullanıcı listeleri — şovlarla aynı ızgara düzeninde.
    if (kind === 'playlists') {
      const items = userPlaylists(playlists.data);
      if (items.length === 0) {
        return <EmptyState title="Liste yok" description="Kütüphaneden yeni liste oluşturabilirsin." />;
      }
      return (
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          onScroll={scrimScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: pad, paddingBottom: theme.spacing(12) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {items.map(playlist => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                width={colW}
                onPress={() => navigation.navigate('PlaylistDetail', { playlistId: playlist.id })}
              />
            ))}
          </View>
        </ScrollView>
      );
    }

    if (kind === 'shows') {
      if (shows.isLoading) {
        return <LoadingView />;
      }
      return (
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          onScroll={scrimScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: pad, paddingBottom: theme.spacing(12) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {(shows.data ?? []).map(s => (
              <ShowCard key={s.id} show={s} width={colW} onPress={() => openShow(s)} />
            ))}
          </View>
        </ScrollView>
      );
    }

    const loading =
      (kind === 'latest' && latest.isLoading) || (kind === 'saved' && saved.isLoading);
    if (loading) {
      return <LoadingView />;
    }
    if (episodeRows.length === 0) {
      return <EmptyState title="Liste boş" description="Burada gösterilecek bölüm yok." />;
    }

    return (
      <FlashList
        data={episodeRows}
        keyExtractor={item => item.id}
        contentInsetAdjustmentBehavior="never"
        onScroll={scrimScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.spacing(12) }}
        renderItem={({ item, index }) => (
          <SwipeableEpisodeRow
            episode={item}
            onPress={() => openSheet(item)}
            onPlay={() => play(item, { episodes: [...episodeRows], index })}
          />
        )}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ImmersiveHeader title={title} onBack={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};
