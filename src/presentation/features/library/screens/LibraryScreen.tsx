import React from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { EmptyState, ErrorView, LoadingView } from '../../../shared/components';
import { Icon, Screen, Text } from '../../../ui';
import { useFollowedShows } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { ShowCard } from '../../home/components/ShowCard';

/**
 * LibraryScreen — Kütüphane. İlk sürümde takip edilen şovlar.
 * (İndirilenler, Geçmiş ve "Sonra dinle" bölümleri sonraki aşamalarda eklenecek.)
 */
export const LibraryScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const followed = useFollowedShows();

  const pad = theme.spacing(2);
  const gap = theme.spacing(1.5);
  const colW = Math.floor((width - pad * 2 - gap) / 2);

  const openShow = (show: Show) =>
    navigation.navigate('ShowDetail', {
      showId: show.id,
      feedUrl: show.feedUrl,
      title: show.title,
    });

  const body = () => {
    if (followed.isLoading) {
      return <LoadingView />;
    }
    if (followed.isError) {
      return <ErrorView error={followed.error} onRetry={followed.refetch} />;
    }
    const shows = followed.data ?? [];
    if (shows.length === 0) {
      return (
        <EmptyState
          title="Henüz takip yok"
          description="Bir şovu takip et; buradan ve ana sayfadan hızlıca ulaş."
        />
      );
    }
    return (
      <ScrollView contentContainerStyle={{ padding: pad, paddingTop: theme.spacing(1) }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {shows.map(s => (
            <ShowCard key={s.id} show={s} width={colW} onPress={() => openShow(s)} />
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: pad,
          paddingBottom: theme.spacing(0.5),
        }}>
        <View>
          <Text variant="title">Kütüphane</Text>
          <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 2 }}>
            Takip ettiğin şovlar
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Tabs', { screen: 'Search' })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Şov ara">
          <Icon name="search" size={24} color={theme.colors.text} />
        </Pressable>
      </View>
      {body()}
    </Screen>
  );
};
