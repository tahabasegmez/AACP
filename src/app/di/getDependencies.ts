import { AppDependencies } from '@presentation/di';
import { composeDependencies } from './composeDependencies';

/**
 * Uygulama ömrü boyunca TEK bağımlılık grafiği.
 *
 * Hem React uygulaması (AppRoot) hem de CarPlay sahnesi (registerCarPlay) bunu
 * kullanır — böylece ikisi AYNI `audioPlayer`, `progressRepo` vb. örnekleri
 * paylaşır. Aksi halde CarPlay ve telefon ayrı oynatıcı örnekleriyle çalışır ve
 * durum senkronize olmazdı.
 */
let instance: AppDependencies | null = null;

export const getDependencies = (): AppDependencies => {
  if (!instance) {
    instance = composeDependencies();
  }
  return instance;
};

