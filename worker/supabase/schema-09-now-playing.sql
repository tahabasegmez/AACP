-- AACP — Şema 09: çalan bölümün cihazlar arası taşınması
--
-- `schema-08`den SONRA, Supabase Studio → SQL Editor'da BİR KEZ çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- Şema 07/08 "hangi cihaz çalıyor" ve "oynatmayı gönder" sorularını çözdü.
-- Eksik kalan yön DEVRALMAYDI: "oynatmayı buraya al" diyen cihaz, karşı
-- cihazın hangi bölümde ve kaç saniyede olduğunu bilmiyordu; kendi eski
-- yerel kaydından devam ediyordu. Yanlış bölüm, yanlış saniye.

-- ============================================================================
-- Çalan bölüm yayını
-- ============================================================================
-- Aktif cihaz, turlarında ne çaldığını yazar. İçerik `pending_command` ile
-- AYNI biçimdedir (bölüm anlık görüntüsü + saniye): devralan cihazın ihtiyacı
-- ile aktarılan komutun ihtiyacı birebir aynı, iki ayrı biçim tanımlamak
-- ikisinin sessizce ayrışması demekti.
alter table public.playback_devices
  add column if not exists now_playing jsonb,
  add column if not exists now_playing_at timestamptz;

-- ============================================================================
-- Devralma — artık çalan bölümü de döner
-- ============================================================================
-- Dönüş tipi değiştiği için fonksiyon önce düşürülür (Postgres, `create or
-- replace` ile dönüş tipini değiştirmeye izin vermez).
drop function if exists public.claim_playback(text, text, text);

create or replace function public.claim_playback(
  p_device_id text,
  p_name text,
  p_platform text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_now_playing jsonb;
  v_devices jsonb;
begin
  -- ÖNCE okunur: devralma bir sonraki adımda diğer cihazı pasifleştirecek ve
  -- o satırın "ne çalıyordu" bilgisi devralan cihazın tek kaynağıdır.
  select d.now_playing
    into v_now_playing
    from public.playback_devices d
   where d.user_id = auth.uid()
     and d.active
     and d.device_id <> p_device_id
   limit 1;

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

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'device_id', d.device_id,
               'name', d.name,
               'platform', d.platform,
               'active', d.active,
               'last_seen_at', d.last_seen_at
             )
             order by d.last_seen_at desc
           ),
           '[]'::jsonb
         )
    into v_devices
    from public.playback_devices d
   where d.user_id = auth.uid();

  return jsonb_build_object('devices', v_devices, 'now_playing', v_now_playing);
end;
$$;

-- ============================================================================
-- Tur — çalan bölümü yayınla, komutu al, listeyi al
-- ============================================================================
-- Dönüş tipi aynı (jsonb) ama imza değişti; eski tek argümanlı sürüm düşürülür.
drop function if exists public.poll_playback(text);

create or replace function public.poll_playback(
  p_device_id text,
  p_now_playing jsonb default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_command jsonb;
  v_now_playing jsonb;
  v_devices jsonb;
begin
  -- Satır kilitlenerek okunur: iki tur aynı anda gelirse komutu yalnızca biri
  -- alır. `update ... returning` KULLANILAMAZ — RETURNING yeni değeri (null)
  -- verirdi, yani komut hiç görünmezdi.
  select pending_command
    into v_command
    from public.playback_devices
   where user_id = auth.uid() and device_id = p_device_id
     for update;

  -- Tazele + gelen kutusunu boşalt. Çalan bölüm yalnızca cihaz bir şey
  -- çalıyorken güncellenir: duraklamış bir cihazın yayınını silmek, devralan
  -- cihazın "nereden devam edeceğim" bilgisini yok ederdi.
  update public.playback_devices
     set last_seen_at = now(),
         pending_command = null,
         command_at = null,
         now_playing = coalesce(p_now_playing, now_playing),
         now_playing_at = case when p_now_playing is null then now_playing_at else now() end
   where user_id = auth.uid() and device_id = p_device_id;

  -- Aktif cihazın çaldığı — devralma düğmesi bunu kullanır.
  select d.now_playing
    into v_now_playing
    from public.playback_devices d
   where d.user_id = auth.uid() and d.active
   limit 1;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'device_id', d.device_id,
               'name', d.name,
               'platform', d.platform,
               'active', d.active,
               'last_seen_at', d.last_seen_at
             )
             order by d.last_seen_at desc
           ),
           '[]'::jsonb
         )
    into v_devices
    from public.playback_devices d
   where d.user_id = auth.uid();

  return jsonb_build_object(
    'devices', v_devices,
    'command', v_command,
    'now_playing', v_now_playing
  );
end;
$$;
