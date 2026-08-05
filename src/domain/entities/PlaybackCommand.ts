import { Episode } from './Episode';

/**
 * PlaybackCommand — bir cihaza "şunu çal" demek için bırakılan komut.
 *
 * Oynatma başka bir cihaza aktarıldığında hedef cihaz, ne çalacağını
 * KATALOĞA SORMADAN bilmelidir: bölüm bir aramada, bir listede ya da
 * indirilenlerde olabilir; hedef cihazın o bağlamı bulması gerekmemeli.
 * Bu yüzden komut, çalmaya yetecek kadar bölüm bilgisini kendi taşır.
 *
 * Açıklama gibi büyük alanlar TAŞINMAZ: komut veritabanında bir satırda
 * bekler ve yalnızca oynatmak için gerekenler anlamlıdır.
 */
export interface PlaybackCommand {
  readonly kind: 'play';
  readonly episode: EpisodeSnapshot;
  /** Oynatmanın başlayacağı saniye (kaynak cihazın kaldığı yer). */
  readonly positionSec: number;
  /**
   * Kaynak cihazın oynatma hızı. Konum ilerletilirken kullanılır: 1.5× ile
   * dinleyen birinin 10 saniyesi 15 saniyelik ses demektir.
   */
  readonly rate?: number;
  /**
   * Bilginin yaşı (ms) — SUNUCU hesaplar.
   *
   * Çalan cihaz konumunu her turda değil, seyrek yayınlar (yazma maliyeti).
   * Aradaki boşluk bu yaşla kapatılır. Damgayı gönderip istemciye
   * çıkarttırmak, cihaz saatleri kaymışsa yanlış saniyeden başlamak demekti;
   * bu yüzden farkı tek bir saat (sunucununki) ölçer.
   *
   * Yalnızca "şu an çalıyor" yayınında bulunur. Aktarılan komutta BULUNMAZ:
   * kaynak cihaz komutu gönderirken zaten susmuştu, geçen süre dinlenmiş
   * sayılmaz.
   */
  readonly ageMs?: number;
}

/** Bölümün oynatmaya yeten en küçük görünümü. */
export interface EpisodeSnapshot {
  readonly id: string;
  readonly showId: string;
  readonly title: string;
  readonly audioUrl: string;
  readonly durationSec: number;
  readonly imageUrl?: string;
}

/** Çalan bölümden aktarılabilir bir komut kurar. */
export const playCommand = (
  episode: Episode,
  positionSec: number,
  rate = 1,
): PlaybackCommand => ({
  kind: 'play',
  episode: {
    id: episode.id,
    showId: episode.showId,
    title: episode.title,
    audioUrl: episode.audioUrl,
    durationSec: episode.durationSec,
    imageUrl: episode.imageUrl,
  },
  positionSec: Math.max(0, Math.floor(positionSec)),
  rate,
});

/**
 * Komutun ŞU ANKİ konumu.
 *
 * Yayın seyrek yapılır; aradan geçen süre (sunucunun ölçtüğü `ageMs`) hızla
 * çarpılıp konuma eklenir. Yaş yoksa (aktarılan komut) konum olduğu gibi
 * kullanılır. Bölüm süresi biliniyorsa taşma kırpılır: yaşlanmış bir yayın
 * bölümün sonunu aşan bir saniye üretebilirdi.
 */
export const commandPositionSec = (command: PlaybackCommand): number => {
  if (!command.ageMs || command.ageMs <= 0) {
    return command.positionSec;
  }
  const advanced = command.positionSec + (command.ageMs / 1000) * (command.rate ?? 1);
  const duration = command.episode.durationSec;
  return duration > 0 ? Math.min(advanced, duration) : advanced;
};

/**
 * Komuttan çalınabilir bir bölüm kurar.
 *
 * Açıklama ve yayın tarihi komutta taşınmaz; oynatma için gerekmezler ve
 * hedef cihaz bölümü listede açtığında zaten kaynağından gelirler.
 */
export const commandEpisode = (command: PlaybackCommand): Episode => ({
  id: command.episode.id,
  showId: command.episode.showId,
  title: command.episode.title,
  description: '',
  audioUrl: command.episode.audioUrl,
  durationSec: command.episode.durationSec,
  publishedAt: '',
  imageUrl: command.episode.imageUrl,
});

/**
 * Gelen komutu doğrular.
 *
 * Sunucudan gelen jsonb serbest biçimlidir; çalınamayacak bir komutu
 * uygulamaya sokmak, sessizce boş bir oynatıcı bırakırdı.
 */
export const parsePlaybackCommand = (raw: unknown): PlaybackCommand | null => {
  const command = raw as Partial<PlaybackCommand> | null;
  const episode = command?.episode as Partial<EpisodeSnapshot> | undefined;
  if (command?.kind !== 'play' || !episode?.id || !episode.audioUrl) {
    return null;
  }
  return {
    kind: 'play',
    episode: {
      id: episode.id,
      showId: episode.showId ?? '',
      title: episode.title ?? 'Bölüm',
      audioUrl: episode.audioUrl,
      durationSec: episode.durationSec ?? 0,
      imageUrl: episode.imageUrl,
    },
    positionSec: typeof command.positionSec === 'number' ? command.positionSec : 0,
    rate: typeof command.rate === 'number' && command.rate > 0 ? command.rate : 1,
    ...(typeof command.ageMs === 'number' ? { ageMs: command.ageMs } : {}),
  };
};
