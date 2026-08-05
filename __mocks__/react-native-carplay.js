/**
 * react-native-carplay jest mock'u — testler native (iOS-only) modül olmadan
 * çalışsın.
 *
 * Yalnızca controller'ın kullandığı yüzeyi taklit eder: CarPlay + kullanılan
 * şablonlar. Şablonlar config'i saklar ve `updateSections` gibi örnek
 * metotlarını kaydeder; testler bu kayıtlar üzerinden davranışı doğrular.
 */
const calls = [];

/**
 * Şablon kimliği üretir.
 *
 * Gerçek kütüphanede her şablonun benzersiz bir `id`si vardır ve gezinme
 * kararları (yığında mı, tepede mi) buna dayanır. Mock kimlik vermediğinde
 * tüm şablonlar `undefined` id ile eşit görünüyor ve testler gerçek davranışı
 * ölçmüyordu.
 */
let nextId = 0;
const makeId = type => `${type}-${(nextId += 1)}`;

const CarPlay = {
  setRootTemplate: t => calls.push(['setRootTemplate', t]),
  pushTemplate: t => calls.push(['pushTemplate', t]),
  popTemplate: () => calls.push(['popTemplate', undefined]),
  popToRootTemplate: () => calls.push(['popToRootTemplate', undefined]),
  popToTemplate: t => calls.push(['popToTemplate', t]),
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
    this.id = config.id || makeId('list');
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
    this.id = config.id || makeId('tabbar');
  }

  updateTemplates(config) {
    this.config = { ...this.config, ...config };
    calls.push(['updateTemplates', config]);
  }
}

class NowPlayingTemplate {
  constructor(config) {
    this.config = config;
    // Gerçekte SİNGLETON'dır: aynı native şablon, sabit kimlik.
    this.id = 'nowplaying';
  }
}

class GridTemplate {
  constructor(config) {
    this.config = config;
    this.id = config.id || makeId('grid');
  }
}

module.exports = {
  CarPlay,
  ListTemplate,
  TabBarTemplate,
  NowPlayingTemplate,
  GridTemplate,
};
