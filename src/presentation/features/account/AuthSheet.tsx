import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { MIN_PASSWORD_LENGTH } from '@domain/entities';
import { useTheme } from '../../theme';
import { BottomSheet, Text } from '../../ui';
import { MergeChoice, useCountLocalChanges, useRegister, useSignIn } from '../../query';

type Mode = 'signIn' | 'register';
/** Panel adımı: form → (gerekirse) birleştirme kararı. */
type Step = 'form' | 'merge';

/**
 * AuthSheet — giriş / hesap oluşturma paneli.
 *
 * Tek panel iki modu da yürütür; alanlar aynı olduğu için ayrı ekranlar yazmak
 * tekrar olurdu. Uygulamanın ortak alttan açılan panelini kullanır.
 *
 * Kayıt sırasında sunucu MEVCUT anonim kullanıcıyı yükseltir; bu yüzden
 * kullanıcıya "verilerin taşınacak" bilgisi gösterilir.
 */
export const AuthSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  onFeedback?: (message: string) => void;
}> = ({ visible, onClose, onFeedback }) => {
  const theme = useTheme();
  const signIn = useSignIn();
  const register = useRegister();

  const countLocal = useCountLocalChanges();

  const [mode, setMode] = useState<Mode>('signIn');
  const [step, setStep] = useState<Step>('form');
  const [localCount, setLocalCount] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const busy = signIn.isPending || register.isPending;
  const canSubmit = email.trim().length > 0 && password.length >= MIN_PASSWORD_LENGTH && !busy;

  /**
   * Giriş/kayıt akışı.
   *
   * KAYIT'ta birleştirme sorulmaz: sunucu mevcut anonim kullanıcıyı yükseltir,
   * cihazdaki veri zaten bu hesaba aittir.
   *
   * GİRİŞ'te cihazdaki veri BAŞKA bir kimliğe aittir. Gönderilmemiş değişiklik
   * varsa kullanıcıya ne yapılacağı sorulur — sessizce birleştirmek ya da
   * silmek, ikisi de sürpriz olurdu.
   */
  const submit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    setError('');

    if (mode === 'register') {
      await run(() => register.mutateAsync({ email, password }), 'Hesabın oluşturuldu');
      return;
    }

    const pending = await countLocal();
    if (pending > 0) {
      setLocalCount(pending);
      setStep('merge');
      return;
    }
    await run(() => signIn.mutateAsync({ email, password }), 'Giriş yapıldı');
  };

  /** Birleştirme kararı verildikten sonra girişi tamamlar. */
  const finishSignIn = (merge: MergeChoice): void => {
    void run(
      () => signIn.mutateAsync({ email, password, merge }),
      merge === 'adopt'
        ? 'Giriş yapıldı — cihazdaki veriler hesabına aktarıldı'
        : 'Giriş yapıldı',
    );
  };

  /** Ortak tamamlama: başarıda paneli kapatır, hatada mesajı gösterir. */
  const run = async (action: () => Promise<unknown>, message: string): Promise<void> => {
    try {
      await action();
      onFeedback?.(message);
      setEmail('');
      setPassword('');
      setStep('form');
      onClose();
    } catch (e) {
      setStep('form');
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı');
    }
  };

  const inputStyle = {
    marginTop: theme.spacing(0.75),
    paddingVertical: theme.spacing(1.25),
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
  };

  // Birleştirme adımı: cihazdaki veri başka bir kimliğe ait, karar gerekiyor.
  if (step === 'merge') {
    return (
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={{ paddingHorizontal: theme.spacing(2.5), paddingBottom: theme.spacing(1) }}>
          <Text variant="heading">Bu cihazdaki veriler</Text>
          <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 6 }}>
            Giriş yapmadan önce bu cihazda{' '}
            <Text variant="caption" color={theme.colors.accent}>
              {localCount} değişiklik
            </Text>{' '}
            biriktirdin (kaldığın yer, listeler, takip ettiklerin). Ne yapmak
            istersin?
          </Text>

          <MergeOption
            title="Hesabıma aktar"
            description="Cihazdaki veriler hesabınla birleştirilir. Aynı bölümde iki kayıt varsa en yeni olan geçerli olur."
            primary
            disabled={busy}
            onPress={() => finishSignIn('adopt')}
          />
          <MergeOption
            title="Hesabımdakiyle devam et"
            description="Cihazdaki veriler silinir ve hesabındaki kayıtlar indirilir. İndirdiğin bölümler korunur."
            disabled={busy}
            onPress={() => finishSignIn('discard')}
          />

          <Pressable
            onPress={() => setStep('form')}
            disabled={busy}
            accessibilityRole="button"
            style={{ marginTop: theme.spacing(1.5), alignItems: 'center' }}>
            <Text variant="caption" color={theme.colors.textMuted}>
              Vazgeç
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing(2.5), paddingBottom: theme.spacing(1) }}>
        <Text variant="heading">{mode === 'signIn' ? 'Giriş yap' : 'Hesap oluştur'}</Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
          {mode === 'signIn'
            ? 'Listelerin ve kaldığın yer tüm cihazlarında aynı olur.'
            : 'Bu cihazdaki listelerin ve dinleme geçmişin hesabına taşınır.'}
        </Text>

        <View style={{ marginTop: theme.spacing(2) }}>
          <Text variant="label" color={theme.colors.textMuted} uppercase>
            E-posta
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@eposta.com"
            placeholderTextColor={theme.colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={inputStyle}
          />
        </View>

        <View style={{ marginTop: theme.spacing(1.5) }}>
          <Text variant="label" color={theme.colors.textMuted} uppercase>
            Şifre
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={`En az ${MIN_PASSWORD_LENGTH} karakter`}
            placeholderTextColor={theme.colors.textDim}
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={inputStyle}
          />
        </View>

        {!!error && (
          <Text variant="caption" color={theme.colors.danger} style={{ marginTop: theme.spacing(1) }}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={mode === 'signIn' ? 'Giriş yap' : 'Hesap oluştur'}
          style={{
            marginTop: theme.spacing(2),
            paddingVertical: theme.spacing(1.5),
            borderRadius: theme.radius.pill,
            alignItems: 'center',
            backgroundColor: canSubmit ? theme.colors.accent : theme.colors.surface,
            opacity: busy ? 0.6 : 1,
          }}>
          <Text variant="bodyStrong" color={canSubmit ? theme.colors.onAccent : theme.colors.textDim}>
            {busy ? 'Lütfen bekle…' : mode === 'signIn' ? 'Giriş yap' : 'Hesap oluştur'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === 'signIn' ? 'register' : 'signIn');
            setError('');
          }}
          accessibilityRole="button"
          style={{ marginTop: theme.spacing(1.5), alignItems: 'center' }}>
          <Text variant="caption" color={theme.colors.accent}>
            {mode === 'signIn' ? 'Hesabın yok mu? Oluştur' : 'Zaten hesabın var mı? Giriş yap'}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
};

/** Birleştirme kararındaki tek seçenek kutusu. */
const MergeOption: React.FC<{
  title: string;
  description: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}> = ({ title, description, onPress, primary, disabled }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        marginTop: theme.spacing(1.5),
        padding: theme.spacing(1.75),
        borderRadius: theme.radius.lg,
        backgroundColor: primary ? theme.colors.accentSoft : theme.colors.surface,
        borderWidth: 1,
        borderColor: primary ? theme.colors.accent : theme.colors.border,
        opacity: disabled ? 0.6 : 1,
      }}>
      <Text variant="bodyStrong" color={primary ? theme.colors.accent : theme.colors.text}>
        {title}
      </Text>
      <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
        {description}
      </Text>
    </Pressable>
  );
};
