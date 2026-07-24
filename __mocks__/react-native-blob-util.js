/**
 * react-native-blob-util jest mock'u — testler native modül olmadan çalışsın.
 * Bellek-içi bir dosya sistemi taklidi; gerçek cihazda gerçek modül kullanılır.
 */
const files = new Set();

const fs = {
  dirs: { DocumentDir: '/mock/Documents' },
  isDir: async () => true,
  mkdir: async () => {},
  exists: async path => files.has(path),
  unlink: async path => {
    files.delete(path);
  },
};

const config = () => ({
  fetch: () => {
    const promise = Promise.resolve({ path: () => '/mock/file' }).then(res => {
      files.add(res.path());
      return res;
    });
    // .progress() zincirlenebilir olmalı
    promise.progress = () => promise;
    return promise;
  },
});

module.exports = { __esModule: true, default: { fs, config }, fs, config };
