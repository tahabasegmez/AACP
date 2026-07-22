/**
 * react-native-carplay jest mock'u — testler native (iOS-only) modül olmadan çalışsın.
 * Yalnızca controller'ın kullandığı yüzeyi taklit eder: CarPlay + ListTemplate +
 * NowPlayingTemplate. Şablonlar config'i saklar; testler config üzerinden doğrular.
 */
const calls = [];

const CarPlay = {
  setRootTemplate: t => calls.push(['setRootTemplate', t]),
  pushTemplate: t => calls.push(['pushTemplate', t]),
  enableNowPlaying: b => calls.push(['enableNowPlaying', b]),
  registerOnConnect: cb => {
    CarPlay.__onConnect = cb;
  },
  registerOnDisconnect: cb => {
    CarPlay.__onDisconnect = cb;
  },
  __getCalls: () => calls,
  __reset: () => {
    calls.length = 0;
  },
};

class ListTemplate {
  constructor(config) {
    this.config = config;
  }
}

class NowPlayingTemplate {
  constructor(config) {
    this.config = config;
  }
}

module.exports = { CarPlay, ListTemplate, NowPlayingTemplate };
