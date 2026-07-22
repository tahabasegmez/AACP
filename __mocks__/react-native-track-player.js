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
};

const Capability = {
  Play: 'play',
  Pause: 'pause',
  Stop: 'stop',
  SeekTo: 'seek-to',
  JumpForward: 'jump-forward',
  JumpBackward: 'jump-backward',
};

const AppKilledPlaybackBehavior = {
  StopPlaybackAndRemoveNotification: 'stop-and-remove',
  ContinuePlayback: 'continue',
  PausePlayback: 'pause',
};

let listeners = {};
let calls = [];

const record = name => (...args) => {
  calls.push([name, ...args]);
  return Promise.resolve();
};

const TrackPlayer = {
  setupPlayer: record('setupPlayer'),
  updateOptions: record('updateOptions'),
  add: record('add'),
  reset: record('reset'),
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
};

module.exports = {
  __esModule: true,
  default: TrackPlayer,
  State,
  Event,
  Capability,
  AppKilledPlaybackBehavior,
};
