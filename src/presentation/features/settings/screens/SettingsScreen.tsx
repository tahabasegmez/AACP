import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '@core/config';
import { useTheme } from '../../../theme';
import { Icon, IconName, Screen, ScreenHeader, Text, scrimScrollHandler } from '../../../ui';
import { useDependencies } from '../../../di';

/**
 * SettingsScreen — Ayarlar.
 *
 * Tema koyuya sabit ve uygulama-içi animasyon ayarı kaldırıldığı için burada
 * yalnızca gerçekten işlevi olan seçenekler bulunur: senkron durumu, veri
 * yönetimi ve uygulama bilgisi. Sunucu yapılandırılmamışsa senkron bölümü
 * "kapalı" olarak dürüstçe gösterilir.
 */
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const { sync, analytics, errorReporter } = useDependencies();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('');

  const syncNow = async (): Promise<void> => {
    if (!sync?.enabled) {
      return;
    }
    setStatus('Senkronlanıyor…');
    try {
      await sync.syncAll();
      await queryClient.invalidateQueries();
      setStatus('Senkron tamamlandı');
    } catch (error) {
      errorReporter.report(error, { scope: 'settings.syncNow' });
      setStatus('Senkron başarısız — bağlantıyı kontrol edin');
    }
  };

  const clearCache = async (): Promise<void> => {
    // Yalnızca ağdan gelen önbelleği temizler; indirilenler ve kullanıcı
    // verisi (kaldığın yer, takipler) korunur.
    queryClient.clear();
    await queryClient.invalidateQueries();
    setStatus('Önbellek temizlendi');
  };

  return (
    <Screen>
      <ScreenHeader title="Ayarlar" />
      <ScrollView
        onScroll={scrimScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.spacing(10) }}>
        <Section title="Senkron">
          <Row
            icon="refresh"
            title="Şimdi senkronla"
            subtitle={
              sync?.enabled
                ? 'Kaldığın yer, takipler ve "sonra dinle" cihazlar arasında eşitlenir.'
                : 'Sunucu yapılandırılmadığı için kapalı — veriler yalnızca bu cihazda.'
            }
            disabled={!sync?.enabled}
            onPress={syncNow}
          />
        </Section>

        <Section title="Veri">
          <Row
            icon="cloud-offline"
            title="Önbelleği temizle"
            subtitle="İndirilen bölümler ve kişisel verilerin korunur."
            onPress={clearCache}
          />
        </Section>

        <Section title="Gizlilik">
          <Row
            icon="info"
            title="Kullanım verisi"
            subtitle={
              env.analyticsEnabled && env.apiBaseUrl
                ? 'Uygulamayı geliştirmek için anonim kullanım verisi toplanır. Kişisel bilgi içermez.'
                : 'Kullanım verisi toplanmıyor.'
            }
            onPress={() => analytics.track('screen_view', { screen: 'privacy' })}
          />
        </Section>

        {!!status && (
          <Text
            variant="caption"
            color={theme.colors.textMuted}
            style={{ paddingHorizontal: theme.spacing(2), paddingTop: theme.spacing(1) }}>
            {status}
          </Text>
        )}

        <View style={{ padding: theme.spacing(2), paddingTop: theme.spacing(3) }}>
          <Text variant="caption" color={theme.colors.textDim}>
            Anadolu Ajansı Podcast · {env.name}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

/** Başlıklı ayar grubu — ekran boyunca tutarlı boşluk/tipografi. */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing(2) }}>
      <Text
        variant="label"
        color={theme.colors.textMuted}
        uppercase
        style={{ paddingHorizontal: theme.spacing(2), marginBottom: theme.spacing(1) }}>
        {title}
      </Text>
      {children}
    </View>
  );
};

/** Tek ayar satırı: ikon + başlık/açıklama; devre dışıysa soluk gösterilir. */
const Row: React.FC<{
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, title, subtitle, onPress, disabled }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.5),
        paddingVertical: theme.spacing(1.5),
        paddingHorizontal: theme.spacing(2),
        opacity: disabled ? 0.5 : 1,
      }}>
      <Icon name={icon} size={22} color={theme.colors.text} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
};
