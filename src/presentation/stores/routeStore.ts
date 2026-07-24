import { create } from 'zustand';

/**
 * routeStore — o an aktif olan ekranın adı. NavigationContainer onStateChange ile
 * güncellenir; global mini player'ın hangi ekranda görünüp nasıl konumlanacağını
 * belirlemek için kullanılır.
 */
interface RouteState {
  routeName?: string;
  setRouteName: (name?: string) => void;
}

export const useRouteStore = create<RouteState>(set => ({
  routeName: undefined,
  setRouteName: routeName => set({ routeName }),
}));
