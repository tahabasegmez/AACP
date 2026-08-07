import { Capability } from 'react-native-track-player';

/**
 * Oynatma kartındaki (kilit ekranı, Dynamic Island, CarPlay, Android bildirimi)
 * TAŞIMA TUŞLARININ tek karar noktası.
 *
 * Ayrı bir dosyada duruyor çünkü bu bir **ürün kararı**, oynatıcı ayarı değil:
 * hangi tuşların çıkacağı sürücü/dinleyici davranışına göre değişir ve
 * gerekçesiyle birlikte tek yerde durmalı. `TrackPlayerAudioService` yalnızca
 * bu listeyi uygular.
 */

/**
 * iOS kartta **en fazla üç** taşıma tuşu çizer ve iki tuş çiftini BİRDEN
 * göstermez: ya bölüm değiştirme ya sarma.
 *
 *  - `episode` → ⏮ ⏯ ⏭ — kuyrukta önceki/sonraki bölüm,
 *  - `seek`    → ⏪ ⏯ ⏩ — bölüm içinde geri/ileri sarma (podcast geleneği).
 *
 * Seçim **uygulama geneldir**: kilit ekranı, Dynamic Island ve CarPlay aynı
 * kümeyi gösterir. `seek` seçildiğinde araçta bölüm değiştirme tuşları
 * kaybolur (kuyruk yine CarPlay'in "Sıradakiler" listesinden gezilebilir).
 */
export type RemoteControlLayout = 'episode' | 'seek';

/**
 * Uygulamanın seçimi: **bölüm değiştirme**.
 *
 * Araçta bölüm değiştirmek sarmadan daha sık gerekir ve sarma zaten sürgüyle
 * yapılabiliyor. Karar `seek`e çevrilirse tek değişecek yer burasıdır; bedeli
 * CarPlay ve kilit ekranında önceki/sonraki bölüm tuşlarının kaybolmasıdır.
 */
export const REMOTE_CONTROL_LAYOUT: RemoteControlLayout = 'episode';

/** Sarma tuşlarının adımları — Apple Podcasts'in alışkanlık yarattığı değerler. */
export const SEEK_FORWARD_SEC = 30;
export const SEEK_BACKWARD_SEC = 15;

/**
 * Uzaktan kumandanın KABUL ETTİĞİ komutlar.
 *
 * `Stop` bilinçli olarak YOK: Apple onu canlı yayınlar için ayırır ve açık
 * bırakıldığında sistem duraklat yerine bir "durdur" karesi çizebiliyor.
 * Podcast'te doğru fiil duraklatmaktır; durdurma zaten kartı kapatmakla
 * aynı işi görür.
 *
 * `SeekTo` her zaman açıktır: sürgüyle konum değiştirme tuşlardan bağımsızdır
 * ve iki düzende de çalışır.
 */
export const remoteCapabilities = (layout: RemoteControlLayout): Capability[] => [
  Capability.Play,
  Capability.Pause,
  Capability.SeekTo,
  ...(layout === 'seek'
    ? [Capability.JumpForward, Capability.JumpBackward]
    : [Capability.SkipToNext, Capability.SkipToPrevious]),
];

/**
 * Android bildirimindeki ÇİZİLEN tuşlar.
 *
 * `remoteCapabilities` uzaktan kumandanın neyi kabul ettiğini söyler; bu liste
 * bildirimde neyin görüneceğini. `SeekTo` dışarıda: o bir tuş değil sürgüdür.
 */
export const notificationCapabilities = (layout: RemoteControlLayout): Capability[] =>
  remoteCapabilities(layout).filter(capability => capability !== Capability.SeekTo);
