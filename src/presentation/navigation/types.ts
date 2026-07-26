import type { NavigatorScreenParams } from '@react-navigation/native';

/** Alt sekmeler. */
export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Library: undefined;
};

/** "Tümü" ile açılan tam liste ekranının türü. */
export type SeeAllKind = 'shows' | 'continue' | 'latest' | 'saved';

/** Kök stack — sekmeler + detay/player/tam-liste (üstte). */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ShowDetail: { showId: string; feedUrl?: string; title?: string };
  Player: { episodeId: string } | undefined;
  SeeAll: { kind: SeeAllKind; title: string };
  Settings: undefined;
  /** Oynatma kuyruğu ("Sıradakiler"). */
  Queue: undefined;
  /** İndirilen bölümlerin yönetimi. */
  Downloads: undefined;
};
