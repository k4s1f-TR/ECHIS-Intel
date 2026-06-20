# ECHIS — Ortak Agent Bağlamı

Bu dosyayı Claude / Codex gibi kod agent’larına **kalıcı proje bağlamı** olarak ver.

Bundan sonraki görev promptlarında bu dosyayı tekrar yazma.  
Görev promptu sadece şu bilgileri içersin:

```text
Use the shared ECHIS agent context.

Task:
...

Scope:
...

Do not touch:
...

Acceptance:
...

Validation:
...
```

Bu dosya; önceki uzun promptlardaki proje tanıtımı, korunacak alanlar,
tasarım dili, validasyon ve genel davranış kurallarını ortaklaştırır.

---

## 1. Proje Kimliği

Proje: **ECHIS**

Görünür ürün/UI markası **ECHIS** olmalı.

ECHIS; frontend-only, dark premium, OSINT / situational awareness /
intelligence monitoring dashboard prototipidir.

UI hissi:

- dark
- premium
- restrained
- serious
- analyst-oriented
- operational
- professional

Kaçınılacak şeyler:

- game UI
- generic cyberpunk
- hacker cliché
- sırf boşluk doldurmak için modül ekleme

---

## 2. Çalışma Dizini

Tipik yerel dizin:

```text
C:\Users\ASUS\Desktop\PROJE\k4s1fB-r-
```

Bu path uygulama içine hardcode edilmemeli.

---

## 3. Stack

Ana stack:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- lucide-react
- MapLibre GL
- topojson-client
- world-atlas
- react-simple-maps

Not:

- Eski promptlarda Three.js aktif globe olarak geçebilir.
- Güncel aktif Monitor / Global View / SOCMINT globe yönü **MapLibre-only**.
- Three.js aktif globe render path’e geri getirilmemeli.

---

## 4. Frontend-Only Kuralı

Açıkça istenmedikçe ekleme:

- backend
- auth
- database
- scraping
- live API
- websocket/live infrastructure
- persistence layer
- real tracking
- real-time surveillance
- gerçek/canlı factual claim

Veriler mock/static frontend data üzerinden yürümeli.
Canlı/güncel gerçek iddia uydurulmamalı.

---

## 5. Navigasyon ve İsimlendirme

Güncel üst seviye ürün sırası:

```text
Monitor → Intel Watch → Cyber News → Defense Industry → Policy → Sources
```

Görünür UI isimleri:

- `Politics` yerine `Policy`
- `Cyber Sec.` yerine `Cyber News`

Dosya, klasör, localStorage key veya legacy referansları açıkça istenmedikçe
rename etme.

---

## 6. Ana Mimari

Bilinen ana yapı:

- `app/page.tsx` → `<AppShell />`
- `app/layout.tsx` → global CSS / MapLibre CSS / metadata
- `app/globals.css` → global dark theme, overflow, scrollbar
- `components/layout/AppShell.tsx` → ana app state ve ekran geçişleri
- `components/layout/HeaderNav.tsx` → top nav
- `components/layout/LeftRail.tsx` → icon-only left rail
- `components/events/*` → event cards / right panel / bookmarks
- `components/signals/*` → SOCMINT panel/card logic
- `components/sources/SourcesScreen.tsx` → source registry
- `components/politics/PoliticsPanel.tsx` → Policy
- `components/cyber/*` → Cyber News
- `components/intel-watch/*` → Intel Watch
- aktif Monitor / Global View / SOCMINT globe → MapLibre-only

Eski Three.js dosyaları varsa, bunları güncel aktif render path varsayma.
Legacy cleanup açıkça istenmedikçe ilgisiz silme/refactor yapma.

---

## 7. Korunacak Genel Alanlar

Açıkça istenmedikçe dokunma:

- app shell
- top nav
- left rail
- unrelated tabs/screens
- unrelated mock data
- backend/API/auth/database varsayımları
- Intel Watch layout
- Cyber News layout
- Defense Industry layout
- SharedWorldMap2D
- Sources
- storage keys
- mevcut kabul edilmiş camera / map / marker davranışları

Değişiklikleri küçük ve kapsamlı tut.

---

## 8. Genel Tasarım Dili

UI karanlık, restrained, premium, modern ve analyst-oriented kalmalı.

Tercih edilen yön:

- base yakın: `#0B0F14`
- green accent, base color değil
- neon green `#00FF88` çok az kullanılmalı
- red / yellow / orange / blue muted ve anlamlı olmalı

Semantik renk kullanımı:

- red = conflict / operation / high risk
- blue = diplomatic / cooperation / public statement
- yellow = uncertain / developing / monitoring
- orange = border tension / elevated concern

Kullan:

- low-opacity rgba
- restrained borders
- okunabilir typography
- subtle hierarchy
- lucide icons
- sade kartlar / paneller

Kaçın:

- decorative border
- busy effects
- gaming style
- military exaggeration
- marketing hero
- cyberpunk/hacker klişeleri

---

## 9. Data Kuralları

Önemli data/type alanları:

- `types/event.ts`
- `data/mockEvents.ts`
- `types/socmint.ts`
- `data/socmintReports.ts`
- `types/source.ts`
- `data/mockSources.ts`
- `data/intel-watch/*`
- `data/cyberMockData.ts`

Kurallar:

- Source count mümkünse `mockEvents.sourceId` üzerinden türetilmeli.
- Yeni mock data mevcut category / region / sourceId / severity / verification
  pattern’lerine uymalı.
- Real/live factual claim uydurma.
- OSINT-safe, public-source dil kullan.

---

## 10. Aktif MapLibre Globe — Genel Durum

Monitor / Global View / SOCMINT aktif globe artık **MapLibre-only**.

MapLibre şunları sahiplenmeli:

- globe rendering
- basemap
- labels
- borders/coastlines
- zoom
- drag
- camera movement

Eski Three.js surface / label / marker / camera sistemleriyle senkron kurmaya çalışma.

Kabul edilen görsel yön:

- black / near-black background
- near-black water
- dark graphite land
- subtle borders/coastlines
- muted labels
- crisp professional label/border görünümü
- no navy/lacivert look
- no bright consumer-map look

MapLibre globe paneli asla blank kalmamalı.

Korunacaklar:

- visible loading state
- visible dark error fallback
- verified container sizing
- MapLibre CSS
- `map.remove()` cleanup
- no multiple map instances

---

## 11. Globe Camera / Central View

Initial load / refresh ve Central View aynı kabul edilmiş default camera state’i
kullanmalı.

Tek source-of-truth mantığı:

```ts
DEFAULT_GLOBE_VIEW
```

Ayrı hardcoded değerler oluşturma:

- initial load
- refresh
- Central View
- reset view
- Monitor
- Global View
- SOCMINT

Central View accepted default camera’ya smooth dönmeli.

Görev açıkça istemedikçe accepted center / zoom / composition değiştirme.

---

## 12. Auto-Rotate Kuralları

Auto-rotate MapLibre-native ve longitude / center tabanlı olmalı.

Auto-rotate için sürekli bearing animation kullanma:

```ts
map.rotateTo(...)
```

Tercih edilen prensip:

```ts
const center = map.getCenter()

map.jumpTo({
  center: [nextLng, center.lat],
  bearing: 0,
  pitch: map.getPitch(),
  zoom: map.getZoom(),
})
```

Beklenen davranış:

- natural horizontal globe movement
- clock-like rotation yok
- counter-clockwise disk spin yok
- stutter yok
- multiple RAF loop yok
- pause/resume sonrası camera jump yok

Teknik beklenti:

- gerçek user interaction’da pause
- task-defined idle rules’a göre resume
- programmatic auto-rotate event user interaction sayılmasın
- resume ederken `lastFrameTime` resetlensin
- unmount cleanup: RAF / timeout / listener temizlensin

---

## 13. Label / LOD Kuralları

Default / Central View görünümünde label clutter azaltılabilir.

Uzak/default zoom’da:

- kıta isimleri
- seçili önemli ülke label’ları

Zoom-in sonrası:

- normal detaylı label’lar dönebilir

Ağır custom label sistemi kurma.
Öncelik:

- MapLibre style layer filter
- minzoom
- expression-based çözüm

---

## 14. Marker Layer Kuralları

Marker işi istendiğinde:

- mevcut mock/static marker verilerini kullan
- Global View ve SOCMINT marker’ları mantıksal olarak ayrı olsun
- mümkünse MapLibre source/layer yapısı kullan
- markerlar küçük, sharp, premium, ölçülü olsun
- ucuz/oversized sprite veya aşırı glow dot görünümü verme
- marker sayısı haritayı kalabalıklaştırmasın
- live data ekleme

Far-side globe marker hiding karmaşıksa basit güvenli çözüm ekle veya TODO bırak.
Globe foundation’ı bozma.

---

## 15. Screen Framing / View Transition

İki kavramı ayır:

```text
Geographic camera view = dünya üzerinde nereye bakıyoruz?
Screen framing = küre UI boşluğunda nereye oturuyor?
```

Panel overlap sorununu çözmek için accepted geographic camera’yı bozma.

Monitor → Global View / SOCMINT geçişlerinde:

- accepted Central View / initial geographic view korunsun
- küre available workspace içine çerçevelensin
- sol/sağ panellerin arkasında kalmasın
- padding / offset / available viewport logic kullanılabilir
- smooth MapLibre camera transition kullan
- jump/snap olmasın
- major transition sırasında auto-rotate pause olsun
- idle kurallarına göre resume olsun

---

## 16. Shared 2D SVG Map

Intel Watch, Cyber News ve Defense Industry accepted shared 2D SVG map foundation kullanır.

Açıkça istenmedikçe dokunma:

- `SharedWorldMap2D`
- Intel Watch shared 2D map
- Cyber News shared 2D map
- Defense Industry shared 2D map

Accepted shared 2D map özellikleri:

- direct black background
- Antarctica removed
- no duplicate world wrapping
- Russia continuity / wrap issue fixed
- smooth geometry
- thin subtle country borders
- accepted zoom / pan / hover / tooltip / modal behavior

---

## 17. Intel Watch Genel Yön

Intel Watch genel OSINT / geopolitical intelligence monitoring desk’tir.
Cyber dashboard gibi görünmemeli.

Odak alanları:

- public information
- public news mentions
- regional signals
- geopolitical developments
- diplomatic activity
- policy signals
- security developments
- influence-operation mentions
- border tensions
- sanctions monitoring
- cooperation mentions
- analyst workflow

Yasak dil / iddia:

- secret data
- classified language
- covert operation language
- real operational claims
- real-time tracking claims
- unsupported intelligence assertions

OSINT-safe dil örnekleri:

- public-source reporting indicates
- open-source mentions increased
- regional monitoring signal
- reported activity
- public statements
- media and institutional references
- public-source references
- news and official statements

---

## 18. Intel Watch 2D SVG Map Kuralları

Accepted Intel Watch map state:

- 2D SVG world map works
- Antarctica removed
- Russia / duplicate wrapping fixed
- country hover highlight works
- country-name tooltip works
- mouse wheel zoom works
- zoom buttons work
- drag / pan works
- country click-to-zoom works
- red pulsing markers work
- marker click opens centered modal
- map clipping correct
- layout and right-side panels accepted

Açıkça istenmedikçe değiştirme:

- projection
- projection type
- default fitExtent
- default scale/position
- country geometry/filtering
- Antarctica removal
- Russia continuity fix
- duplicate-wrap prevention
- base map colors
- country borders
- hover highlight
- tooltip
- wheel zoom
- zoom buttons
- drag/pan
- country click-to-zoom
- reset behavior
- marker positions/color/size/pulse
- layout
- right-side panels

Existing SVG transform prensibi:

```tsx
<g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
  countries
  borders
  markers
</g>
```

Reset:

```ts
zoom = 1
pan = { x: 0, y: 0 }
```

---

## 19. Intel Watch Marker Modal

Marker click centered HTML overlay modal açmalı.

Modal:

- map panel içinde centered
- map arkasında blur/dim
- marker screen coordinate’e bağlı değil
- zoom/pan sırasında stabil
- SVG text değil, HTML overlay
- modal açıkken arkadaki map interaction bloklanmalı

Close:

- X / close button
- Escape
- backdrop click varsa

Kapanmamalı:

- modal içine tıklayınca
- hover
- mouse move

Allowed modal sections:

1. Header
   - Location
   - Signal Type
   - Severity badge
   - Close button

2. Metadata
   - Source
   - Updated
   - Region
   - Category

3. Event Brief

4. Source Context

Eklenmemeli:

- Confidence
- confidence percentage
- probability score
- Key Observations
- Monitoring Focus
- Tags / Related Tags
- analyst recommendation
- AI-generated assessment language
- secret/classified/covert language
- real-time surveillance
- agency tracking claims

---

## 20. Cyber News

Cyber News bir cybersecurity news / cyber intelligence dashboard’dur.
Deep technical SOC engineering screen değildir.

Hissiyat:

- modern
- premium
- dark
- restrained
- operational
- vivid but not flashy

Accepted layout:

- top nav / left rail korunur
- main area 3 columns
- left/top: CYBER THREAT MAP
- under map: Session IP strip
- left/bottom: MOST MENTIONED REGIONS
- left/bottom second panel: AFFECTED SECTORS / EXPOSURE
- center: CYBER SECURITY NEWS
- right: THREAT CONTEXT

Do-not-readd:

- Time Filter
- View Full Report
- Threat Context footer CTA
- View All News footer/link/container
- map header severity legend
- VPN / Not Detected in Session IP
- thin left-side severity strips
- gereksiz yeni modüller

Threat Context field order:

1. COUNTRY
2. AFFECTED ENTITY / ORGANIZATION
3. HACK INCIDENT
4. ATTACK TYPE / VECTOR
5. THREAT ACTOR / GROUP
6. TARGET / ASSET
7. TARGET SECTOR
8. SUMMARY
9. FIRST SEEN
10. LAST UPDATE
11. CONFIDENCE
12. IMPACT

Session IP:

- `185.234.219.102`
- Istanbul, Türkiye
- ISP
- Türk Telekom

VPN detection claim ekleme.

Affected Sectors compact horizontal bars olmalı.
Donut chart kullanma.

---

## 21. Defense Industry

Defense Industry shared Intel-style 2D SVG base map kullanır.

Accepted:

- `DefenseIndustryPanel.tsx` renders `DefenseIndustryMap`
- `DefenseIndustryMap` imports `SharedWorldMap2D`
- old Defense canvas/custom map rendered değil
- markers bright sharp orange point markers
- no country-fill highlight system
- layout unchanged
- scrollbar accent Defense / Key Segments accent ile uyumlu olmalı, Cyber green değil

---

## 22. Sources

Sources current naming ile uyumlu olmalı:

- Policy
- Cyber News
- Defense Industry

Frontend mock/static only.

Real scraping / API / database / live ingestion ekleme.

---

## 23. Bookmarks

Bookmarks legacy localStorage key kullanabilir:

```text
borueyes.bookmarks
```

Açıkça istenmedikçe storage key değiştirme.

Bookmarks OSINT events ve SOCMINT reports içerebilir.

---

## 24. Reserved Alanlar

Açıkça istenmedikçe geliştirme:

- Air Track
- Ship Track
- Analytics / AI Analysis
- real backend
- live intelligence ingestion
- real scraping/data pipeline

---

## 25. Implementation Discipline

Kod değiştirirken:

- küçük ve scoped değişiklik yap
- çalışan davranışı koru
- unrelated refactor yapma
- existing component/data/styling pattern’lerini takip et
- gereksiz schema değişikliği yapma
- event listener cleanup yap
- SVG marker black focus outline çıkarsa subtle custom focus kullan
- yeni abstraction sadece gerçekten karmaşıklığı azaltıyorsa ekle

---

## 26. Validation

Varsayılan:

```bash
npm run lint
```

Windows PowerShell policy sorun çıkarırsa:

```bash
npm.cmd run lint
```

Şunlar değişirse build de çalıştır:

- TypeScript
- imports
- data models
- component structure
- MapLibre lifecycle
- shared code

```bash
npm run build
```

UI davranışı değiştiyse browser’da manuel kontrol et.

Kontrol örnekleri:

- no console errors
- no blank screen
- unrelated screens unaffected
- layout unchanged unless requested
- hover/tooltip/zoom/drag/reset korunmuş mu
- marker/modal interaction doğru mu
- map interactions modal sonrası geri geliyor mu

Scoped errorları düzelt.
Unrelated/pre-existing errorları ayrı raporla.

---

## 27. Final Report Discipline

Agent final raporu kompakt olmalı.

İçersin:

- changed files
- very short summary
- compact validation checklist
- remaining issue varsa açıkça belirt

İçermesin:

- chain-of-thought
- uzun internal reasoning
- aşırı implementation commentary
- tekrar proje tanıtımı
- unrelated öneriler

---

## 28. Kısa Görev Prompt Şablonu

Bundan sonraki promptlar bu dosyayı referans alsın:

```text
Use the shared ECHIS agent context.

Task:
...

Scope:
...

Do not touch:
...

Acceptance:
...

Validation:
...
```

Sadece göreve özel bilgileri ekle.
