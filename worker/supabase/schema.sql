-- AACP — Supabase şeması
--
-- Supabase Studio → SQL Editor'da BİR KEZ çalıştırın.
-- Tekrar çalıştırmak güvenlidir (IF NOT EXISTS / CREATE OR REPLACE).
--
-- GÜVENLİK İLKESİ: yetkilendirme uygulama kodunda değil, VERİTABANINDA
-- zorunlu kılınır (Row Level Security). Worker'da bir hata olsa bile bir
-- kullanıcı başkasının satırlarını okuyamaz.

-- ============================================================================
-- 1. Senkron kayıtları (kaldığın yer, takipler, sonra dinle, listeler)
-- ============================================================================
create table if not exists public.sync_records (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  collection text   not null,
  key        text   not null,
  value      text   not null default '',
  -- İstemcideki değişiklik zamanı (epoch ms) — çakışma çözümü buna bakar.
  updated_at bigint not null,
  -- Silmeler de senkronlanmalı (tombstone), aksi halde bir cihazdaki silme
  -- diğerine ulaşmaz ve kayıt "geri gelir".
  deleted    boolean not null default false,
  primary key (user_id, collection, key)
);

-- Delta çekme sorgusunun indeksi.
create index if not exists idx_sync_delta
  on public.sync_records (user_id, collection, updated_at);

alter table public.sync_records enable row level security;

-- Kullanıcı YALNIZCA kendi satırlarına erişir.
drop policy if exists "sync: kendi kayıtlarını okur" on public.sync_records;
create policy "sync: kendi kayıtlarını okur"
  on public.sync_records for select
  using (auth.uid() = user_id);

drop policy if exists "sync: kendi kayıtlarını yazar" on public.sync_records;
create policy "sync: kendi kayıtlarını yazar"
  on public.sync_records for insert
  with check (auth.uid() = user_id);

drop policy if exists "sync: kendi kayıtlarını günceller" on public.sync_records;
create policy "sync: kendi kayıtlarını günceller"
  on public.sync_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Çakışma çözümü: SON YAZAN KAZANIR.
--
-- Bunu SQL tarafında yapmak kritik: iki cihaz aynı anda yazarsa
-- "oku-karşılaştır-yaz" yarışı veri kaybettirir. Burada karşılaştırma
-- atomiktir — gelen kayıt yalnızca daha YENİYSE üzerine yazar.
-- ----------------------------------------------------------------------------
create or replace function public.sync_records_keep_newest()
returns trigger
language plpgsql
as $$
begin
  if old.updated_at >= new.updated_at then
    -- Gelen kayıt eski: mevcut satır korunur.
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_keep_newest on public.sync_records;
create trigger trg_sync_keep_newest
  before update on public.sync_records
  for each row execute function public.sync_records_keep_newest();

-- ============================================================================
-- 2. Push kayıtları (cihaz jetonları)
-- ============================================================================
create table if not exists public.push_registrations (
  token      text   primary key,
  user_id    uuid   not null references auth.users (id) on delete cascade,
  platform   text   not null default 'ios',
  updated_at bigint not null
);

create index if not exists idx_push_user on public.push_registrations (user_id);

alter table public.push_registrations enable row level security;

drop policy if exists "push: kendi kayıtlarını yönetir" on public.push_registrations;
create policy "push: kendi kayıtlarını yönetir"
  on public.push_registrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- 3. Telemetri olayları
-- ============================================================================
create table if not exists public.analytics_events (
  id          bigserial primary key,
  -- Oturum açılmadan önceki olaylar da anlamlıdır → null olabilir.
  user_id     uuid references auth.users (id) on delete set null,
  name        text   not null,
  payload     text   not null default '{}',
  occurred_at bigint not null
);

create index if not exists idx_analytics_time on public.analytics_events (occurred_at);
create index if not exists idx_analytics_name on public.analytics_events (name);

alter table public.analytics_events enable row level security;
-- Politika TANIMLANMAZ: yalnızca servis anahtarı (Worker) yazabilir/okuyabilir.
-- Kullanıcılar kendi olaylarını da göremez — telemetri yönetim verisidir.

-- ============================================================================
-- 4. Ayarlar (katalog, feed tarama durumu)
-- ============================================================================
create table if not exists public.settings (
  key   text primary key,
  value text not null
);

alter table public.settings enable row level security;
-- Politika TANIMLANMAZ: yalnızca servis anahtarı erişir.
-- Katalog okuması Worker üzerinden yapılır (herkese açık uç).

-- ============================================================================
-- 5. Temizlik işi (opsiyonel)
-- ============================================================================
-- Telemetri sonsuza kadar birikmemeli. pg_cron eklentisi etkinse:
--
select cron.schedule(
 'analytics-temizlik', '0 3 * * *',
  $$ delete from public.analytics_events
     where occurred_at < (extract(epoch from now() - interval '90 days') * 1000) $$
);
