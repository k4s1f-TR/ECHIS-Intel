# ECHIS — Kaynak Aday Listesi (RSS / API)

Hazırlanma: 6 Temmuz 2026 · Son güncelleme: 7 Temmuz 2026 · Hazırlayan: Claude
Amaç: Cyber News, Defense Industry, Policy ve Monitor ekranlarına eklenecek
yeni kaynakların **tek yerden kontrol edilip aktarılabileceği** aday havuzu.

> **DURUM (7 Tem 2026):** Toplam **42 kaynak bağlı** (12 dalga-1 + 30 dalga-2),
> hepsi çalışan route'tan canlı doğrulandı. Dalga-2'de §8 test listesinden 30
> kaynak bağlandı; 2'si route'ta elendi → **euractiv** (upstream 403 bot koruması),
> **middle-east-eye** (`/rss` sunucu-tarafında 404). 3 TR/DE savunma kaynağı hâlâ
> lexicon kararı bekliyor. Kalan ⚠️ adaylar ve elenenler için §8'e bak.

---

## 0. Durum göstergesi

| İşaret | Anlamı |
|---|---|
| 🔗 | **Bağlandı** — projeye entegre + çalışan route'tan canlı doğrulandı (7 Tem 2026) |
| ✅⏸ | Feed canlı doğrulandı **ama bağlanmadı** — karar/engel bekliyor (nota bak) |
| ⚠️ | URL kalıbı bilinen/standart, henüz canlı doğrulanmadı — **teste hazır** (§8) |
| ❌ | Denendi, sorunlu (403 / 404 / taşınmış) — nota bak |

> ❌ 403 alan kaynaklar bot korumasına takılmış olabilir; ECHIS'in `rss-preview`
> proxy'si **sunucu tarafında** çalıştığından farklı sonuç verebilir. Eklemeden
> önce `/api/sources/rss-preview?sourceId=<id>` ile mutlaka dene.

---

## 1. Entegrasyon adımları (her kaynak için aynı 4 adım)

1. **Tanım:** `data/sources/sourceDefinitions.ts` içine `SourceDefinition` kaydı ekle
   (`accessType: "rss"`, `candidateFeedUrl` = aşağıdaki Feed URL, `targetScreens` = hedef ekran).
2. **Allowlist:** `app/api/sources/rss-preview/route.ts` → `ALLOWED_PREVIEW_SOURCE_IDS`
   setine id'yi ekle (route arbitrary URL kabul etmez; bu set tek yetkili liste).
3. **Ekran bağlantısı:**
   - Cyber → `components/cyber/useCyberNewsFeed.ts` → `CYBER_NEWS_SOURCE_IDS` (+ `CYBER_NEWS_SOURCE_LABEL` güncelle)
   - Defense → `components/defense-industry/useDefenseIndustryFeed.ts` → `DEFENSE_SOURCE_IDS`
   - Policy → `components/policy/usePolicyFeed.ts` → `POLICY_SOURCE_IDS`
     (devlet bağlantılıysa **`STATE_AFFILIATED_SOURCE_IDS`** setine de ekle)
   - Monitor/Global View → `data/source-intelligence/sourceRegistry.ts` → `SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS`
4. **Doğrulama:** `npm run lint` + `npm run build` + `rss-preview` canlı testi + tarayıcıda ekran kontrolü.

> Not (7 Tem 2026): `lib/sources/rssPreviewAdapter.ts` artık gzip/deflate/br gövdeyi
> çözüyor — bazı sunucular (ör. UN News) koşulsuz sıkıştırma döndürüyor.

---

## 2. CYBER NEWS adayları

Bağlı (18 kaynak): The Hacker News · BleepingComputer · The Record · Dark Reading · CyberScoop · SecurityWeek · CISA · **+dalga-2:** Talos · Unit 42 · Krebs · Help Net · Infosecurity · The Register · WeLiveSecurity · Malwarebytes · Securelist · NCSC UK · Schneier. Detay: §8.

### 2a. Haber siteleri (bağımsız)

| Kaynak | Feed URL | Dil | Durum | Önerilen id |
|---|---|---|---|---|
| BleepingComputer | `https://www.bleepingcomputer.com/feed/` | EN | 🔗 | `bleeping-computer` |
| The Record (Recorded Future News) | `https://therecord.media/feed` | EN | 🔗 | `the-record` |
| Dark Reading | `https://www.darkreading.com/rss.xml` | EN | 🔗 | `dark-reading` |
| CyberScoop | `https://cyberscoop.com/feed/` | EN | 🔗 | `cyberscoop` |
| Krebs on Security | `https://krebsonsecurity.com/feed/` | EN | ⚠️ | `krebs-security` |
| Help Net Security | `https://www.helpnetsecurity.com/feed/` | EN | ⚠️ | `helpnet-security` |
| Infosecurity Magazine | `https://www.infosecurity-magazine.com/rss/news/` | EN | ⚠️ | `infosecurity-mag` |
| The Register (Security) | `https://www.theregister.com/security/headlines.atom` | EN | ⚠️ | `register-security` |
| Schneier on Security | `https://www.schneier.com/feed/atom/` | EN | ⚠️ | `schneier` — analiz, düşük hacim |

### 2b. Resmî kurumlar

| Kaynak | Feed URL | Bağlılık | Durum | Not |
|---|---|---|---|---|
| USOM / Siber Güvenlik Başkanlığı (TR) | eski: `usom.gov.tr/rss/tehdit.rss` | TR resmî | ❌ | 302 → `siberguvenlik.gov.tr/api/`; **yeni RSS endpoint'i araştırılmalı** — yüksek öncelik |
| NCSC (UK) | `https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml` | UK resmî | ⚠️ | Rehber+haber karışık |
| ENISA (AB) | `https://www.enisa.europa.eu/media/news-items/news-wires/RSS` | AB kurumu | ⚠️ | Düşük hacim, yüksek güvenilirlik |

### 2c. Vendor araştırma blogları (Threat Context motorunu iyi besler)

| Kaynak | Feed URL | Durum | Not |
|---|---|---|---|
| Cisco Talos | `https://blog.talosintelligence.com/rss/` | ⚠️ | APT/aktör isimleri zengin |
| Unit 42 (Palo Alto) | `https://unit42.paloaltonetworks.com/feed/` | ⚠️ | Aktör atıfları güçlü |
| WeLiveSecurity (ESET) | `https://www.welivesecurity.com/en/rss/feed/` | ⚠️ | |
| Google Threat Intelligence (Mandiant) | `https://cloud.google.com/blog/topics/threat-intelligence/rss/` | ⚠️ | |
| Malwarebytes Labs | `https://www.malwarebytes.com/blog/feed/index.xml` | ⚠️ | |
| Securelist (Kaspersky) | `https://securelist.com/feed/` | ⚠️ | RU merkezli şirket — istersen ayrı etiketle |

---

## 3. DEFENSE INDUSTRY adayları

Bağlı (14 kaynak): Breaking Defense · Defense News · The War Zone · The Aviationist · Defense One · Naval News · EDR Magazine · **+dalga-2:** USNI · DSCA-FMS · DefenseScoop · Air & Space Forces · Defence Industry Europe · Defence Blog · SavunmaTR(kısmi). Detay: §8.

### 3a. Türkiye

| Kaynak | Feed URL | Dil | Durum | Önerilen id |
|---|---|---|---|---|
| SavunmaSanayiST | `https://www.savunmasanayist.com/feed/` | TR | ✅⏸ | `savunmasanayist` — motor lexicon kararı bekliyor |
| DefenceTurk | `https://www.defenceturk.net/feed` | TR | ✅⏸ | `defenceturk` — aynı |
| TurDef | `https://turdef.com/rss` | EN | ❌ 403 | Bot koruması; sunucu-tarafı `rss-preview` ile dene — EN, değerli |
| C4Defence | `https://www.c4defence.com/feed` | TR | ❌ 404 | RSS bulunamadı; farklı feed yolu incelenmeli |
| SavunmaTR | `https://www.savunmatr.com/feed` | TR | ⚠️ | URL kalıbı tahmini — doğrula |

> **KARAR GEREKİR:** TR/DE savunma kaynakları Türkçe/Almanca yayın yapar; `lib/defense`
> motoru yalnızca İngilizce lexicon'a bakıp ilgililik geçidinde bu metinleri **eler**
> (Defense ekranında görünmezler). Açılış: ya motora TR/DE terim ekle, ya bu kaynakları
> Monitor'a yönlendir. Bu karar verilene kadar bağlanmadı.

### 3b. Avrupa

| Kaynak | Feed URL | Dil | Durum | Önerilen id |
|---|---|---|---|---|
| EDR Magazine (European Defence Review) | `https://www.edrmagazine.eu/feed` | EN | 🔗 | `edr-magazine` |
| Hartpunkt | `https://www.hartpunkt.de/feed/` | DE | ✅⏸ | `hartpunkt` — Almanca lexicon kararı bekliyor |
| Defence Industry Europe | `https://defence-industry.eu/feed/` | EN | ⚠️ | `defence-industry-eu` |
| European Defence Agency | `https://eda.europa.eu/news-and-events/rss` | EN | ⚠️ | AB kurumu, düşük hacim |
| Meta-Defense | `https://meta-defense.fr/en/feed/` | EN | ⚠️ | FR analiz sitesi (EN sürüm) |
| Militarnyi | `https://mil.in.ua/en/feed/` | EN | ⚠️ | Ukrayna odaklı |

### 3c. Global / ABD (mevcutları tamamlayıcı)

| Kaynak | Feed URL | Durum | Not |
|---|---|---|---|
| Defense One | `https://www.defenseone.com/rss/all/` | 🔗 | Politika+teknoloji dengesi |
| Naval News | `https://www.navalnews.com/feed/` | 🔗 | Deniz platformları |
| USNI News | `https://news.usni.org/feed` | ⚠️ | ABD Deniz Enstitüsü |
| Air & Space Forces Magazine | `https://www.airandspaceforces.com/feed/` | ⚠️ | |
| DefenseScoop | `https://defensescoop.com/feed/` | ⚠️ | Savunma+teknoloji |
| National Defense Magazine | `https://www.nationaldefensemagazine.org/rss` | ⚠️ | NDIA (sektör derneği) |
| DSCA Major Arms Sales | `https://www.dsca.mil/press-media/major-arms-sales/feed` | ⚠️ | ABD resmî FMS duyuruları — ihracat takibi için birebir |
| Defence Blog | `https://defence-blog.com/feed/` | ⚠️ | Hacim yüksek, doğruluk değişken — dikkat notuyla |
| Overt Defense | `https://www.overtdefense.com/feed/` | ⚠️ | |

> RSS **vermeyen** büyük isimler: Janes, Shephard Media (paywall/portal) — API gerekir, listeye alınmadı.

---

## 4. POLICY adayları

Bağlı (17 kaynak): (mevcut 9) · France 24 World · UN News · **+dalga-2:** BBC World · DW World · Crisis Group · Foreign Policy · Global Times(STATE) · APA(STATE). Detay: §8.
Bağlılık kolonu: **Özel** = bağımsız/ticari · **Kamu** = devlet fonlu kamu yayıncısı · **Devlet** = doğrudan devlet ajansı (kesin STATE rozeti).

### 4a. Dengeleyici / genel dünya haberi

| Kaynak | Feed URL | Bağlılık | Durum | Not |
|---|---|---|---|---|
| France 24 (World) | `https://www.france24.com/en/rss` | Kamu (FR) | 🔗 | STATE rozeti almadı (Kamu) |
| UN News | `https://news.un.org/feed/subscribe/en/news/all/rss.xml` | BM kurumu | 🔗 | gzip; adaptör düzeltmesi eklendi |
| DW World (EN) | `https://rss.dw.com/rdf/rss-en-world` | Kamu (DE) | ⚠️ | Araç oturumda erişemedi; sunucu-tarafı dene |
| BBC World | `https://feeds.bbci.co.uk/news/world/rss.xml` | Kamu (UK) | ⚠️ | Çok stabil bilinen feed |
| The Diplomat | `https://thediplomat.com/feed/` | Özel | ❌ 403 | Sunucu-tarafı dene — Asya-Pasifik boşluğunu kapatır |
| Euractiv | `https://www.euractiv.com/feed/` | Özel | ⚠️ | AB politikası |
| Foreign Policy | `https://foreignpolicy.com/feed/` | Özel | ⚠️ | Paywall — feed'de özet var |
| Crisis Group | `https://www.crisisgroup.org/rss` | Düşünce kur. | ⚠️ | Düşük hacim, yüksek analiz değeri |
| Middle East Eye | `https://www.middleeasteye.net/rss` | Özel | ⚠️ | Katar finansman iddiası — notla ekle |

> **Reuters ve AP resmî RSS vermiyor** (2020'den beri). Üçüncü el Google News proxy
> önerilmez — üstteki kamu yayıncılarıyla dengele.

### 4b. Devlet ajansları (izleme değeri için — hepsi STATE setine)

| Kaynak | Feed URL | Devlet | Durum |
|---|---|---|---|
| Xinhua (EN) | `english.news.cn` RSS kalıbı belirsiz | Çin | ⚠️ endpoint araştır |
| Global Times | `https://www.globaltimes.cn/rss/outbrain.xml` | Çin | ⚠️ |
| KCNA Watch (agregatör) | `https://kcnawatch.org/feed/` | K.Kore (izleme) | ⚠️ üçüncü taraf |
| APA (EN) | `https://apa.az/en/rss` | Azerbaycan | ⚠️ |
| KUNA (EN) | `https://www.kuna.net.kw/rss.aspx?language=en` | Kuveyt | ⚠️ |
| WAFA (EN) | `https://english.wafa.ps/rss` | Filistin | ⚠️ |

---

## 5. MONITOR / GLOBAL VIEW adayları

### 5a. Afrika (yeni bölge — 3 kaynak bağlandı)

| Kaynak | Feed URL | Ülke/Kapsam | Durum | Önerilen id |
|---|---|---|---|---|
| AllAfrica Latest | `https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf` | Kıta (agregatör) | 🔗 | `allafrica-latest` |
| Daily Maverick | `https://www.dailymaverick.co.za/dmrss/` | Güney Afrika | 🔗 | `daily-maverick` |
| Premium Times | `https://www.premiumtimesng.com/feed` | Nijerya | 🔗 | `premium-times-ng` |
| Africanews | `https://www.africanews.com/api/en/rss` | Kıta | ⚠️ | Euronews grubunun Afrika kanalı |
| HumAngle | `https://humanglemedia.com/feed/` | Sahel/güvenlik | ⚠️ | Çatışma-güvenlik odaklı, Monitor'a çok uygun |
| African Arguments | `https://africanarguments.org/feed/` | Kıta/analiz | ⚠️ | |
| ISS Africa | `https://issafrica.org/rss` | Güvenlik düşünce kur. | ⚠️ | |
| The East African | nation.africa altyapısı — kalıp belirsiz | Doğu Afrika | ⚠️ | endpoint araştır |

### 5b. Diğer bölge boşlukları

| Kaynak | Feed URL | Bölge | Durum | Not |
|---|---|---|---|---|
| MercoPress | `https://en.mercopress.com/rss` | Güney Amerika | ⚠️ | |
| InSight Crime | `https://insightcrime.org/feed/` | LatAm güvenlik | ⚠️ | Örgütlü suç/güvenlik — Monitor'a uygun |
| Kyodo News (EN) | `https://english.kyodonews.net/rss/all.xml` | Japonya | ⚠️ | Özel ajans |
| Yonhap (EN) | `https://en.yna.co.kr/RSS/news.xml` | Kore | ⚠️ | Yarı-kamu — STATE gri alan |
| Dawn | `https://www.dawn.com/feeds/home` | Pakistan | ⚠️ | |

---

## 6. SOCMINT hazırlığı (kaynak değil, **yöntem** adayları)

| Platform | Yöntem | Not |
|---|---|---|
| Bluesky | `https://bsky.app/profile/<handle>/rss` | **Native RSS** — ek altyapı gerekmez, en kolay başlangıç |
| Mastodon | `https://<instance>/@<user>.rss` | Native RSS |
| Telegram (public kanal) | RSSHub: `/telegram/channel/<name>` | Public rsshub.app rate-limit'li — self-host önerilir |
| Reddit | `https://www.reddit.com/r/<subreddit>/.rss` | UA'sız istekler engellenir; özel UA gerek |
| X/Twitter | Nitter köprüleri | Instance'lar ölüyor — önerilmez; resmi API paralı |

---

## 7. Sayım özeti

- 🔗 **Bağlandı:** 42 (dalga-1: 12 · dalga-2: 30)
- ✅⏸ **Doğrulandı, karar bekliyor:** 3 (SavunmaSanayiST · DefenceTurk · Hartpunkt — lexicon)
- ❌ **Sorunlu:** 6 (TurDef 403 · The Diplomat 403 · C4Defence 404 · USOM taşındı · **euractiv** route-403 · **middle-east-eye** route-404 · **WAFA** 404)
- SOCMINT yöntemi: 5

---

## 8. DALGA-2 SONUÇLARI (7 Tem 2026 — çalışan route ile test edildi)

30 kaynak bağlandı, 3 elendi. Öğe sayıları canlı route testinden.

### Cyber News → `CYBER_NEWS_SOURCE_IDS` (11 bağlandı)
| Kaynak | id | Sonuç |
|---|---|---|
| Cisco Talos | `talos` | 🔗 15 |
| Unit 42 (Palo Alto) | `unit42` | 🔗 15 |
| Krebs on Security | `krebs-security` | 🔗 10 |
| Help Net Security | `helpnet-security` | 🔗 10 |
| Infosecurity Magazine | `infosecurity-mag` | 🔗 150 |
| The Register (Security, Atom) | `register-security` | 🔗 50 |
| WeLiveSecurity (ESET) | `welivesecurity` | 🔗 100 |
| Malwarebytes Labs | `malwarebytes` | 🔗 20 |
| Securelist (Kaspersky) | `securelist` | 🔗 10 |
| NCSC (UK) | `ncsc-uk` | 🔗 20 |
| Schneier on Security | `schneier` | 🔗 10 |

### Defense Industry → `DEFENSE_SOURCE_IDS` (7 bağlandı)
| Kaynak | id | Sonuç |
|---|---|---|
| USNI News | `usni-news` | 🔗 30 |
| DSCA — Foreign Military Sales | `dsca-fms` | 🔗 10 · `RSS.ashx?ContentType=700...max=10` (ülke ülke FMS bildirimleri) |
| DefenseScoop | `defensescoop` | 🔗 10 |
| Air & Space Forces Magazine | `airspace-forces` | 🔗 9 |
| Defence Industry Europe | `defence-industry-eu` | 🔗 10 |
| Defence Blog | `defence-blog` | 🔗 10 (doğruluk değişken) |
| SavunmaTR | `savunmatr` | 🔗 10 · **TR — lib/defense EN geçidi çoğu öğeyi eler, kısmi görünür** |

> DSCA'nın diğer 2 adayı (samm.dsca.mil, ContentType=1 featured) çalışıyor ama
> haber/manuel; FMS bildirimleri için CT700 seçildi.

### Policy → `POLICY_SOURCE_IDS` (6 bağlandı, 2 elendi)
| Kaynak | id | Sonuç | STATE |
|---|---|---|---|
| BBC World | `bbc-world` | 🔗 26 | — |
| DW World (RDF) | `dw-world` | 🔗 11 | — |
| Crisis Group | `crisis-group` | 🔗 10 | — |
| Foreign Policy | `foreign-policy` | 🔗 25 | — |
| Global Times | `global-times` | 🔗 50 | **evet** ✅ eklendi |
| APA (Azerbaycan) | `apa` | 🔗 50 · `en.apa.az/rss` | **evet** ✅ eklendi |
| ~~Euractiv~~ | `euractiv` | ❌ route-403 (bot koruması) | — |
| ~~Middle East Eye~~ | `middle-east-eye` | ❌ route-404 (`/rss` sunucu-tarafında) | — |

### Monitor / Global View → `SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS` (6 bağlandı)
| Kaynak | id | regionScope | Sonuç |
|---|---|---|---|
| HumAngle | `humangle` | africa | 🔗 10 |
| InSight Crime | `insight-crime` | americas | 🔗 11 |
| African Arguments | `african-arguments` | africa | 🔗 10 |
| MercoPress | `mercopress` | americas | 🔗 10 |
| Yonhap (EN) | `yonhap` | asia_pacific | 🔗 98 |
| Dawn | `dawn` | global | 🔗 26 (Güney Asya scope yok → global) |
| The East African | — | — | atlandı (URL yok — nation.africa endpoint araştır) |

---

## 9. Kalan iş

- **Elenenler için alternatif:** Euractiv (farklı feed yolu / proxy) · Middle East Eye (doğru RSS yolu bul) · WAFA (`english.wafa.ps/rss` 404 — doğru endpoint) · The East African (URL yok).
- **Karar bekleyen:** TR/DE savunma (SavunmaSanayiST/DefenceTurk/Hartpunkt + savunmatr'ın tam çalışması) — `lib/defense` lexicon'a TR/DE terim ekle **ya da** bu kaynakları Monitor'a taşı.
- **❌ 403'ler:** TurDef, The Diplomat — ECHIS UA'sı da 403 alıyorsa proxy/rotasyon gerekir.
- **USOM:** yeni RSS endpoint'i (`siberguvenlik.gov.tr`) araştır.
- **South Asia scope:** Dawn gibi kaynaklar için `SourceRegionScope`'a `south_asia` eklenmesi tartışılabilir (şimdilik `global`).
