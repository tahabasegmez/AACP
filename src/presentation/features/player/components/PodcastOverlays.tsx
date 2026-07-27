import React from 'react';
import { TopScrim } from '../../../ui';
import { OfflineBar } from '../../../shared/components';
import { GlobalDock } from './GlobalDock';

/**
 * PodcastOverlays — navigasyonun ÜSTÜNDE duran global katman:
 * mini player + tab bar + çevrimdışı şeridi (GlobalDock) ve island scrim'i.
 *
 * Tek bileşen olarak toplanmasının sebebi: hem standalone uygulama hem de
 * gömülü kullanım aynı overlay kümesini TEK çağrıyla yerleştirsin. Gömen
 * uygulama "hangi overlay'leri eklemeliyim?" diye düşünmek zorunda kalmaz.
 *
 * Overlay'ler aktif rotaya göre kendilerini gizler (ör. Player ekranında mini
 * player görünmez), bu yüzden ana uygulamanın kökünde durmaları güvenlidir.
 */
export const PodcastOverlays: React.FC = () => (
  <>
    <GlobalDock />
    <TopScrim />
    {/* Çevrimdışı şeridi — ekranın en altında, layout'u etkilemeyen overlay. */}
    <OfflineBar />
  </>
);
