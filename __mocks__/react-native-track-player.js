/**
 * react-native-track-player jest mock'u — testler native modül olmadan çalışsın diye.
 * Gerçek cihazda gerçek modül kullanılır.
 *
 * Ek olarak test yardımcıları sunar:
 *   __emit(event, payload)  → kayıtlı olay dinleyicilerini tetikler
 *   __getCalls()            → çağrılan metodların kaydı
 *   __reset()              → mock durumunu sıfırlar
 */
const State = {
  None: 'none',
  Ready: 'ready',
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
  Loading: 'loading',
  Buffering: 'buffering',
  Error: 'error',
  Ended: 'ended',
};

const Event = {
  PlaybackState: 'playback-state',
  PlaybackProgressUpdated: 'playback-progress-updated',
  PlaybackActiveTrackChanged: 'playback-active-track-changed',
  RemotePlay: 'remote-play',
  RemotePause: 'remote-pause',
  RemoteStop: 'remote-stop',
  RemoteSeek: 'remote-seek',
  RemoteJumpForward: 'remote-jump-forward',
  RemoteJumpBackward: 'remote-jump-backward',
  RemoteNext: 'remote-next',
  RemotePrevious: 'remote-previous',
  PlaybackQueueEnded: 'playback-queue-ended',
};

const Capability = {
  Play: 'play',
  Pause: 'pause',
  Stop: 'stop',
  SeekTo: 'seek',
  SkipToNext: 'next',
  SkipToPrevious: 'previous',
  JumpForward: 'jumpForward',
  JumpBackward: 'jumpBackward',
};

const AppKilledPlaybackBehavior = {
  StopPlaybackAndRemoveNotification: 'stop-and-remove',
  ContinuePlayback: 'continue',
  PausePlayback: 'pause',
};

const IOSCategory = { Playback: 'playback', Ambient: 'ambient' };
const IOSCategoryMode = { Default: 'default', SpokenAudio: 'spokenAudio' };

let listeners = {};
let calls = [];
/**
 * Kütüphanenin KENDİ kuyruğu.
 *
 * Uygulama sıralamayı artık track-player'a devrettiği için mock'un da gerçek
 * bir kuyruğu taklit etmesi gerekiyor: aksi halde "kullanıcı eklemesi çalanın
 * ardına girer" gibi kurallar test edilemezdi.
 */
let queue = [];
let activeIndex = -1;

const record = name => (...args) => {
  calls.push([name, ...args]);
  return Promise.resolve();
};

const TrackPlayer = {
  setupPlayer: record('setupPlayer'),
  updateOptions: record('updateOptions'),
  add: (tracks, insertBeforeIndex = -1) => {
    calls.push(['add', tracks, insertBeforeIndex]);
    const list = Array.isArray(tracks) ? tracks : [tracks];
    const at = insertBeforeIndex < 0 ? queue.length : insertBeforeIndex;
    queue.splice(at, 0, ...list);
    if (activeIndex >= at) {
      activeIndex += list.length;
    }
    return Promise.resolve();
  },
  setQueue: tracks => {
    calls.push(['setQueue', tracks]);
    queue = [...tracks];
    activeIndex = queue.length > 0 ? 0 : -1;
    return Promise.resolve();
  },
  getQueue: async () => queue,
  getActiveTrackIndex: async () => (activeIndex >= 0 ? activeIndex : undefined),
  skip: (index, initialPosition = -1) => {
    calls.push(['skip', index, initialPosition]);
    if (index >= 0 && index < queue.length) {
      activeIndex = index;
    }
    return Promise.resolve();
  },
  skipToNext: () => {
    calls.push(['skipToNext']);
    if (activeIndex >= 0 && activeIndex < queue.length - 1) {
      activeIndex += 1;
    }
    return Promise.resolve();
  },
  skipToPrevious: () => {
    calls.push(['skipToPrevious']);
    if (activeIndex > 0) {
      activeIndex -= 1;
    }
    return Promise.resolve();
  },
  move: (from, to) => {
    calls.push(['move', from, to]);
    const [moved] = queue.splice(from, 1);
    queue.splice(to, 0, moved);
    return Promise.resolve();
  },
  remove: indexes => {
    calls.push(['remove', indexes]);
    const list = Array.isArray(indexes) ? indexes : [indexes];
    queue = queue.filter((_, i) => !list.includes(i));
    return Promise.resolve();
  },
  updateNowPlayingMetadata: record('updateNowPlayingMetadata'),
  reset: () => {
    calls.push(['reset']);
    queue = [];
    activeIndex = -1;
    return Promise.resolve();
  },
  play: record('play'),
  pause: record('pause'),
  stop: record('stop'),
  seekTo: record('seekTo'),
  setRate: record('setRate'),
  getProgress: async () => ({ position: 0, duration: 0, buffered: 0 }),
  getPlaybackState: async () => ({ state: State.None }),
  registerPlaybackService: () => {},
  addEventListener: (event, cb) => {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
    return {
      remove: () => {
        listeners[event] = (listeners[event] || []).filter(l => l !== cb);
      },
    };
  },
};

// Test yardımcıları
TrackPlayer.__emit = (event, payload) => {
  (listeners[event] || []).forEach(cb => cb(payload));
};
TrackPlayer.__getCalls = () => calls;
TrackPlayer.__reset = () => {
  listeners = {};
  calls = [];
  queue = [];
  activeIndex = -1;
};
/** Testlerin kuyruğu doğrudan okuması için. */
TrackPlayer.__queue = () => ({ queue, activeIndex });

module.exports = {
  __esModule: true,
  default: TrackPlayer,
  State,
  Event,
  Capability,
  AppKilledPlaybackBehavior,
  IOSCategory,
  IOSCategoryMode,
};
