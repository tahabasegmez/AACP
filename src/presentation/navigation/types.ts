/**
 * Navigasyon rota tipleri — tip güvenli navigasyon için tek kaynak.
 * Yeni ekran eklerken parametrelerini buraya yaz; navigation.navigate tipli olsun.
 */
export type RootStackParamList = {
  ShowList: undefined;
  ShowDetail: { showId: string; feedUrl?: string; title?: string };
  Player: { episodeId: string } | undefined;
};
