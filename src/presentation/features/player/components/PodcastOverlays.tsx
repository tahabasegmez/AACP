import React from 'react';
import { TopScrim } from '../../../ui';
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
  </>
);
