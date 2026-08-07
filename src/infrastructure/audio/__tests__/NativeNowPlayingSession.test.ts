import { NativeModules, Platform } from 'react-native';
import { NativeNowPlayingSession } from '../NativeNowPlayingSession';

const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  Platform.OS = 'ios';
  (NativeModules as Record<string, unknown>).NowPlayingSession = {
    setPlaybackState: (state: string) => calls.push(state),
  };
});

afterEach(() => {
  delete (NativeModules as Record<string, unknown>).NowPlayingSession;
});

describe('NativeNowPlayingSession', () => {
  it('oynatma durumunu sisteme bildirir', () => {
    const session = new NativeNowPlayingSession();

    session.sync('playing', 'ep1');
    session.sync('paused', 'ep1');
    session.sync('idle', 'ep1');

    expect(calls).toEqual(['playing', 'paused', 'stopped']);
  });

  it('ARA durumlar "çalıyor" sayılır', () => {
    // Kullanıcı oynata bastığında kart hemen belirmeli; ilk parça yüklenene
    // kadar "durdu" demek kartı yanıp sönerdi.
    const session = new NativeNowPlayingSession();

    session.sync('loading', 'ep1');
    session.sync('buffering', 'ep1');
    session.sync('playing', 'ep1');

    expect(calls).toEqual(['playing']);
  });

  it('aynı durum tekrar bildirilmez', () => {
    const session = new NativeNowPlayingSession();

    session.sync('playing', 'ep1');
    session.sync('playing', 'ep1');

    expect(calls).toEqual(['playing']);
  });

  it('parça değişince kart YENİDEN tamamlanır', () => {
    // track-player kartı parça değişiminde baştan yazar ve eklediğimiz
    // alanları siler; durum aynı kalsa bile tazelemek gerekir.
    const session = new NativeNowPlayingSession();

    session.sync('playing', 'ep1');
    session.sync('playing', 'ep2');

    expect(calls).toEqual(['playing', 'playing']);
  });

  it('modül yoksa sessizce devre dışı kalır', () => {
    delete (NativeModules as Record<string, unknown>).NowPlayingSession;
    const session = new NativeNowPlayingSession();

    expect(session.available).toBe(false);
    expect(() => session.sync('playing', 'ep1')).not.toThrow();
  });

  it("Android'de native modül aranmaz (kart bildirimle çizilir)", () => {
    Platform.OS = 'android';
    const session = new NativeNowPlayingSession();

    session.sync('playing', 'ep1');

    expect(session.available).toBe(false);
    expect(calls).toEqual([]);
  });
});
