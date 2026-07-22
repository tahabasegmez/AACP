import { Episode } from '@domain/entities';
import { State } from 'react-native-track-player';
import { episodeToTrack, mapTrackPlayerState } from '../playbackMapping';

describe('mapTrackPlayerState', () => {
  it('track-player state → domain status', () => {
    expect(mapTrackPlayerState(State.Playing)).toBe('playing');
    expect(mapTrackPlayerState(State.Paused)).toBe('paused');
    expect(mapTrackPlayerState(State.Ready)).toBe('paused');
    expect(mapTrackPlayerState(State.Loading)).toBe('loading');
    expect(mapTrackPlayerState(State.Buffering)).toBe('buffering');
    expect(mapTrackPlayerState(State.Ended)).toBe('ended');
    expect(mapTrackPlayerState(State.Error)).toBe('error');
    expect(mapTrackPlayerState(State.Stopped)).toBe('idle');
    expect(mapTrackPlayerState(State.None)).toBe('idle');
  });
});

describe('episodeToTrack', () => {
  const episode: Episode = {
    id: 'ep1',
    showId: 'show1',
    title: 'Başlık',
    description: '',
    audioUrl: 'https://media/ep1.mp3',
    durationSec: 1200,
    publishedAt: '2026-07-20T00:00:00.000Z',
    imageUrl: 'https://img/ep1.jpg',
  };

  it('domain episode → track alanları', () => {
    const track = episodeToTrack(episode);
    expect(track.id).toBe('ep1');
    expect(track.url).toBe('https://media/ep1.mp3');
    expect(track.title).toBe('Başlık');
    expect(track.artwork).toBe('https://img/ep1.jpg');
    expect(track.duration).toBe(1200);
  });

  it('süre 0 ise duration undefined', () => {
    const track = episodeToTrack({ ...episode, durationSec: 0 });
    expect(track.duration).toBeUndefined();
  });
});
