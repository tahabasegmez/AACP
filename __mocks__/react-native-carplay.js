/**
 * react-native-carplay jest mock'u — testler native (iOS-only) modül olmadan
 * çalışsın.
 *
 * Yalnızca controller'ın kullandığı yüzeyi taklit eder: CarPlay + kullanılan
 * şablonlar. Şablonlar config'i saklar ve `updateSections` gibi örnek
 * metotlarını kaydeder; testler bu kayıtlar üzerinden davranışı doğrular.
 */
const calls = [];

const CarPlay = {
  setRootTemplate: t => calls.push(['setRootTemplate', t]),
  pushTemplate: t => calls.push(['pushTemplate', t]),
  popTemplate: () => calls.push(['popTemplate', undefined]),
  popToRootTemplate: () => calls.push(['popToRootTemplate', undefined]),
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

  /** Gerçek şablonda içerik yerinde güncellenir; testte çağrı kaydedilir. */
  updateSections(sections) {
    this.config = { ...this.config, sections };
    calls.push(['updateSections', sections]);
  }
}

class TabBarTemplate {
  constructor(config) {
    this.config = config;
  }

  updateTemplates(config) {
    this.config = { ...this.config, ...config };
    calls.push(['updateTemplates', config]);
  }
}

class NowPlayingTemplate {
  constructor(config) {
    this.config = config;
  }
}

class GridTemplate {
  constructor(config) {
    this.config = config;
  }
}

module.exports = {
  CarPlay,
  ListTemplate,
  TabBarTemplate,
  NowPlayingTemplate,
  GridTemplate,
};
