/**
 * AACP — GÖMME (embedding) GİRİŞ NOKTASI.
 *
 * Podcast özelliğini başka bir React Native uygulamasının içine yerleştirmek
 * için gereken HER ŞEY buradan export edilir. Gömen uygulama `src/` içindeki
 * hiçbir dosyayı doğrudan import etmemelidir — bu dosya kararlı bir yüzeydir,
 * içerisi yeniden düzenlense de burası aynı kalır.
 *
 * Kullanım (ana uygulamanın App.tsx'i):
 *
 * ```tsx
 * import { PodcastProviders, PodcastNavigator, PodcastOverlays } from 'aacp/embed';
 *
 * export default function App() {
 *   return (
 *     <GestureHandlerRootView style={{ flex: 1 }}>
 *       <SafeAreaProvider>
 *         <PodcastProviders>
 *           <NavigationContainer ref={navigationRef}>
 *             <Stack.Navigator>
 *               <Stack.Screen name="Main" component={MainTabs} />
 *               <Stack.Screen
 *                 name="Podcasts"
 *                 component={PodcastNavigator}
 *                 options={{ headerShown: false }}
 *               />
 *             </Stack.Navigator>
 *           </NavigationContainer>
 *           <PodcastOverlays />
 *         </PodcastProviders>
 *       </SafeAreaProvider>
 *     </GestureHandlerRootView>
 *   );
 * }
 * ```
 *
 * Ayrıntılı kurulum (native yapılandırma, ses, CarPlay): docs/EMBEDDING.md
 */

// --- React ağacı ------------------------------------------------------------
/** Sağlayıcılar + arka plan yürütücüleri. Ana uygulamanın KÖKÜNDE olmalı. */
export { PodcastProviders } from './src/app/PodcastProviders';
/** Podcast'in tüm ekran ağacı — ana uygulamanın stack'ine bir ekran olarak konur. */
export { PodcastNavigator } from './src/presentation/navigation/PodcastNavigator';
/** Mini player + tab bar + üst scrim. NavigationContainer'ın ÜSTÜNDE render edilir. */
export { PodcastOverlays } from './src/presentation/features/player/components/PodcastOverlays';

// --- Navigasyon köprüsü -----------------------------------------------------
/**
 * Gömülü modda ana uygulamanın NavigationContainer ref'ini bağlar; mini
 * player'dan Player açmak gibi container-dışı navigasyonlar bu sayede çalışır.
 */
export { setNavigationRef } from './src/presentation/navigation/navigationRef';
export type { RootStackParamList as PodcastParamList } from './src/presentation/navigation/types';

// --- Native kayıtlar (ana uygulamanın index.js'inde çağrılır) ----------------
/** Kilit ekranı / CarPlay uzaktan kontrollerini işleyen arka plan servisi. */
export { default as podcastPlaybackService } from './src/infrastructure/audio/playbackService';
/** CarPlay sahnesini bağlar (yalnızca iOS; entitlement ana uygulamada olmalı). */
export { registerCarPlay } from './src/app/carplay/registerCarPlay';

// --- Yapılandırma -----------------------------------------------------------
/** Sunucu adresi, bölüm kaynağı vb. — ana uygulama build zamanında besleyebilir. */
export { env } from './src/core/config/env';
export type { AppEnv } from './src/core/config/env';

// --- İleri düzey ------------------------------------------------------------
/**
 * Paylaşılan bağımlılık grafiği. Ana uygulamanın podcast verisine (ör. "son
 * dinlenenler" widget'ı) doğrudan erişmesi gerekirse kullanılır.
 */
export { getDependencies as getPodcastDependencies } from './src/app/di';
export type { AppDependencies as PodcastDependencies } from './src/presentation/di';
