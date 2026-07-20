# ECHIS — Denetim Sonuçları ve Yayın Yol Haritası

> Son güncelleme: **2 Temmuz 2026** (Claude Fable 5 denetim oturumu)
> Bu dosya, Temmuz 2026 güvenlik/kalite denetiminin kaydı ve canlıya çıkışa
> kadar yapılacakların tek listesidir. Bir maddeyi bitirince buradaki kutusunu
> işaretleyin ve "Ne yapıldı" bölümüne tarih düşün.
> Yeni bir AI ajanına iş verirken bu dosyayı + `AGENTS.md`'yi referans gösterin.

---

## 1. Mevcut durum özeti

- Proje: Next.js 16 OSINT/durumsal farkındalık paneli. Build/lint/testler temiz.
- Hedef: **yayınlanacak ürün** (kişisel araç değil).
- Mock ekranlar (Signals/SOCMINT, Policy, Defense Industry, Events) gerçek
  veriye bağlanmadan canlıya çıkılmayacak — sahibinin kararı.
- Barındırma kararı henüz verilmedi. Öneri: **Vercel (uygulama) + Supabase
  (veritabanı/auth)** — ikisinin de ücretsiz katmanı başlangıç için yeterli.
  VPS kısa/orta vadede gereksiz (bakım yükü).

---

## 2. Ne yapıldı (2 Temmuz 2026)

### Grup 1 — Kritik güvenlik düzeltmeleri ✅

| Kod | Ne yapıldı | Dosya |
|-----|-----------|-------|
| S3 ✅ | `next` 16.2.4 → **16.2.10** (6 high severity CVE kapandı); `eslint-config-next` eşitlendi; `npm audit fix` | `package.json` |
| K1 ✅ | Kullanılmayan `react-simple-maps` + `d3-geo` bağımlılıkları ve iki hayalet `.d.ts` silindi | `package.json`, `types/` |
| S1 ✅ | TLS sertifika doğrulamasını gevşeten fallback (`rejectUnauthorized:false`) **tamamen kaldırıldı**. Karar öncesi 35 feed host'u katı TLS ile probe edildi: hiçbiri sertifika hatası vermiyordu, kaldırmak hiçbir kaynağı kırmadı | `lib/sources/rssPreviewAdapter.ts` |
| S2 ✅ | `insecureHTTPParser` fallback'i kaldırıldı (HTTP request smuggling yüzeyi) | aynı dosya |
| S4 ✅ | Feed yanıtına **3 MB üst sınır** (`MAX_FEED_BYTES`, aşan istek `upstream_body_too_large` ile kesilir) | aynı dosya |
| S8 ✅ | Feed'den gelen linklerde şema doğrulaması: yalnızca `http(s)` kabul (`safeHttpUrl`), `javascript:` vb. düşürülür | aynı dosya |
| S7 ✅ | `client-timezone` IP cache'ine 5.000 girişlik sınır (FIFO) — bellek şişirme kapandı | `app/api/client-timezone/route.ts` |

Kalıntı risk: `npm audit`'te **2 moderate** kaldı (Next.js'in kendi içine gömdüğü
`postcss` kopyası). Bizim tarafta eylem yok; **Next'in yeni sürümleri çıktıkça
`npm audit` tekrar çalıştırılıp `next` güncellenecek.**

### Grup 2 — S5'in cache yarısı ✅

Denetim düzeltmesi: 6 API route'unda (currents, finlight, freenews, gdelt,
newsdata, worldnews) 5 dk TTL cache **zaten vardı**. Eksik olan 3 route'a aynı
desen (5 dk TTL + in-flight birleştirme + hata anında bayat cache'i sunma) eklendi:

| Route | Dosya |
|-------|-------|
| Guardian ✅ | `app/api/sources/guardian/route.ts` |
| ReliefWeb ✅ | `app/api/sources/reliefweb/route.ts` |
| **RSS-preview** (80+ kaynağın tamamı; kaynak-bazlı keyed cache) ✅ | `app/api/sources/rss-preview/route.ts` |

Etki: aynı kaynağa 5 dk içinde gelen tüm istekler tek upstream isteğinde
birleşir → API kotası korunur, kaynak sitelerin bot/ban riski düşer, N kullanıcı
= 1× upstream yük.

### Grup 3 — bugün yapılabilen kısım ✅

| Kod | Ne yapıldı | Dosya |
|-----|-----------|-------|
| S6 (kısmi) ✅ | Güvenlik başlıkları eklendi: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` | `next.config.ts` |

**CSP bilinçli olarak eklenmedi** — aşağıda §3.2'de nedeni ve taslağı var.

Doğrulama (her grupta): `npm run lint` ✅ · `npm run build` ✅ · test
harness'leri 68/68 ✅ · dev sunucusunda canlı smoke test (cache hit +
başlıklar) ✅.

---

## 3. KALAN İŞLER — canlıya çıkmadan önce

Sıralama önerilen yapılış sırasıdır.

### 3.1 ☐ S5'in rate-limit yarısı (yayın öncesi son hafta)

**Ne:** Aynı ziyaretçinin (IP) API route'larına dakikada atabileceği istek
sayısını sınırlamak. Cache var ama cache'i bypass edemese de kötü niyetli
biri sunucuyu meşgul edebilir.
**Nasıl:** Barındırma Vercel olacaksa en kolayı Vercel WAF / Firewall
kuralları (kod yazmadan panel üzerinden) veya `middleware.ts` içinde basit
IP-başına sayaç. Kendi Node sunucusu olursa route içi in-memory sayaç yeterli.
**Karar bekliyor:** barındırma seçimi. Bu yüzden şimdi yapılmadı.

### 3.2 ☐ S6'nın CSP ayağı (yayın öncesi son hafta)

**Ne:** Content-Security-Policy başlığı — "bu sayfa yalnızca şu adreslerden
kod/görsel/bağlantı yükleyebilir" talimatı. XSS'e karşı en güçlü katman.
**Neden şimdi değil:** Globe motorları dış sunuculardan harita karosu (tile)
çekiyor; CSP bu host'ları tek tek saymak zorunda. Yanlış yazılırsa **harita
kararır**. Deploy ortamında test ederek eklenmeli.
**Başlangıç taslağı** (host listesi doğrulanmalı — `echisOsmGlobeStyle.ts` ve
`echisCommandBasemap.ts` içindeki tile URL'leriyle karşılaştırın):

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.tile.openstreetmap.org https://basemaps.cartocdn.com;
connect-src 'self' https://*.tile.openstreetmap.org https://basemaps.cartocdn.com;
worker-src 'self' blob:;
font-src 'self';
frame-ancestors 'none';
```

İlk aşamada `Content-Security-Policy-Report-Only` başlığıyla yayınlayıp
konsolda ihlal var mı izleyin; temizse gerçek başlığa çevirin.

### 3.3 ☐ Auth (giriş) — yayın modeli netleşince

**Ne:** Panel herkese açık mı olacak, davetli mi? Davetliyse Supabase Auth
(e-posta + şifre veya magic link) en az dirençli yol; Vercel + Supabase
ikilisinde hazır entegrasyon var.
**Not:** Auth eklenmeden yayınlanırsa rate-limit ve kota koruması iki kat
önemli hale gelir.

### 3.4 ☐ KVKK / gizlilik (yayından önce zorunlu)

- `client-timezone` route'u ziyaretçi IP'sini findip.net'e (yurtdışı üçüncü
  taraf) gönderiyor → **aydınlatma metni** gerekir; alternatif: bu özelliği
  tarayıcının kendi `Intl.DateTimeFormat().resolvedOptions().timeZone`
  değeriyle değiştirip IP göndermeyi tamamen bırakmak (daha temiz çözüm,
  API anahtarı ihtiyacını da kaldırır).
- Sitede analitik/çerez eklenirse çerez bildirimi.

### 3.5 ☐ Mock ekranlara "SIMULATED DATA" göstergesi (yayından önce zorunlu)

Signals/SOCMINT, Policy, Defense Industry, Events ekranları gerçek veriye
bağlanana kadar kalıcı ve kaçırılamaz bir "SİMÜLE VERİ" bandı/filigranı
taşımalı. Gerçek sanılan sahte istihbarat, ürün güvenilirliğini bitirir.

### 3.6 ☐ API kullanım şartları denetimi (yayından önce zorunlu — engel olabilir)

Ücretsiz API anahtarları (Guardian, NewsData, WorldNews, Currents, Finlight)
çoğunlukla geliştirme/kişisel kullanım içindir; halka açık ürün ya görünür
atıf ya ücretli plan gerektirir. Her API'nin ToS'u tek tek okunup karar
verilmeli (atıf ekle / plana geç / kaynağı çıkar). Aksi halde yayın sonrası
anahtar iptali = panelin yarısı kararır. RSS tarafı güvenli: yalnızca
başlık+özet gösteriliyor ve kaynağa link veriliyor.

### 3.7 ☐ Deploy günü kontrol listesi

- [ ] `.env` anahtarlarını Vercel ortam değişkenlerine taşı (repo'ya asla koyma)
- [ ] **Not:** Route cache'leri bellek-içi; Vercel serverless'ta her instance
      kendi cache'ini tutar (koruma kısmen sürer). Trafik büyürse cache'i
      Upstash Redis'e taşımayı değerlendir — şimdilik gerekmez.
- [ ] `npm audit` son kontrol + `next` son sürüm
- [ ] CSP report-only → enforce geçişi
- [ ] Rate limit aktif mi test et
- [ ] Uygulamanın konsolunda hata var mı, globe iki motorda da açılıyor mu
- [ ] Hata izleme kur (Sentry ücretsiz katman yeterli) — canlıda kullanıcı
      konsolu görünmez
- [ ] Dar ekranda "masaüstü için tasarlandı" uyarısı (responsive yatırımı
      bilinçli olarak yapılmıyor)

---

## 4. KALAN İŞLER — kalite/altyapı (aciliyeti düşük, değeri yüksek)

### 4.1 ☐ Test script'i + CI

`package.json`'a test script'i (mevcut iki self-contained harness'i çalıştıran)
+ `.github/workflows/ci.yml` (push'ta lint + build + test). Repo GitHub'da,
Actions ücretsiz. AI ajanına verilecek görev: "Add npm test script wrapping
the two existing test harnesses (see their header comments for the exact tsc
command) and a GitHub Actions workflow running lint, build, test on push."

### 4.2 ✅ Küre yaşam döngüsünün ayrılması (K3)

Eski Three.js alternatif küresi ve motor seçici kaldırıldı. Ana ekran,
Global View ve SOCMINT MapLibre üzerinde ayrı ref/instance yaşam döngülerine
sahip; yalnızca aktif ekranın operasyonel küresi mount edilir.

### 4.3 ✅ `three` bağımlılığının kaldırılması (K1)

Eski alternatif kürenin Three.js kullanımı kaldırıldı. `three` ve
`@types/three` bağımlılıkları projeden tamamen çıkarıldı.

### 4.4 ☐ Dev dosyaların bölünmesi (K2)

`MapLibreGlobe.tsx` (2430 satır), `IntelWatchMap.tsx` (2231),
`SourcesScreen.tsx` (1300). Bir sonraki büyük dokunuşta marker/kamera/
stil alt modüllere ayrılmalı. Kendi başına bir görev olarak YAPMAYIN —
"çalışan koda dokunma" ilkesi; ancak o dosyada zaten iş varken bölün.

### 4.5 ☐ Commit mesajı disiplini (K5)

Tarih yerine bir satır içerik: `security: remove TLS fallbacks` gibi.

---

## 5. ÜRÜN YOL HARİTASI — denetimin önerdiği geliştirmeler

Öncelik sırasıyla (değer/efor oranına göre):

1. ☐ **Kaynak güvenilirlik puanı (Admiralty/NATO kodu).** Her kaynağa statik
   iki eksenli puan (kaynak güvenilirliği A–F × bilgi güvenilirliği 1–6),
   `sourceDefinitions.ts`'e alan olarak; feed kartlarında rozet. Devlet medyası
   (TASS, PressTV, SANA, Xinhua...) ile Guardian'ın aynı görsel ağırlıkta
   sunulması mevcut en büyük analitik zafiyet. Efor: 1-2 gün.
2. ☐ **Kalıcılık + zaman çizelgesi.** Şu an sayfa yenilenince her şey sıfır.
   Aşama 1: IndexedDB (backend'siz, hemen yapılabilir). Aşama 2: Supabase
   (cihazlar arası, gerçek arşiv). "Bu bölgede geçen haftaya göre aktivite
   arttı mı?" sorusunu cevaplayabilmek war-monitor ürününün asıl değeridir.
3. ☐ **Watchlist / alert.** Anahtar kelime + bölge eşleşmesinde görsel uyarı.
   Mevcut filtre motorunun üstüne doğal oturur.
4. ☐ **Global View toplama katmanı.** `docs/global-view/COMPARISON_REPORT_RESULT.md`
   içindeki AUGMENT (Seçenek A) planı — hazır analiz, uygulanmayı bekliyor.
5. ☐ Mock ekranların gerçek veriye bağlanması (yayın önkoşulu, sahibinin
   içerik kararlarıyla birlikte).
6. ☐ **Kaynak sağlık paneli.** Mevcut tanı altyapısını (`errorBySourceId`,
   `cacheStatus`, `RssPreviewDiagnosticError`) analiste gösteren küçük bir
   "Feed Health" görünümü: hangi kaynak ne zamandır sessiz, son hata nedeni.
   SourcesScreen'e doğal uyar. Efor: küçük.
7. ☐ **Daily Brief dışa aktarma.** Son 24 saatin öne çıkanları + yer imleri →
   tek tık Markdown/PDF brief. Ürünü "izleme ekranı"ndan "rapor üreten araç"a
   taşır. Efor: orta.
8. ☐ **UTC saat disiplini.** Göreceli zamanların ("3 h ago") üzerine gelince
   kesin UTC damgası tooltip'i; istihbarat paneli standardı. Efor: küçük.
9. ☐ README'yi gerçek içerikle değiştir (hâlâ create-next-app şablonu):
   proje tanımı, kurulum, env değişken İSİM listesi (değersiz).
10. ☐ Komut paleti (Ctrl+K kaynak/bölge arama) — düşük öncelik, pro-araç hissi.

**Bilinçli ertelenenler** (AGENTS.md §7 Reserved): Air/Ship Track, Analytics,
websocket/streaming, scraping. Yukarıdaki 1-4 bitmeden başlamayın.

---

## 6. Kapanan denetim bulguları — hızlı referans

| Kod | Bulgu | Durum |
|-----|-------|-------|
| S1 | TLS doğrulama bypass fallback'i | ✅ kaldırıldı (2 Tem 2026) |
| S2 | insecureHTTPParser fallback'i | ✅ kaldırıldı |
| S3 | next 16.2.4 CVE'leri | ✅ 16.2.10 |
| S4 | Feed yanıt boyutu sınırsız | ✅ 3 MB cap |
| S5 | Cache eksik / rate limit yok | ✅ cache tamam · ☐ rate limit (§3.1) |
| S6 | Güvenlik başlıkları yok | ✅ temel set · ☐ CSP (§3.2) |
| S7 | IP→findip.net + sınırsız cache | ✅ cache cap · ☐ KVKK/alternatif (§3.4) |
| S8 | Link şema doğrulaması yok | ✅ http(s) filtresi |
| S9 | Devlet medyası + zayıf taşıma güvenliği bileşimi | ✅ S1 ile kapandı; kalıcı çözüm §5.1 rozeti |
| K1 | Ölü bağımlılıklar | ✅ silindi · three kaldırıldı (§4.3) |
| K2 | Dev dosyalar | ☐ (§4.4) |
| K3 | Çift motor bundle'ı | ✅ operasyonel alternatif kaldırıldı (§4.2) |
| K4 | Test script'i/CI yok | ☐ (§4.1) |
| K5 | Commit hijyeni | ☐ (§4.5) |
| P1 | 88 kaynak fetch fırtınası | ✅ server cache absorbe ediyor |

---

## 7. AI ajanına iş verirken

`AGENTS.md` §10 şablonunu kullanın ve şunu ekleyin:

```
Use AGENTS.md. Context: docs/PROJE_DENETIM_VE_YOL_HARITASI.md §<madde no>.
```

Görev bitince bu dosyadaki ilgili kutuyu işaretletmeyi unutmayın.
