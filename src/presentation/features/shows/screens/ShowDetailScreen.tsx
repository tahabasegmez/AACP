import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { useShowEpisodes } from '../../../query';
import { useDependencies } from '../../../di';
import { usePlayerStore } from '../../../stores';
import { EmptyState, ErrorView, LoadingView } from '../../../shared/components';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowDetail'>;

/**
 * ShowDetailScreen — bir şovun bölüm listesi (sayfalı/sonsuz kaydırma).
 *
 * Bölümler `useShowEpisodes` ile parça parça gelir (büyük feed'ler için).
 * Şov başlığı/açıklaması feed + katalog birleşiminden (use case içinde) zenginleşir.
 * Bölüme dokununca "kaldığın yerden" çalar.
 */
export const ShowDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const theme = useTheme();
  const { feedUrl } = route.params;
  const { continueEpisode } = useDependencies();
  const setCurrentEpisode = usePlayerStore(s => s.setCurrentEpisode);
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

  // Sayfaları tek listeye indir; şov meta verisini ilk sayfadan al.
  const episodes = useMemo(
    () => data?.pages.flatMap(p => p.episodes.items) ?? [],
    [data],
  );
  const show = data?.pages[0]?.show;

  const onPlay = async (episode: Episode) => {
    // Oynatıcı ekranının başlık/görsel gösterebilmesi için seçili bölümü paylaş.
    setCurrentEpisode(episode);
    await continueEpisode.execute({ episode });
    navigation.navigate('Player', { episodeId: episode.id });
  };

  if (isLoading) {
    return <LoadingView />;
  }
  if (isError) {
    return <ErrorView error={error} onRetry={refetch} />;
  }
  if (episodes.length === 0) {
    return (
      <EmptyState
        title="Bölüm yok"
        description="Bu şovda henüz yayınlanmış bölüm bulunmuyor."
      />
    );
  }

  const renderItem = ({ item }: { item: Episode }) => (
    <Pressable onPress={() => onPlay(item)} style={{ padding: theme.spacing(2) }}>
      <Text style={{ color: theme.colors.text, fontSize: 15 }}>{item.title}</Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing(0.5) }}>
        {formatDuration(item.durationSec)}
      </Text>
    </Pressable>
  );

  const Header = show ? (
    <View style={{ padding: theme.spacing(2) }}>
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>
        {show.title}
      </Text>
      {!!show.description && (
        <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing(1) }}>
          {show.description}
        </Text>
      )}
    </View>
  ) : null;

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      data={episodes}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      ListHeaderComponent={Header}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
    />
  );
};
