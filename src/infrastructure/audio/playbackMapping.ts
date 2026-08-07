import { Episode, PlaybackStatus } from '@domain/entities';
import { QueueItem } from '@domain/services';
import { State, type AddTrack, type NowPlayingMetadata } from 'react-native-track-player';

/**
 * track-player <-> domain arasındaki SAF dönüşümler.
 *
 * Ayrı ve saf tutuluyor ki native modül olmadan (jest'te) tam test edilebilsin;
 * TrackPlayerAudioService yalnızca bu fonksiyonları kullanan ince bir sarmalayıcı.
 */

/** track-player State enum'ını domain PlaybackStatus'una çevirir. */
export const mapTrackPlayerState = (state: State): PlaybackStatus => {
  switch (state) {
    case State.Playing:
      return 'playing';
    case State.Paused:
    case State.Ready:
      return 'paused';
    case State.Loading:
      return 'loading';
    case State.Buffering:
      return 'buffering';
    case State.Ended:
      return 'ended';
    case State.Error:
      return 'error';
    case State.Stopped:
    case State.None:
    default:
      return 'idle';
  }
};

/** Şov adı bilinmediğinde oynatma kartında görünecek ad. */
const PUBLISHER = 'AACP';

/**
 * Domain Episode'unu track-player'ın çalabileceği bir track nesnesine çevirir.
 *
 * Buradaki alanlar aynı zamanda **oynatma kartını** besler (kilit ekranı,
 * Dynamic Island, CarPlay Now Playing): iOS içeriği `MPNowPlayingInfoCenter`'dan
 * okur. Bu yüzden şov adı `artist` olarak da verilir — kartta yalnızca bölüm
 * başlığının görünmesi bilgiyi eksik bırakır.
 *
 * `album` bilinçli olarak DOLDURULMAZ: CarPlay hem sanatçıyı hem albümü ayrı
 * satırlarda gösterdiği için şov adı ekranda iki kez çıkıyordu.
 */
export const episodeToTrack = (item: QueueItem): AddTrack => ({
  id: item.episode.id,
  url: item.episode.audioUrl,
  ...episodeToNowPlaying(item.episode),
  // Kuyruk artık OYNATICIDA yaşadığı için domain verisi parçanın üstünde
  // taşınır: kütüphane tanımadığı alanları olduğu gibi saklar ve `getQueue()`
  // ile geri verir (`Track.originalObject`). Böylece kuyruğu okumak için
  // ikinci bir kayıt tutmak gerekmez.
  [EPISODE_KEY]: item.episode,
  [SOURCE_KEY]: item.source,
});

/** Parçanın üstünde taşınan domain alanları (kütüphane bunları yorumlamaz). */
const EPISODE_KEY = 'aacpEpisode';
const SOURCE_KEY = 'aacpSource';

/**
 * Parçayı kuyruk öğesine geri çevirir.
 *
 * Beklenen alanlar yoksa (ör. kütüphane sürümü değişip özel alanları
 * düşürürse) öğe atlanır: yarım bir bölümle çalışmaktansa kuyrukta
 * göstermemek yeğdir.
 */
export const trackToQueueItem = (track: unknown): QueueItem | null => {
  const raw = track as Record<string, unknown> | null;
  const episode = raw?.[EPISODE_KEY] as Episode | undefined;
  if (!episode?.id) {
    return null;
  }
  return {
    episode,
    source: raw?.[SOURCE_KEY] === 'user' ? 'user' : 'context',
  };
};

/**
 * Oynatma kartına yazılacak meta veri.
 *
 * track-player parça eklenirken kartı kendisi de doldurur, ama parça
 * değiştiğinde kartın boş kaldığı durumlar görüldü (özellikle CarPlay). Bu
 * yüzden oynatma başladıktan sonra kart AÇIKÇA tazelenir; aynı alanlar tek
 * yerden üretilir ki ikisi ayrışmasın.
 */
export const episodeToNowPlaying = (episode: Episode): NowPlayingMetadata => ({
  title: episode.title,
  artist: episode.showTitle ?? PUBLISHER,
  artwork: episode.imageUrl,
  duration: episode.durationSec > 0 ? episode.durationSec : undefined,
});
