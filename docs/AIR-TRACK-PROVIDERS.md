# ECHIS — Air Track Modülü: Açık/Ücretsiz Uçuş Verisi Sağlayıcıları
## Uygunluk ve Entegrasyon Raporu

*Hazırlanma tarihi: 7 Temmuz 2026 · Kapsam: global canlı harita + askeri/devlet uçakları + tekil sorgu/geçmiş*

---

## 0. Yönetici Özeti

Flightradar24'ün ücretsiz/açık muadili **tek bir sağlayıcı olarak yok**; ancak
üç katmanlı bir kombinasyonla FR24'e yakın bir operasyonel resim ücretsiz kurulabilir:

| Katman | Kaynak | Neden |
|---|---|---|
| **Global sivil trafik** (ana harita) | **OpenSky Network** `/states/all` | Ücretsiz global anlık görüntü sunan tek API |
| **Askeri/devlet uçakları** (OSINT katmanı) | **adsb.lol** `/v2/mil` | Filtresiz, global, ODbL açık lisans — üründe kullanılabilir |
| **Detay/sorgu** (tıklanan uçak, kuyruk no, bölge) | adsb.lol / airplanes.live point+hex sorguları + **adsbdb/hexdb** metadata | 1 istek/sn limitleri tekil sorgu için fazlasıyla yeter |

**Kritik lisans bulgusu:** OpenSky verisi araştırma/kişisel kullanımda serbest,
ancak **canlı bir üründe operasyonel kullanım yazılı lisans gerektiriyor**
(kâr amacı gütmeyen kurumlar dahil). Geliştirme/prototip aşaması için sorun yok;
ECHIS yayınlanmadan önce OpenSky ile iletişime geçilmeli veya alternatif
stratejiye geçilmeli (bkz. §5). Topluluk ağlarının (adsb.fi, airplanes.live,
ADS-B Exchange Community) tamamı "kişisel/ticari olmayan" şartlı. **Yayınlanan
ürün için lisansı gerçekten açık olan tek canlı kaynak adsb.lol'dür (ODbL 1.0).**

---

## 1. Arka Plan: Bu Ekosistem Nasıl Çalışıyor?

- Uçaklar **ADS-B** transponderlarıyla konum/hız/kimlik yayınlar (1090 MHz, şifresiz).
- Dünyanın her yerindeki gönüllüler ~30$'lık SDR alıcılarla bu sinyalleri toplayıp
  ağlara "feed" eder. Transponder kapalıysa **MLAT** (çoklu alıcıyla nirengi) devreye girer.
- FR24/FlightAware bu gönüllü verisini alır, **devlet/askeri uçakları filtreler**
  ve ticari olarak satar. Topluluk ağları (adsb.lol, airplanes.live, adsb.fi,
  ADS-B Exchange) ise **filtrelemez** — OSINT değeri tam da burada.
- Sonuç: askeri uçak görünürlüğü konusunda ücretsiz topluluk ağları FR24'ten
  **daha iyidir**; ancak okyanus üstü kapsama (uydu ADS-B) yalnızca ücretli
  ticari kaynaklarda vardır.
- Çoğu ağın ekonomisi "feed et, API kazan" üzerine kurulu: bir alıcı kurup ağa
  veri beslersen limitler ciddi genişler. ECHIS için orta vadede **bir adet
  alıcı kurmak** (İstanbul/Ankara civarı) en ucuz "premium API aboneliği"dir.

---

## 2. Sağlayıcı Profilleri

### 2.1 OpenSky Network — global resmin ana kaynağı ⭐

İsviçre merkezli, kâr amacı gütmeyen araştırma ağı. Ücretsiz **global anlık
görüntü** (`/states/all`) sunan tek API.

| Özellik | Değer |
|---|---|
| Base URL | `https://opensky-network.org/api` |
| Kimlik doğrulama | OAuth2 client-credentials (Mart 2026'da basic auth kaldırıldı); token 30 dk geçerli |
| Token endpoint | `https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token` |
| Günlük kredi | Anonim **400** · Kayıtlı **4.000** · Feeder (≥%30 uptime) **8.000** |
| Global istek maliyeti | 4 kredi (>400 derece²); ≤25 derece² bölge = 1 kredi |
| Zaman çözünürlüğü | Kayıtlı 5 sn, anonim 10 sn |
| Kredi bitince | `429` + `X-Rate-Limit-Retry-After-Seconds` başlığı |

**Bütçe matematiği (global harita):** kayıtlı hesapla 4.000 kredi ÷ 4 =
**günde 1.000 global kare** → 7/24 kesintisiz **~86 saniyede bir yenileme**.
Feeder olunca ~43 sn. Sunucu tarafı önbellekle bu bütçe kullanıcı sayısından
**bağımsızdır** (bkz. §6.2) — tek upstream istek tüm ziyaretçilere servis edilir.

**Veri modeli notu:** `/states/all` state vector'ları `icao24, callsign,
origin_country, lon, lat, baro_altitude, velocity, true_track, vertical_rate,
squawk, category` içerir; **tescil (registration) ve uçak tipi yoktur** —
yerel statik veritabanıyla zenginleştirilir (§4.3).

**Lisans:** araştırma/eğitim için serbest; **her türlü ticari kullanım ve canlı
üründe operasyonel API kullanımı yazılı lisans gerektirir.** Geliştirme ve
değerlendirme serbesttir. Detay: §5.

Artılar: gerçek global snapshot, bölgesel bbox desteği, akademik güvenilirlik,
geçmiş veri (kayıtlıya 1 saat geriye state, ayrıca ayrı flights/tracks
endpoint'leri).
Eksiler: tescil/tip alanı yok, güncelleme yavaş (5-10 sn çözünürlük),
operasyonel lisans şartı, kapsama topluluk yoğunluğuna bağlı (Avrupa çok iyi,
okyanus/Afrika zayıf).

### 2.2 adsb.lol — açık lisanslı, filtresiz, ürün-güvenli ⭐

Topluluk ağı; **tek gerçekten açık veri kaynağı**: canlı API + günlük tarihsel
arşiv **ODbL 1.0** ile lisanslı (atıf + paylaş-benzer şartıyla ticari kullanım
dahil serbest). API, ADS-B Exchange v2 API'siyle **drop-in uyumlu**.

| Özellik | Değer |
|---|---|
| Base URL | `https://api.adsb.lol` (interaktif docs: `/docs`) |
| Anahtar | Şu an gerekmiyor; ileride feed edenlere API anahtarı planlanıyor |
| Rate limit | Dinamik (yüke göre); pratikte 1 istek/sn sınıfı |
| Lisans | **ODbL 1.0 — ticari kullanıma açık** |

Endpoint ailesi (v2):

```
/v2/mil                              → global askeri işaretli uçaklar  ★ OSINT
/v2/ladd                             → LADD (gizlenmek isteyen ABD tescilleri)
/v2/pia                              → PIA (özel ICAO adresi kullananlar)
/v2/hex/{icao24}   /v2/reg/{tescil}  → tekil uçak
/v2/callsign/{cs}  /v2/sqk/{squawk}  → çağrı kodu / squawk (7700 acil!)
/v2/type/{icaoType}                  → tip bazlı (örn. K35R tanker)
/v2/point/{lat}/{lon}/{radius}       → nokta+yarıçap, max 250 nm
```

**Global sivil snapshot endpoint'i yok** — bu yüzden ana harita OpenSky'dan,
askeri katman ve tüm sorgular adsb.lol'den gelir. `/v2/mil` global döner ve
ECHIS'in savunma odağı için tek başına çok değerli bir katmandır.

### 2.3 airplanes.live — güçlü yedek / ikinci kaynak

ADS-B Exchange'in eski ekibinden bağımsız, filtresiz ağ. **ADSB.One bu ağla
birleşti** (eski ADSB-One/api reposu airplanes.live arşivine yönleniyor) —
ADSB.One'ı ayrı kaynak olarak planlamayın.

- REST API: `https://api.airplanes.live/v2/...` — adsb.lol ile aynı v2 endpoint
  ailesi (mil/ladd/pia/hex/callsign/squawk/type/point, 250 nm).
- **1 istek/sn**; şu an feeder şartı yok ("ileride değişebilir" notuyla).
- Lisans: **ticari olmayan kullanım**; ticari için ayrı anlaşma sayfası var.
- Rol: adsb.lol düşerse otomatik failover hedefi (aynı JSON şeması sayesinde
  adapter değişikliği gerektirmez).

### 2.4 adsb.fi — bölgesel sorgular için üçüncü yedek

Finlandiya merkezli topluluk ağı.

- Base: `https://opendata.adsb.fi/api` — `/v2/{hex|callsign|registration|sqk|mil}`,
  `/v3/lat/{lat}/lon/{lon}/dist/{nm}` (max 250 nm).
- **1 istek/sn**; feeder'lara özel `/v2/snapshot` (tüm uçaklar, 30 sn'de bir,
  feeder IP'si gerekli) — **feeder kurulursa OpenSky'a global alternatif olur.**
- Lisans: kişisel, ticari olmayan; atıf zorunlu.

### 2.5 ADS-B Exchange — referans ama önerilmiyor

En büyük filtresiz ağ; ancak 2023'te özel sermayeye (JetNet) satıldı.
"Community API" (eski API Lite) ücretsiz ama **ticari olmayan** kullanım +
kurumsal kullanımda **feeder barındırma şartı**; ticari erişim RapidAPI/enterprise
üzerinden ücretli. v2 şeması zaten adsb.lol/airplanes.live'da aynen var —
ADSBx'e bağımlılık kurmanın ECHIS'e ek getirisi yok.

### 2.6 Uygun olmayanlar / ücretli kıyas

| Sağlayıcı | Durum | Not |
|---|---|---|
| **aviationstack** | ❌ Uygun değil | Ücretsiz plan 100 istek/**ay**, yalnız HTTP, tarife/durum odaklı (canlı konum haritası için değil) |
| **AirLabs vb. freemium'lar** | ❌ | Benzer: aylık istek kotaları canlı harita için anlamsız |
| **Flightradar24 API** | 💰 | Ücretsiz katman yok; en düşük plan ~9$/ay 30k kredi — ileride ucuz ticari yedek olabilir |
| **FlightAware AeroAPI** | 💰 | "Ücretsiz" katman = ayda 5$ kredi; ticari planlar 100$/ay'dan başlar |

---

## 3. Karşılaştırma Tablosu

| Kriter | OpenSky | adsb.lol | airplanes.live | adsb.fi | ADSBx Community |
|---|---|---|---|---|---|
| Global snapshot | ✅ (kredili) | ❌ (sadece mil/ladd/pia global) | ❌ | ⚠️ feeder'a özel | ❌ |
| Askeri uçak | ⚠️ görünür ama etiketsiz | ✅ `/v2/mil` | ✅ `/v2/mil` | ✅ `/v2/mil` | ✅ |
| Nokta/yarıçap sorgu | ✅ bbox | ✅ 250 nm | ✅ 250 nm | ✅ 250 nm | ✅ |
| Tescil/tip alanı | ❌ | ✅ | ✅ | ✅ | ✅ |
| Rate limit | kredi/gün | dinamik ~1/sn | 1/sn | 1/sn | tanımsız |
| Anahtar | OAuth2 | yok (şimdilik) | yok | yok | anahtar |
| **Üründe kullanım** | ⚠️ yazılı lisans | ✅ **ODbL** | ⚠️ non-commercial | ⚠️ non-commercial | ⚠️ non-commercial |
| Geçmiş veri | ✅ | ✅ günlük arşiv | ❌ | ❌ | 💰 |
| Feeder avantajı | 2× kredi | ileride anahtar | öncelik | global snapshot | API erişimi |

---

## 4. Tamamlayıcı Ücretsiz Kaynaklar (metadata / zenginleştirme)

Canlı konum tek başına yetmez; "bu uçak kim?" sorusu şu ücretsiz kaynaklarla çözülür:

### 4.1 adsbdb.com — uçak + rota API'si
`https://api.adsbdb.com/v0/aircraft/{modeS|tescil}` ve `/v0/callsign/{cs}` —
kayıtsız, ücretsiz; uçak tipi/operatör/tescil ve çağrı kodundan kalkış-varış
rotası döner. Limit 60 sn'lik kayan pencere üzerinden hesaplanır.
Not: rota verisi üçüncü kişilerin emeği; yeniden yayınlama izne tabi —
ekranda gösterim OK, kendi veritabanına toplu kopyalama değil.

### 4.2 hexdb.io — hafif hex→kimlik servisi
`https://hexdb.io/api/v1/aircraft/{hex}` (tip, üretici, operatör, tescil),
`/api/v1/route/icao/{callsign}`, `/api/v1/airport/icao/{icao}`. Ücretsiz, basit;
adsbdb'nin yedeği.

### 4.3 tar1090-db (Mictronics DB) — **yerel statik veritabanı** ⭐
`https://github.com/wiedehopf/tar1090-db/raw/refs/heads/csv/aircraft.csv.gz` —
yüz binlerce uçağın hex→tescil/tip/açıklama+**askeri bayrak** eşlemesi.
Build sırasında indirilip `data/airtrack/` altına işlenirse OpenSky'ın eksik
tescil/tip alanları **sıfır API çağrısıyla** doldurulur. En yüksek
kazanç/maliyet oranlı parça budur.

### 4.4 plane-alert-db — "ilginç uçaklar" listesi ⭐ (OSINT)
`https://github.com/sdr-enthusiasts/plane-alert-db` — devlet/askeri/VIP/
diktatör/tanker/AWACS gibi **53 kategoride ~16.000 ilginç uçak** CSV'si.
Canlı trafikle hex üzerinden kesiştirilerek ECHIS'e "Watchlist Hit" katmanı
kurulur (örn. "şu an havada 3 izleme listesi uçağı"). CC BY 4.0 mantığında
topluluk listesi; ECHIS'in savunma ekranıyla doğal kesişim.

### 4.5 Diğer statikler
- **OurAirports / OpenFlights** — havalimanı adı/koordinat/IATA-ICAO (public domain CSV).
- **Planespotters.net foto API** — `https://api.planespotters.net/pub/photos/hex/{hex}`
  küçük boyutlu uçak fotoğrafı + fotoğrafçı atıf linki; detay panelinde şık durur
  (atıf/backlink şartına uyulmalı).

---

## 5. Lisans ve Ticari Kullanım Analizi (karar noktası)

ECHIS'in hedefi yayınlanan bir ürün olduğu için tablo net okunmalı:

| Kaynak | Prototip/dev | Yayınlanmış ücretsiz ürün | Ticari ürün |
|---|---|---|---|
| OpenSky | ✅ | ⚠️ yazılı izin gerekli (operasyonel kullanım maddesi) | ❌ lisans şart |
| adsb.lol | ✅ | ✅ ODbL: atıf + veritabanı türevlerinde paylaş-benzer | ✅ (aynı şartlarla) |
| airplanes.live | ✅ | ⚠️ non-commercial sınırı; reklamsız/ücretsizse gri alan, teyit önerilir | ❌ anlaşma gerekli |
| adsb.fi | ✅ | ⚠️ "kişisel" vurgusu daha katı | ❌ |
| adsbdb / hexdb | ✅ | ✅ (rota verisini yeniden yayınlamamak kaydıyla) | ⚠️ rota verisi hariç |

**Önerilen yol:**
1. **Şimdi (Faz 1):** OpenSky kayıtlı hesap + adsb.lol ile geliştir. Prototip ve
   değerlendirme kullanımı her iki tarafta da serbest.
2. **Yayın öncesi:** OpenSky'a e-posta ile kullanım senaryosu bildir (küçük
   projelere makul yaklaştıkları biliniyor; feeder olmak süreci kolaylaştırır).
   Olumsuzsa global sivil katmanı kaldırıp **adsb.lol mil + bölgesel point
   sorguları** ile devam et — ECHIS'in OSINT değer önerisi zaten bu katmanda.
3. **Orta vade:** ~100-150$'lık bir ADS-B alıcı kurup adsb.fi + adsb.lol +
   OpenSky'a aynı anda feed et → OpenSky 8.000 kredi/gün, adsb.fi global
   snapshot, adsb.lol gelecekteki API anahtarı. Tek donanım, üç ağda ayrıcalık.

---

## 6. ECHIS Entegrasyon Mimarisi

### 6.1 Katman şeması

```
                    ┌─ İstemci (Air Track ekranı, MapLibre) ─┐
                    │  60-90 sn'de bir kendi proxy'mizi çağırır │
                    └────────────────┬───────────────────────┘
                                     │
        app/api/airtrack/*  (sunucu tarafı proxy + TTL cache)
        ┌──────────────┬─────────────────┬──────────────────┐
   /global (OpenSky    /mil (adsb.lol    /lookup/[hex]
    states/all,         /v2/mil,          (adsb.lol hex +
    TTL 90 sn,          TTL 30 sn)        adsbdb route +
    OAuth2 token                          planespotters foto,
    cache'li)                             TTL 5 dk)
        └──────────────┴─────────────────┴──────────────────┘
                                     │
        data/airtrack/  (build-time statik: aircraft.csv.gz
        özeti + plane-alert-db watchlist + havalimanları)
```

### 6.2 Proxy pattern — mevcut koda birebir uyum

`app/api/sources/gdelt/route.ts` bu iş için hazır şablondur ve aynen
uygulanmalıdır: modül seviyesinde cache + in-flight promise dedupe +
minimum istek aralığı (cooldown) + `cacheStatus: fresh|stale`. Air Track için
tek ek: OpenSky OAuth2 token'ının da modül seviyesinde cache'lenmesi
(30 dk ömür, ~25. dakikada yenile). `client_id/client_secret` `.env.local`'e
girer, AGENTS.md §4 gereği asla istemciye sızmaz.

**Neden kritik:** OpenSky kredisi hesap başınadır. Sunucu cache'i sayesinde
1 kullanıcı da 1.000 kullanıcı da aynı bütçeyi tüketir (günde ~1.000 istek).
İstemci hiçbir zaman sağlayıcıya doğrudan gitmez.

### 6.3 Normalize veri modeli

İki farklı şema (OpenSky array formatı + v2 JSON) tek tipe indirgenmeli —
`types/airtrack.ts`:

```ts
export type AirTrackContact = {
  icao24: string;          // birincil anahtar (hex)
  callsign: string | null;
  registration: string | null;  // v2'den veya yerel DB'den
  typeCode: string | null;      // örn. "B738", "K35R"
  lat: number; lon: number;
  altitudeFt: number | null;    // baro
  groundSpeedKt: number | null;
  track: number | null;         // derece
  verticalRateFpm: number | null;
  squawk: string | null;        // "7700" = acil durum vurgusu
  military: boolean;            // mil endpoint ∪ yerel DB bayrağı
  watchlist: string | null;     // plane-alert-db kategori adı
  source: "opensky" | "adsblol" | "airplaneslive";
  seenAt: number;               // epoch ms
};
```

Adapter'lar `lib/airtrack/openskyAdapter.ts` ve `lib/airtrack/v2Adapter.ts`
olarak `lib/sources/*Adapter.ts` düzenini izler. v2Adapter tek yazılır;
adsb.lol / airplanes.live / adsb.fi şema-uyumlu olduğundan base URL
parametresiyle üçüne de failover yapar.

### 6.4 Harita render notları

- MapLibre'de uçaklar **GeoJSON source + `setData()`** ile güncellenmeli
  (DOM marker değil — global karede 8-15k uçak olur, marker DOM'u çöker).
- Sembol: `track` değeriyle döndürülen uçak ikonu (`icon-rotate`);
  askeri = amber/çelik (Defense Engine renk diliyle tutarlı),
  watchlist = kritik vurgu, squawk 7700 = pulse.
- Zoom < 4'te yoğunluk için `circle` layer'a düş; zoom ≥ 4'te sembol.
- AGENTS.md §6 kuralları geçerli: tek harita instance'ı, unmount'ta
  `map.remove()`, kamera `DEFAULT_GLOBE_VIEW`'a dokunmaz. Air Track kendi
  ekranı olduğundan ana/çalışma kürelerine dokunmadan, Intel Watch'taki gibi
  **kendi bağımsız MapLibre instance'ı** ile kurulmalı.

### 6.5 Yenileme kadansı ve bütçe

| Veri | Kaynak | Kadans | Günlük maliyet |
|---|---|---|---|
| Global sivil kare | OpenSky | 90 sn (ekran açıkken) | ≤960 istek = 3.840 kredi ✅ 4.000 içinde |
| Global askeri | adsb.lol /v2/mil | 30 sn | rate limit'e uyar, kredisiz |
| Uçak detayı (tıklama) | adsb.lol hex + adsbdb | anlık, 5 dk cache | ihmal edilebilir |
| Ekran kapalıyken | — | polling durur | bütçe korunur |

İnce ayar: ekran görünür değilken (`document.visibilityState`) polling
durdurulmalı; OpenSky 429 dönerse cache `stale` işaretiyle servis edilip
`X-Rate-Limit-Retry-After-Seconds` kadar beklenmelidir.

### 6.6 Uygulama fazları

1. **Faz 1 — Askeri katman (en hızlı kazanç):** adsb.lol `/v2/mil` proxy'si +
   bağımsız MapLibre haritası + plane-alert-db watchlist eşleşmesi.
   Lisans riski sıfır, ECHIS kimliğiyle tam uyumlu. ~1 route + 1 adapter + 1 ekran.
2. **Faz 2 — Global sivil arka plan:** OpenSky `/states/all` + OAuth2 token
   yönetimi + tar1090-db statik zenginleştirme.
3. **Faz 3 — Detay paneli:** hex tıklama → v2 hex sorgusu + adsbdb rota +
   planespotters foto; squawk 7700 izleme; "Send to Intel Watch" köprüsü.
4. **Faz 4 — Dayanıklılık:** airplanes.live failover, feeder kurulumu kararı,
   OpenSky lisans yazışması.

---

## 7. Riskler ve Sınırlar

- **Kapsama:** topluluk ağlarında okyanus/Afrika/orta Asya boşlukları var
  (uydu ADS-B yok). Global harita "dünyadaki tüm uçaklar" değil "alıcı
  kapsamasındaki uçaklar"dır — UI'da küçük bir kapsama notu dürüst olur.
- **Askeri görünürlük:** yalnızca transponder'ı açık askeri uçaklar görünür
  (tanker, kargo, eğitim, AWACS çoğu zaman açık; savaş devriyeleri kapalı).
  Bu bile OSINT için ciddi sinyal üretir (örn. tanker yörüngeleri).
- **OpenSky lisansı:** yayın öncesi çözülmesi gereken tek blokör (bkz. §5).
- **Topluluk API kararlılığı:** SLA yok; adsb.lol "ileride anahtar" diyor.
  v2 şema uyumluluğu sayesinde üç ağ arasında geçiş maliyeti düşük tutulmalı
  (base URL config'te).
- **AGENTS.md §7:** Air Track "reserved" listesinde — implementasyon ayrı ve
  açık bir task olarak başlatılmalı; bu rapor yalnızca ön araştırmadır.

---

## 8. Ship Track Ön Notu (bir sonraki modül)

Deniz tarafında tablo daha basit: **aisstream.io** ücretsiz global AIS
websocket akışı sunuyor (`wss://stream.aisstream.io/v0/stream`, ücretsiz API
anahtarı + bounding box/MMSI/mesaj tipi filtreli abonelik). Websocket
AGENTS.md'de "reserved" olduğundan mimari kararı (sunucuda tek websocket →
istemciye SSE/polling) ayrı bir raporda ele alınmalı. AISHub alternatifi
kendi AIS alıcını feed etme şartlı. Air Track'te kurulacak proxy+cache+
normalize deseni Ship Track'e birebir taşınır.

---

## 9. Kaynaklar

**OpenSky:** [REST API dokümantasyonu](https://openskynetwork.github.io/opensky-api/rest.html) · [Kullanım şartları](https://opensky-network.org/about/terms-of-use) · [API sayfası](https://opensky-network.org/data/api)
**adsb.lol:** [API docs](https://api.adsb.lol/docs) · [Open Data](https://www.adsb.lol/docs/open-data/) · [GitHub](https://github.com/adsblol/api)
**airplanes.live:** [API guide](https://airplanes.live/api-guide/) · [Ticari kullanım](https://airplanes.live/commercial-use/) · [Kullanım şartları](https://airplanes.live/terms-of-use/)
**adsb.fi:** [opendata README](https://github.com/adsbfi/opendata/blob/main/README.md)
**ADS-B Exchange:** [Developer Hub](https://www.adsbexchange.com/community/developer-hub/) · [API Lite](https://www.adsbexchange.com/api-lite/)
**Metadata:** [adsbdb](https://www.adsbdb.com/) · [hexdb.io](https://hexdb.io/) · [tar1090-db](https://github.com/wiedehopf/tar1090-db) · [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db) · [Planespotters](https://www.planespotters.net/)
**Ücretli kıyas:** [FR24 API](https://fr24api.flightradar24.com/) · [AeroAPI](https://www.flightaware.com/commercial/aeroapi/v3/pricing.rvt)
**AIS (ön not):** [aisstream.io](https://aisstream.io/) · [dokümantasyon](https://aisstream.io/documentation)
