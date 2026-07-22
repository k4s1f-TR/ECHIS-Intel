# ECHIS Canlı Küre Veri Yol Haritası

## Amaç

Karşılama küresi yalnızca gerçek, kamuya açık kaynaklardan gelen ve coğrafi
konumu yeterli güvenle çözümlenmiş kayıtları göstermelidir. Arayüzün veri
kaynağı değiştiğinde yeniden tasarlanmasını önlemek için bütün uygulamalar
`GlobeActivitySnapshot` sözleşmesini kullanır.

## Bugünkü geçiş aşaması

- RSS ve API kaynakları kullanıcı uygulamayı açtığında mevcut kaynak pipeline'ı
  tarafından toplanır.
- Normalize edilmiş, filtrelenmiş ve coğrafi konumu çözümlenmiş sonuçlar
  `GlobeActivitySnapshot` biçimine dönüştürülür.
- Karşılama küresi son 24 saat içinde coğrafi olarak kabul edilmiş gerçek
  kümelerin tamamını gösterir; yapay adet sınırı, uydurma olay veya dekoratif
  sahte marker üretmez.
- Snapshot; `loading`, `fresh`, `partial`, `stale` ve `unavailable` durumlarını
  destekler. Veri eskiyse noktalar korunabilir ancak arayüz bunu açıkça
  "stale" olarak belirtir.
- Bu aşamadaki `sourceMode` değeri `visitor_pipeline` olur. Bu, toplamanın henüz
  ziyaretçiden bağımsız çalışmadığını açıkça ifade eder.

## Üretim hedefi

Canlıya geçmeden önce ziyaretçiden bağımsız bir toplama hattı kurulmalıdır:

1. RSS kaynaklarını kaynak profiline göre 2–15 dakikalık aralıklarla kontrol
   eden zamanlanmış bir toplayıcı çalıştırılır.
2. HTTP `ETag` ve `Last-Modified` başlıkları mümkün olduğunda kullanılır.
3. Kaynak başına eşzamanlılık sınırı, zaman aşımı, artan bekleme ve rastgele
   gecikme uygulanır.
4. Kayıtlar bağlantı, başlık, kaynak ve yayın zamanı üzerinden tekrarlarından
   arındırılır.
5. Filtreleme, önem puanı ve coğrafi çözümleme ziyaretçi isteğinden bağımsız
   olarak sunucu tarafında tamamlanır.
6. Son geçerli snapshot kalıcı veritabanı/cache içinde saklanır. Uygulama
   yeniden başlasa veya birden fazla instance açılsa bile kaybolmaz.
7. `/api/globe/snapshot` benzeri salt-okunur bir endpoint son snapshot'ı,
   oluşturulma zamanını ve tazelik durumunu döndürür.
8. Üretimde `sourceMode` değeri `scheduled_collector` olur. Arayüz ve küre
   bileşenleri değiştirilmeden yalnızca snapshot sağlayıcısı değiştirilir.

## Snapshot sözleşmesi

Sözleşmenin kaynak dosyası `types/globe-activity.ts` dosyasıdır. Temel alanlar:

- `schemaVersion`: Geriye uyumlu sözleşme sürümü.
- `sourceMode`: Verinin ziyaretçi pipeline'ından mı, zamanlanmış toplayıcıdan mı
  geldiği.
- `state`: Tazelik/yükleme durumu.
- `generatedAt` ve `expiresAt`: Snapshot'ın üretim ve tazelik sınırı.
- `windowHours`: Kürede temsil edilen zaman aralığı.
- `totalItemCount` ve `geolocatedItemCount`: İşlenen ve haritalanabilen kayıtlar.
- `points`: Konum, kaynak, zaman, önem ve coğrafi güven bilgisi taşıyan gerçek
  aktivite kümeleri.

## Görsel davranış

- İmleç küre dışında veya boş alandayken gerçek snapshot kartları konumlarına
  ince çizgilerle bağlanır ve auto-rotate devam eder; dekoratif nabız kullanılmaz.
- Kabul edilen her aktivite kümesi için bir bilgi kartı üretilir; kartlar yapay
  bir adet sınırına göre elenmez, bağımsız zamanlamayla sırayla görünür ve kürenin
  arka yüzüne geçtiğinde doğal olarak gizlenir.
- Bir ülkenin üzerine gelindiğinde ülke vurgusu öncelik kazanır; hover auto-rotate
  davranışını durdurmaz.
- Ülke/bölge seçildiğinde aktivite noktaları geri çekilir, küre durur ve çalışma
  alanı rotaları açılır.
- Veri hazırlanırken sahte marker gösterilmez. Küre çalışır durumda kalır ve
  toplama durumu açıkça yazılır.
- Snapshot eskiyse "live" ifadesi kullanılmaz; son güncelleme zamanı gösterilir.
- RSS kaynağının ülkesi olayın gerçekleştiği ülke kabul edilmez. Yalnızca marker
  için kabul edilmiş coğrafi kanıtı bulunan kayıtlar küreye çıkar.

## Canlıya geçiş kontrol listesi

- [ ] Zamanlanmış RSS toplayıcısı
- [ ] Kalıcı snapshot deposu
- [ ] Dağıtık kilit ve çoklu-instance güvenliği
- [ ] Kaynak sağlık ve gecikme ölçümleri
- [ ] ETag / Last-Modified desteği
- [ ] Hata, zaman aşımı ve yeniden deneme politikası
- [ ] Snapshot endpoint'i ve cache başlıkları
- [ ] Eski snapshot saklama ve geri dönüş politikası
- [ ] Veri lisansı, kaynak gösterimi ve saklama süresi kontrolü
- [ ] Üretim yük ve hata senaryosu testleri
