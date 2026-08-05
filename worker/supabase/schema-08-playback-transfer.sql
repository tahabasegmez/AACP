-- AACP — Şema 08: oynatmayı başka cihaza aktarma
--
-- `schema-07`den SONRA, Supabase Studio → SQL Editor'da BİR KEZ çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- Şema 07 "hangi cihaz çalıyor" sorusunu çözdü. Bu şema bir adım ötesini
-- ekler: kullanıcı BAŞKA bir cihazını seçip oynatmayı oraya gönderebilir.

-- ============================================================================
-- Cihaz gelen kutusu
-- ============================================================================
-- Aktarım, hedef cihaza verilen bir KOMUTtur. Cihazlar arasında doğrudan bir
-- kanal yoktur (uygulama arka planda olabilir, ağı değişmiş olabilir); komut
-- sunucuda bekler ve hedef cihaz kendi turunda alır.
--
-- Komut jsonb'dir: içeriği (hangi bölüm, hangi saniye) uygulamanın bileceği
-- bir ayrıntıdır ve ilerde alan eklemek şema değişikliği gerektirmemelidir.
alter table public.playback_devices
  add column if not exists pending_command jsonb,
  add column if not exists command_at timestamptz;

-- ============================================================================
-- Oynatmayı bir cihaza aktar
-- ============================================================================
-- Hedef cihaz AKTİF yapılır; kaynak cihaz kendi turunda "oturumu kaybettim"
-- görüp duraklar. Böylece durdurma ve başlatma tek kuralla yürür — kaynağa
-- ayrıca "dur" komutu göndermek, iki ayrı yolun ayrışması demekti.
create or replace function public.transfer_playback(
  p_to_device_id text,
  p_command jsonb
)
returns table (device_id text, name text, platform text, active boolean, last_seen_at timestamptz)
language plpgsql
security definer
as $$
-- Dönüş sütunları tablonunkilerle aynı adlı; belirsiz adlar daima sütun
-- olarak çözülsün (bkz. schema-07).
#variable_conflict use_column
begin
  -- Var olmayan bir cihaza aktarım yapılmaz: kullanıcı listede görmediği bir
  -- cihazı seçemez, ama istemci eski bir listeyle gelebilir.
  if not exists (
    select 1 from public.playback_devices d
     where d.user_id = auth.uid() and d.device_id = p_to_device_id
  ) then
    raise exception 'cihaz bulunamadı' using errcode = 'no_data_found';
  end if;

  update public.playback_devices d
     set active = false
   where d.user_id = auth.uid() and d.active;

  update public.playback_devices d
     set active = true,
         pending_command = p_command,
         command_at = now()
   where d.user_id = auth.uid() and d.device_id = p_to_device_id;

  return query
    select d.device_id, d.name, d.platform, d.active, d.last_seen_at
      from public.playback_devices d
     where d.user_id = auth.uid()
     order by d.last_seen_at desc;
end;
$$;

-- ============================================================================
-- Cihazın turu: tazele + gelen kutusunu boşalt + listeyi al
-- ============================================================================
-- Cihazlar bunu düzenli olarak çağırır. Üç iş TEK çağrıda yapılır çünkü üçü de
-- her turda gerekir; ayrı uçlara bölmek turu üçe katlardı.
--
-- Komut OKUNDUĞUNDA SİLİNİR: aynı aktarım iki kez uygulanırsa bölüm ikinci kez
-- baştan başlardı. Silme ve okuma tek ifadede yapılır, arada başka bir tur
-- komutu ikinci kez alamaz.
create or replace function public.poll_playback(p_device_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_command jsonb;
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

  -- Cihazın "son görülme"si tazelenir: listede boşta duran cihazın ne zaman
  -- açıldığı kullanıcıya bilgi verir. Komut varsa aynı ifadede tüketilir.
  update public.playback_devices
     set last_seen_at = now(),
         pending_command = null,
         command_at = null
   where user_id = auth.uid() and device_id = p_device_id;

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

  return jsonb_build_object('devices', v_devices, 'command', v_command);
end;
$$;
