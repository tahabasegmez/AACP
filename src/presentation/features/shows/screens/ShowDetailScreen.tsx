import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { useFeedQuery } from '../../../query';
import { useDependencies } from '../../../di';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowDetail'>;

/**
 * ShowDetailScreen — bir şovun bölüm listesi. Bölüme dokununca oynatır.
 */
export const ShowDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const theme = useTheme();
  const { feedUrl } = route.params;
  const { playEpisode } = useDependencies();
  const { data: feed, isLoading } = useFeedQuery(feedUrl);

  const onPlay = async (episode: Episode) => {
    await playEpisode.execute({ episode });
    navigation.navigate('Player', { episodeId: episode.id });
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Episode }) => (
    <Pressable onPress={() => onPlay(item)} style={{ padding: theme.spacing(2) }}>
      <Text style={{ color: theme.colors.text, fontSize: 15 }}>{item.title}</Text>
      <Text style={{ color: theme.colors.textMuted }}>
        {formatDuration(item.durationSec)}
      </Text>
    </Pressable>
  );

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      data={feed?.episodes}
      keyExtractor={item => item.id}
      renderItem={renderItem}
    />
  );
};
