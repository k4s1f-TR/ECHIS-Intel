# Prompt — Globe (MapLibre) yüzey rengini crimson temaya senkronla

Use AGENTS.md.

## Amaç
Global View küresinin (MapLibre) **yüzey/kıta/deniz/sınır/etiket** renklerini, onaylanan
crimson / dip-siyah / gümüş temaya çek. **Marker'lara DOKUNMA** (zaten kırmızı). Geometriye,
projeksiyona, kameraya, etkileşime DOKUNMA — yalnızca renk sabitleri değişir.

## ⛔ Kurallar
- Sadece renk değerleri. Layout, kamera, zoom/pan/rotate, marker SVG'leri, katman yapısı AYNI.
- Kıta geometrisi değişmez (OSM vektör tile zaten tam detay; biz sadece boyuyoruz).

## 1) `components/maplibre/MapLibreGlobe.tsx` — palet sabitleri (≈ satır 912–922)
Mevcut → Önerilen (crimson varyant):
```
PANEL_BG       "#030506"                 → "#050304"
LAND_FILL      "#141817"                 → "#1a1517"      // yeşil tortu yok, nötr charcoal
LAND_OVERLAY   "#181C1A"                 → "#211a1c"
WATER_FILL     "#070A0B"                 → "#070508"      // nötr dip-siyah deniz
WATERWAY_FILL  "#0a0e10"                 → "#0c090e"
BORDER_COUNTRY "rgba(150,162,158,0.55)"  → "rgba(255,86,96,0.38)"   // ülke sınırı: soluk crimson
BORDER_ADMIN   "rgba(120,132,128,0.22)"  → "rgba(176,184,196,0.18)" // idari sınır: soğuk gümüş
LABEL_MAJOR    "rgba(190,198,194,0.72)"  → "rgba(206,210,218,0.74)" // gümüş
LABEL_MINOR    "rgba(150,160,156,0.48)"  → "rgba(150,158,170,0.46)"
LABEL_WATER    "rgba(120,132,138,0.55)"  → "rgba(140,150,166,0.50)"
LABEL_HALO     "rgba(5,7,8,0.85)"        → "rgba(5,3,5,0.85)"
```
> Bu sabitler `createEchisOsmGlobeStyle(...)`'a paslandığı için kara/deniz/ülke-sınırı/etiket-halo
> otomatik güncellenir. Marker sabitleri (PIN_SVG, GLOBAL_PIN_SVG, glow renkleri) DEĞİŞMEZ.
> İstersen tek dokunuş: `PIN_SVG` içindeki `#ff1f2d` → `#ff2b3d` (aksanla birebir).

## 2) `components/map/styles/echisOsmGlobeStyle.ts` — yerel renkler
```
OSM_ADMIN_BOUNDARY  "rgba(142,154,150,0.55)" → "rgba(176,184,196,0.30)"  // idari sınır gümüş
road_minor line-color "rgba(96,104,102,0.20)"  → "rgba(122,122,130,0.16)" // nötr
road_major line-color "rgba(118,126,122,0.23)" → "rgba(132,132,140,0.18)" // nötr
water_name text-color "rgba(122,136,140,0.50)" → "rgba(140,150,166,0.50)" // soğuk gümüş
```
Yer etiketleri (place_*_label) yeşil-griye kaçan tonlarda; nötr gümüşe nudge et (opsiyonel,
ince): country `rgba(196,202,198,.82)`→`rgba(208,212,220,.84)`, region `rgba(174,184,180,.64)`
→`rgba(184,190,202,.64)`, capital/city tonlarını da R≈G≈B nötr gümüşe yaklaştır.

## 3) Atmosfer / rim
- Study'deki kırmızı dış halo ve kenar çizgisi KALDIRILDI; MapLibre'de de varsayılan mavimsi
  globe atmosferini sade tut: gerekiyorsa `map.setSky(...)` / fog ile çok hafif nötr yap ya da
  olduğu gibi bırak. Kırmızı bir rim/halo EKLEME.

## 4) Kara "kabartma" (relief) — DİKKAT: study'deki kabartma canvas hilesi, birebir taşınmaz
Study'de kıtaların yükselmiş görünmesi, kare-başı canvas drop-shadow + clip ile yapılan sahte
bir efekt — MapLibre'de bu teknik yok. İki gerçek seçenek:
- **(Kolay, önerilen) Tonal "pop":** kara/deniz kontrastı zaten `LAND_FILL` vs `WATER_FILL` ile
  artıyor; ek olarak **kıyıya ince bir iç-aydınlık çizgisi** ekle — `water` fill katmanının
  hemen üstüne, kıyı hattını izleyen 0.6px'lik düşük-opaklı gümüş bir line (ör.
  `rgba(196,202,212,0.10)`). Kıtaları denizden ayırıp hafif kabartma hissi verir; bedava,
  her zoom'da çalışır. (Yeni veri yok.)
- **(Zor, gerçek 3B) DEM terrain:** `raster-dem` kaynağı + `map.setTerrain` + `hillshade`
  katmanı. Gerçek dağ rölyefi verir ama ek tile kaynağı/bant genişliği ister, düşük zoom'da
  küre genelinde çok ince kalır. Yalnızca gerçekten 3B isteniyorsa.

## Acceptance
- Küre yüzeyi nötr dip-siyah (yeşil tortu yok); ülke sınırı soluk crimson, idari sınır gümüş,
  etiketler gümüş; marker'lar değişmedi; kırmızı halo/rim yok.
- Geometri/kamera/etkileşim AYNI. Performans aynı (sadece renk değişti).

## Validation
- `npm run build`; Global View'i aç, yakınlaş/uzaklaş — renkler temaya uyumlu, kıyı detayı tam,
  kasma yok.
