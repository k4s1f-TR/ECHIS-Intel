# ECHIS — Air Track Yol Haritası

*Durum tarihi: 8 Temmuz 2026 · Sağlayıcı analizi: `AIR-TRACK-PROVIDERS.md`*

**Mevcut durum (Faz 1–3 canlı):** Sol raydan açılan Air Track ekranı;
ana küreyle birebir görünümde bağımsız MapLibre küresi; adsb.lol `/v2/mil`
askeri katmanı (10 sn poll, airplanes.live failover) + OpenSky `/states/all`
global sivil katmanı (95 sn poll, OAuth2, 90 sn sunucu cache); **bölgesel
hızlı şerit** — zoom ≥ 5'te viewport çevresi adsb.lol `/v2/point` (250 nm,
10 sn, kredisiz, ODbL) ile tazelenir; `icao24` anahtarlı birleşik dünya
durumu, **monotonik tazelik** kuralıyla (eski fix yeniyi asla ezmez,
`posTimestamp`); kareler arasında dead reckoning (hız+rota ile 2 Hz
ekstrapolasyon, uçak başına çıpa, 120 sn tavan) + yeni fix'te 1,2 sn
**lerp düzeltme** (snap yok); auto-rotate yalnız zoom < 4'te; HUD'da
CIV / MIL / WL katman toggle'ları; tıkla → zengin kontak kartı (adsbdb rota
+ foto + Send to Intel Watch).

## Faz 1 — Mevcut ekranı olgunlaştırma (anahtarsız kaynaklarla) ✅

| # | İş | Durum |
|---|---|---|
| 1.1 | Statik uçak DB: tip adı / operatör zenginleştirme (`data/airtrack/`) | tamam |
| 1.2 | Watchlist: plane-alert-db kesişimi, vurgu + HUD sayacı | tamam |
| 1.3 | Acil durum: squawk 7500/7600/7700 pulse + HUD uyarısı | tamam |
| 1.4 | Seçili uçak izi (trail) | tamam |
| 1.5 | Sol liste paneli: arama + tıkla-odaklan | tamam |

## Faz 2 — Sivil global katman (OpenSky) ✅

| # | İş | Durum |
|---|---|---|
| 2.1 | OpenSky OAuth2 client + `/states/all` proxy (90 sn cache, token yönetimi) | tamam — `lib/airtrack/openskyAdapter.ts` + `app/api/airtrack/global` |
| 2.2 | Track Store birleşimi: `icao24` anahtarlı dünya durumu, sabit kaynak önceliği (askeri: adsb.lol > OpenSky), alan bazında zenginleştirme; düşük zoom'da nokta katmanı | tamam — merge `useAirTrackFeed`, zoom < 4.2 gümüş nokta / ≥ 4.2 siluet |
| 2.3 | Katman kontrolü: sivil / askeri / watchlist toggle | tamam — CIV kapatılınca OpenSky polling tamamen durur |

## Faz 3 — Detay ve ekosistem entegrasyonu ✅

| # | İş | Durum |
|---|---|---|
| 3.1 | Zengin detay paneli: adsbdb rota, planespotters foto, hexdb yedek | tamam — `app/api/airtrack/lookup/[hex]` (5 dk cache) + `AirTrackContactCard` |
| 3.2 | Send to Intel Watch köprüsü | tamam — kontak kartından `workspaceStore.sendToIntelWatch` |
| 3.3 | airplanes.live failover (base URL config) | tamam — adsb.lol hatasında otomatik ikinci deneme, kart kaynağı buna göre etiketlenir |

## Faz 4 — Yayına hazırlık

| # | İş |
|---|---|
| 4.1 | OpenSky lisans yazışması + alıcı (feeder) kurma kararı |
| 4.2 | Ship Track mimari raporu (aisstream.io, websocket→proxy deseni) |

**Kural:** Kaynak önceliği ve lisans sınırları için `AIR-TRACK-PROVIDERS.md`
bağlayıcıdır; non-commercial lisanslı kaynaklar (adsb.fi, airplanes.live)
yalnız yedek/geliştirme rolünde kalır.
