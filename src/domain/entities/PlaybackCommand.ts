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
export const playCommand = (episode: Episode, positionSec: number): PlaybackCommand => ({
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
});

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
  };
};
