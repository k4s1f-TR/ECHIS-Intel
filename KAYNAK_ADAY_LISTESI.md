# ECHIS — Kaynak Aday Listesi (RSS / API)

Hazırlanma: 6 Temmuz 2026 · Hazırlayan: Claude (kaynak araştırması devir dokümanı)
Amaç: Cyber News, Defense Industry, Policy ve Monitor ekranlarına eklenecek
yeni kaynakların **tek yerden kontrol edilip aktarılabileceği** aday havuzu.

> **ENTEGRE EDİLDİ (7 Tem 2026):** Aşağıdaki ✅ İngilizce kaynakların 12'si
> projeye bağlandı ve **çalışan route üzerinden canlı doğrulandı** (öğe sayıları):
> Cyber → bleeping-computer(15), the-record(5), dark-reading(50), cyberscoop(10);
> Defense → defense-one(23), naval-news(10), edr-magazine(10);
> Policy → france24-world(24), un-news(30); Afrika/Monitor → allafrica-latest(30),
> daily-maverick(52), premium-times-ng(15). un-news gzip döndürdüğü için
> `lib/sources/rssPreviewAdapter.ts`'e gzip/deflate/br çözme eklendi.
> **Bağlanmadı (karar/araştırma bekliyor):** TR/DE savunma (SavunmaSanayiST,
> DefenceTurk, Hartpunkt — lib/defense EN lexicon uyumsuz, motor eler);
> ⚠️ işaretli tüm adaylar; ❌ olanlar (TurDef/The Diplomat 403, C4Defence 404, USOM taşınmış).

---

## 0. Doğrulama durumu göstergesi

| İşaret | Anlamı |
|---|---|
| ✅ | 6 Tem 2026'da canlı doğrulandı: feed URL'i geçerli RSS/Atom XML döndürdü, son öğe aynı gün/haftadan |
| ⚠️ | URL kalıbı bilinen/standart, ancak bu oturumda canlı doğrulanmadı — eklemeden önce test edilmeli |
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
4. **Doğrulama:** `npm run lint` + `npm run build` + tarayıcıda ekran kontrolü
   (Sources sekmesi runtime durumunu gösterir).

---

## 2. CYBER NEWS adayları

Mevcut: The Hacker News · SecurityWeek · CISA (3 kaynak — dar).
Öneri: önce ✅ olan 3-4 haber kaynağı, ardından 1-2 kurum/vendor.

### 2a. Haber siteleri (bağımsız)

| Kaynak | Feed URL | Dil | Durum | Önerilen id |
|---|---|---|---|---|
| BleepingComputer | `https://www.bleepingcomputer.com/feed/` | EN | ✅ | `bleeping-computer` |
| The Record (Recorded Future News) | `https://therecord.media/feed` | EN | ✅ | `the-record` |
| Dark Reading | `https://www.darkreading.com/rss.xml` | EN | ✅ | `dark-reading` |
| CyberScoop | `https://cyberscoop.com/feed/` | EN | ✅ | `cyberscoop` |
| Krebs on Security | `https://krebsonsecurity.com/feed/` | EN | ⚠️ | `krebs-security` |
| Help Net Security | `https://www.helpnetsecurity.com/feed/` | EN | ⚠️ | `helpnet-security` |
| Infosecurity Magazine | `https://www.infosecurity-magazine.com/rss/news/` | EN | ⚠️ | `infosecurity-mag` |
| The Register (Security) | `https://www.theregister.com/security/headlines.atom` | EN | ⚠️ | `register-security` |
| Schneier on Security | `https://www.schneier.com/feed/atom/` | EN | ⚠️ | `schneier` — haber değil analiz; düşük hacim |

### 2b. Resmî kurumlar

| Kaynak | Feed URL | Bağlılık | Durum | Not |
|---|---|---|---|---|
| USOM / Siber Güvenlik Başkanlığı (TR) | eski: `usom.gov.tr/rss/tehdit.rss` | TR resmî | ❌ | 302 → `siberguvenlik.gov.tr/api/` yönlendiriyor; **yeni RSS endpoint'i araştırılmalı** — Türkiye kaynağı olarak yüksek öncelik |
| NCSC (UK) | `https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml` | UK resmî | ⚠️ | Rehber+haber karışık |
| ENISA (AB) | `https://www.enisa.europa.eu/media/news-items/news-wires/RSS` | AB kurumu | ⚠️ | Düşük hacim, yüksek güvenilirlik |

### 2c. Vendor araştırma blogları (teknik derinlik — Threat Context motorunu iyi besler)

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

Mevcut: Breaking Defense · Defense News · The War Zone · The Aviationist (hepsi ABD merkezli).
Öneri: **önce Türk kaynakları** (SavunmaSanayiST + DefenceTurk ikisi de canlı ✅), sonra Avrupa.

### 3a. Türkiye

| Kaynak | Feed URL | Dil | Durum | Önerilen id |
|---|---|---|---|---|
| SavunmaSanayiST | `https://www.savunmasanayist.com/feed/` | TR | ✅ | `savunmasanayist` |
| DefenceTurk | `https://www.defenceturk.net/feed` | TR | ✅ | `defenceturk` |
| TurDef | `https://turdef.com/rss` | EN | ❌ 403 | Bot koruması; sunucu tarafından (`rss-preview`) tekrar dene — İngilizce TR savunma haberi olarak değerli |
| C4Defence | `https://www.c4defence.com/feed` | TR | ❌ 404 | RSS bulunamadı; sitede farklı bir feed yolu var mı incelenmeli |
| SavunmaTR | `https://www.savunmatr.com/feed` | TR | ⚠️ | URL kalıbı tahmini — doğrula |

> Not: TR kaynaklar Türkçe yayın yapar; `lib/defense` motoru İngilizce lexicon
> kullanıyor. Türkçe feed eklenirse segment/tedarik tespiti çalışmaz, yalnızca
> feed+harita beslenmesi sınırlı olur. Ya lexicon'a TR terim eklenmeli
> ya da bu kaynaklar önce Monitor'a alınmalı. **Karar gerektirir.**

### 3b. Avrupa

| Kaynak | Feed URL | Dil | Durum | Önerilen id |
|---|---|---|---|---|
| EDR Magazine (European Defence Review) | `https://www.edrmagazine.eu/feed` | EN | ✅ | `edr-magazine` |
| Hartpunkt | `https://www.hartpunkt.de/feed/` | DE | ✅ | `hartpunkt` — Almanca; motor lexicon notu geçerli |
| Defence Industry Europe | `https://defence-industry.eu/feed/` | EN | ⚠️ | `defence-industry-eu` |
| European Defence Agency | `https://eda.europa.eu/news-and-events/rss` | EN | ⚠️ | AB kurumu, düşük hacim |
| Meta-Defense | `https://meta-defense.fr/en/feed/` | EN | ⚠️ | FR analiz sitesi (EN sürüm) |
| Militarnyi | `https://mil.in.ua/en/feed/` | EN | ⚠️ | Ukrayna odaklı |

### 3c. Global / ABD (mevcutları tamamlayıcı)

| Kaynak | Feed URL | Durum | Not |
|---|---|---|---|
| Defense One | `https://www.defenseone.com/rss/all/` | ✅ | Politika+teknoloji dengesi |
| Naval News | `https://www.navalnews.com/feed/` | ✅ | Deniz platformları — mevcut sette eksik alan |
| USNI News | `https://news.usni.org/feed` | ⚠️ | ABD Deniz Enstitüsü |
| Air & Space Forces Magazine | `https://www.airandspaceforces.com/feed/` | ⚠️ | |
| DefenseScoop | `https://defensescoop.com/feed/` | ⚠️ | Savunma+teknoloji |
| National Defense Magazine | `https://www.nationaldefensemagazine.org/rss` | ⚠️ | NDIA (sektör derneği) |
| DSCA Major Arms Sales | `https://www.dsca.mil/press-media/major-arms-sales/feed` | ⚠️ | ABD resmî FMS duyuruları — ihracat takibi için birebir |
| Defence Blog | `https://defence-blog.com/feed/` | ⚠️ | Hacim yüksek, doğruluk düzeyi değişken — dikkat notuyla |
| Overt Defense | `https://www.overtdefense.com/feed/` | ⚠️ | |

> RSS **vermeyen** büyük isimler: Janes, Shephard Media (paywall/portal).
> Bunlar için kaynak eklemek yerine ileride API anlaşması gerekir — listeye alınmadı.

---

## 4. POLICY adayları

Mevcut 9 kaynağın 6'sı devlet bağlantılı. Öneri: önce 2-3 dengeleyici ekle.
`stateAffiliated` önerisi kolonda: **Özel** = bağımsız/ticari, **Kamu** = devlet fonlu
kamu yayıncısı (STATE rozetine dahil edilip edilmeyeceği senin kararın — Al Jazeera
şu an dahil, tutarlılık için Kamu olanları da işaretlemek savunulabilir), **Devlet** = doğrudan devlet ajansı (kesin STATE).

### 4a. Dengeleyici / genel dünya haberi

| Kaynak | Feed URL | Bağlılık | Durum | Not |
|---|---|---|---|---|
| France 24 (EN) | `https://www.france24.com/en/rss` | Kamu (FR) | ✅ | |
| UN News | `https://news.un.org/feed/subscribe/en/news/all/rss.xml` | BM kurumu | ✅ | |
| DW World (EN) | `https://rss.dw.com/rdf/rss-en-world` | Kamu (DE) | ⚠️ | Araç bu oturumda erişemedi; sunucu tarafından dene |
| BBC World | `https://feeds.bbci.co.uk/news/world/rss.xml` | Kamu (UK) | ⚠️ | Çok stabil bilinen feed |
| The Diplomat | `https://thediplomat.com/feed/` | Özel | ❌ 403 | Bot koruması; sunucu tarafından dene — Asya-Pasifik boşluğunu kapatır |
| Euractiv | `https://www.euractiv.com/feed/` | Özel | ⚠️ | AB politikası |
| Foreign Policy | `https://foreignpolicy.com/feed/` | Özel | ⚠️ | Paywall — feed'de özet var |
| Crisis Group | `https://www.crisisgroup.org/rss` | Düşünce kur. | ⚠️ | Düşük hacim, yüksek analiz değeri |
| Middle East Eye | `https://www.middleeasteye.net/rss` | Özel | ⚠️ | Finansmanına dair Katar iddiaları var — notla ekle |

> **Reuters ve AP resmî RSS vermiyor** (2020'den beri kapalı). İstenirse Google
> News RSS proxy kalıbı kullanılabilir (`news.google.com/rss/search?q=site:apnews.com+world`)
> ama üçüncü el bağımlılık yaratır — önerim: kullanma, üstteki kamu yayıncılarıyla dengele.

### 4b. Devlet ajansları (izleme değeri için — hepsi STATE setine)

| Kaynak | Feed URL | Devlet | Durum |
|---|---|---|---|
| Xinhua (EN) | `english.news.cn` RSS kalıbı belirsiz | Çin | ⚠️ endpoint araştır |
| Global Times | `https://www.globaltimes.cn/rss/outbrain.xml` | Çin | ⚠️ |
| KCNA Watch (agregatör) | `https://kcnawatch.org/feed/` | K.Kore (izleme) | ⚠️ üçüncü taraf agregatör |
| APA (EN) | `https://apa.az/en/rss` | Azerbaycan | ⚠️ |
| KUNA (EN) | `https://www.kuna.net.kw/rss.aspx?language=en` | Kuveyt | ⚠️ |
| WAFA (EN) | `https://english.wafa.ps/rss` | Filistin | ⚠️ |

---

## 5. MONITOR / GLOBAL VIEW adayları

### 5a. Afrika (yeni bölge eklendi — kaynak boşluğu burada en büyük)

| Kaynak | Feed URL | Ülke/Kapsam | Durum | Önerilen id |
|---|---|---|---|---|
| AllAfrica Latest | `https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf` | Kıta (agregatör) | ✅ | `allafrica-latest` |
| Daily Maverick | `https://www.dailymaverick.co.za/dmrss/` | Güney Afrika | ✅ | `daily-maverick` |
| Premium Times | `https://www.premiumtimesng.com/feed` | Nijerya | ✅ | `premium-times-ng` |
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

SOCMINT canlıya geçerken doğrudan RSS köprüleri:

| Platform | Yöntem | Not |
|---|---|---|
| Bluesky | `https://bsky.app/profile/<handle>/rss` | **Native RSS** — ek altyapı gerekmez, en kolay başlangıç |
| Mastodon | `https://<instance>/@<user>.rss` | Native RSS |
| Telegram (public kanal) | RSSHub: `/telegram/channel/<name>` | Public rsshub.app instance'ı rate-limit'li — **self-host önerilir** |
| Reddit | `https://www.reddit.com/r/<subreddit>/.rss` | UA'sız istekler engellenir; sunucu tarafında özel UA gerek |
| X/Twitter | Nitter köprüleri | Instance'lar sürekli ölüyor — **önerilmez**; resmi API paralı |

---

## 7. Önerilen ekleme sırası (küçük dalgalar halinde)

1. **Cyber dalga 1:** BleepingComputer + The Record (+ istersen Dark Reading) — üçü ✅
2. **Defense dalga 1:** SavunmaSanayiST + DefenceTurk (✅; Türkçe-lexicon kararını ver) + Naval News + EDR Magazine (✅)
3. **Policy dengeleme:** France 24 + UN News (✅) + DW (sunucu testi sonrası)
4. **Afrika:** AllAfrica + Daily Maverick + Premium Times (✅) → Monitor registry'sine
5. Kalan ⚠️'ler ihtiyaç oldukça, her seferinde `rss-preview` testiyle.

Her dalgada: az sayıda kaynak ekle → Sources sekmesinde runtime'ı izle →
hacim/gürültü dengesine bak → sonra genişlet.
