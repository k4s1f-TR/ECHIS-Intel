# Karşılaştırma Raporu — Global View: Mevcut Filtre vs. Hedefli Tespit Sistemi

> Salt-okunur mimari inceleme. Hiçbir kod değiştirilmedi. Tüm ifadeler dosya +
> satır aralığı ile kaynaklandırılmıştır. Aşağıdaki sistemlerin ürettiği her şey
> **açık kaynak metinden çıkarımdır (inferred)** ve OSINT-güvenli kalmalıdır
> (`AGENTS.md` §3.6).

---

## 1. Yönetici özeti

Global View pipeline'ı hâlihazırda **`lib/cyber`'dan belirgin biçimde daha
zengin bir tespit motoru** çalıştırıyor; "tam-özellikli" üç boyuttan ikisinde
öndedir: rol atfı ve coğrafya/işaretçi (marker) çözümlemesi.
`SourceEntityRoles` (`data/source-intelligence/sourceIntelligenceTypes.ts:228-256`)
~25 rol alanına sahiptir (saldırgan/mağdur/beyan-eden/etkilenen/yalnızca-bahsi-geçen/
arka-plan), 30 değerli bir `SourceEventType` taksonomisi vardır (`:154-188`) ve
Cyber motorunun karşılığı bulunmayan, `strength` + `acceptedForMarker` +
`rejectionReason` içeren kademeli bir `GeoEvidence` modeli mevcuttur (`:283-335`).
Global View'in **eksik** olduğu şey, Cyber'in panellerini çalıştıran *toplama
(aggregation) ve sunum* katmanıdır: öğe başına bir kez sayılan, roller ayrı ayrı
işaretlenen makro-bölge (`RegionId`) toplaması
(`lib/cyber/analyzeCyberSignals.ts:82-198`), öğeler-arası bir alan/konu metriği,
tek bir `provenance/inferred` + güven-bandı sözleşmesi, iki panel, opsiyonel
`countryFills` harita katmanı (`components/cyber/CyberMap.tsx`) ve bağımlılıksız
bir test koşum düzeneği.

Yani bu, "ikinci bir dedektör inşa et" işi **değildir**. Paralel bir rol motoru
(Seçenek B) inşa etmek, kod tabanının en iyi ayarlanmış parçasını çoğaltır ve
zamanla birbirinden **sapacak (drift) iki rol sistemi** yaratır.

**Öneri: AUGMENT (üzerine ekle) — Seçenek A (üstte toplama katmanı).** Mevcut
`SourceFilterResult` / `SourceEntityRoles` / `eventType` / `geoBasis` çıktısını
tüket, yalnızca şunları ekle: bir `entityRoles → origin/target/neutral`
adaptörü, paylaşılan `lib/cyber` taksonomisini *import eden* bir
`country/region → RegionId` çözümleyicisi, bir alan toplaması, paneller,
opsiyonel harita dolgusu ve testler. Efor **M**.

---

## 2. Yetenek matrisi

Açıklama — Mevcut filtre = `data/source-intelligence/**`; Hedefli sistem =
`02_BUILD_SPEC.md`'de tarif edilen `lib/globalview/**`.

| Yetenek | Mevcut filtre | Hedefli sistem | Örtüşme? | Boşluk? |
|---|---|---|---|---|
| **Normalizasyon (EN+TR, mojibake, phrase cache)** | ✅ `normalizeFilterText.ts:1-56` (Türkçe ek ayıklama, mojibake haritası, derlenmiş-regex cache) | Mevcut semantiği yeniden kullanır (spec §4) | **Tam** | Yok — yeniden yaz değil, yeniden kullan |
| **Ülke / demonim tespiti** | ✅ `contextClassifier.ts` `COUNTRY_ALIASES` sözlüğü (EN+TR takma adlar, `:24-60+`), `countriesInText` | Bir ülke→`RegionId` haritası gerekir | **Kısmi** | Mevcut filtrede `RegionId` eşlemesi yok |
| **Saldırgan / mağdur rolü** | ✅ **Daha zengin** — `SourceEntityRoles` `primaryActorCountry`/`blamedActor`/`targetCountry`/`affectedCountry`/`issuingCountry`/`eventLocation`/`mentionedOnly` (`types:228-256`); `detectAttackRoles`, `detectBlamedAndPartner` (`contextClassifier.ts:636-646`) | 3 değerli `origin/target/neutral` (`lib/cyber/types.ts:39`) | **Tam+** | Mevcut model bir *üst-küme*; hedefli sistem yeni bir dedektör değil yalnızca bir **eşleme** gerektirir |
| **Olay tipleme (event typing)** | ✅ 30 `SourceEventType` değeri + `domainForEventType` (`applySourceFilters.ts:123-163`) | `SourceEventType`'ı yeniden kullanır (spec §1.2) | **Tam** | Yok |
| **Makro-bölge toplaması (öğe/1 kez, rol sayımları)** | ❌ yok — yalnızca skorlama için düz `geopoliticalRegions` *anahtar kelime listesi* var (`keywordDictionaries.ts:186-197`), `RegionId` taksonomisi veya sayım yok | ✅ `analyzeCyberSignals.ts:82-198` örnek alınır | **Yok** | **Net-yeni** |
| **Alan / sektör toplaması (öğeler-arası sayım+pay)** | ⚠️ yalnızca öğe-başı — `SourceFilterMatch.score`, `primaryDomain` (`applySourceFilters.ts:298-300`); `DomainMetric[]` yok | ✅ `DomainMetric[]` (itemCount/share/terms) | **Kısmi** | **Net-yeni toplama** |
| **Coğrafya / marker çözümü + kanıt gücü** | ✅ **Daha zengin** — `resolveGeoBasis`, `GeoEvidence.strength` strong/moderate/weak, `acceptedForMarker`, `rejectionReason` (`types:283-335`); worker'da cache ile çalışır (`sourceIntelligencePipeline.ts:113-153`) | Kapsam dışı (markerlar olduğu gibi kalır) | **Tam+** | Yok — hedefli sistem bunu *tüketmeli*, asla yeniden yapmamalı |
| **Skorlama / kabul** | ✅ `FILTER_ACCEPTANCE_THRESHOLD=25`, grup skorlama, negatif-gürültü (`geopoliticalFilterRules.ts:3`, `applySourceFilters.ts:179-300`) | Kapsam dışı (`accepted`'ı tüket) | **Tam** | Yok |
| **Güven bantları** | ⚠️ örtük — `GeoEvidenceStrength`, `verificationStatus`, `sourceBasis` | ✅ açık `SignalConfidence` high/med/low (`lib/cyber/types.ts:59`) | **Kısmi** | Mevcut güçlerin bantlara **normalize edilmesi** gerekir |
| **Kaynak/menşe (provenance)** | ✅ **Daha zengin ama dağınık** — `sourceBasis`/`verificationStatus`/`extractionMethod`, `geoBasis.evidence`, `markerReason`/`noMarkerReason` | ✅ tek `provenance`+`inferred` bayrağı (`analyzeCyberSignals.ts:195-196`) | **Kısmi** | Toplam çıktıda **tek birleşik bayrak** gerekir |
| **Paneller için toplama** | ❌ yok | ✅ `RegionMetric[]`/`DomainMetric[]` | **Yok** | **Net-yeni** |
| **Harita bölge-dolgusu** | ❌ Global View yalnızca marker kullanır | ✅ `countryFills` opt-in (`SharedWorldMap2D.tsx:206-249,336`), `atlasRegions.ts`, `CyberMap.tsx` | **Yok** | **Net-yeni (opsiyonel)** — Cyber desenini yeniden kullan |
| **Testler (bağımlılıksız düzenek)** | ❌ `data/source-intelligence/**` altında **bulunamadı** | ✅ `lib/cyber/__tests__/cyberSignals.test.ts` örnek alınır | **Yok** | **Net-yeni** |

---

## 3. Hedefli sistemin gerçekten EKLEDİĞİ (net-yeni değer)

1. **Global View için makro-bölge toplaması.** Filtre, ülkeleri hiçbir zaman
   `RegionId` makro-bölgelerine gruplamaz veya bunları öğe-başı bir kez, roller
   ayrı ayrı işaretlenerek saymaz. Bu, Cyber'in "Most Mentioned Regions"
   panelinin çekirdeğidir (`analyzeCyberSignals.ts:110-132`) ve burada karşılığı
   yoktur.
2. **Öğeler-arası alan/konu metrikleri.** Filtre alanları öğe başına skorlar
   (`applySourceFilters.ts:269-296`) ama kimse bunları bir panel için
   `itemCount`/`share`/örnek terimlerle `DomainMetric[]` olarak toplamaz.
3. **Toplam çıktı üzerinde tek bir menşe/güven sözleşmesi.** Bugün menşe
   gerçektir ama `sourceBasis`, `verificationStatus`, `geoBasis.evidence`,
   `markerReason` arasında dağınıktır. Rollup üzerinde bir `{ provenance,
   inferred }` + normalize `SignalConfidence` yenidir.
4. **İki Global View paneli** (props-in/sunumsal, `--c-*` token'ları,
   boş/yükleniyor/hata durumları) — `MostMentionedRegionsPanel` /
   `AffectedSectorsPanel`'i örnek alarak.
5. **Opsiyonel rol-kodlu harita bölge-dolgusu** — mevcut `countryFills` opt-in
   prop'u üzerinden Global View haritasında; şu an yalnızca Cyber'e özgü.
6. **Bağımlılıksız test düzeneği** toplama mantığı için — source-intelligence
   filtresinin bugün **hiç testi yok**, dolayısıyla herhangi bir regresyon
   koruması net-yeni değerdir.

---

## 4. NELERİ ÇOĞALTIR — ve iki-rol-sistemi riski

En büyük risk. Cyber'in `GeoRole` = `origin | target | neutral`
(`lib/cyber/types.ts:39`), filtrenin zaten ~25 alanda ifade ettiği bir modelin
**3 değerli bir sıkıştırmasıdır** (`SourceEntityRoles`, `types:228-256`):

| `lib/cyber` GeoRole | Mevcut `SourceEntityRoles` alan(lar)ı |
|---|---|
| `origin` (saldırgan) | `primaryActorCountry`, `blamedActor`, `reportingActorCountry`; beyanlar için `issuingCountry` |
| `target` (mağdur) | `targetCountry`, `affectedCountry`, `affectedLocation`, `eventLocation` (saldırılar için) |
| `neutral` | `mentionedOnly`, `backgroundContext` |

Seçenek B **ikinci, bağımsız bir rol geçişi** inşa ederse (`regionDetection.ts:139-183`'ün
bir `lib/globalview` klonu), uygulama aynı metni okuyup uyuşmayabilen iki
dedektöre sahip olur — ör. filtre İsrail'i `eventLocation` olarak etiketlerken
yeni geçiş `origin` olarak etiketleyebilir. Markerlar (filtrenin rollerince
sürülür) ve paneller (klonca sürülür) aynı ekranda farklı hikayeler anlatır.
`02_BUILD_SPEC.md` §2 tam olarak bunu uyarır: "ikinci bir rol sisteminden kaçın."

Ayrıca çatallanırsa (fork) çoğaltılır: **ülke→bölge taksonomisi**. `lib/cyber`
buna zaten sahiptir (`geoLexicon.ts` + `atlasRegions.ts`). Spec açıktır
(`02_BUILD_SPEC.md:94-97`): **tek doğruluk kaynağı**, paylaşılan — asla ikinci
bir ülke→bölge tablosu değil.

**Karar:** mevcut rolleri `origin/target/neutral`'a **eşle**; onları yeniden
tespit etme.

---

## 5. Entegrasyon seçenekleri

### (A) Üstte toplama katmanı — **önerilen**, efor **M**
Worker'da zaten hesaplanan `SourceFilterResult`'ı (`entityRoles` + `eventType` +
`geoBasis`) tüket; yalnızca şunları ekle: `entityRoleAdapter` (roller→`GeoRole`),
`country→RegionId` çözümleyici (paylaşılan taksonomiyi import eder), alan
toplaması, paneller, opsiyonel harita dolgusu, testler.
- **Artılar:** sıfır çift-tespit; tek rol sistemi; en küçük yüzey; worker'ın
  mevcut hesabını yeniden kullanır (`sourceIntelligencePipeline.ts:178-183`);
  Türkçe işleme bedavaya devralınır.
- **Eksiler:** çıktı kalitesi filtrenin rolleriyle sınırlıdır; adaptör
  hataların saklanabileceği tek yer olduğundan en güçlü testleri gerektirir.
  **Veri-akışı uyarısı:** istemci bugün yalnızca *kabul edilmiş* adayları alır
  (`buildIntelligenceEventCandidates`, `result.accepted`'ı filtreler,
  `pipelineWorker`/`sourceIntelligencePipeline.ts:68-69`) — paneller için sorun
  değil, ancak toplamanın yalnızca-kabul-edilenler mi yoksa tüm öğeler mi
  içermesi gerektiğine bağlanmadan önce karar verilmeli (bkz. Açık Sorular).

### (B) Paralel motor `lib/globalview/` — `lib/cyber`'ı örnek alarak — efor **L**
Bağımsız tespit, "Cyber ile en tutarlı" olan.
- **Artılar:** Cyber ile mimari olarak simetrik; tamamen ayrık/test edilebilir.
- **Eksiler:** **uygulamanın en iyi ayarlanmış kodunu yeniden inşa eder**;
  iki-rol-sistemi sapma riskini yaratır (§4); yine de paylaşılan taksonomiyi
  import etmeli ve bir fixture kümesinde mevcut rollerle uyum kanıtlamalı
  (`02_BUILD_SPEC.md:88-92`). En yüksek maliyet, en yüksek regresyon riski.
  Yalnızca filtrenin rolleri toplama için sistematik olarak yanlış çıkarsa
  gerekçelendirilir — burada buna dair kanıt yok.

### (C) Hibrit — coğrafi-kanıt + olay tiplemeyi yeniden kullan, yalnızca eksik olduğu yerde ince rol geçişi — efor **M/L**
- **Artılar:** güçlü mevcut sinyalleri yetkili tutar, gerçek boşlukları doldurur.
- **Eksiler:** belgelenmiş bir öncelik ("mevcut güçlü coğrafi-kanıt, çıkarımlanan
  üzerinde kazanır", `02_BUILD_SPEC.md:87`) ve uzlaştırma mantığı gerektirir —
  Seçenek A'nın büyük ölçüde zaten sağladığı bir fayda için gerçek karmaşıklık,
  çünkü mevcut rollerin gerçek boşluğu çok azdır.

---

## 6. Hassasiyet & doğruluk riskleri

- **Yanlış atıf (beyan-eden ≠ hedef).** Bir dışişleri kınaması, *beyan eden*
  ülkeyi bildirinin yazarı yapar, mağdur değil. Filtre `issuingCountry`'yi
  `affectedCountry`'den zaten ayırır (`contextClassifier.ts:633-636`, olay
  tipleri `condemnation`/`warning`/`official_statement`). Seçenek A bunu doğru
  devralır; naif bir Seçenek-B sayacı beyan-edenleri hedef olarak yanlış
  etiketler. `mentionedOnly`/`backgroundContext`'i → `neutral` eşle, asla
  `target` değil (`02_BUILD_SPEC.md:134`).
- **Türkçe/İngilizce karışık akışlar.** Kaynakta `normalizeFilterText` (ek
  ayıklama, mojibake, `:1-25`) ve `COUNTRY_ALIASES` içindeki TR takma adlarınca
  ele alınır. Seçenek A bunu birebir yeniden kullanır → regresyon yok. Seçenek B,
  TR işlemeyi yeniden yazma ve bozma riski taşır.
- **Aktör-mağdur belirsizliği.** Filtre bunu kademeli `GeoEvidence.strength` +
  `acceptedForMarker` (`types:294-313`) ile kodlar. Güçlü coğrafi-kanıtı tercih
  et; yalnızca belirsizlik olmadığında çıkarım yap. Seçenek A buna dayanır;
  B/C buna karşı uzlaşmak zorundadır.
- **Toplamaya özgü risk:** artık *eşleme* başarısızlık noktasıdır. Yanlış bir
  `issuingCountry → origin` vs `→ neutral` kararı her paneli çarpıtır. Bu,
  fixture'larla (§8) ve `02_BUILD_SPEC.md:138`'e göre belgelenmiş bir politikayla
  sabitlenmelidir.

---

## 7. Performans

- **Filtre + coğrafya + marker pipeline'ı ayrılmış bir Web Worker'da çalışır**
  (`data/source-intelligence/pipelineWorker.ts`, `SourceIntelligenceProvider.tsx:438`'de
  başlatılır), coğrafi-çözüm cache'i (`sourceIntelligencePipeline.ts:53-141`) ve
  48s tazelik kapısı (`:19-27`) ile. Ana iş parçacığı / globe RAF asla
  bloklanmaz.
- **Cyber'in `analyzeCyberSignals`'i istemcide çalışır** — `useMemo` ile
  (`components/cyber/CyberSecPanel.tsx:164-166`), worker'da değil — sınırlı bir
  öğe listesi üzerinde saf string işi olduğundan kabul edilebilir.
- **Rehber:** Seçenek A için rollup, zaten-analiz-edilmiş adaylar üzerinde ucuz
  bir map/reduce'tur → bir istemci `useMemo`'su (Cyber deseni) uygundur ve worker
  sözleşmesini değişmeden tutar. Öğe hacimleri büyürse, rollup daha sonra
  worker'ın `PIPELINE_RESULT`'ına katlanabilir; peşinen worker tesisatı ekleme.

---

## 8. Öneri & aşamalı yayılım (rollout)

**Seçenek A ile augment et.** Mevcut tespit, Cyber'in rol modelinin bir üst-kümesi
artı daha güçlü bir coğrafya katmanıdır; asıl boşluk toplama + sunum + testlerdir.
Tespiti yeniden icat etmek (B) en iyi kodu çoğaltır ve sapmaya davetiye çıkarır.

1. **Faz 1 — paylaşılan taksonomi.** Her iki tüketicinin (Cyber ve Global View)
   tek kaynaktan import etmesi için ülke→`RegionId` tablolarını doğrula/taşı
   (bugün `lib/cyber`, veya `02_BUILD_SPEC.md:94-97`'e göre nötr bir `lib/geo/`).
   Davranış-koruyan, minimal.
2. **Faz 2 — saf motor + testler.** `entityRoleAdapter` (roller→`GeoRole`) +
   `country→RegionId` çözümleyici + bölge/alan rollup'u, hepsi saf ve yalnızca-tip
   çapraz-import'lar ile. Önce bağımlılıksız düzeneği gönder (≥40 assertion,
   `02_BUILD_SPEC.md:175`): saldırgan→origin, mağdur→target, beyan-eden işleme,
   yalnızca-bahsi-geçen→neutral, öğe-başı-bir-kez sayım, pay matematiği ve bir
   fixture kümesinde **mevcut `SourceEntityRoles` ile uyum** iddia edilir.
3. **Faz 3 — paneller.** Canlı adaylar üzerinde `useMemo` ile beslenen iki
   sunumsal panel (props-in, `--c-*`, boş/yükleniyor/hata). Mock veri yok.
4. **Faz 4 — opsiyonel harita dolgusu.** Yalnızca opt-in prop üzerinden
   `countryFills`, `CyberMap.tsx`'e göre rol-kodlu soluk palet. Globe kamerasına
   veya `SharedWorldMap2D` varsayılanlarına dokunma (`AGENTS.md` §6).

`02_BUILD_SPEC.md:203`'ün gerektirdiği gibi, mevcut filtreye karşı rol-eşleme
uyum oranını raporla.

---

## 9. Ürün sahibi için açık sorular

- **Öğe kapsamı:** yalnızca **kabul edilmiş adaylar** üzerinde mi topla (istemcinin
  şu an aldığı, `sourceIntelligencePipeline.ts:68-69`) yoksa **tüm filtrelenmiş
  öğeler** üzerinde mi (worker'ın rejected/`feed_only` sonuçları da açığa vurmasını
  gerektirir)?
- **Beyanlar için beyan-eden ülke:** bir kınamanın `issuingCountry`'si `origin`
  olarak mı yoksa ayrı bir `neutral` olarak mı toplansın? (`02_BUILD_SPEC.md:138`
  bunu bu rapora bırakır.)
- **Panel için alan taksonomisi:** `SourceFilterDomain` ile mi (10 alan,
  `types:142-152`) yoksa daha ince `SourceEventType` ile mi (30 değer) topla?
- **Bölge taksonomisi uyumu:** filtrenin stratejik-bölge kelimeleri (Karadeniz,
  Sahel, Levant; `keywordDictionaries.ts:186-197`) Cyber'in makro-bölgeleriyle
  1:1 eşleşmez — Cyber'in makro-bölge gruplamasını olduğu gibi kabul et, yoksa
  genişlet mi?
- **Harita bölge-dolgusu v1 kapsamında mı**, yoksa önce yalnızca paneller mi?
- **Hesap yeri:** rollup'u istemcide mi tut (`useMemo`, Cyber tarzı) yoksa
  hacimler büyürse worker `PIPELINE_RESULT`'ına mı taşı?

---

*Bu rapor dışında hiçbir dosya oluşturulmadı veya değiştirilmedi.*
