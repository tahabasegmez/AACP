import { Capability } from 'react-native-track-player';

/**
 * Uzaktan kumanda yetenekleri — PLATFORMA GÖRE doğru biçimde.
 *
 * Neden kütüphanenin `Capability` enum'ı doğrudan kullanılmıyor:
 *
 * `Capability` değerlerini native `getConstants()`'tan okur:
 *
 * ```js
 * Capability["Play"] = Constants?.CAPABILITY_PLAY ?? 1;
 * ```
 *
 * Ama iOS bu sabitleri **metin** olarak verir (`"play"`, `"next"`…) — Swift
 * tarafı da öyle bekler:
 *
 * ```swift
 * var capabilitiesStr = options["capabilities"] as? [String] ?? []
 * player.remoteCommands = capabilitiesStr.compactMap { Capability(rawValue: $0) }
 * ```
 *
 * TurboModule şeması ise onları **sayı** olarak bildirir
 * (`NativeTrackPlayer.ts`: `CAPABILITY_PLAY: number`). New Architecture'da
 * codegen şemayı zorladığı için iOS'ta bu sabitler kullanılabilir metin olarak
 * gelmez; JS `?? 1` yedeğine düşüp SAYI gönderir, Swift'in `as? [String]`
 * dönüşümü başarısız olur ve **hiçbir uzaktan komut kaydedilmez**.
 *
 * Sonucu: iOS uygulamayı "şimdi çalan uygulama" saymaz — kilit ekranında ve
 * Dynamic Island'da oynatma kartı HİÇ görünmez.
 *
 * Android'de aynı sabitler gerçekten sayıdır ve şemayla uyuşur; orada enum
 * doğru çalışır. Bu yüzden liste platforma göre üretilir.
 */

/**
 * iOS'un Swift `Capability` enum'ının ham değerleri.
 *
 * Kütüphane düzeldiğinde bu tablo silinip yerine enum konabilir; o güne kadar
 * tek kaynak burasıdır.
 */
const IOS_CAPABILITIES = ['play', 'pause', 'stop', 'seek', 'next', 'previous'] as const;

/** Android'de enum sayısal sabitlerle sorunsuz çalışır. */
const ANDROID_CAPABILITIES: Capability[] = [
  Capability.Play,
  Capability.Pause,
  Capability.Stop,
  Capability.SeekTo,
  Capability.SkipToNext,
  Capability.SkipToPrevious,
];

/**
 * Android bildirimindeki TUŞLAR.
 *
 * `capabilities` uzaktan kumandanın ne KABUL ettiğini söyler; bu liste
 * bildirimde neyin ÇİZİLECEĞİNİ. `Stop` ve `SeekTo` dışarıda: durdurma
 * bildirimi kapatmakla aynı işi görür, sarma ise tuş değil sürgüdür.
 */
export const NOTIFICATION_CAPABILITIES: Capability[] = [
  Capability.Play,
  Capability.Pause,
  Capability.SkipToPrevious,
  Capability.SkipToNext,
];

/**
 * Oynatma kartındaki (kilit ekranı / Dynamic Island / CarPlay) kontroller.
 *
 * İleri/geri SARMA (`JumpForward/Backward`) bilinçli olarak YOK: iOS her iki
 * tuş çiftini birden göstermez, sarma açıkken "sonraki/önceki bölüm" gizlenir.
 * Araçta bölüm değiştirmek 15 sn sarmaktan daha sık gerekir; sarma zaten
 * sürgüyle (`seek`) yapılabiliyor.
 *
 * Dönüş tipi `Capability[]`: iOS'ta değerler metindir ama kütüphanenin imzası
 * enum ister. Dönüşüm tek yerde ve gerekçesiyle yapılır.
 */
export const remoteCapabilities = (os: string): Capability[] =>
  os === 'ios'
    ? (IOS_CAPABILITIES as unknown as Capability[])
    : ANDROID_CAPABILITIES;
