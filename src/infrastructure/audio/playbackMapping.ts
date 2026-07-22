import { Episode, PlaybackStatus } from '@domain/entities';
import { State, type AddTrack } from 'react-native-track-player';

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

/** Domain Episode'unu track-player'ın çalabileceği bir track nesnesine çevirir. */
export const episodeToTrack = (episode: Episode): AddTrack => ({
  id: episode.id,
  url: episode.audioUrl,
  title: episode.title,
  artist: 'Anadolu Ajansı',
  artwork: episode.imageUrl,
  duration: episode.durationSec > 0 ? episode.durationSec : undefined,
});
