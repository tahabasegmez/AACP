-- AACP — Şema 07: cihazlar ve tek aktif oynatma oturumu
--
-- `schema-06` yoksa `schema-05`ten SONRA, Supabase Studio → SQL Editor'da
-- BİR KEZ çalıştırın. Tekrar çalıştırmak güvenlidir.
--
-- KURAL: bir hesapta aynı anda YALNIZCA BİR cihaz çalabilir. İkinci cihazda
-- oynatma başlatmak oturumu devralır; devredilen cihaz duraklar.

-- ============================================================================
-- Cihaz kaydı
-- ============================================================================
-- Cihaz listesi İLİŞKİSELDİR: kullanıcıya gösterilir ("hangi cihazlarım var,
-- hangisi çalıyor"), sorgulanır ve hesapla birlikte silinir. Bu yüzden
-- anahtar-değer deposunda değil burada durur (bkz. docs/VERI-MIMARISI.md §1).
create table if not exists public.playback_devices (
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Kurulum başına kararlı kimlik (istemcideki cihaz kimliği).
  device_id   text not null,
  name        text not null,
  platform    text not null default 'unknown',
  -- Oynatma oturumunu ŞU AN bu cihaz mı tutuyor.
  active      boolean not null default false,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- "Bir hesapta tek aktif cihaz" kuralı VERİTABANINDA zorlanır.
-- Uygulama kodunda tutulsaydı, iki cihazın aynı anda talep etmesi durumunda
-- ikisi de kazanabilirdi.
create unique index if not exists idx_playback_devices_single_active
  on public.playback_devices (user_id)
  where active;

alter table public.playback_devices enable row level security;

drop policy if exists "devices: kendi cihazlarını görür" on public.playback_devices;
create policy "devices: kendi cihazlarını görür"
  on public.playback_devices for select
  using (auth.uid() = user_id);
-- Yazma politikası TANIMLANMAZ: kayıtlar yalnızca aşağıdaki fonksiyon
-- üzerinden değişir, böylece "tek aktif" kuralı atlanamaz.

-- ============================================================================
-- Oturumu devralma
-- ============================================================================
-- Devralma ATOMİK olmak zorundadır: önce diğerlerini pasifleştirip sonra
-- kendini aktif yapmak iki ayrı istekte yapılsaydı, arada kalan pencerede
-- iki cihaz birden aktif görünebilirdi. Tek fonksiyon = tek işlem.
create or replace function public.claim_playback(
  p_device_id text,
  p_name text,
  p_platform text
)
returns table (device_id text, name text, platform text, active boolean, last_seen_at timestamptz)
language plpgsql
security definer
as $$
-- Dönüş sütunlarının adları tablonunkilerle AYNIDIR (istemciye giden alan
-- adları böyle olmalı). Bu, gövdedeki `device_id`/`name` gibi adları PL/pgSQL
-- için belirsiz yapar ("column reference is ambiguous", 42702) — özellikle
-- `on conflict` hedefinde, orada takma ad kullanılamaz.
-- Yönerge, belirsiz adların DAİMA sütun olarak çözülmesini söyler; gövdede
-- dönüş değişkenleri zaten hiç okunmuyor.
#variable_conflict use_column
begin
  -- Cihazı kaydet/tazele.
  insert into public.playback_devices (user_id, device_id, name, platform, last_seen_at)
  values (auth.uid(), p_device_id, p_name, p_platform, now())
  on conflict (user_id, device_id) do update
    set name = excluded.name,
        platform = excluded.platform,
        last_seen_at = now();

  -- Önce TÜM cihazları pasifleştir, sonra talep edeni aktif yap.
  update public.playback_devices d
     set active = false
   where d.user_id = auth.uid() and d.active;

  update public.playback_devices d
     set active = true
   where d.user_id = auth.uid() and d.device_id = p_device_id;

  return query
    select d.device_id, d.name, d.platform, d.active, d.last_seen_at
      from public.playback_devices d
     where d.user_id = auth.uid()
     order by d.last_seen_at desc;
end;
$$;

-- ============================================================================
-- Oturumu bırakma
-- ============================================================================
-- Duraklatma/çıkış sırasında çağrılır. Cihaz kaydı SİLİNMEZ; yalnızca aktiflik
-- düşer — kullanıcı cihaz listesinde onu görmeye devam etmeli.
create or replace function public.release_playback(p_device_id text)
returns void
language plpgsql
security definer
as $$
begin
  update public.playback_devices
     set active = false
   where user_id = auth.uid() and device_id = p_device_id;
end;
$$;
