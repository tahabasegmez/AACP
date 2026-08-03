import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '@core/config';
import { useTheme } from '../../../theme';
import { Icon, IconName, Screen, ScreenHeader, Text, scrimScrollHandler } from '../../../ui';
import { useDependencies } from '../../../di';
import { useRefreshPending, useSyncNow, useSyncStatus } from '../../../query';

/** "3 dakika önce" gibi kısa görece zaman — senkron tazeliğini anlatır. */
const formatRelative = (epochMs: number): string => {
  const diffSec = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (diffSec < 60) {
    return 'az önce';
  }
  const minutes = Math.round(diffSec / 60);
  if (minutes < 60) {
    return `${minutes} dakika önce`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} saat önce`;
  }
  return new Date(epochMs).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * SettingsScreen — Ayarlar.
 *
 * Tema koyuya sabit ve uygulama-içi animasyon ayarı kaldırıldığı için burada
 * yalnızca gerçekten işlevi olan seçenekler bulunur: senkron durumu, veri
 * yönetimi ve uygulama bilgisi. Sunucu yapılandırılmamışsa senkron bölümü
 * "kapalı" olarak dürüstçe gösterilir.
 *
 * HESAP BURADA DEĞİLDİR: giriş, çıkış, ad ve fotoğraf ana sayfadaki hesap
 * düğmesinden yönetilir. İki giriş noktası tutmak, ikisinin zamanla ayrışması
 * demekti.
 */
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const { analytics, errorReporter } = useDependencies();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('');

  // Senkron durumu — motordan canlı gelir (son senkron, bekleyen, hata).
  const syncStatus = useSyncStatus();
  const { run: runSyncNow, busy: syncBusy, enabled: syncEnabled } = useSyncNow();
  useRefreshPending();

  /**
   * Senkron satırının açıklaması — durumu tek cümlede anlatır.
   * Öncelik: kapalı → hata → bekleyen → son senkron zamanı.
   */
  const syncSubtitle = ((): string => {
    if (!syncEnabled) {
      return 'Sunucu yapılandırılmadığı için kapalı — veriler yalnızca bu cihazda.';
    }
    if (syncStatus.phase === 'error' && syncStatus.error) {
      return `Son deneme başarısız: ${syncStatus.error}`;
    }
    if (syncStatus.pendingCount > 0) {
      return `${syncStatus.pendingCount} değişiklik gönderilmeyi bekliyor.`;
    }
    if (syncStatus.lastSyncAt > 0) {
      return `Son senkron: ${formatRelative(syncStatus.lastSyncAt)}`;
    }
    return 'Kaldığın yer, listeler ve takip ettiklerin cihazlar arasında eşitlenir.';
  })();

  const runSync = async (): Promise<void> => {
    const result = await runSyncNow();
    if (!result) {
      return;
    }
    if (result.phase === 'error') {
      errorReporter.report(new Error(result.error ?? 'sync failed'), {
        scope: 'settings.syncNow',
      });
      setStatus('Senkron başarısız — bağlantıyı kontrol edin');
    } else {
      setStatus('Senkron tamamlandı');
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
            title={syncBusy ? 'Senkronlanıyor…' : 'Şimdi senkronla'}
            subtitle={syncSubtitle}
            disabled={!syncEnabled || syncBusy}
            onPress={() => void runSync()}
          />
          {/* Çakışma bilgisi: sessizce kaybolan değişiklikleri açıklar. */}
          {syncStatus.conflictCount > 0 && (
            <Text
              variant="caption"
              color={theme.colors.warning}
              style={{ paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(1) }}>
              {syncStatus.conflictCount} kayıt başka bir cihazda daha yeni olduğu için
              güncellendi.
            </Text>
          )}
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
