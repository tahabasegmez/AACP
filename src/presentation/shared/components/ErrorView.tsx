import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppError } from '@core/error';
import { useTheme } from '../../theme';

/** AppError kodunu kullanıcıya uygun Türkçe mesaja çevirir. */
const messageForError = (error?: unknown): string => {
  if (error instanceof AppError) {
    switch (error.code) {
      case 'NETWORK':
        return 'İnternet bağlantısı sorunu. Bağlantını kontrol edip tekrar dene.';
      case 'TIMEOUT':
        return 'İstek zaman aşımına uğradı. Lütfen tekrar dene.';
      case 'PARSE':
        return 'İçerik okunamadı. Daha sonra tekrar dene.';
      case 'NOT_FOUND':
        return 'İçerik bulunamadı.';
      default:
        return 'Bir şeyler ters gitti. Lütfen tekrar dene.';
    }
  }
  return 'Bir şeyler ters gitti. Lütfen tekrar dene.';
};

/**
 * ErrorView — hata durumunda tutarlı gösterim + "Tekrar dene" aksiyonu.
 * "Aptal" bileşen: veri çağrısı yapmaz, sadece prop alır.
 */
export const ErrorView: React.FC<{
  error?: unknown;
  onRetry?: () => void;
}> = ({ error, onRetry }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing(3),
        backgroundColor: theme.colors.background,
      }}>
      <Text style={{ color: theme.colors.text, textAlign: 'center', fontSize: 15 }}>
        {messageForError(error)}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={{
            marginTop: theme.spacing(2),
            paddingVertical: theme.spacing(1),
            paddingHorizontal: theme.spacing(3),
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
          }}>
          <Text style={{ color: theme.colors.primary, fontSize: 15 }}>
            Tekrar dene
          </Text>
        </Pressable>
      )}
    </View>
  );
};
