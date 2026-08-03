import React, { useState } from 'react';
import { View } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Avatar — yuvarlak profil göstergesi.
 *
 * Üç kademeli yedekleme: fotoğraf → baş harf → kişi simgesi. Fotoğraf
 * yüklenemezse (adres bayat, ağ yok) sessizce baş harfe düşer; kırık görsel
 * göstermek profil alanında kabul edilemez.
 *
 * Harf boyutu çapa oranlanır, böylece aynı bileşen hem başlıktaki 32 px'lik
 * düğmede hem paneldeki 64 px'lik büyük gösterimde doğru görünür.
 */
export const Avatar: React.FC<{
  size: number;
  /** Profil fotoğrafının adresi; yoksa baş harfe düşülür. */
  uri?: string;
  /** Fotoğraf yokken gösterilecek tek harf. */
  initial?: string;
  /** Kenarlık — koyu zeminde avatarı ayırmak için (başlıkta kullanılır). */
  ring?: boolean;
}> = ({ size, uri, initial, ring }) => {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  const showImage = !!uri && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        // Marka mavisi zemin — fotoğraf yokken Google'ın hesap rozetindeki gibi
        // renkli bir daire üstünde baş harf durur.
        backgroundColor: theme.colors.accent,
        ...(ring ? { borderWidth: 1.5, borderColor: theme.colors.border } : {}),
      }}>
      {showImage ? (
        <FastImage
          source={{ uri, priority: FastImage.priority.normal }}
          onError={() => setFailed(true)}
          style={{ width: size, height: size }}
        />
      ) : initial ? (
        <Text
          variant="bodyStrong"
          color={theme.colors.onAccent}
          // Tipografi ölçeği sabit boyutlar sunar; avatar harfi çapa
          // orantılı olmalı, bu yüzden burada doğrudan hesaplanır.
          style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}
          allowFontScaling={false}>
          {initial}
        </Text>
      ) : (
        <Icon name="person" size={size * 0.55} color={theme.colors.onAccent} />
      )}
    </View>
  );
};
