import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Episode, PlaybackProgress, Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { Screen, Skeleton } from '../../../ui';
import {
  useFollowedShows,
  useLatestEpisodes,
  useResumeList,
  useShowsQuery,
} from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { HomeHeader } from '../components/HomeHeader';
import { SectionHeader } from '../components/SectionHeader';
import { HScroll } from '../components/HScroll';
import { ShowCard } from '../components/ShowCard';
import { ContinueCard } from '../components/ContinueCard';
import { EpisodeCard } from '../components/EpisodeCard';

/** progress kaydından (meta'sıyla) çalınabilir bir Episode kurar. */
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

export const HomeScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const play = usePlayEpisode();

  const shows = useShowsQuery();
  const resume = useResumeList();
  const followed = useFollowedShows();

  const followedFeedUrls = useMemo(
    () => (followed.data ?? []).map(s => s.feedUrl),
    [followed.data],
  );
  const latest = useLatestEpisodes(followedFeedUrls);

  // showId → Show (kart alt başlıkları için).
  const showById = useMemo(() => {
    const map = new Map<string, Show>();
    (shows.data ?? []).forEach(s => map.set(s.id, s));
    return map;
  }, [shows.data]);

  const resumeItems = (resume.data ?? []).filter(p => p.audioUrl);
  const latestItems = latest.data ?? [];
  const showItems = shows.data ?? [];

  const refreshing =
    shows.isFetching || resume.isFetching || followed.isFetching;
  const onRefresh = () => {
    shows.refetch();
    resume.refetch();
    followed.refetch();
    latest.refetch();
  };

  const openShow = (show: Show) =>
    navigation.navigate('ShowDetail', {
      showId: show.id,
      feedUrl: show.feedUrl,
      title: show.title,
    });

  return (
    <Screen edges={{ top: false }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.spacing(10) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.textMuted}
          />
        }>
        <HomeHeader />

        <View style={{ height: theme.spacing(1) }} />

        {shows.isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {resumeItems.length > 0 && (
              <View style={{ marginBottom: theme.spacing(2.5) }}>
                <SectionHeader
                  title="Dinlemeye devam"
                  onSeeAll={() =>
                    navigation.navigate('SeeAll', { kind: 'continue', title: 'Dinlemeye devam' })
                  }
                />
                <HScroll>
                  {resumeItems.map(p => (
                    <ContinueCard
                      key={p.episodeId}
                      progress={p}
                      showTitle={showById.get(p.showId ?? '')?.title ?? ''}
                      onPress={() => play(progressToEpisode(p))}
                    />
                  ))}
                </HScroll>
              </View>
            )}

            {latestItems.length > 0 && (
              <View style={{ marginBottom: theme.spacing(2.5) }}>
                <SectionHeader
                  title="Takip ettiklerinden yeni"
                  onSeeAll={() =>
                    navigation.navigate('SeeAll', { kind: 'latest', title: 'Yeni bölümler' })
                  }
                />
                <HScroll>
                  {latestItems.map(ep => (
                    <EpisodeCard
                      key={ep.id}
                      episode={ep}
                      showTitle={showById.get(ep.showId)?.title ?? ''}
                      onPress={() => play(ep)}
                    />
                  ))}
                </HScroll>
              </View>
            )}

            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <SectionHeader
                title="Tüm şovlar"
                onSeeAll={() =>
                  navigation.navigate('SeeAll', { kind: 'shows', title: 'Tüm şovlar' })
                }
              />
              <HScroll>
                {showItems.map(s => (
                  <ShowCard key={s.id} show={s} onPress={() => openShow(s)} />
                ))}
              </HScroll>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const LoadingSkeleton: React.FC = () => {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing(2), gap: theme.spacing(2) }}>
      <Skeleton width={160} height={18} />
      <View style={{ flexDirection: 'row', gap: theme.spacing(1.5) }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ gap: theme.spacing(1) }}>
            <Skeleton width={132} height={132} radius={theme.radius.lg} />
            <Skeleton width={100} height={12} />
            <Skeleton width={70} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
};
