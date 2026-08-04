import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme';

/**
 * Icon — uygulama genelinde ikon soyutlaması.
 *
 * Semantik isimler (play, forward, search...) → Ionicons glyph'lerine eşlenir.
 * Böylece ekranlar kütüphaneye bağlı kalmaz; ikon setini değiştirmek istersek
 * yalnızca bu dosyadaki `GLYPHS` haritasını güncelleriz.
 */
export type IconName =
  | 'play'
  | 'pause'
  | 'forward'
  | 'backward'
  | 'home'
  | 'home-outline'
  | 'search'
  | 'library'
  | 'library-outline'
  | 'settings'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-back'
  | 'download'
  | 'downloaded'
  | 'bookmark'
  | 'bookmark-outline'
  | 'share'
  | 'heart'
  | 'heart-outline'
  | 'list'
  | 'timer'
  | 'cast'
  | 'close'
  | 'refresh'
  | 'cloud-offline'
  | 'checkmark'
  | 'info'
  | 'ellipsis'
  | 'add'
  /** Oynatma kuyruğu (sıraya ekle / sıradakiler). */
  | 'queue'
  /** Kullanıcı listesi (playlist'e ekle). */
  | 'playlist'
  /** Listeden çıkar — eklemenin karşıtı. */
  | 'playlist-remove'
  /** Kişi (profil fotoğrafı yoksa yedek). */
  | 'person'
  /** Fotoğraf seç/değiştir. */
  | 'camera'
  | 'sign-in'
  | 'sign-out';

const GLYPHS: Record<IconName, string> = {
  play: 'play',
  pause: 'pause',
  forward: 'play-forward',
  backward: 'play-back',
  home: 'home',
  'home-outline': 'home-outline',
  search: 'search',
  library: 'library',
  'library-outline': 'library-outline',
  settings: 'settings-outline',
  'chevron-right': 'chevron-forward',
  'chevron-down': 'chevron-down',
  'chevron-back': 'chevron-back',
  download: 'arrow-down-circle-outline',
  downloaded: 'arrow-down-circle',
  bookmark: 'bookmark',
  'bookmark-outline': 'bookmark-outline',
  share: 'share-outline',
  heart: 'heart',
  'heart-outline': 'heart-outline',
  list: 'list',
  timer: 'timer-outline',
  cast: 'phone-portrait-outline',
  close: 'close',
  refresh: 'refresh',
  'cloud-offline': 'cloud-offline-outline',
  checkmark: 'checkmark',
  info: 'information-circle-outline',
  ellipsis: 'ellipsis-horizontal',
  add: 'add',
  // Kuyruk ve liste GÖRSEL OLARAK ayrışmalı: kuyruk sıraya alınmış öğeleri
  // (yığın), liste ise adlandırılmış bir koleksiyonu (madde işaretli liste)
  // çağrıştırır.
  queue: 'layers-outline',
  playlist: 'list',
  'playlist-remove': 'remove-circle-outline',
  person: 'person',
  camera: 'camera-outline',
  'sign-in': 'log-in-outline',
  'sign-out': 'log-out-outline',
};

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export const Icon: React.FC<Props> = ({ name, size = 22, color }) => {
  const theme = useTheme();
  return <Ionicons name={GLYPHS[name]} size={size} color={color ?? theme.colors.text} />;
};
