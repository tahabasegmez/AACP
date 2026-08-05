-- AACP — Şema 07: cihaz kaydı (oynatma oturumu için dayanıklı taban)
--
-- Supabase Studio → SQL Editor'da BİR KEZ çalıştırın. Tekrar çalıştırmak
-- güvenlidir; bu dosya aynı zamanda daha eski bir sürümü ÇALIŞTIRMIŞ
-- kurulumları temizler.
--
-- KURAL: bir hesapta aynı anda YALNIZCA BİR cihaz çalabilir.
--
-- Bu kuralın DURUMU Postgres'te tutulmaz. "Kim çalıyor, ne çalıyor, bekleyen
-- komut var mı" verisi:
--   * saniyeler içinde eskir,
--   * hiç sorgulanmaz (yalnızca anahtarla okunur),
--   * kaybolduğunda zararı yoktur (bir sonraki devralma yeniden kurar).
-- Bunu her turda satır güncelleyerek Postgres'te tutmak, her yazımda WAL ve
-- ölü satır üretirdi — yüz eşzamanlı dinleyicide saniyede onlarca yazma, sırf
-- "hâlâ ben çalıyorum" demek için. Bu yüzden oturum durumu Redis'te (TTL ile)
-- yaşar; bkz. docs/TEK-CIHAZ-OYNATMA.md.
--
-- Postgres'te KALAN tek şey, kullanıcıya gösterilen kalıcı cihaz listesidir:
-- ilişkiseldir, hesapla birlikte silinir ve seyrek yazılır (oynatma
-- başlarken bir kez).

-- ============================================================================
-- 0. Eski sürümün temizliği
-- ============================================================================
-- Oturum mantığı plpgsql fonksiyonlarındayken atomiklik gerekiyordu. Redis'e
-- taşındıktan sonra gerekmiyor: kural bir KİLİT değil DEVRALMADIR ve tek bir
-- insanın iki cihazda aynı milisaniyede düğmeye basması diye bir yarış yok.
drop function if exists public.claim_playback(text, text, text);
drop function if exists public.release_playback(text);
drop function if exists public.transfer_playback(text, jsonb);
drop function if exists public.poll_playback(text);
drop function if exists public.poll_playback(text, jsonb);
drop index if exists public.idx_playback_devices_single_active;

-- ============================================================================
-- 1. Cihaz listesi
-- ============================================================================
create table if not exists public.playback_devices (
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Kurulum başına kararlı kimlik (istemcideki cihaz kimliği).
  device_id   text not null,
  name        text not null,
  platform    text not null default 'unknown',
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Geçici oturum alanları artık Redis'te; tabloda kalırlarsa iki kaynak olur
-- ve hangisinin doğru olduğu belirsizleşir.
alter table public.playback_devices
  drop column if exists active,
  drop column if exists pending_command,
  drop column if exists command_at,
  drop column if exists now_playing,
  drop column if exists now_playing_at;

alter table public.playback_devices enable row level security;

-- Kullanıcı yalnızca kendi cihazlarını görür ve yazar. Fonksiyon (security
-- definer) katmanına gerek kalmadı: yazılan tek şey cihazın adı/platformu,
-- korunması gereken bir değişmez yok.
drop policy if exists "devices: kendi cihazlarını görür" on public.playback_devices;
create policy "devices: kendi cihazlarını görür"
  on public.playback_devices for select
  using (auth.uid() = user_id);

drop policy if exists "devices: kendi cihazını kaydeder" on public.playback_devices;
create policy "devices: kendi cihazını kaydeder"
  on public.playback_devices for insert
  with check (auth.uid() = user_id);

drop policy if exists "devices: kendi cihazını günceller" on public.playback_devices;
create policy "devices: kendi cihazını günceller"
  on public.playback_devices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- 2. Oturum yedeği (Redis bağlı DEĞİLSE)
-- ============================================================================
-- Redis yapılandırılmamış kurulumlarda oturum burada yaşar. Cloudflare KV bu
-- iş için KULLANILAMAZ: 60 saniyeye varan eventual consistency, "kim çalıyor"
-- sorusunu yanlış cevaplardı.
--
-- Kullanıcı başına TEK satır ve yalnızca anahtarla okunur — bu tablo bir
-- anahtar-değer deposunun Postgres'teki taklididir, bilinçli olarak.
create table if not exists public.playback_sessions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.playback_sessions enable row level security;

drop policy if exists "sessions: kendi oturumu" on public.playback_sessions;
create policy "sessions: kendi oturumu"
  on public.playback_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
