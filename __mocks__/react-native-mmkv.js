/**
 * react-native-mmkv jest mock'u — testler native modül olmadan (Windows dahil)
 * çalışsın diye bellek-içi bir MMKV taklidi. Gerçek cihazda gerçek MMKV kullanılır.
 * Jest, node_modules mock'larını __mocks__ klasöründen otomatik uygular.
 *
 * v4 API'sini taklit eder: createMMKV(config) → { getString, set, remove, ... }.
 */
const createMMKV = () => {
  const store = new Map();
  return {
    getString: key => (store.has(key) ? store.get(key) : undefined),
    set: (key, value) => store.set(key, String(value)),
    remove: key => store.delete(key),
    contains: key => store.has(key),
    clearAll: () => store.clear(),
    getAllKeys: () => [...store.keys()],
  };
};

module.exports = { createMMKV };
