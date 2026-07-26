# Sunucu Kurulumu ve Deneme Rehberi

Bu rehber AACP backend'ini sıfırdan kurup uçtan uca denemeyi anlatır. Örnekler
**Raspberry Pi 5** üzerinden verilmiştir, ancak komutların tamamı herhangi bir
Linux sunucusunda (kurumsal sunucu, kiralık VPS) aynen çalışır — servis
makineye özgü hiçbir varsayım yapmaz.

Mimari ve uç listesi: [BACKEND.md](BACKEND.md)

---

## 1. Ön hazırlık (Raspberry Pi)

Raspberry Pi OS (64-bit) kurulu ve SSH açık varsayılıyor.

```bash
ssh pi@raspberrypi.local
```

Docker yoksa kur:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Grup değişikliği için oturumu yenile:
exit
```

Tekrar bağlanıp doğrula:

```bash
docker --version
docker compose version
```

> **Neden Docker:** `better-sqlite3` native bir modüldür ve Node sürümüne bağlı
> derlenir. Docker bu derlemeyi imaj içinde tek seferde halleder; Pi'de Node
> sürümüyle uğraşmazsınız. Docker istemiyorsanız §7'ye bakın.

## 2. Projeyi al

```bash
git clone https://github.com/tahabasegmez/AACP.git
cd AACP/server
```

## 3. Yapılandır

```bash
cp .env.example .env
# Jeton imzalama anahtarı üret ve .env'e yaz:
openssl rand -hex 32
# Yönetim anahtarı (katalog yayınlama için) üret:
openssl rand -hex 24
nano .env
```

En az şunları doldurun:

```bash
AUTH_SECRET=<openssl çıktısı>
ADMIN_TOKEN=<ikinci openssl çıktısı>
```

Boş bırakılırsa: `AUTH_SECRET` yoksa yeniden başlatmada oturumlar düşer;
`ADMIN_TOKEN` yoksa katalog yayınlama uçları **kapalı** kalır.

## 4. Çalıştır

```bash
docker compose up -d --build
```

İlk derleme Pi'de birkaç dakika sürebilir (native modül derlemesi). Sonra:

```bash
docker compose ps
docker compose logs -f api
```

Sağlık kontrolü:

```bash
curl http://localhost:8080/health
# {"status":"ok","env":"production","time":"..."}
```

## 5. Kataloğu yayınla

Katalog tek kaynakta yaşar (`src/core/config/feedCatalog.ts`). JSON'u üretin —
bu adım **geliştirme makinenizde** (Windows/mac) yapılır:

```bash
node scripts/generate-shows-json.js shows.json
```

Dosyayı Pi'ye kopyalayın ve yayınlayın:

```bash
scp shows.json pi@raspberrypi.local:~/
```

Pi'de:

```bash
curl -X POST http://localhost:8080/v1/catalog \
     -H "x-admin-token: $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     --data @shows.json
# {"count":11}
```

Doğrula:

```bash
curl http://localhost:8080/v1/catalog | head -c 300
```

> Alternatif: `shows.json`'u kalıcı volume'e (`/data`) koyarsanız API çağrısına
> gerek kalmaz. Servis önce veritabanına, sonra `DATA_DIR/shows.json`'a bakar.

## 6. Uçtan uca deneme

### 6.1 Oturum aç (anonim cihaz kimliği)

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/device \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-cihaz-12345"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo $TOKEN
```

### 6.2 Senkron: veri gönder ve geri oku

```bash
# "Kaldığın yer" kaydı gönder
curl -X POST http://localhost:8080/v1/sync/progress \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"key":"ep-1","value":"{\"pos\":42}","updatedAt":'"$(date +%s000)"',"deleted":false}]}'
# {"accepted":1,"cursor":...}

# Geri oku
curl "http://localhost:8080/v1/sync/progress?since=0" \
  -H "Authorization: Bearer $TOKEN"
```

**İkinci cihaz senaryosu:** farklı bir `deviceId` ile yeni jeton alın ve aynı
`GET`'i yapın — veri **görünmemeli** (kullanıcılar izole). Aynı `deviceId` ile
alırsanız **görünmeli** (aynı kullanıcı).

### 6.3 Telemetri

```bash
curl -X POST http://localhost:8080/v1/analytics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"name":"app_open","occurredAt":'"$(date +%s000)"',"payload":{}}]}'
# {"accepted":1}
```

### 6.4 Yeni bölüm taraması (push)

```bash
curl -X POST http://localhost:8080/v1/push/scan \
  -H "x-admin-token: $ADMIN_TOKEN"
# {"checked":11,"notified":0}
```

İlk çalıştırmada `notified: 0` **beklenen davranıştır** — tarayıcı mevcut durumu
kaydeder, geçmiş bölümler için bildirim yağdırmaz. Bir şovda yeni bölüm
yayınlandıktan sonraki taramada takipçilere bildirim üretilir.

> APNs anahtarı henüz bağlı olmadığı için bildirimler **loglanır, gönderilmez**
> (`LoggingPushSender`). Zinciri loglardan izleyebilirsiniz:
> `docker compose logs -f api | grep push`

### 6.5 Veritabanını incele

```bash
docker compose exec api node -e "
const db = require('better-sqlite3')('/data/aacp.db');
console.log('kullanıcılar:', db.prepare('SELECT COUNT(*) c FROM users').get());
console.log('senkron:', db.prepare('SELECT COUNT(*) c FROM sync_records').get());
console.log('olaylar:', db.prepare('SELECT COUNT(*) c FROM analytics_events').get());
"
```

## 7. Uygulamayı sunucuya bağla

Geliştirme makinenizde [src/core/config/env.ts](../src/core/config/env.ts):

```ts
development: {
  ...base,
  name: 'development',
  apiBaseUrl: 'http://raspberrypi.local:8080', // ← Pi'nin adresi
  analyticsEnabled: true,
  syncEnabled: true,
},
```

Pi'nin IP'sini öğrenmek için: `hostname -I`

> **iOS uyarısı:** iOS App Transport Security düz HTTP'yi engeller. Yerel ağda
> denemek için ya §8'deki HTTPS kurulumunu yapın ya da geçici olarak Xcode'da
> `NSAllowsLocalNetworking` istisnası tanımlayın. **Üretimde HTTPS zorunludur.**

Uygulamayı çalıştırınca beklenen davranış:
- Şov listesi sunucudaki katalogdan gelir (`/v1/catalog`),
- Ayarlar → "Şimdi senkronla" çalışır ve durum mesajı gösterir,
- Bir bölümü yarıda bırakıp başka cihazda aynı `deviceId` ile açınca kaldığınız
  yer gelir.

## 8. HTTPS (üretim için zorunlu)

Servis düz HTTP konuşur; TLS'i önündeki ters proxy sonlandırır. Caddy en kısa
yoldur (otomatik Let's Encrypt sertifikası):

```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
```

```
podcast.example.com {
    reverse_proxy localhost:8080
}
```

```bash
sudo systemctl reload caddy
```

Alan adı yoksa Cloudflare Tunnel veya Tailscale Funnel de kullanılabilir; servis
tarafında değişiklik gerekmez.

## 9. Bakım

**Güncelleme:**
```bash
cd ~/AACP && git pull
cd server && docker compose up -d --build
```

**Yedekleme** (veri tek bir volume'de):
```bash
docker run --rm -v aacp-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/aacp-yedek-$(date +%F).tar.gz -C /data .
```

**Geri yükleme:**
```bash
docker run --rm -v aacp-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/aacp-yedek-2026-07-26.tar.gz -C /data
docker compose restart
```

**Loglar:** `docker compose logs -f api` (JSON satırları — `jq` ile süzülebilir)

## 10. Docker'sız kurulum (systemd)

```bash
cd ~/AACP/server
npm ci && npm run build
sudo mkdir -p /var/lib/aacp && sudo chown $USER /var/lib/aacp
sudo nano /etc/systemd/system/aacp.service
```

```ini
[Unit]
Description=AACP Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/AACP/server
Environment=NODE_ENV=production
Environment=DATA_DIR=/var/lib/aacp
EnvironmentFile=/home/pi/AACP/server/.env
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now aacp
sudo systemctl status aacp
```

## 11. Sorun giderme

| Belirti | Sebep / çözüm |
|---|---|
| `curl: (7) connection refused` | Konteyner ayakta mı? `docker compose ps`, `logs api` |
| `403 Yönetim uçları kapalı` | `.env`'de `ADMIN_TOKEN` boş — doldurup `docker compose up -d` |
| `401 Bu uç için oturum gerekli` | `Authorization: Bearer $TOKEN` başlığı eksik veya jeton süresi dolmuş |
| Katalog boş dönüyor | Yayınlanmadı — §5'i uygulayın (uygulama yine de bundled listeyle çalışır) |
| Uygulama sunucuyu görmüyor | `apiBaseUrl` yanlış, Pi farklı ağda, ya da iOS HTTP'yi engelliyor (§7) |
| `better-sqlite3` derleme hatası (Docker'sız) | Node 20+ gerekli; `python3 make g++` kurulu olmalı |
| Pi'de derleme çok yavaş | Normal (native modül). Alternatif: imajı x86 makinede `docker buildx --platform linux/arm64` ile üretip aktarın |
