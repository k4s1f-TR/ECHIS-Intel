# HANDOFF — ECHIS küre birleştirme (three.js "2A") + idari sınırlar

Bu paket, ECHIS'in **Home/Monitor karşılama**, **Global View**, **SOCMINT Watch**
ve **Intel Watch** ekranlarındaki küreyi tek bir three.js "2A" küresinde
birleştirir. Ülke sınırları + **admin-1 (il/eyalet) sınırları** küreyle
**bütünleşik** çizilir (ayrı katman yok). Global View & SOCMINT'teki MapLibre
küreleri three.js küresiyle DEĞİŞTİRİLİR.

Aşağıdaki "TEK PARÇA KOMUT"u uygulayan asistana ver; bu klasördeki dosyalar
kaynaktır.

---

## Paket içeriği

| Dosya | Hedef yol |
|---|---|
| `EchisGlobe.tsx` | `components/map/EchisGlobe.tsx` |
| `ScreenGlobe.tsx` | `components/map/ScreenGlobe.tsx` |
| `MonitorLanding.tsx` | `components/monitor/MonitorLanding.tsx` (değiştir) |
| `generate-admin1-geojson.mjs` | `scripts/generate-admin1-geojson.mjs` |
| `2A-globe-reference.png` | görsel referans (kopyalanmaz) |

---

## TEK PARÇA KOMUT (asistana yapıştır)

> ECHIS Next.js reposunda küreyi three.js "2A" tasarımında birleştir. Şu adımları
> uygula, dosyaları bu paketten al:
>
> **1. Bileşenleri koy**
> - `EchisGlobe.tsx` → `components/map/EchisGlobe.tsx`
> - `ScreenGlobe.tsx` → `components/map/ScreenGlobe.tsx`
> - `MonitorLanding.tsx` → `components/monitor/MonitorLanding.tsx` (mevcut olanı değiştir; `forwardRef`'tir, `homeGlobeRef` ile uyumlu)
>
> **2. İdari (il/eyalet) sınır verisini üret**
> - `generate-admin1-geojson.mjs` → `scripts/generate-admin1-geojson.mjs`
> - `package.json` scripts'e ekle: `"generate:admin1": "node scripts/generate-admin1-geojson.mjs"`
> - Çalıştır: `npm run generate:admin1` → `public/data/home-globe-admin1.geojson` üretir.
>   (İnternet yoksa Natural Earth `ne_10m_admin_1_states_provinces.geojson` dosyasını `scripts/` altına koy.)
> - `public/data/home-globe.geojson` zaten var (ülke sınırları); yoksa `npm run generate:home-globe`.
>
> **3. AppShell'de MapLibre kürelerini değiştir** (`components/layout/AppShell.tsx`)
> - `activeMapRailMode === "global"` bloğundaki `<MapLibreGlobe key="global-view-globe" .../>` yerine:
>   ```tsx
>   <ScreenGlobe
>     ref={globalGlobeRef}
>     markers={markersFromFeatures(globalMarkers)}
>     selectedMarkerId={selectedId}
>     onMarkerSelect={handleGlobalMarkerSelect}
>     caption="GLOBAL VIEW"
>   />
>   ```
> - `activeMapRailMode === "signals"` bloğundaki `<MapLibreGlobe key="socmint-globe" .../>` yerine:
>   ```tsx
>   <ScreenGlobe
>     ref={signalsGlobeRef}
>     markers={markersFromFeatures(signalsMarkers)}
>     selectedMarkerId={selectedSignalId}
>     onMarkerSelect={handleSignalMarkerSelect}
>     caption="SOCMINT WATCH"
>   />
>   ```
> - Import ekle: `import { ScreenGlobe } from "@/components/map/ScreenGlobe";`
>   ve `import { markersFromFeatures } from "@/components/map/EchisGlobe";`
> - `globalGlobeRef` / `signalsGlobeRef` tiplerini `EchisGlobeHandle`'a çevir
>   (`import type { EchisGlobeHandle } from "@/components/map/EchisGlobe"`). Bu handle
>   `centerView / zoomIn / zoomOut / focusMarker / projectMarker / setAutoRotatePaused`
>   sunar; `MapControls` ve feed-kartı → `focusMarker` akışları aynı çalışır.
>
> **4. Intel Watch — düz SVG haritaya alternatif küre**
> - Intel Watch'ta düz harita SVG kalır. Yanına küre alternatifi ekle:
>   ```tsx
>   <ScreenGlobe markers={markersFromFeatures(intelMarkers)} caption="INTEL WATCH · GLOBE" />
>   ```
>   Bir görünüm anahtarı (harita ⇄ küre toggle) ile göster.
>
> **5. Kaldırılabilecekler (opsiyonel)**
> - Home için artık `MonitorLanding` küreyi kendi barındırıyor; ayrı `HomeGlobe`
>   mount'una gerek yok.
> - `GlobeLoadingAnimation` (webm loader) yerine zarif açılış + `EchisGlobe size="mini"`
>   kullanılabilir.
> - MapLibre'ı başka ekran kullanmıyorsa `maplibre-gl` bağımlılığı sökülebilir
>   (Cyber/Defense/IntelWatchMap hâlâ MapLibre kullanıyorsa BIRAKMA — önce kontrol et).
>
> **6. Doğrula**
> - `npm run dev` → Home, Global View, SOCMINT, Intel Watch'ta küre görünüyor,
>   ülke + il sınırları bütünleşik, marker'lar tıklanınca ilgili panel açılıyor,
>   seçili marker büyüyüp parlıyor, sürükle/zoom/oto-dönüş çalışıyor.
> - Palet crimson/siyah/gümüş; mavi/lacivert yok.

---

## Notlar / sınırlar

- **Davranış iyileştirmeleri (v2):**
  - **Senkron yüklenme:** küre, sphere + ülke + admin sınırları hazır olana kadar
    gizli kalır, sonra hepsi **birlikte fade-in** olur (parça parça "pat" binme yok).
  - **Manevra performansı:** çok marker'lı ekranlarda (>10) ambient pulse kapanır,
    yalnızca seçili marker pulse eder → sürükleme/dönüş akıcı kalır.
  - **Ortalanmış kadraj:** `ScreenGlobe` `centered` ile küreyi tam-ekran veri
    ekranında merkezler (hero'nun aşağı ofseti yok). Home karşılama hero ofsetini korur.
- **Bütünleşik sınırlar:** ülke (`home-globe.geojson`, crimson `#ff2b3d`, opacity .6) ve
  admin-1 (`home-globe-admin1.geojson`, soluk `#ff5a64`, opacity .2) küre grubuna
  çizgi geometrisi olarak eklenir — kürenin parçasıdır, ayrı overlay değildir.
  `ScreenGlobe`'da `showAdminBorders` varsayılan açık; `EchisGlobe`'da varsayılan kapalı.
- **"Şehir sınırı" = admin-1 (il/eyalet).** Küresel tutarlı belediye sınırı verisi
  yoktur; il/eyalet standarttır.
- **Performans:** admin-1 çok segment içerir. Kalabalıksa script'te `COORDINATE_PRECISION`'ı
  düşür (2), ya da admin materyal opaklığını azalt. İstenirse zoom eşiğinde açma eklenebilir.
- **Kaybolan MapLibre özellikleri:** gerçek OSM basemap + zoom'a bağlı şehir/etiket
  kartografisi, sayı-rozeti kümeleme, hover popup metinleri. Marker tıklama-yönlendirme,
  seçim vurgusu, hover-büyüme (dot ölçek) three.js'te taşındı. Etiketli isim
  kartografisi three.js küresinde yoktur (tasarım tercihi — sade metalik küre).
- **markersFromFeatures:** app'in `MarkerFeature{id,lng,lat,severity,confidence,itemCount}`
  dizisini `GlobeMarker{level}`'a çevirir (severity→level). İsim etiketi istersen
  `GlobeMarker.label/detail` alanlarını doldurup `showLabels` aç.

## EchisGlobe boyutları (referans)

| `size` | Marker | Etiket | Graticule | Yıldız | Kullanım |
|---|---|---|---|---|---|
| `hero` | ✓ | ✓ | ✓ | ✓ | Home + veri ekranları (ScreenGlobe bunu kullanır) |
| `panel` | ✓ | ✗ | ✓ | ✗ | kart/sidebar küresi |
| `mini` | ✗ | ✗ | ✗ | ✗ | loader/gösterge küresi |
