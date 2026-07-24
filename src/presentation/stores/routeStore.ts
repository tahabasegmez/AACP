import { create } from 'zustand';

const TAB_ROUTES = ['Home', 'Search', 'Library'];

/**
 * routeStore — aktif ekran adı + son aktif sekme. NavigationContainer onStateChange
 * ile güncellenir. Global mini player'ın konumu/görünürlüğü ve animasyonlu tab
 * bar'ın hangi sekmenin seçili olduğu bilgisini buradan alır.
 */
interface RouteState {
  routeName?: string;
  /** ShowDetail vб. gibi sekme-dışı ekranlarda bile seçili sekmeyi korur. */
  lastTab: string;
  setRouteName: (name?: string) => void;
}

export const useRouteStore = create<RouteState>(set => ({
  routeName: undefined,
  lastTab: 'Home',
  setRouteName: name =>
    set(state => ({
      routeName: name,
      lastTab: name && TAB_ROUTES.includes(name) ? name : state.lastTab,
    })),
}));
