import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Episode } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, Text } from '../../../ui';
import { useResumeList, useShowEpisodes } from '../../../query';
import { useIsFollowed, useToggleFollow } from '../../../query';
import { EmptyState, ErrorView, LoadingView } from '../../../shared/components';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useEpisodeSheetStore } from '../../../stores';
import type { RootStackParamList } from '../../../navigation/types';
import { EpisodeRow } from '../components/EpisodeRow';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowDetail'>;

/**
 * ShowDetailScreen — Spotify albüm mantığında şov ekranı.
 * Kapaktan türeyen degrade hero, Takip et, ve sayfalı bölüm listesi (FlashList).
 */
export const ShowDetailScreen: React.FC<Props> = ({ route }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { showId, feedUrl } = route.params;
  const play = usePlayEpisode();
  const openSheet = useEpisodeSheetStore(s => s.open);
  const [expanded, setExpanded] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useShowEpisodes(feedUrl);
  const resume = useResumeList();
  const followed = useIsFollowed(showId);
  const toggleFollow = useToggleFollow();

  const episodes = useMemo(
    () => data?.pages.flatMap(p => p.episodes.items) ?? [],
    [data],
  );
  const show = data?.pages[0]?.show;

  // Kaldığın-yer çubukları için episodeId → oran haritası.
  const progressById = useMemo(() => {
    const map = new Map<string, number>();
    (resume.data ?? []).forEach(p => {
      if (p.durationSec > 0) {
        map.set(p.episodeId, p.positionSec / p.durationSec);
      }
    });
    return map;
  }, [resume.data]);

  if (isLoading) {
    return <LoadingView />;
  }
  if (isError) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  const Header = (
    <View>
      <LinearGradient
        colors={[theme.colors.brand, theme.colors.elevated, theme.colors.bg]}
        style={{
          paddingTop: insets.top + theme.spacing(6),
          paddingBottom: theme.spacing(2),
          alignItems: 'center',
        }}>
        <CoverImage uri={show?.imageUrl} size={160} radius={theme.radius.md} />
        <Text variant="title" style={{ marginTop: theme.spacing(2), textAlign: 'center', paddingHorizontal: theme.spacing(2) }}>
          {show?.title ?? route.params.title ?? ''}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
          {show?.author}
          {show?.categories?.length ? ` · ${show.categories[0]}` : ''}
        </Text>
        {!!show?.description && (
          <Pressable onPress={() => setExpanded(v => !v)} style={{ paddingHorizontal: theme.spacing(2.5) }}>
            <Text
              variant="caption"
              color={theme.colors.textMuted}
              numberOfLines={expanded ? undefined : 2}
              style={{ textAlign: 'center', marginTop: theme.spacing(1.25) }}>
              {show.description}
            </Text>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2.5), marginTop: theme.spacing(2) }}>
          <Pressable
            onPress={() => toggleFollow.mutate(showId)}
            accessibilityRole="button"
            accessibilityLabel={followed.data ? 'Takibi bırak' : 'Takip et'}
            style={{
              borderWidth: 1.5,
              borderColor: followed.data ? theme.colors.accent : theme.colors.textMuted,
              borderRadius: theme.radius.pill,
              paddingVertical: theme.spacing(1),
              paddingHorizontal: theme.spacing(2.25),
            }}>
            <Text variant="subtitle" color={followed.data ? theme.colors.accent : theme.colors.text}>
              {followed.data ? '✓ Takip ediliyor' : 'Takip et'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => episodes[0] && play(episodes[0])}
            accessibilityRole="button"
            accessibilityLabel="En yeni bölümü çal"
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.accent,
            }}>
            <Icon name="play" size={24} color={theme.colors.onAccent} />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );

  if (episodes.length === 0) {
    return (
      <>
        {Header}
        <EmptyState title="Bölüm yok" description="Bu şovda henüz yayınlanmış bölüm bulunmuyor." />
      </>
    );
  }

  return (
    <FlashList
      data={episodes}
      keyExtractor={item => item.id}
      ListHeaderComponent={Header}
      contentContainerStyle={{ paddingBottom: theme.spacing(12) }}
      renderItem={({ item }: { item: Episode }) => (
        <EpisodeRow
          episode={item}
          progress={progressById.get(item.id)}
          onPress={() => openSheet(item)}
          onPlay={() =>
            play(item, { episodes, index: episodes.findIndex(e => e.id === item.id) })
          }
        />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
    />
  );
};
