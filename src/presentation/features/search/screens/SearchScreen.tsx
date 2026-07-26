import React, { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { EmptyState, LoadingView } from '../../../shared/components';
import { Screen, ScreenHeader, SearchField, scrimScrollHandler } from '../../../ui';
import { useShowsQuery } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { ShowCard } from '../../home/components/ShowCard';

const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * SearchScreen — şov arama. (Bölüm araması tek şov içinde, şov detayında yapılır.)
 * Katalog küçük olduğu için istemci tarafı filtre yeterli.
 */
export const SearchScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const shows = useShowsQuery();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const query = trLower(q.trim());
    const all = shows.data ?? [];
    if (!query) {
      return all;
    }
    return all.filter(
      s => trLower(s.title).includes(query) || trLower(s.author).includes(query),
    );
  }, [q, shows.data]);

  const pad = theme.spacing(2);
  const gap = theme.spacing(1.5);
  const colW = Math.floor((width - pad * 2 - gap) / 2);

  const openShow = (show: Show) =>
    navigation.navigate('ShowDetail', {
      showId: show.id,
      feedUrl: show.feedUrl,
      title: show.title,
    });

  return (
    <Screen>
      <ScreenHeader title="Ara" />
      <SearchField value={q} onChangeText={setQ} placeholder="Şov ara" />

      {shows.isLoading ? (
        <LoadingView />
      ) : results.length === 0 ? (
        <EmptyState title="Sonuç yok" description={`"${q}" için şov bulunamadı.`} />
      ) : (
        <ScrollView
          onScroll={scrimScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: pad, paddingTop: theme.spacing(1), paddingBottom: theme.spacing(10) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {results.map(s => (
              <ShowCard key={s.id} show={s} width={colW} onPress={() => openShow(s)} />
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
};
