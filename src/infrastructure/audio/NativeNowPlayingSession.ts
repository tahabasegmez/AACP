import { NativeModules, Platform } from 'react-native';
import { PlaybackStatus } from '@domain/entities';

/** Native modülün JS tarafındaki yüzeyi. */
interface NowPlayingSessionModule {
  setPlaybackState(state: NowPlayingState): void;
}

/** Sisteme bildirilen üç durum; native taraf bunları eşler. */
type NowPlayingState = 'playing' | 'paused' | 'stopped';

/**
 * Domain oynatma durumunu sistemin kartına çevirir.
 *
 * Ara durumlar (yükleniyor, tamponluyor) "çalıyor" sayılır: kullanıcı oynata
 * bastıysa kart hemen belirmeli, ilk parça yüklenene kadar kaybolmamalı.
 */
const toNowPlayingState = (status: PlaybackStatus): NowPlayingState => {
  switch (status) {
    case 'playing':
    case 'loading':
    case 'buffering':
      return 'playing';
    case 'paused':
      return 'paused';
    default:
      return 'stopped';
  }
};

/**
 * NativeNowPlayingSession — sistemin oynatma kartında track-player'ın
 * yazmadığı alanları tamamlar (bkz. ios/AACP/NowPlayingSession.swift).
 *
 * NEDEN AYRI: `nowPlayingInfo` kartın İÇERİĞİNİ taşır (bunu track-player
 * dolduruyor); oynatmanın sürüp sürmediğini ve öğenin bir SES PARÇASI
 * olduğunu söyleyen alanları ise hiç kimse yazmıyor. Yazılmayınca iOS
 * uygulamayı "çalan oynatıcı" saymıyor ve kartı eksik çiziyor — kapak ve
 * sürgü gelirken taşıma tuşları ve çalıyor göstergesi gelmiyor.
 *
 * Modül yoksa (Android ya da bu native dosyaları içermeyen bir iOS build'i)
 * sessizce devre dışı kalır — oynatma etkilenmez.
 */
export class NativeNowPlayingSession {
  private readonly module?: NowPlayingSessionModule;
  /** En son bildirilen durum + parça; aynı kartı tekrar yazmamak için. */
  private last?: string;

  constructor() {
    // Yalnızca iOS'ta anlamlı; Android'de kart bildirimle çizilir.
    this.module =
      Platform.OS === 'ios'
        ? (NativeModules.NowPlayingSession as NowPlayingSessionModule | undefined)
        : undefined;
  }

  get available(): boolean {
    return typeof this.module?.setPlaybackState === 'function';
  }

  /**
   * Kartı tazeler — durum ya da çalan parça DEĞİŞTİYSE.
   *
   * Bu iki an, track-player'ın kartı baştan yazdığı anlardır: tamamlama tam
   * o zaman yapılmalı, yoksa eklediğimiz alanlar silinmiş olarak kalır.
   * Oynatma sürerken kart yeniden yazılmadığı için saniyede bir tazelemeye
   * gerek yoktur.
   */
  sync(status: PlaybackStatus, episodeId: string | null): void {
    const state = toNowPlayingState(status);
    const key = `${state}:${episodeId ?? ''}`;
    if (key === this.last) {
      return;
    }
    this.last = key;
    this.module?.setPlaybackState(state);
  }
}
