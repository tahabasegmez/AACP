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
  useShowsQuery,
} from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import type { RootStackParamList } from '../../../navigation/types';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { ShowCard } from '../components/ShowCard';
import { ContinueCard } from '../components/ContinueCard';
import { EpisodeCard } from '../components/EpisodeCard';

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
 * SeeAll — bir carousel'in tam dikey listesi (şovlar grid, bölümler liste).
 * Native header yerine ImmersiveHeader (island'a kadar tam ekran, dairesiz geri).
 */
export const SeeAllScreen: React.FC<Props> = ({ route }) => {
  const { kind, title } = route.params;
  const theme = useTheme();
  const navigation = useAppNavigation();
  const play = usePlayEpisode();
  const { width } = useWindowDimensions();

  const shows = useShowsQuery();
  const resume = useResumeList();
  const followed = useFollowedShows();
  const followedFeedUrls = useMemo(
    () => (followed.data ?? []).map(s => s.feedUrl),
    [followed.data],
  );
  const latest = useLatestEpisodes(followedFeedUrls);

  const showById = useMemo(() => {
    const map = new Map<string, Show>();
    (shows.data ?? []).forEach(s => map.set(s.id, s));
    return map;
  }, [shows.data]);

  const pad = theme.spacing(2);
  const gap = theme.spacing(1.5);
  const colW = Math.floor((width - pad * 2 - gap) / 2);
  const fullW = width - pad * 2;

  const openShow = (show: Show) =>
    navigation.navigate('ShowDetail', {
      showId: show.id,
      feedUrl: show.feedUrl,
      title: show.title,
    });

  const renderBody = () => {
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

    if (kind === 'continue') {
      const items = (resume.data ?? []).filter(p => p.audioUrl);
      if (items.length === 0) {
        return <EmptyState title="Liste boş" description="Yarıda bıraktığın bölüm yok." />;
      }
      return (
        <FlashList
          data={items}
          keyExtractor={p => p.episodeId}
          contentInsetAdjustmentBehavior="never"
          onScroll={scrimScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: pad, paddingBottom: theme.spacing(12) }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item }) => (
            <ContinueCard
              progress={item}
              width={fullW}
              showTitle={showById.get(item.showId ?? '')?.title ?? ''}
              onPress={() => play(progressToEpisode(item))}
            />
          )}
        />
      );
    }

    // latest
    const items = latest.data ?? [];
    if (latest.isLoading) {
      return <LoadingView />;
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title="Henüz yok"
          description="Takip ettiğin şovlardan yeni bölüm geldiğinde burada listelenir."
        />
      );
    }
    return (
      <FlashList
        data={items}
        keyExtractor={ep => ep.id}
        contentInsetAdjustmentBehavior="never"
        onScroll={scrimScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: pad, paddingBottom: theme.spacing(12) }}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        renderItem={({ item }) => (
          <EpisodeCard
            episode={item}
            width={fullW}
            showTitle={showById.get(item.showId)?.title ?? ''}
            onPress={() => play(item)}
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
