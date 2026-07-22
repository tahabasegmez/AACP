import React, { createContext, useContext } from 'react';
import { AppDependencies } from './AppDependencies';

/**
 * DependencyProvider — use case'leri React ağacına enjekte eder.
 * `app` katmanı somut bağımlılıkları oluşturup buraya value olarak verir.
 */
const DependencyContext = createContext<AppDependencies | null>(null);

export const DependencyProvider: React.FC<{
  dependencies: AppDependencies;
  children: React.ReactNode;
}> = ({ dependencies, children }) => (
  <DependencyContext.Provider value={dependencies}>
    {children}
  </DependencyContext.Provider>
);

/** Ekranlarda/hook'larda use case'lere erişim: `const { getShowCatalog } = useDependencies();` */
export const useDependencies = (): AppDependencies => {
  const deps = useContext(DependencyContext);
  if (!deps) {
    throw new Error(
      'useDependencies, DependencyProvider dışında kullanılamaz. app/AppRoot içinde sarmalandı mı?',
    );
  }
  return deps;
};
