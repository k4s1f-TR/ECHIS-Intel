# ECHIS — Bağımsız Ürün, Kullanıcı Deneyimi ve Teknik Hazırlık Denetimi

> Denetim tarihi: 21 Temmuz 2026  
> Denetlenen kapsam: Mevcut çalışma ağacındaki ECHIS web uygulamasının tamamı  
> Bakış açısı: İlk kez ürüne giren dış kullanıcı, profesyonel analist, klavye kullanıcısı ve canlı ortam işletmecisi  
> Rapor türü: Backend tasarımından bağımsız mevcut durum ve canlıya hazırlık denetimi  
> Karar seviyesi: Kamuya açık üretim yayını için **NO-GO**

---

## 1. Yönetici özeti

ECHIS; güçlü ve ayırt edilebilir bir görsel kimliğe, etkileyici harita/globe çalışmalarına, geniş kaynak kapsamına ve bazı ekranlarda örnek gösterilebilecek kaynak şeffaflığına sahip, ileri seviyede bir ürün prototipidir. Proje basit bir arayüz denemesi değildir; canlı RSS/API akışları, coğrafi çözümleme, kural tabanlı sinyal analizi, uçuş takibi, yerel analist çalışma alanı ve çok sayıda uzmanlaşmış ekran içerir.

Bununla birlikte mevcut sürüm, dış kullanıcıya açık ve güvenilir bir üretim ürünü olarak yayımlanmaya hazır değildir. En önemli sorun backend eksikliği değildir. Daha önce çözülmesi gereken temel konu, arayüzün kullanıcıya neyin gerçek, neyin türetilmiş, neyin tahmini, neyin önbellekten, neyin yerel ve neyin tamamen simülasyon olduğunu tutarlı biçimde söylememesidir.

Mevcut durumda:

- Production build, integration/ScreenGlobe.tsx içindeki uyumsuz centered prop’u nedeniyle type-check aşamasında durmaktadır.
- Monitor açılışı rastgele üretilen görsel sinyalleri ve sabit metrikleri operasyonel veri izlenimiyle sunmaktadır.
- SOCMINT ekranı kodda açıkça mock olan kayıtları görünür bir demo etiketi olmadan güncel rapor gibi göstermektedir.
- Contact formu hiçbir veri göndermeden başarı, güvenli iletim ve takip numarası üretmektedir.
- Confidence, corroborated, severity ve live gibi kritik terimler bazı ekranlarda gerçek doğrulama anlamından daha güçlü bir izlenim yaratmaktadır.
- Air Track konumları gerçek fixler arasında tahminle ilerletilmesine rağmen kullanıcıya gözlem/tahmin ayrımı yeterince gösterilmemektedir.
- Ziyaretçi IP’si, saat/şehir belirleme akışı kapsamında görünür bir gizlilik açıklaması olmadan üçüncü tarafa gönderilmektedir.
- GDELT adaptöründe HTTPS’den HTTP’ye düşme yolu ve RSS redirect zincirinde yeniden doğrulanmayan hedefler bulunmaktadır.
- Intel Watch haritasında provider attribution verisi tanımlı olmasına rağmen görünür attribution kontrolü kapatılmıştır.
- Klavye, odak, kontrast, modal davranışı, responsive düzen ve otomatik hareket alanlarında ciddi erişilebilirlik açıkları vardır.
- Tek URL üzerinde React state’iyle yürüyen gezinme; geri tuşu, yenileme, paylaşılabilir bağlantı ve araştırma bağlamını koruma beklentilerini karşılamamaktadır.
- Test harness’leri mevcut ve geçen 114 assertion vardır; ancak standart test komutu, CI kapısı, E2E, erişilebilirlik testi ve üretim gözlemlenebilirliği yoktur.

### Net karar

| Kullanım senaryosu | Karar | Gerekçe |
|---|---|---|
| Geliştirici/ürün sahibi tarafından yerel kullanım | **Uygun** | Prototip geliştirme ve keşif için işlevsel temel var |
| Sınırlı ekip içi demo | **Koşullu uygun** | Tüm simülasyonlar açıkça etiketlenmeli; Contact kapatılmalı; veriye operasyonel karar için güvenilmemeli |
| Davetli kapalı beta | **Şu anda uygun değil** | Build, güven, veri semantiği, güvenlik, erişilebilirlik ve veri saklama sınırları kapanmamış |
| Kamuya açık production | **NO-GO** | Kullanıcıyı yanıltabilecek davranışlar ve yayın engelleyici teknik/hukuki riskler var |

Backend geliştirmeye doğrudan geçmek, mevcut belirsizlikleri API ve veri tabanı sözleşmelerine kalıcı biçimde gömme riski taşır. Önce ürünün doğruluk dili, veri durum modeli, kullanıcı/oturum modeli, saklama sınırı, paylaşılabilir URL yapısı, kaynak yönetişimi ve yayın kapsamı karara bağlanmalıdır.

---

## 2. Raporun amacı ve bağımsızlığı

Bu belge:

- Başka bir raporun özeti veya eki değildir.
- Backend teknolojisi seçmek için hazırlanmış bir mimari doküman değildir.
- Mevcut uygulamanın dış kullanıcıya ne sunduğunu, bunun kodda gerçekte nasıl çalıştığını ve canlıya çıkmadan önce hangi risklerin kapanması gerektiğini inceler.
- Daha sonra hazırlanacak “backend öncesi yapılacaklar listesi” için karar girdisi üretir; o listenin kendisi değildir.

Temel denetim sorusu şudur:

> ECHIS bugün ilk kez gören bağımsız bir kullanıcı tarafından güvenilir, anlaşılır, erişilebilir, paylaşılabilir ve üretime hazır bir ürün olarak algılanabilir mi?

Yanıt: Görsel ve işlevsel potansiyeli yüksek olmakla birlikte, mevcut haliyle hayır.

---

## 3. Denetim yöntemi, kanıt standardı ve sınırlamalar

### 3.1 İncelenen alanlar

- Uygulama kabuğu, iki seviyeli navigasyon ve tüm görünür ekranlar
- Canlı, önbellekli, statik, yerel, türetilmiş, tahmini ve mock veri akışları
- Formlar, butonlar, aramalar, filtreler, modallar ve boş/hata/yükleme durumları
- Responsive davranış ve sabit yerleşim varsayımları
- Klavye erişimi, odak yönetimi, semantik HTML, kontrast ve hareket
- Route yapısı, state yönetimi, paylaşım ve geri/yenileme davranışı
- İstemci yükü, veri fan-out’u, büyük asset’ler ve kod bölme
- TypeScript, lint, testler, build, CI ve hata izolasyonu
- Güvenlik başlıkları, upstream erişimi, redirect davranışı ve veri bütünlüğü
- Gizlilik, kaynak attribution’ı, içerik yönetişimi ve OSINT kullanım sınırları
- README, çalışma komutları ve operasyonel dokümantasyon

### 3.2 Uygulanan doğrulamalar

| Kontrol | Sonuç |
|---|---|
| ESLint | 0 hata, 1 uyarı |
| TypeScript / production build | Başarısız; integration/ScreenGlobe.tsx:65 |
| Global feed helper testleri | 17/17 geçti |
| Policy sinyal testleri | 19/19 geçti |
| Defense sinyal testleri | 27/27 geçti |
| Cyber sinyal testleri | 51/51 geçti |
| Toplam mevcut assertion | 114/114 geçti |
| Lokal HTTP erişimi | Dev sunucusu HTTP 200 verdi |
| Etkileşimli görsel tarayıcı denetimi | Ortamda kullanılabilir tarayıcı oturumu bulunmadığı için tamamlanamadı |

### 3.3 Kanıt dili

Raporda üç farklı ifade türü ayrılmıştır:

- **Doğrudan bulgu:** Kod veya komut çıktısıyla doğrulanmıştır.
- **Risk çıkarımı:** Doğrudan bulgunun olası kullanıcı/işletim etkisidir.
- **Manuel doğrulama gerektirir:** Piksel düzeni, gerçek cihaz davranışı, gerçek ağ süresi veya hukuki uygunluk gibi yalnızca statik kodla kesinleştirilemeyen alandır.

### 3.4 Sınırlamalar

- Bu denetim bir penetrasyon testi değildir.
- Kaynak lisanslarının tek tek hukuki incelemesi yapılmamıştır.
- KVKK/GDPR değerlendirmesi hukuki görüş değildir; hukuki inceleme gerektiren veri akışlarını işaretler.
- Lighthouse, gerçek cihaz, ekran okuyucu ve görsel regresyon ölçümü yapılamamıştır.
- Production build tamamlanamadığı için nihai bundle ve Web Vitals ölçümü üretilememiştir. Rapordaki bundle rakamları mevcut derleme ara çıktısından alınmış, yeniden ölçülmesi gereken göstergelerdir.
- Denetim, commit edilmiş ve henüz commit edilmemiş değişikliklerin birlikte bulunduğu mevcut çalışma ağacının anlık fotoğrafıdır.

---

## 4. Öncelik ve kabul kriteri modeli

| Seviye | Tanım | Beklenen davranış |
|---|---|---|
| **P0 — Bloker** | Kamuya açık yayını engeller; yanıltma, veri bütünlüğü, güvenlik, gizlilik veya temel erişim riski taşır | Backend backlog’u dondurulmadan önce karar verilmeli; public release öncesi tamamen kapanmalı |
| **P1 — Yüksek** | Kapalı beta veya profesyonel kullanım kalitesini ciddi biçimde düşürür | Backend sözleşmelerini etkileyenler backend başlamadan karara bağlanmalı |
| **P2 — Orta** | Profesyonellik, sürdürülebilirlik veya kullanım verimini belirgin artırır | Planlanmalı; release modeline göre fazlanabilir |
| **P3 — İyileştirme** | Kozmetik, optimizasyon veya ileri seviye rahatlık | Temel güven kapıları sonrasında ele alınabilir |

Bir bulgunun “kapandı” sayılması yalnızca kod değişikliğiyle değil, gözlenebilir kabul kanıtıyla mümkündür. Örneğin Contact için butonun çalışması yeterli değildir; gerçek teslimat onayı, hata yolu, tekrar deneme, gizlilik metni ve test kanıtı gerekir.

---

## 5. Mevcut ürün ve veri gerçekliği envanteri

| Yüzey | Kullanıcının gördüğü | Kodda gerçek durum | Değerlendirme |
|---|---|---|---|
| **Monitor** | Küresel stratejik izleme, öncelikli bölgeler, sinyal hacmi, güvenli oturum | Bölgeler ve sayılar sabit; ambient marker’lar Math.random ile üretilip 6,8 saniyede yenileniyor | **Simülasyon; etiketsiz sunum kritik** |
| **Global View** | Çok kaynaklı küresel olay/haber akışı ve harita | Canlı RSS/API, kural tabanlı filtreleme, geocoding, kümeleme ve sunum skorları | **Gerçek veri temeli var; semantik dikkat gerekli** |
| **SOCMINT Watch** | Sosyal kaynak raporları, konum, confidence ve verification | data/socmintReports.ts içinde sabit mock kayıtlar | **Mock; görünür demo etiketi yok** |
| **Air Track** | Sivil, askerî ve watchlist uçuşları; canlı durum | adsb.lol/OpenSky akışı; gerçek fixler arasında dead-reckoning ile tahmini hareket | **Gerçek + tahmini; ayrım görünür değil** |
| **Intel Watch** | Analist haritası, pin, çizim, statik katmanlar, import/export | Tarayıcı localStorage’ı + paketli GeoJSON veri setleri | **İşlevsel yerel çalışma alanı; hesap/senkron yok** |
| **Bookmarks** | Kaydedilmiş araştırma öğeleri | Yalnızca tarayıcı localStorage’ı | **İşlevsel; cihaz/tarayıcı sınırı açıklanmıyor** |
| **Cyber News** | Canlı siber haber ve threat context | Canlı RSS; ülke/aktör/sektör/güven metinden deterministik sezgilerle türetiliyor | **Görece şeffaf; harita olay doğrulaması sanılabilir** |
| **Defense Industry** | Canlı savunma haberları, confidence, impact, supply-chain pressure | Canlı RSS; skor ve bağlam başlık/özetten kural tabanlı türetiliyor | **Türetim dili yeterince görünür değil** |
| **Policy** | Dossier, severity, topic, region ve sinyal hacmi | Canlı RSS; kural tabanlı sınıflandırma; dossier body kaynak özetidir | **Sunum, algoritmik çıktıyı olduğundan güçlü gösterebilir** |
| **Sources** | Kaynak şeffaflığı ekranı | Endpoint, config, hata, API anahtarı durumu ve runtime registry içeren ops ekranı | **Public katalog ile admin konsolu karışmış** |
| **Contact** | Güvenli mesaj iletimi, takip numarası ve 24–48 saat dönüş | Form değeri okunmuyor/gönderilmiyor; rastgele takip kodu oluşturuluyor | **Yanlış başarı bildirimi; yayın blokeri** |
| **Ship Track** | Sol menü hedefi | Coming soon / devre dışı | **Tamamlanmamış** |
| **Analytics** | Sol menü hedefi | Coming soon / devre dışı | **Tamamlanmamış** |
| **Theme, Account, Exit** | Ürün/oturum kontrolleri | Coming soon veya devre dışı | **Mevcut olmayan yetenek izlenimi** |

### Envanterden çıkan temel sonuç

Üründe tek bir veri gerçekliği yoktur. Aynı uygulama içinde en az yedi farklı durum birlikte bulunmaktadır:

1. Canlı upstream veri
2. Son başarılı önbellek
3. Kural tabanlı türetilmiş analiz
4. Benzer başlık kümelenmesi
5. Tahmini hareket/konum
6. Paketli statik veri
7. Tamamen mock veya dekoratif simülasyon

Bu durumlar için ortak bir görsel ve sözlü sözlük bulunmadığından kullanıcı, veri türlerini birbirinden güvenilir biçimde ayıramaz. Backend öncesi en kritik ürün tasarımı bu “veri durumu sözleşmesi”dir.

---

## 6. Olgunluk matrisi

| Alan | Durum | Objektif gerekçe |
|---|---|---|
| Görsel kimlik | **Güçlü temel / manuel doğrulama gerekli** | Koyu tema, crimson-silver renk dili ve yoğun bilgi estetiği tutarlı; gerçek tarayıcı görsel QA tamamlanamadı |
| Ürün konumlandırması | **Ciddi risk** | Medya izleme, OSINT analizi, operasyonel tracking ve demo yüzeyler aynı vaat altında |
| Veri doğruluğu dili | **Bloke** | Live, confidence, corroborated, severity, secure ve session terimleri davranışla her yerde uyuşmuyor |
| Temel işlevsellik | **Bloke** | Contact gerçek değil; Pin to Watch ve bazı kanallar çalışmıyor; build geçmiyor |
| Bilgi mimarisi | **Ciddi risk** | İki nav seviyesi, örtüşen ekran isimleri ve tek URL/state tabanlı gezinme |
| Responsive | **Ciddi risk** | Sabit paneller, overflow hidden ve sınırlı media query kullanımı |
| Erişilebilirlik | **Bloke** | Görünmeyen odak hedefleri, fareye bağımlı kartlar, kontrast, label ve modal odak açıkları |
| Performans | **Ciddi risk** | Büyük istemci grafiği, kod bölme yok, çok yüksek başlangıç fetch fan-out’u ve büyük GeoJSON’lar |
| Frontend sürdürülebilirliği | **Ciddi risk** | Çok büyük bileşenler, yoğun inline style ve merkezi AppShell bağımlılığı |
| Test ve release gate | **Bloke** | Assertion’lar geçiyor; fakat typecheck/build kırık, test script’i ve CI yok |
| Güvenlik | **Bloke** | HTTP downgrade ve redirect SSRF riski; CSP yok |
| Gizlilik ve hukuki hazırlık | **Bloke** | IP üçüncü tarafa aktarılıyor; privacy/terms/acceptable-use/retention çerçevesi yok |
| Operasyonel hazırlık | **Ciddi risk** | Health/readiness, structured telemetry, runbook, runtime pin ve hata izleme yok |
| Dokümantasyon | **Ciddi risk** | README varsayılan Next.js metni; güncel uygulamayla uyuşmayan eski denetim beyanları var |

---

## 7. Güçlü yönler — korunması gereken ürün sermayesi

Objektif denetim yalnızca sorunları listelememelidir. Aşağıdaki alanlar yeni mimaride korunmalıdır.

### 7.1 Ayırt edilebilir ürün kimliği

- Uygulama sıradan bir admin paneli görünümünden ayrılıyor.
- Koyu tema, kırmızı vurgu, monospace metadata ve serif/editoryal yüzeyler güçlü bir karakter oluşturuyor.
- Harita merkezli çalışma modeli ürünün OSINT konumlandırmasıyla uyumlu.

### 7.2 Global View kaynak/provenance yaklaşımı

Global View detayında kaynak adı/ID, published UTC, source basis, verification, geo basis, geo method/evidence ve orijinal URL gösterilebiliyor. Bu yaklaşım Policy, Defense, Cyber, SOCMINT ve Air Track için ortak standart haline getirilmeye uygundur.

Kanıt:

- components/source-intelligence/SourceGlobalFeedPanel.tsx:196-209
- components/source-intelligence/SourceGlobalFeedPanel.tsx:360-422
- components/source-intelligence/SourceGlobalFeedPanel.tsx:561-620

### 7.3 Hata, boş ve kısmi durumların düşünülmüş olması

- Global feed partial durumu gösterebiliyor.
- Cyber, Defense ve Policy loading/error/empty dallarına sahip.
- Air Track CONNECTING/LIVE/STALE/OFFLINE durumlarını modelliyor.
- Bookmarks boş durum sunuyor.

Eksik olan ortak bir state standardı ve bazı ekranlarda kullanıcı kontrollü retry’dir; fakat temel düşünce mevcuttur.

### 7.4 Intel Watch çalışma alanı

- Undo geçmişi
- İki adımlı clear
- Yerel kalıcılık
- GeoJSON import/export
- Statik katman toggle’ları
- Kullanıcı pin/not akışı

Bu özellikler gerçek bir analist çalışma yüzeyi potansiyeli göstermektedir.

### 7.5 Cyber tarafındaki türetim şeffaflığı

Cyber context paneli ülke, aktör, sektör ve confidence’ın açık kaynak metninden inferred olduğunu diğer ekranlardan daha açık biçimde ifade ediyor. Bu içerik dili, tüm türetilmiş analizler için başlangıç şablonu olabilir.

### 7.6 Teknik temelde olumlu uygulamalar

- TypeScript strict açıktır.
- Next core-web-vitals ESLint tabanı kullanılmaktadır.
- RSS başlangıç route’unda sourceId allowlist’i, timeout, response cap, cache ve in-flight birleştirme vardır.
- Çoğu dış bağlantı noopener/noreferrer kullanmaktadır.
- Ağır source pipeline’ı Worker’a ayrılmıştır.
- WebGL/MapLibre cleanup kodu özenlidir.
- Temel güvenlik başlıkları mevcuttur: nosniff, frame deny, referrer, permissions ve HSTS.
- Yerel globe/GeoJSON varlıkları bazı dış servis kesintilerine karşı görsel dayanıklılık sağlar.

---

## 8. P0 — Kamuya açık yayını engelleyen bulgular

### P0-01 — Production build geçmiyor

**Doğrudan bulgu**

integration/ScreenGlobe.tsx:65, EchisGlobe bileşenine centered prop’u veriyor; güncel EchisGlobeProps bu alanı içermiyor. tsconfig tüm TS/TSX ağacını kapsadığı için integration klasörü de type-check’e giriyor.

**Dış kullanıcı/iş etkisi**

- Güvenilir production artifact üretilemez.
- CI kurulsa ilk gate’te durur.
- “Build temiz” diyen eski dokümantasyon güncel gerçekle çelişir.

**Kapanış ölçütü**

- Stale integration kopyaları güncel sözleşmeye eşitlenmeli veya derleme kapsamından açıkça ayrılmalı.
- npm run typecheck ve npm run build sıfır hatayla geçmeli.
- Aynı kontroller CI’da zorunlu olmalı.

### P0-02 — Monitor ve SOCMINT gerçek veri gibi algılanabilecek etiketsiz simülasyonlardır

**Doğrudan bulgu**

- Monitor WATCH_REGIONS değerleri ve sinyal sayıları sabittir.
- Ambient sinyaller Math.random ile üretilir ve 6,8 saniyede yenilenir.
- Arayüz “Strategic intelligence environment”, “Global coverage”, “1,284 SIGNALS/24H”, “63 SOURCES” ve “SECURE SESSION” ifadelerini kullanır.
- SOCMINT veri dosyası “Mock-only” açıklamasına sahiptir.
- SOCMINT UI’da sürekli görünen demo/mock etiketi yoktur; kayıtlar “Today” zamanları ve gerçek şehirlerle sunulur.

Kanıt:

- components/monitor/MonitorLanding.tsx:26-41
- components/monitor/MonitorLanding.tsx:85-150
- components/monitor/MonitorLanding.tsx:283-309
- components/monitor/MonitorLanding.tsx:466-473
- data/socmintReports.ts:3-68
- components/signals/SignalsPanel.tsx:269-294
- components/layout/AppShell.tsx:248-255

**Dış kullanıcı/iş etkisi**

- Dekoratif yoğunluk gerçek olay yoğunluğu sanılabilir.
- Sabit risk etiketleri güncel tehdit değerlendirmesi gibi yorumlanabilir.
- Hassas güvenlik, konvoy veya çatışma iddiaları yanlış bilgi olarak yayılabilir.
- Bir kez kaybedilen OSINT güvenilirliğini geri kazanmak zordur.

**Kapanış ölçütü**

- Bu yüzeyler public build’den çıkarılmalı veya ekran seviyesinde sürekli “DEMO / FICTIONAL SAMPLE / ILLUSTRATIVE” etiketi taşımalıdır.
- “Today”, “secure”, “session”, kesin source/signal sayısı ve risk iddiaları gerçek ölçüm olmadan kullanılmamalıdır.
- Gerçek SOCMINT modelinde kaynak URL’si, alınma zamanı, gözlem zamanı, veri yaşı, doğrulayan kaynaklar, konum hassasiyeti ve düzeltme geçmişi bulunmalıdır.

### P0-03 — Contact gerçek teslimat olmadan güvenli başarı bildiriyor

**Doğrudan bulgu**

Submit işlevi yalnızca Math.random ile ECH-xxxx kodu üretip sent state’ini true yapar. Ad, e-posta, kategori ve mesaj herhangi bir endpoint’e, form action’a, mail servisine veya kalıcı kayda gönderilmez.

Buna rağmen arayüz:

- “SECURE INTAKE”
- “Secure intake relay”
- “Sent over a secure relay”
- “Message transmitted”
- Takip numarası
- “24–48 hours” yanıt vaadi

göstermektedir. Direct channel satırları da cursor verilen div’lerdir; gerçek link veya click handler değildir.

Kanıt:

- components/contact/ContactScreen.tsx:44-88
- components/contact/ContactScreen.tsx:364-526
- components/contact/ContactScreen.tsx:572-622

**Dış kullanıcı/iş etkisi**

- Kullanıcı düzeltme, güvenlik bildirimi, ortaklık veya veri talebinin ulaştığını sanır.
- Kritik bildirimler sessizce kaybolur.
- “Secure relay” ifadesi doğrulanamayan bir güvenlik vaadidir.
- İtibar ve tüketici güveni bakımından açık bir yayın blokeridir.

**Kapanış ölçütü**

- Gerçek teslimat gelene kadar Contact kaldırılmalı veya açıkça devre dışı gösterilmelidir.
- Başarı yalnızca server-side kabul ve kalıcı gerçek ticket ID sonrasında gösterilmelidir.
- Pending, validation, hata, retry, duplicate/idempotency ve abuse koruması tanımlanmalıdır.
- Form alanları semantik label, name, autocomplete ve gizlilik açıklaması taşımalıdır.
- Düzeltme bildirimi her içerik öğesinden erişilebilir olmalıdır.

### P0-04 — Kritik veri terimleri gerçek anlamlarından daha güçlü kullanılıyor

Bu bulgu tek bir ekran hatası değil, ürün genelindeki veri sözleşmesi problemidir.

**Doğrudan bulgular**

1. Global View confidence:
   - Keyword priority, official-source özelliği ve geo eşleşmesi gibi sinyallerden türetilir.
   - İddianın doğru olma olasılığını ölçen bir doğrulama modeli değildir.

2. Global View corroborated:
   - Aynı domain, 48 saat penceresi ve başlık token benzerliği üzerinden kümelenir.
   - Bağımsız içerik veya kanıt doğrulaması değildir.

3. Global View severity:
   - Editorial/relevance priority, harita event severity’sine dönüşebilir.
   - Metinsel önem ile fiziksel olay şiddeti karışır.

4. Policy ve Defense:
   - Severity, impact, confidence ve supply-chain pressure metinsel heuristics’tir.
   - Dossier/analist dili bu türetimin gücünü olduğundan fazla gösterebilir.

5. Cyber:
   - Inferred açıklaması olumlu olsa da “Global Threat Map” haber mention’larını doğrulanmış incident konumu gibi okutabilir.

6. Cache:
   - Cyber/Defense/Policy tüm yenilemeler başarısız olduğunda son iyi cache’i döndürebilir.
   - Items bulunduğu sürece arayüz “LIVE” izlenimini sürdürebilir.

Kanıt:

- lib/sourceintel/feedInsights.ts:55-79
- lib/sourceintel/feedInsights.ts:181-230
- data/source-intelligence/filters/applySourceFilters.ts:175-300
- components/layout/AppShell.tsx:292-305
- lib/policy/detect.ts:194-288
- lib/defense/analyzeDefenseSignals.ts:145-152
- components/cyber/ThreatContextPanel.tsx:210-218
- components/cyber/useCyberNewsFeed.ts:174-193
- components/defense-industry/useDefenseIndustryFeed.ts:101-120
- components/policy/usePolicyFeed.ts:114-132

**Dış kullanıcı/iş etkisi**

- Kullanıcı haber önceliğini doğruluk güveni sanabilir.
- Benzer haber başlıklarını bağımsız teyit sanabilir.
- Cache’i canlı veri sanabilir.
- Algoritmik özetleri insan analist değerlendirmesi sanabilir.

**Kapanış ölçütü**

Ürün genelinde aşağıdaki kavramlar birbirinden ayrılmalıdır:

| Mevcut/genel terim | Kullanılması gereken daha doğru kavram |
|---|---|
| Confidence | Text-match confidence, classification confidence veya source-quality signal |
| Corroborated | Similar coverage / matching reports; doğrulama varsa kanıt yöntemi ayrıca |
| Severity | Editorial priority, detected language intensity veya verified incident severity |
| Live | Last successful collection zamanı + fresh/degraded/stale/offline |
| Dossier | Source summary + automated classification; analist notu ayrı |
| Threat map | Coverage/mention map; verified incident map ayrı |

Her türetilmiş alan provenance, method version, input zamanı ve açıklanabilirlik bilgisi taşımalıdır.

### P0-05 — Air Track gözlenen ve tahmini konumu yeterince ayırmıyor

**Doğrudan bulgu**

- Feed gerçek upstream sağlayıcılardan gelir.
- Globe, gerçek fixler arasında hız ve istikametle dead-reckoning uygular.
- Model positionAgeSec ve gerçek fix zamanı taşıyabilir.
- Kartta bu kritik yaş ve tahmin bilgisi görünür değildir.
- Intel Watch’a aktarılırken updated alanına kaynak fix zamanı yerine gönderim anı yazılabilir.

Kanıt:

- components/airtrack/useAirTrackFeed.ts:8-30
- components/airtrack/AirTrackGlobe.tsx:269-310
- components/airtrack/AirTrackGlobe.tsx:359-412
- types/airtrack.ts:38-45
- components/airtrack/AirTrackContactCard.tsx:134-153
- components/airtrack/AirTrackContactCard.tsx:324-358

**Dış kullanıcı/iş etkisi**

- Tahmini konum son gerçek gözlem veya “şu an” sanılabilir.
- Askerî/watchlist bağlamında birkaç dakikalık fark bile yanlış çıkarıma yol açabilir.
- Operasyonel karar desteği izlenimi oluşur.

**Kapanış ölçütü**

- Observed position ve estimated position görsel olarak ayrılmalıdır.
- Last fix UTC, position age, provider delay ve prediction age görünür olmalıdır.
- Belirli eşikten sonra track solmalı ve stale/offline olmalıdır.
- Export/pin kayıtlarında source observedAt ve estimatedAt ayrı tutulmalıdır.
- Ürün “navigation/safety/operational targeting için kullanılmaz” sınırını açıkça belirtmelidir.

### P0-06 — Upstream veri bütünlüğünde HTTP downgrade ve redirect SSRF riski var

**Doğrudan bulgular**

1. GDELT adaptörü:
   - HTTP fallback endpoint’i tanımlar.
   - HTTPS URL’sini HTTP’ye çevirebilir.
   - Sertifika hatasında şifresiz bağlantıya düşebilir.

2. RSS redirect zinciri:
   - İlk sourceId route allowlist’i olumlu bir kontroldür.
   - Ancak redirect sonrası her yeni URL aynı protokol/host/private-IP kurallarıyla yeniden doğrulanmaz.
   - Allowlist’teki upstream, localhost, link-local, metadata IP veya HTTP hedefe yönlendirebilir.

Kanıt:

- lib/sources/gdeltAdapter.ts:9-10
- lib/sources/gdeltAdapter.ts:217-225
- lib/sources/gdeltAdapter.ts:298-306
- app/api/sources/rss-preview/route.ts:17-20
- app/api/sources/rss-preview/route.ts:190-205
- lib/sources/rssPreviewAdapter.ts:213-263

**Dış kullanıcı/iş etkisi**

- OSINT verisi ağ üzerinde değiştirilebilir.
- Server-side fetch iç ağ/metadata hedeflerine yönlendirilebilir.
- Kaynağın görünen kimliği ile gerçek bağlantı hedefi ayrışabilir.

**Kapanış ölçütü**

- TLS hatasında fail-closed davranılmalı; yalnızca son doğrulanmış stale cache kullanılmalıdır.
- Her redirect hop’unda HTTPS zorunlu olmalıdır.
- Host/redirect-host allowlist’i uygulanmalıdır.
- DNS çözümü sonrasında private, loopback, link-local, reserved ve cloud metadata adresleri bloklanmalıdır.
- Redirect sayısı sınırlandırılmalı ve nihai URL provenance’a yazılmalıdır.
- Güvenlik testleri CI’da yer almalıdır.

### P0-07 — Gizlilik ve üçüncü taraf IP aktarımı kullanıcıya açıklanmıyor

**Doğrudan bulgu**

GeoLiveClock mount olduğunda client-timezone route’unu çağırır. Route, proxy header’larından IP çıkarır, FindIP hizmetine gönderir ve IP anahtarlı cache’te altı saate kadar tutar.

Kanıt:

- components/ui/GeoLiveClock.tsx:65-104
- app/api/client-timezone/route.ts:53-63
- app/api/client-timezone/route.ts:170-199
- app/api/client-timezone/route.ts:208-227

**Dış kullanıcı/iş etkisi**

- Kullanıcı yalnızca saat gördüğünü düşünürken IP’si üçüncü tarafa aktarılır.
- Privacy notice, amaç, hukuki dayanak, saklama ve üçüncü taraf aktarım açıklaması yoktur.
- Türkiye/AB dahil farklı bölgelerde uyum riski doğar.

**Kapanış ölçütü**

- Salt timezone için öncelikle browser Intl timeZone kullanılmalıdır.
- Şehir/IP geolocation gerekli değilse kaldırılmalıdır.
- Gerekliyse açık ihtiyaç, uygun hukuki temel/opt-in, privacy notice, retention ve vendor değerlendirmesi tamamlanmalıdır.
- Cache anahtarlarında ham IP kullanımının gerekliliği ve minimizasyonu değerlendirilmelidir.

### P0-08 — Kaynak attribution ve lisans kapısı tamamlanmamış

**Doğrudan bulgu**

Intel Watch basemap tanımı attribution metni içerir; IntelWatchMap ise attributionControl:false ile başlatılır ve diğer globe bileşenlerinde olduğu gibi sonradan AttributionControl eklemez.

Paketli airbase, port, nuclear facility ve chokepoint veri setlerinde kaynak/freshness sunumu da ekranlar arasında tutarlı değildir.

Kanıt:

- components/intel-watch/echisCommandBasemap.ts:63-84
- components/intel-watch/IntelWatchMap.tsx:673-685
- components/maplibre/MapLibreGlobe.tsx:1854-1858
- components/intel-watch/IntelWatchMap.tsx:361-430

**Dış kullanıcı/iş etkisi**

- Harita sağlayıcısı şartları ihlal edilebilir.
- Kullanıcı statik katmanın kaynağını, yaşını ve doğruluğunu değerlendiremez.
- Yeniden dağıtılan veri setlerinin lisans yükümlülükleri belirsiz kalır.

**Kapanış ölçütü**

- Her harita yüzeyinde görünür provider attribution bulunmalıdır.
- Tüm üçüncü taraf veri setleri için kaynak, lisans, attribution metni, veri tarihi, yenileme yöntemi ve redistribüsyon izni kaydedilmelidir.
- Public Sources/Methodology sayfasında kullanıcıya uygun özet sunulmalıdır.
- Hukuki doğrulama olmadan public release yapılmamalıdır.

### P0-09 — Kaynak yönetişimi ile “live” ürün iddiası uyuşmuyor

**Doğrudan bulgu**

- data/sources/sourceDefinitions.ts içinde 137 kaynak tanımı vardır.
- 137 kaynağın tamamı candidate_test statüsündedir.
- Bunların 130’u RSS, 7’si API erişim tipindedir.
- Runtime default listesi 97 source ID içerir.
- Monitor açılışı sabit “63 SOURCES” ifadesini kullanır.

**Dış kullanıcı/iş etkisi**

- “Aktif runtime” ile “editoryal olarak onaylı production source” aynı şeymiş gibi davranılır.
- Kaynak sayısı ürünün farklı yerlerinde farklı anlam taşır.
- Son inceleme tarihi, lisans, çalışma oranı, editoryal risk ve sahibi olmayan kaynaklar production’a taşınabilir.

**Kapanış ölçütü**

Her kaynak için en az şu yaşam döngüsü gerekir:

1. Candidate
2. Technical test passed
3. Editorial/legal reviewed
4. Production active
5. Degraded
6. Suspended
7. Retired

Ek olarak owner, lastReviewedAt, nextReviewAt, license, geography/language, bias/state-affiliation, expected cadence, lastSuccessAt ve reliability geçmişi tutulmalıdır. Public sayı yalnızca tanımlı metriği göstermelidir: örneğin “son 24 saatte başarıyla veri alınan production sources”.

### P0-10 — Temel klavye erişimi görünmeyen kontroller nedeniyle bozulabiliyor

**Doğrudan bulgu**

- Bazı harita/yüzeyler aktif değilken yalnızca opacity:0 ve pointerEvents:none ile görünmez yapılır.
- Floating kartlar ve SignalsPanel mount edilmiş kalır.
- İçlerindeki butonlar tab sırasından çıkarılmaz.
- İnaktif alanlarda inert, hidden veya conditional unmount kullanılmaz.

Kanıt:

- components/layout/AppShell.tsx:603-610
- components/layout/AppShell.tsx:658-723
- components/layout/AppShell.tsx:833-857
- components/signals/SignalsPanel.tsx:297-324

**Dış kullanıcı/iş etkisi**

- Tab tuşu görünmeyen kontrollere gider.
- Kullanıcı odağın kaybolduğunu düşünür.
- Klavyeyle temel ekran navigasyonu güvenilir değildir.

**Kapanış ölçütü**

- İnaktif yüzeyler unmount edilmeli veya inert + aria-hidden kullanılmalıdır.
- Görünüm değişiminde odak yeni ekran başlığına taşınmalıdır.
- Tüm ana akışlar yalnızca klavyeyle E2E test edilmelidir.
- Erişilebilirlik gate’i public release kriteri olmalıdır.

### P0-11 — Güvenli oturum, hesap ve yerel kayıt beklentisi gerçeği yansıtmıyor

**Doğrudan bulgu**

- Açılış “SECURE SESSION” gösterir.
- Header sabit AB avatarı gösterir; gerçek account/auth yoktur.
- Exit devre dışıdır.
- Bookmarks ve Intel Watch verileri yalnızca localStorage’da tutulur.
- Kullanıcıya “bu cihaz/tarayıcıya özeldir, senkronize edilmez” açıklaması verilmez.

**Dış kullanıcı/iş etkisi**

- Kullanıcı araştırmasının hesaba bağlı, yedekli veya başka cihazda erişilebilir olduğunu sanabilir.
- Tarayıcı verisi temizlenince çalışma kaybolur.
- “Secure session” doğrulanamayan güvenlik beklentisi yaratır.

**Kapanış ölçütü**

- Auth yoksa avatar, exit ve secure-session dili public sürümden çıkarılmalıdır.
- Yerel kayıtlar açıkça “this browser/device only” etiketi taşımalıdır.
- Storage hata/quota durumu görünür olmalı; export/backup akışı sunulmalıdır.
- Auth/sync gelecekse kimlik, tenant, sahiplik, paylaşım ve retention kararları backend öncesi verilmelidir.

### P0-12 — OSINT kullanım sınırı, yöntem ve düzeltme mekanizması yok

**Doğrudan bulgu**

Üründe hassas askerî/watchlist uçuşları, airbase, chokepoint, port ve nuclear facility katmanları; otomatik severity/confidence sınıfları ve coğrafi çıkarımlar bulunur. Buna karşın görünür:

- Methodology
- Acceptable Use
- Privacy
- Terms
- Data limitations
- Correction/appeal
- Harm-reduction
- “Not for operational targeting/safety decisions”

çerçevesi yoktur. Contact içinde correction kategorisi görünse de form gerçekte çalışmaz.

**Dış kullanıcı/iş etkisi**

- Kullanıcı aracın sınırlarını bilmez.
- Yanlış konum/etiket/iddia için işleyen düzeltme yolu yoktur.
- Hassas veriler amaç dışı kullanım için daha kolay yanlış yorumlanabilir.

**Kapanış ölçütü**

- Kullanım amacı ve yasaklanan kullanım senaryoları yazılı hale getirilmelidir.
- Her içerikte source/provenance ve correction/report aksiyonu bulunmalıdır.
- Hassas konumların hassasiyet, gecikme, genelleştirme ve retention politikası belirlenmelidir.
- Hukuk, güvenlik ve etik gözden geçirme public release gate’i olmalıdır.

---

## 9. P1 — Backend öncesi karara bağlanması gereken yüksek öncelikli bulgular

### 9.1 URL, geri tuşu ve paylaşılabilir araştırma bağlamı yok

Tek app/page.tsx ve AppShell local state yapısı nedeniyle ekranlar gerçek route değildir. Kullanıcı:

- Geri/ileri tuşuyla ürün içi gezinemez.
- Yenilemede Monitor’a döner.
- Belirli olay, dossier, kaynak, filtre veya harita görünümünü paylaşamaz.
- Ekran değiştirince bazı seçim ve filtrelerini kaybeder.

Kanıt:

- app/page.tsx:4-9
- components/layout/AppShell.tsx:110-129
- components/layout/AppShell.tsx:369-494
- components/layout/AppShell.tsx:889-931

**Önerilen sonuç:** Route segmentleri veya doğrulanmış query-state; paylaşılabilir item URL’si; back/forward; ekran bazlı title/metadata; state’in açıkça resetlenmesi.

### 9.2 Masaüstü varsayımı ürün kararı olarak tanımlanmamış

Kod:

- html/body scroll’unu kapatır.
- AppShell’i h-screen/w-screen/overflow-hidden tutar.
- Sabit 68 px rail, 372 px sağ panel, 206–430 px kolonlar kullanır.
- Header’da marka, yedi tab, saat ve sağ kontrolleri tek satıra koyar.
- Intel Watch 820 px altında yalnız küçük bir daraltma yapar.

Bu nedenle telefon, tablet, split-screen, küçük laptop ve yüzde 200 zoom’da içerik kesilme riski yüksektir.

**Önerilen sonuç:** Ya açıkça minimum viewport ve desktop-only kapısı tanımlanmalı ya da mobil/dar ekran için gerçek drawer, bottom-sheet, collapse rail ve tek kolon akış tasarlanmalıdır. Public genel kullanıcı hedefleniyorsa responsive destek zorunludur.

### 9.3 Kontrast ve yazı ölçeği düşük görüş riski taşıyor

Statik token hesabında koyu zemin üzerinde:

- c-t4 yaklaşık 3.61:1
- c-t5 yaklaşık 2.11:1
- c-t6 yaklaşık 1.55:1

değerindedir. Bu renkler 8–13 px metadata ve kontrol metinlerinde yaygın kullanılır. Normal metin için 4.5:1 hedefi karşılanmayabilir.

Kanıt:

- app/globals.css:278-295
- app/globals.css:119-129
- app/globals.css:335-341
- components/cyber/ThreatContextPanel.tsx:7-26
- components/airtrack/AirTrackListPanel.tsx:175-202

**Önerilen sonuç:** Render edilmiş ekranlarda otomatik + manuel kontrast denetimi; t5/t6’nın yalnız dekoratif/disabled kullanımı; kritik metadata’nın daha büyük ve yüksek kontrastlı hale getirilmesi.

### 9.4 Fareye bağımlı kartlar ve eksik form/modal semantiği

- Policy, Cyber, Defense ve Sources satırlarının bir bölümü div onClick kullanır; keyboard handler/tabIndex yoktur.
- Contact label metinleri gerçek label değildir.
- Arama alanlarının bazıları yalnız placeholder kullanır ve outline kaldırır.
- Modal’larda role=dialog ve Escape olumlu olsa da initial focus, focus trap, restore, inert background ve aria-labelledby yoktur.
- Pin to Watch butonu görünür fakat onClick içermez.
- Direct channel’lar link değildir.

**Önerilen sonuç:** Native button/link/input/label kullanımı; standart dialog primitive; tüm aksiyonlarda focus-visible; automated axe + keyboard E2E.

### 9.5 Otomatik hareket reduced-motion tercihini tam izlemiyor

Three ve MapLibre globe’ları sürekli requestAnimationFrame döngüsüyle auto-rotate eder. CSS’te reduced-motion kuralları bulunmasına rağmen JavaScript globe loop’larında matchMedia kontrolü yoktur. Loader video, shimmer ve pulse animasyonları da tamamen kapsanmamıştır.

**Önerilen sonuç:** Görünür pause/stop; prefers-reduced-motion altında auto-rotate, autoplay, shimmer, pulse ve smooth hareketin kapanması; tercihin uygulama genelinde ortak motion policy olması.

### 9.6 Public Sources ekranı ile operasyon konsolu ayrılmalı

Sources sekmesi:

- Runtime sources
- Errors need fix
- Missing API key
- Endpoint/feed URL
- Config/test/candidate statüsü
- Refresh kontrolleri

gibi iç operasyon dilini dış kullanıcıya gösterir.

**Önerilen sonuç:** İki farklı ürün:

1. Public Sources & Methodology: kaynak sahibi, ülke, dil, kapsam, editoryal bağlam, lisans, gecikme, son başarılı alım, state-affiliation ve yöntem.
2. Admin Source Operations: endpoint, anahtar, hata, retry, runtime metrik ve aday onayı.

### 9.7 Başlangıç request fan-out’u kontrolsüz büyüyor

Mevcut tanımlara göre:

- Global provider default listesinde 97 kaynak vardır.
- AppShell Cyber, Defense ve Policy feedlerini de önceden yükler.
- Bu hook’larda sırasıyla yaklaşık 18, 14 ve 17 kaynak bulunur.
- Böylece açılışta tanımlı task sayısı 146 seviyesine ulaşabilir.
- Global ekran açıkken tüm kaynaklar 120 saniyede bir yeniden tetiklenebilir.
- RSS parse limiti kaynak başına 150 item’dır.

Kanıt:

- data/source-intelligence/sourceRegistry.ts:38-152
- components/source-intelligence/SourceIntelligenceProvider.tsx:487-515
- components/layout/AppShell.tsx:140-146
- components/cyber/useCyberNewsFeed.ts:8-27
- components/defense-industry/useDefenseIndustryFeed.ts:14-29
- components/policy/usePolicyFeed.ts:14-32
- components/source-intelligence/useSourceFeedAutoRefresh.ts:23-78

**Önerilen sonuç:** Aktif ekran bazlı fetch; 6–10 concurrency sınırı; backpressure; ortak dedup/cache; server aggregate; top-N/pagination; kullanıcı ve upstream başına bütçe.

### 9.8 Başlangıç bundle ve statik asset bütçesi yüksek

Doğrudan bulgular:

- AppShell tüm büyük ekranları statik import eder.
- Repo içinde next/dynamic veya React.lazy kullanımı yoktur.
- Three, MapLibre, Intel Watch, Air Track ve diğer ekranlar tek client dependency graph’ına bağlanır.
- Mevcut derleme ara çıktısında app/page entry yaklaşık 2,30 MB ham JavaScript, yaklaşık 600 KB gzip ve yaklaşık 130 KB CSS göstermektedir.
- Büyük public varlıklar:

| Dosya | Yaklaşık boyut |
|---|---:|
| public/data/home-globe.geojson | 3,16 MB |
| public/data/home-globe-admin1.geojson | 2,27 MB |
| public/data/ports.geojson | 1,08 MB |
| public/globe-loader.webm | 1,06 MB |
| public/data/airbases.geojson | 0,61 MB |
| public/data/home-globe-labels.json | 0,19 MB |
| public/data/nuclear-facilities.geojson | 0,18 MB |

**Önerilen sonuç:** Screen-level dynamic import; MapLibre/Three/Intel/AirTrack’in ihtiyaç anında yüklenmesi; GeoJSON simplify/TopoJSON/binary/parçalı yükleme; bundle, LCP ve INP bütçeleri. Build düzeldikten sonra temiz production artifact ile yeniden ölçüm.

### 9.9 Büyük bileşenler değişiklik riskini artırıyor

Yaklaşık en büyük dosyalar:

| Dosya | Satır |
|---|---:|
| data/sources/sourceDefinitions.ts | 3.049 |
| components/intel-watch/IntelWatchMap.tsx | 2.894 |
| components/maplibre/MapLibreGlobe.tsx | 2.370 |
| data/source-intelligence/geo/locationResolver.ts | 1.331 |
| components/sources/SourcesScreen.tsx | 1.245 |
| components/map/EchisGlobe.tsx | 1.243 |
| components/source-intelligence/SourceGlobalFeedPanel.tsx | 1.214 |
| components/airtrack/AirTrackGlobe.tsx | 943 |
| components/layout/AppShell.tsx | 884 |

Satır sayısı tek başına kalite problemi değildir; ancak bu dosyalarda rendering, state, veri dönüştürme, interaction, storage ve lifecycle sorumlulukları birlikte tutulmaktadır.

**Önerilen sonuç:** Önce characterization test; sonra pure constants/types, data adapter, controller hook, presentation ve map renderer ayrımı. Büyük bir “rewrite” yerine davranışı koruyan kademeli bölme.

### 9.10 Stil sistemi parçalı ve CSP’yi zorlaştırıyor

Mevcut snapshot’ta yaklaşık:

- 773 style={{...}} kullanımı
- 6 gömülü style etiketi
- 266 hex renk kullanımı

bulunmaktadır. Contact, Intel Watch, Sources ve Global Feed kendi alt tasarım dillerini taşır. Bu durum:

- Tema tutarlılığı
- Focus/contrast standardı
- Responsive bakım
- CSP nonce/hash planı
- Görsel regresyon

alanlarını zorlaştırır.

**Önerilen sonuç:** Ortak token + component primitive; screen bazlı CSS module/Tailwind katmanı; inline stilin yalnız dinamik geometri için kalması.

### 9.11 Global hata izolasyonu ve güvenli storage katmanı yok

- app/error.tsx, app/global-error.tsx, app/loading.tsx ve app/not-found.tsx yoktur.
- Tek client tree hatası tüm dashboard’u etkileyebilir.
- Bookmarks localStorage erişimlerinin bir kısmı try/catch ve fallback olmadan yapılır.
- Quota veya privacy mode storage hatası uygulamayı düşürebilir.

**Önerilen sonuç:** Screen boundary + global error boundary; retry/reference ID; versioned safe storage adapter; memory fallback; quota feedback; storage event ile sekmeler arası senkron.

### 9.12 Testler var, fakat release sistemi yok

Olumlu olarak dört self-contained test harness’i toplam 114 assertion ile geçmektedir. Ancak:

- package.json içinde test ve typecheck script’i yoktur.
- CI workflow yoktur.
- UI, hooks, routes, storage, maps ve error paths kapsam dışıdır.
- E2E, accessibility ve visual regression yoktur.

**Önerilen sonuç:** npm scripts + CI sırası:

1. npm ci
2. lint
3. typecheck
4. unit/integration
5. route/security tests
6. E2E smoke
7. accessibility
8. build
9. bundle budget

### 9.13 Operasyon hazırlığı eksik

Mevcut projede görünür:

- Node/package manager runtime pin
- Health/readiness endpoint
- Structured logging
- Error tracking
- Performance telemetry
- Release/version göstergesi
- Deploy/runbook
- Rollback prosedürü
- Uptime/source health alarmı

yoktur.

**Önerilen sonuç:** Production ortamı seçilmeden önce gözlemlenebilirlik gereksinimleri tanımlanmalı; backend’e sonradan eklenen bir yan iş olarak görülmemelidir.

### 9.14 README ve yaşayan dokümantasyon gerçek ürünle uyuşmuyor

README hâlâ Create Next App başlangıç metnidir ve Geist fontundan söz eder; gerçek uygulama farklı font aileleri kullanır. Güncel ağaç build olmazken mevcut eski denetim dokümanında build’in geçtiği yazmaktadır.

**Önerilen sonuç:** Tek bir yaşayan README:

- Ürün amacı ve hedef kullanıcı
- Veri türleri
- Local setup
- Yalnızca env değişken adları
- Scriptler
- Mimari harita
- Failure modes
- Test/build komutları
- Deploy/runbook bağlantısı
- Güvenlik ve disclosure süreci

---

## 10. P2 — Profesyonellik ve verim iyileştirmeleri

### 10.1 Navigasyon ve ürün hiyerarşisi

- Monitor, Global View ve SOCMINT Watch ilişkisi ilk bakışta açık değildir.
- Header ve rail aynı seviyede iki farklı navigasyon sistemi gibi görünür.
- Air Track/Bookmarks açıldığında header’da Monitor aktif görünebilir.
- Rail semantic nav ve aria-current kullanmaz.
- Coming soon hedefleri ana nav’da olgunluk algısını düşürür.

**İyileştirme:** Birincil modüller, çalışma alanları ve yardımcı sayfalar ayrılmalı; breadcrumb/screen title ve tek active-state modeli kullanılmalıdır.

### 10.2 Terminoloji

Report, signal, item, event, news, intelligence ve dossier terimleri ekranlar arasında farklı nesneler için karışır. “Source” hem yayıncı hem runtime adapter anlamına gelir.

**İyileştirme:** Ürün veri sözlüğü hazırlanmalı. Her nesnenin tek adı, veri durumu ve kullanıcıya dönük açıklaması olmalıdır.

### 10.3 Onboarding ve glossary

SOCMINT, OSINT, CIV, MIL, WL, RSS, geo basis ve corroboration ilk kullanımda açıklanmaz.

**İyileştirme:** İlk kullanım turu, yöntem/glossary, veri durumu legend’i ve “nasıl doğrularım?” akışı.

### 10.4 Tıklama hedefleri

Bazı ikon kontrolleri 18–22 px düzeyindedir.

**İyileştirme:** Görsel ikon küçük kalabilir; interaktif alan en az 28–32 px, kritik hedeflerde WCAG 2.2 minimum 24×24 px olmalıdır.

### 10.5 Harita popup collision

Marker popup sabit 248 px genişlik ve doğrudan x/y projeksiyonu kullanır; kenarda kesilebilir.

**İyileştirme:** Flip/shift/clamp collision; dar ekranda bottom-sheet.

### 10.6 Destructive action standardı

Bookmarks Clear tek adımda tüm kayıtları siler; Intel Watch’ta ise iki adımlı örnek vardır.

**İyileştirme:** Ortak confirm veya undo toast standardı.

### 10.7 Dış bağlantı semantiği

Bazı dış kaynak aksiyonları button + window.open kullanır.

**İyileştirme:** Gerçek anchor; kopyalama, context menu, yeni sekme ve erişilebilir link semantiği.

### 10.8 Metadata ve paylaşım

Document title sabit ECHIS’tir; ekran bağlamı, Open Graph ve sosyal paylaşım metadata’sı yoktur.

**İyileştirme:** Route/state bazlı title ve paylaşım önizlemesi.

### 10.9 Font bütçesi

Beş font ailesi ve çok sayıda weight global yüklenir; mevcut output’ta yaklaşık 40 woff2 ve 580 KB font yükü görülmüştür.

**İyileştirme:** Ekrana özel serifleri defer etmek, variable/subset kullanmak ve weight sayısını azaltmak.

### 10.10 GeoJSON import limiti

Intel Watch importunda dosya boyutu, feature sayısı ve coordinate limiti görünür değildir.

**İyileştirme:** Dosya/feature/coordinate cap, worker parse, progress ve güvenli hata mesajı.

---

## 11. Dış kullanıcı yolculuğu açısından değerlendirme

### 11.1 İlk giriş

**Olumlu**

- Güçlü, premium ve amaca uygun bir ilk izlenim.
- Harita hareketi ve yoğun UI, ürünün teknik derinliğini gösterir.

**Sorun**

- Kullanıcı ürünün medya izleme aracı mı, analist çalışma alanı mı, operasyonel tracker mı olduğunu anlayamaz.
- Rastgele sinyaller ve sabit metrikler canlı veri izlenimi verir.
- “Secure session” auth varmış gibi algılanabilir.

### 11.2 Navigasyon

**Olumlu**

- Ana modüller görünür ve erişim hızlıdır.

**Sorun**

- İki nav katmanının ilişkisi açıklanmaz.
- Soon kontrolleri ana akışta gürültü oluşturur.
- Back/forward ve URL yoktur.
- Ekran değişimi araştırma bağlamını sıfırlayabilir.

### 11.3 Bir içeriği anlama

**Olumlu**

- Global View’de provenance ayrıntısı güçlüdür.
- Cyber türetim dili kısmen şeffaftır.

**Sorun**

- Aynı renk/etiket farklı ekranlarda farklı kanıt gücü anlamına gelir.
- Freshness her yerde görünür değildir.
- İnference ile verified fact ayrımı standart değildir.

### 11.4 Bir içeriği doğrulama

**Olumlu**

- Bazı ekranlarda orijinal kaynak açılır.
- State-affiliated source işaretleri ve geo evidence örnekleri vardır.

**Sorun**

- Policy/Defense/SOCMINT boyunca kaynak ve yöntem standardı değişir.
- Corroboration bağımsız teyit sanılabilir.
- Düzeltme/itiraz akışı çalışmaz.

### 11.5 Araştırmayı kaydetme ve sürdürme

**Olumlu**

- Bookmarks ve Intel Watch local workspace kullanılabilir.
- Intel Watch import/export değerlidir.

**Sorun**

- Verinin yalnızca bu browser’da kaldığı açıklanmaz.
- Bookmarks için güvenli export/sync yoktur.
- Hesap avatarı yanlış senkron beklentisi yaratır.
- Spesifik araştırma URL ile paylaşılamaz.

### 11.6 Yardım ve iletişim

**Sorun**

- Onboarding, help, methodology ve glossary yoktur.
- Contact başarısı gerçek değildir.
- Correction/security disclosure için güvenilir kanal yoktur.

Bu son adım, dış kullanıcının güvenini belirleyen en kritik kırılmadır.

---

## 12. Erişilebilirlik denetimi özeti

### 12.1 Kritik açıklar

- Görünmeyen mount edilmiş yüzeylerde tab stop
- Fareye bağımlı kart/satırlar
- Contact alanlarında programatik label eksikliği
- Sonuç ve loading durumlarında aria-live eksikliği
- Modal focus trap/initial focus/restore eksikliği
- Arama inputlarında label ve focus-visible eksikliği
- Otomatik hareket için pause/reduced-motion eksikliği
- Düşük kontrastlı 8–13 px metadata

### 12.2 Olumlu örnekler

- Bazı dialog’larda role=dialog, aria-modal ve Escape vardır.
- Bookmark butonları ve bazı toggle’lar aria-pressed kullanır.
- Birçok ikon kontrolünün aria-label’i vardır.
- Reduced-motion CSS kuralları en azından kısmi bir temel sağlar.

### 12.3 Release kabul standardı

Public ürün için minimum:

- WCAG 2.2 AA hedefi
- Keyboard-only smoke
- Screen reader: NVDA + Chromium/Firefox; VoiceOver + Safari
- 200% zoom
- 320 CSS px veya açık desktop-only support gate
- Axe/Accessibility Insights otomasyonu
- Manuel kontrast ve motion testi
- Tüm dialog/form/error/loading akışlarında odak ve duyuru testi

---

## 13. Responsive ve görsel sistem değerlendirmesi

### 13.1 Responsive karar

Mevcut kod mobil-first veya adaptive değildir. Bir desktop operator dashboard’u olarak tasarlanmış görünmektedir. Bu tek başına kusur değildir; kusur, destek sınırının ürün tarafından açıklanmamasıdır.

İki geçerli yol vardır:

**Yol A — Desktop-only profesyonel araç**

- Minimum desteklenen viewport açıkça belirtilir.
- Daha dar ekranda içerik kırılmak yerine destek mesajı gösterir.
- Yüzde 200 zoom ve küçük laptop hâlâ erişilebilir olur.

**Yol B — Genel kullanıma responsive ürün**

- Header mobile menu olur.
- Rail collapse/drawer olur.
- Sağ/sol paneller bottom-sheet veya tek kolon olur.
- Harita + detay geçişleri route/state ile yönetilir.
- 100dvh ve scroll bölgeleri açıkça tasarlanır.

Backend başlamadan hangisinin hedef olduğu kararlaştırılmalıdır; aksi halde payload, pagination ve ekran kontratları yanlış kullanım modeline göre tasarlanabilir.

### 13.2 Görsel sistem

Güçlü tema tokenları olmasına rağmen ekranlar aynı ürün içinde ayrı handoff’ların portları gibi davranabilir:

- Contact kendi hard-coded sistemine sahiptir.
- Intel Watch --iw-* tokenları ve çok küçük ölçek kullanır.
- Cyber/Defense ortak sisteme daha yakındır.
- Policy serif ve zoom temelli ayrı bir yoğunluk kurar.

**Öneri:** Ortak page header, panel, CTA, form, status, empty/error, modal, focus, typography ve spacing primitive’leri. Modüllerin karakteri korunabilir; temel etkileşim dili aynı olmalıdır.

---

## 14. Performans ve ölçeklenebilirlik değerlendirmesi

### 14.1 Mevcut risk profili

- Yaklaşık 147 TS/TSX dosyası ve 40 binin üzerinde kod satırı
- 56 client component
- Tek route ve büyük statik client import graph’ı
- Screen-level dynamic import yok
- Çok sayıda kaynak task’ı
- Büyük GeoJSON ve video varlıkları
- Sürekli çalışan RAF map/globe loop’ları
- Yoğun inline style ve büyük component dosyaları

### 14.2 Muhtemel kullanıcı etkisi

- İlk açılışta uzun JavaScript parse/execute
- Düşük donanımda harita ile feed render’ının yarışması
- Mobil veri ve düşük bantta yüksek transfer
- API kotalarının hızlı tüketilmesi
- Upstream kaynaklara gereksiz tekrar yük
- Ekran görünmese bile preload maliyeti
- Çok büyük Intel importlarında ana thread donması

### 14.3 Ölçülmesi gereken bütçeler

Backend seçilmeden önce hedef cihaz ve ağ profili tanımlanmalı:

| Metrik | Başlangıç hedefi önerisi |
|---|---|
| Initial JS gzip | Masaüstü dashboard için ölçülmüş ve gerekçeli bütçe; screen chunk’ları ayrılmalı |
| LCP | p75 altında 2,5 saniye hedefi |
| INP | p75 altında 200 ms hedefi |
| CLS | 0,1 altında |
| Source concurrency | 6–10 arası kontrollü |
| Refresh | Kaynak cadence/freshness’e göre; toplu sabit poll değil |
| GeoJSON parse | Worker veya parça bazlı; ana thread long-task bütçesi |
| Memory | Uzun açık oturum ve tab değişimleriyle ölçülmeli |

Bu değerler mutlak sözleşme değil, gerçek kullanıcı profiliyle doğrulanacak başlangıç kapılarıdır.

---

## 15. Frontend mühendislik ve bakım değerlendirmesi

### 15.1 Mimari güçlü taraflar

- Domain klasörleri Cyber, Defense, Policy, Air Track ve source intelligence ayrımını büyük ölçüde yansıtır.
- Type modelleme birçok alanda ayrıntılıdır.
- Heuristic motorların testleri vardır.
- Worker ve adapter kavramları doğru yöndedir.

### 15.2 Mimari borç

- AppShell hem navigation hem screen lifecycle hem harita state’i hem seçimleri yönetir.
- Devasa harita bileşenleri controller, renderer, storage ve UI sorumluluklarını karıştırır.
- Ortak veri durumu sözleşmesi yerine ekran bazlı özel modeller vardır.
- Integration klasörü yaşayan bir staging kopyası olarak derleme alanını bozar.
- Derleme/runtime sınırı ve fixture politikası net değildir.

### 15.3 Refactor yaklaşımı

Önerilen sıra:

1. Davranış characterization testleri
2. Saf type/constant modülleri
3. Veri adapter ve status contract’ı
4. Controller hook’ları
5. Presentation component’leri
6. Map renderer/layer modülleri
7. Screen-level lazy loading

Tek seferde büyük yeniden yazım önerilmez.

---

## 16. Güvenlik, gizlilik ve içerik yönetişimi

### 16.1 Mevcut olumlu kontroller

- .env dosyaları ignore edilir; sırlar istemciye açıkça yazılmamıştır.
- Bazı source route’larında allowlist, timeout, cache ve body cap vardır.
- X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy ve HSTS eklenmiştir.
- External URL sanitize uygulamaları mevcuttur.

### 16.2 Eksikler

- GDELT HTTP fallback
- Redirect hop doğrulaması
- CSP yok; kod yorumunda bilinçli olarak ertelenmiş
- Rate limit/release ortamı politikası net değil
- Privacy/Terms/Acceptable Use yok
- IP transfer açıklaması yok
- Data retention/deletion yok
- Source license/freshness inventory public değil
- Security disclosure kanalı çalışmıyor
- Structured security logging ve alarm yok

### 16.3 CSP yaklaşımı

CSP doğrudan enforce edilmeden önce:

1. Tüm tile, font, worker, image ve connect hostları envantere alınmalı.
2. Inline style/script ihtiyacı azaltılmalı.
3. Report-Only uygulanmalı.
4. İhlaller staging’de gözlenmeli.
5. Nonce/hash ve açık allowlist ile enforce edilmelidir.

Haritanın kararmaması önemli olmakla birlikte CSP’nin süresiz ertelenmesi uygun değildir.

---

## 17. Backend başlamadan önce verilmesi gereken ürün kararları

Bu bölüm bir görev listesi değil, backend veri modeli ve API sözleşmesini belirleyen karar kapılarıdır.

### Karar 1 — Yayın modeli

- İç araç
- Davetli kapalı beta
- Public read-only
- Public + kullanıcı hesabı
- Kurumsal/tenant tabanlı

Auth, rate limit, saklama, paylaşım ve gözlemlenebilirlik buna göre değişir.

### Karar 2 — Ürünün birincil kullanıcısı

- Genel haber takipçisi
- OSINT araştırmacısı
- Güvenlik analisti
- Kurumsal risk ekibi
- Savunma/politika analisti

Her persona için bilgi yoğunluğu, mobil ihtiyacı, açıklama seviyesi ve veri gecikmesi farklıdır.

### Karar 3 — Ortak veri durum sözleşmesi

Her item için en az:

- sourceType
- sourceUrl
- collectedAt
- publishedAt
- observedAt
- lastSuccessfulRefreshAt
- freshnessState
- dataMode: live / cached / static / simulated / user-generated
- derivationState: raw / normalized / inferred / estimated / verified
- method ve methodVersion
- confidenceType
- evidence/provenance
- correctionStatus

tanımlanmalıdır.

### Karar 4 — Identity ve workspace

- Auth olacak mı?
- Bookmark ve Intel Watch kime ait?
- Senkron olacak mı?
- Tenant/team paylaşımı olacak mı?
- Export/delete/retention nasıl işleyecek?
- Anonymous local mode korunacak mı?

### Karar 5 — URL ve paylaşım modeli

- Hangi ekranlar route olacak?
- Item ID kalıcı mı?
- Share URL hangi private veriyi açığa çıkarabilir?
- Filter/query URL’de ne kadar tutulacak?
- Link ömrü ve access control ne olacak?

### Karar 6 — Source governance

- Production’a kim kaynak alır?
- Teknik ve editoryal onay ayrı mı?
- Lisans sahibi kim?
- State-affiliation/bias nasıl açıklanır?
- Source failure ne zaman degrade/suspend eder?
- Review cadence nedir?

### Karar 7 — Inference ve verification

- Hangi çıktı yalnızca rule-based classification?
- Hangisi corroboration?
- Hangisi analyst-reviewed?
- Hangisi verified fact?
- Kullanıcı bu farkı nasıl görecek?

### Karar 8 — Privacy ve retention

- IP gerekli mi?
- Hangi event/log tutulacak?
- Contact mesajı ne kadar saklanacak?
- Watchlist veya workspace kişisel veri sayılabilir mi?
- Silme/export talebi nasıl karşılanacak?

### Karar 9 — Desteklenen cihaz ve erişilebilirlik

- Desktop-only mı?
- Minimum viewport?
- WCAG hedefi?
- Klavye/screen reader support?
- Motion policy?

### Karar 10 — Contact, correction ve incident response

- Hangi kanal gerçek?
- Ticket sistemi nedir?
- SLA gerçekçi mi?
- Security disclosure nasıl ayrılır?
- Yanlış konum/etiket düzeltmesi hangi item’a bağlanır?

Bu kararlar yazılı olmadan backend entity ve endpoint tasarımına başlamak önerilmez.

---

## 18. Backend’den önce, backend ile birlikte ve sonra ele alınabilecek alanlar

### Backend’den önce kapanması gerekenler

- Simulated/mock/live/static/inferred/estimated veri sözlüğü
- Yanıltıcı Monitor, SOCMINT ve Contact davranışları
- Secure/session/account iddiaları
- P0 build, TLS/redirect, privacy ve attribution konuları
- Yayın modeli ve hedef kullanıcı
- Route/deep-link kararı
- Desktop-only veya responsive kararı
- Source lifecycle ve production approval
- Accessibility minimum gate
- Methodology, Terms, Privacy, Acceptable Use ve correction çerçevesi

### Backend ile birlikte tasarlanması gerekenler

- Auth/tenant/workspace
- Bookmark ve Intel Watch sync
- Kalıcı item/event/source ID’leri
- Source health ve collection timestamps
- Fresh/stale/degraded status
- Contact/ticket delivery
- Audit trail ve correction workflow
- Rate limit, cache, queue ve backpressure
- Observability, incident ID ve structured logs
- Veri retention/delete/export

### Backend sonrasına kalabilecekler

- Theme switcher
- Ship Track ve Analytics gibi yeni modüller
- İleri seviye personalization
- Kozmetik mikro animasyonlar
- İkincil panel varyasyonları
- Gelişmiş ekip işbirliği, karar verilmiş MVP dışında ise

---

## 19. Önerilen yayın kapıları

### Gate A — Ürün doğruluğu

- [ ] Her ekran data mode’u doğru gösteriyor.
- [ ] Mock/simulated veri public build’de yok veya kalıcı etiketli.
- [ ] Confidence/corroboration/severity sözlüğü onaylı.
- [ ] Last successful update ve freshness görünür.
- [ ] Observed/estimated ayrımı uygulanmış.

### Gate B — Temel işlev

- [ ] Production build geçiyor.
- [ ] Tüm görünen CTA’lar çalışıyor veya gerçekten disabled.
- [ ] Contact gerçek teslimat ve hata yolu içeriyor.
- [ ] Back/forward/refresh/share akışları tanımlı.
- [ ] Local-only veri kullanıcıya açıkça anlatılıyor.

### Gate C — Erişilebilirlik ve responsive

- [ ] Görünmeyen tab stop yok.
- [ ] Tüm ana akışlar klavye ile tamamlanıyor.
- [ ] Modal focus lifecycle doğru.
- [ ] Form label/error/status duyuruları doğru.
- [ ] Kontrast ve target size kontrolleri geçiyor.
- [ ] Reduced-motion tüm canvas/video/animation alanlarını kapsıyor.
- [ ] Desteklenen viewport kararı uygulanmış.

### Gate D — Güvenlik ve gizlilik

- [ ] TLS downgrade kaldırılmış.
- [ ] Redirect SSRF kontrolleri test edilmiş.
- [ ] Privacy/Terms/Acceptable Use yayımlanmış.
- [ ] IP ve üçüncü taraf aktarımı kararı kapanmış.
- [ ] Lisans/attribution matrisi onaylanmış.
- [ ] CSP Report-Only ve enforce geçiş planı test edilmiş.
- [ ] Security disclosure kanalı çalışıyor.

### Gate E — Kalite ve operasyon

- [ ] CI: lint, typecheck, test, E2E, a11y, build.
- [ ] Branded error boundary ve retry.
- [ ] Health/readiness ve telemetry.
- [ ] Bundle/fetch bütçeleri geçiyor.
- [ ] Deploy/rollback/runbook hazır.
- [ ] README ve env dokümantasyonu güncel.

Kamuya açık production kararı için Gate A–E’nin tamamı kapanmalıdır.

---

## 20. Bulguların önceliklendirilmiş özeti

| ID | Bulgu | Seviye | Backend sözleşmesini etkiler mi? |
|---|---|---:|---:|
| P0-01 | Build/typecheck kırık | P0 | Hayır; release gate |
| P0-02 | Etiketsiz Monitor/SOCMINT simülasyonu | P0 | Evet; dataMode/provenance |
| P0-03 | Contact gerçek teslimat olmadan başarı veriyor | P0 | Evet; ticket/delivery |
| P0-04 | Confidence/corroboration/severity/live semantiği | P0 | Evet; ortak item/status modeli |
| P0-05 | Air Track observed/estimated ayrımı | P0 | Evet; tracking zaman modeli |
| P0-06 | HTTP downgrade ve redirect SSRF riski | P0 | Evet; fetch/security katmanı |
| P0-07 | Açıklanmayan IP aktarımı | P0 | Evet; privacy/log/retention |
| P0-08 | Attribution ve lisans kapısı | P0 | Evet; source metadata |
| P0-09 | Candidate source yönetişimi | P0 | Evet; source lifecycle |
| P0-10 | Görünmeyen klavye odakları | P0 | Hayır; frontend release gate |
| P0-11 | Secure session/account/local veri beklentisi | P0 | Evet; auth/workspace |
| P0-12 | Methodology/acceptable-use/correction yok | P0 | Evet; audit/correction |
| P1-01 | Deep-link/back/refresh yok | P1 | Evet; kalıcı ID ve erişim |
| P1-02 | Responsive destek kararsız | P1 | Kısmen; payload/pagination |
| P1-03 | Kontrast/küçük metin | P1 | Hayır |
| P1-04 | Kart/form/modal semantiği | P1 | Hayır |
| P1-05 | Reduced-motion eksik | P1 | Hayır |
| P1-06 | Public Sources ile ops konsolu karışık | P1 | Evet; admin role/source model |
| P1-07 | 97+ kaynak request fan-out’u | P1 | Evet; aggregate/cache/queue |
| P1-08 | Büyük bundle ve asset’ler | P1 | Hayır |
| P1-09 | Büyük bileşenler | P1 | Hayır |
| P1-10 | Parçalı stil sistemi | P1 | Hayır |
| P1-11 | Error boundary ve storage fallback yok | P1 | Kısmen |
| P1-12 | CI/release sistemi yok | P1 | Hayır |
| P1-13 | Operasyon/telemetry yok | P1 | Evet |
| P1-14 | Yaşayan dokümantasyon güncel değil | P1 | Hayır |

---

## 21. Sonuç ve profesyonel görüş

ECHIS’in temel problemi “yeterince özellik olmaması” değildir. Aksine ürün çok sayıda yüzeyi ve ileri seviye teknik bileşeni aynı anda taşımaktadır. Esas risk, bu genişliğin henüz ortak bir doğruluk, kullanıcı, durum, erişilebilirlik ve yayın sözleşmesine bağlanmamış olmasıdır.

Dış kullanıcı açısından en kritik soru şudur:

> Ekranda gördüğüm şey gerçek mi, güncel mi, doğrulanmış mı, tahmin mi, algoritmik çıkarım mı, demo mu ve kaynağına nasıl ulaşırım?

Mevcut sürüm bu soruya her ekranda aynı açıklıkta cevap verememektedir. Bu nedenle backend’e geçmeden önce yapılacak en değerli çalışma yeni özellik eklemek değil, ürünün kanıt ve güven modelini netleştirmektir.

### Nihai öneri

1. Kamuya açık yayın hazırlığını durdurun; ürünü şimdilik açıkça “internal prototype/demo” kabul edin.
2. P0-01 ile P0-12 arasındaki bulgular için sahip, karar ve kabul kanıtı belirleyin.
3. Backend’den önce veri durumu sözleşmesi, yayın modeli, kullanıcı/workspace, URL, source governance, privacy ve erişilebilirlik kararlarını kapatın.
4. Ardından bu rapordan ayrı, bağımlılık sıralı ve ölçülebilir bir “backend öncesi yapılacaklar listesi” oluşturun.
5. P0’lar kapandıktan sonra gerçek tarayıcı, farklı viewport, klavye, ekran okuyucu, ağ yavaşlatma ve gerçek production build ile ikinci bir doğrulama denetimi yapın.

Doğru sırayla ele alındığında mevcut kod tabanı çöpe atılması gereken bir prototip değildir. Güçlü harita deneyimi, canlı kaynak altyapısı, provenance örnekleri ve analist çalışma alanı korunarak; güvenilir, açıklanabilir ve profesyonel bir ürüne dönüştürülebilecek ciddi bir temel vardır. Ancak bugünkü haliyle kamuya açık production için objektif karar **NO-GO**’dur.

---

## 22. Kanıt dosyaları — hızlı referans

### Uygulama kabuğu ve navigasyon

- app/page.tsx
- app/layout.tsx
- app/globals.css
- components/layout/AppShell.tsx
- components/layout/HeaderNav.tsx
- components/layout/LeftRail.tsx

### Simülasyon, mock ve güven dili

- components/monitor/MonitorLanding.tsx
- data/socmintReports.ts
- components/signals/SignalsPanel.tsx
- components/contact/ContactScreen.tsx

### Kaynak, inference ve freshness

- data/source-intelligence/sourceRegistry.ts
- data/sources/sourceDefinitions.ts
- components/source-intelligence/SourceIntelligenceProvider.tsx
- components/source-intelligence/SourceGlobalFeedPanel.tsx
- lib/sourceintel/feedInsights.ts
- components/cyber/useCyberNewsFeed.ts
- components/defense-industry/useDefenseIndustryFeed.ts
- components/policy/usePolicyFeed.ts

### Air Track ve Intel Watch

- components/airtrack/AirTrackGlobe.tsx
- components/airtrack/AirTrackContactCard.tsx
- types/airtrack.ts
- components/intel-watch/IntelWatchMap.tsx
- components/intel-watch/echisCommandBasemap.ts

### Güvenlik ve gizlilik

- lib/sources/gdeltAdapter.ts
- lib/sources/rssPreviewAdapter.ts
- app/api/sources/rss-preview/route.ts
- components/ui/GeoLiveClock.tsx
- app/api/client-timezone/route.ts
- next.config.ts

### Kalite ve dokümantasyon

- package.json
- tsconfig.json
- eslint.config.mjs
- integration/ScreenGlobe.tsx
- README.md
- lib/sourceintel/__tests__/feedInsights.test.ts
- lib/policy/__tests__/policySignals.test.ts
- lib/defense/__tests__/defenseSignals.test.ts
- lib/cyber/__tests__/cyberSignals.test.ts

