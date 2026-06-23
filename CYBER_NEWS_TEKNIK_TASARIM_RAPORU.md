# Cyber News Görsel Teknik Tasarım Raporu

Hazırlanma tarihi: 23 Haziran 2026

Bu rapor, projedeki Cyber News ekranının **görsel teknik tasarımını** açıklar. Odak noktası; ekranda görünen renkler, gradientler, siyah zemin kullanımı, panel yüzeyleri, kart durumları, tipografi, boşluklar, harita görünümü ve görsel hiyerarşidir.

## 1. Görsel Tasarım Kimliği

Cyber News ekranı koyu, operasyonel ve premium bir siber istihbarat paneli gibi tasarlanmıştır.

| Görsel unsur | Teknik karşılığı | Kullanım amacı |
|---|---|---|
| Derin siyah zemin | `#060305`, `#030203`, `#060406` | Ekranı ciddi, odaklı ve komuta merkezi hissinde tutar. |
| Parlak kırmızı vurgu | `#ff2b3d` | Tehlike, alarm, aktif seçim ve kritik vurgu hissi verir. |
| Koyu kırmızı destek rengi | `#b3121f` | Gradient başlangıcı olarak kırmızıya derinlik katar. |
| Soğuk gümüş metin | `rgba(238,240,244,0.98)` ve alt tonlar | Siyah zemin üzerinde okunabilirlik ve premium görünüm sağlar. |
| Hafif cam/metal panel hissi | Transparan beyaz border, gölge ve karbon gradient | Panelleri düz siyah blok olmaktan çıkarır. |

Ana tema dosyası: `app/globals.css`

Cyber News'e özel tema scope'u:

```css
.cyber-premium
```

Bu sınıf `components/layout/AppShell.tsx` içinde ekranı sarar ve Cyber News renk sistemini aktif eder.

## 2. Siyah Zemin Kullanımı

Cyber News ekranında tam siyah yerine çok koyu, hafif kırmızı alt tonlu siyahlar kullanılır. Bu tercih kırmızı vurguların daha kaliteli ve güçlü görünmesini sağlar.

| Token / değer | Renk kodu | Nerede kullanılır? | Görsel etkisi |
|---|---:|---|---|
| `--c-bg-base` | `#060305` | Ana ekran zemini | Tüm ekranın temel koyu rengi. |
| `--c-bg-deep` | `#030203` | Daha derin arka plan alanları | Derinlik ve kontrast hissi. |
| `--c-panel-bg` | `#060406` | Panel yüzeyleri | Panelleri ana zeminden çok hafif ayırır. |
| Harita arka planı | `#0c0a0d -> #070507 -> #040305` | Dünya haritası alanı | Merkezde hafif aydınlık, kenarlarda derin karanlık görünüm. |

Kod kaynağı:

```css
--c-bg-base: #060305;
--c-bg-deep: #030203;
--c-panel-bg: #060406;
```

Harita arka plan gradienti:

```css
radial-gradient(
  120% 100% at 50% 36%,
  #0c0a0d 0%,
  #070507 58%,
  #040305 100%
)
```

Görsel yorum:

- Siyah zemin ekranda baskın renktir.
- Kırmızı sadece önemli noktalarda kullanıldığı için dikkat dağıtmaz.
- Panel ve kartlar siyah zemin üzerinde çok hafif border/gölge farkıyla ayrılır.
- Harita zemini düz siyah değil, radial gradient ile derinlik hissi verir.

## 3. Kırmızı ve Gradient Kullanımı

Cyber News ekranının ana vurgu dili kırmızıdır. Kırmızı renk tek başına kullanılmaz; çoğu yerde koyu kırmızıdan parlak kırmızıya geçen gradient ile desteklenir.

### 3.1 Ana Kırmızı Renkler

| Token / değer | Renk kodu | Görevi |
|---|---:|---|
| `--c-accent` | `#ff2b3d` | Ana parlak kırmızı vurgu. |
| `--c-accent-2` | `#b3121f` | Gradient başlangıç rengi, koyu kırmızı. |
| `--c-accent-text` | `rgba(255, 86, 96, 1)` | Kırmızı metin vurgusu. |
| `--c-accent-bg` | `rgba(255, 43, 61, 0.13)` | Kırmızı transparan yüzey. |
| `--c-accent-bg-soft` | `rgba(255, 43, 61, 0.06)` | Çok yumuşak kırmızı seçili alan etkisi. |
| `--c-accent-border` | `rgba(255, 72, 84, 0.42)` | Seçili kart/panel border vurgusu. |
| `--c-accent-glow` | `rgba(255, 43, 61, 0.42)` | Kırmızı ışık/parlama efekti. |

Kod kaynağı:

```css
--c-accent: #ff2b3d;
--c-accent-2: #b3121f;
--c-accent-text: rgba(255, 86, 96, 1);
--c-accent-bg: rgba(255, 43, 61, 0.13);
--c-accent-bg-soft: rgba(255, 43, 61, 0.06);
--c-accent-border: rgba(255, 72, 84, 0.42);
--c-accent-glow: rgba(255, 43, 61, 0.42);
```

### 3.2 Ana Kırmızı Gradient

Ana geçişli kırmızı kullanım:

```css
linear-gradient(90deg, #b3121f 0%, #ff2b3d 100%)
```

Bu gradient:

- Solda `#b3121f` koyu kırmızı ile başlar.
- Sağda `#ff2b3d` parlak kırmızıya geçer.
- `90deg` olduğu için geçiş soldan sağadır.
- Progress bar, vurgu çizgisi ve aktif durumlarda premium kırmızı etkisi verir.

Bu gradientin ekrandaki örnek kullanımı:

```tsx
background: "linear-gradient(90deg, var(--c-accent-2), var(--c-accent))"
```

Kullanıldığı yerlerden biri:

```tsx
components/cyber/MostMentionedRegionsPanel.tsx
```

Bölge progress bar'ları bu kırmızı geçişi kullanır.

### 3.3 Seçili Haber Kartı Gradienti

Seçili haber kartı için daha yumuşak, dikey bir kırmızı gradient kullanılır:

```css
linear-gradient(
  180deg,
  rgba(255,43,61,0.17),
  rgba(255,43,61,0.05)
)
```

Görsel etkisi:

- Kartın seçili olduğunu belli eder.
- Çok parlak olmadığı için siyah temayı bozmaz.
- Üstten alta doğru kırmızı yoğunluğu azalır.
- Kartın premium ve sakin görünmesini korur.

Kod kaynağı:

```tsx
components/cyber/CyberNewsPanel.tsx
```

İlgili davranış:

```tsx
background: isSelected
  ? "linear-gradient(180deg, rgba(255,43,61,0.17), rgba(255,43,61,0.05))"
  : hovered
    ? "var(--c-card-bg-hover)"
    : "var(--c-card-bg)"
```

## 4. Panel Yüzey Tasarımı

Cyber News panelleri `.cyber-panel` sınıfıyla görselleştirilir.

Kod kaynağı:

```css
.cyber-panel
```

Panel tasarım özellikleri:

| Özellik | Kod / token | Görsel etkisi |
|---|---|---|
| Arka plan | `--c-panel-bg: #060406` | Siyah/koyu panel yüzeyi. |
| Gradient doku | `--c-panel-grad` | Hafif karbon/metal yüzey hissi. |
| Border | `1px solid var(--c-border-1)` | Panel sınırlarını zarifçe ayırır. |
| Radius | `var(--c-radius) = 12px` | Modern panel köşesi. |
| İç highlight | `0 1px 0 rgba(255,255,255,0.04) inset` | Üst kenarda hafif ışık hissi. |
| Drop shadow | `0 14px 40px rgba(0,0,0,0.4)` | Paneli zeminden ayırır. |
| Overflow | `hidden` | İçerik radius dışına taşmaz. |

Panel CSS:

```css
.cyber-panel {
  background: var(--c-panel-bg);
  background-image: var(--c-panel-grad);
  border: 1px solid var(--c-border-1);
  border-radius: var(--c-radius);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 14px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}
```

## 5. Panel Başlıkları

Panel başlıkları küçük, uppercase, geniş harf aralıklı ve gümüş tonludur. Bu tercih ekranı dashboard/terminal estetiğine yaklaştırır.

| Özellik | Değer |
|---|---|
| Font | `var(--font-disp)` / Space Grotesk |
| Boyut | `10.5px` |
| Ağırlık | `600` |
| Harf aralığı | `0.14em` |
| Dönüşüm | `uppercase` |
| Renk | `var(--c-t4)` |

Kod:

```css
.cyber-panel-title {
  font-family: var(--font-disp);
  font-size: var(--c-fs-sm);
  font-weight: 600;
  color: var(--c-t4);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
```

Görsel etkisi:

- Başlıklar bağırmaz, sakin kalır.
- Panel içeriği başlıktan daha önemli görünür.
- Gümüş renk, kırmızı vurgu ile rekabet etmez.

## 6. Haber Kartı Görsel Tasarımı

Haber kartları `CyberNewsPanel.tsx` içinde çizilir.

### 6.1 Normal Kart

| Özellik | Kod | Etki |
|---|---|---|
| Arka plan | `var(--c-card-bg)` | Çok hafif açık siyah yüzey. |
| Border | `var(--c-border-3)` | En düşük kontrastlı çerçeve. |
| Radius | `var(--c-radius-sm)` | 8px kart köşesi. |
| Padding | `13px 15px` | Kompakt ama okunabilir iç boşluk. |

### 6.2 Hover Kart

Hover durumunda:

```tsx
background: "var(--c-card-bg-hover)"
border: "1px solid var(--c-border-1)"
transform: "translateX(2px)"
```

Görsel etkisi:

- Kart hafif sağa kayar.
- Arka plan biraz aydınlanır.
- Kullanıcıya tıklanabilirlik hissi verir.

### 6.3 Seçili Kart

Seçili kartta:

```tsx
background: "linear-gradient(180deg, rgba(255,43,61,0.17), rgba(255,43,61,0.05))"
border: "1px solid var(--c-accent-border)"
boxShadow: "0 0 0 1px var(--c-accent-bg-soft), 0 10px 28px rgba(0,0,0,0.35)"
```

Görsel etkisi:

- Seçili haber kırmızı tonla ayrılır.
- Border daha sıcak/kırmızı görünür.
- Gölge kartı öne çıkarır.
- Sağdaki Threat Context panelinin hangi haberden beslendiği anlaşılır.

## 7. Metin Renk Hiyerarşisi

Cyber News ekranında metinler tek bir beyazla verilmez. Okunabilirlik ve derinlik için altı kademeli gümüş metin sistemi kullanılır.

| Token | Renk kodu | Kullanım |
|---|---:|---|
| `--c-t1` | `rgba(238, 240, 244, 0.98)` | En güçlü başlık, haber başlığı. |
| `--c-t2` | `rgba(214, 219, 226, 0.92)` | Birincil değerler. |
| `--c-t3` | `rgba(176, 184, 196, 0.82)` | Gövde metni. |
| `--c-t4` | `rgba(132, 142, 156, 0.72)` | Açıklama ve ikincil metin. |
| `--c-t5` | `rgba(96, 105, 119, 0.64)` | Label, metadata, zaman. |
| `--c-t6` | `rgba(70, 78, 90, 0.6)` | Ayraç, rank, pasif detay. |

Görsel etkisi:

- Haber başlıkları öne çıkar.
- Özetler daha sakin kalır.
- Label ve metadata geri planda kalır.
- Kırmızı vurgu sadece kritik yerlerde dikkat çeker.

## 8. Severity / Risk Renkleri

Severity renkleri haber badge'lerinde ve sektör barlarında kullanılır.

| Seviye | Renk | Kod | Görsel rol |
|---|---:|---|---|
| Critical | Kırmızı | `rgba(255, 72, 82, 0.98)` | En yüksek risk. |
| High | Turuncu | `rgba(255, 122, 47, 0.95)` | Yüksek risk. |
| Medium | Altın sarısı | `rgba(241, 194, 79, 0.95)` | Orta risk. |
| Low / Elevated | Gümüş | `rgba(176, 184, 196, 0.82)` | Daha sakin risk. |

Badge renk haritası:

```tsx
const SEV_BADGE = {
  critical: { text: "var(--c-crit)", bg: "var(--c-crit-bg)", border: "var(--c-crit-border)" },
  high: { text: "var(--c-high)", bg: "var(--c-high-bg)", border: "var(--c-high-border)" },
  medium: { text: "var(--c-med)", bg: "var(--c-med-bg)", border: "var(--c-med-border)" },
  low: { text: "var(--c-elev)", bg: "var(--c-elev-bg)", border: "var(--c-elev-border)" },
};
```

Kod kaynağı:

```tsx
components/cyber/CyberNewsPanel.tsx
```

## 9. Harita Görsel Tasarımı

Harita `CyberMap.tsx` içinde özel tema ile çizilir.

| Harita parçası | Renk / teknik değer | Görsel etkisi |
|---|---|---|
| Kara parçaları | `#221a1e` | Siyah zemin üzerinde koyu bordo/kahverengi kara yüzeyi. |
| Ülke sınırları | `rgba(255,72,84,0.40)` | Kırmızımsı ince sınır çizgisi. |
| Grid / graticule | `rgba(255,72,84,0.04)` | Çok hafif teknik harita çizgisi. |
| Arka plan | Radial siyah gradient | Haritaya derinlik ve merkez odak verir. |

Kod:

```tsx
const CYBER_MAP_THEME = {
  land: "#221a1e",
  border: "rgba(255,72,84,0.40)",
  graticule: "rgba(255,72,84,0.04)",
  background: "radial-gradient(120% 100% at 50% 36%, #0c0a0d 0%, #070507 58%, #040305 100%)",
};
```

Not:

- Mevcut harita sadece base map görünümünü çiziyor.
- Marker, attack arc ve animasyon sistemi şu an aktif değil.
- `cyberHotspots` ve `cyberAttackIndicators` verileri hazır, ancak haritada görsel marker/çizgi olarak kullanılmıyor.

## 10. Progress Bar Görsel Tasarımı

### 10.1 Most Mentioned Regions Barları

Bölge panelindeki barlar kırmızı gradient kullanır:

```tsx
background: "linear-gradient(90deg, var(--c-accent-2), var(--c-accent))"
```

Görsel etkisi:

- En çok bahsedilen bölgeler kırmızı vurgu ile öne çıkar.
- Bar genişliği `count / maxCount` oranına göre hesaplanır.
- İnce bar kullanımı ekranın yoğun ama zarif görünmesini sağlar.

### 10.2 Affected Sectors Barları

Sektör panelinde risk seviyesine göre gradient değişir:

```tsx
crit: "linear-gradient(90deg, var(--c-accent-2), var(--c-crit))"
high: "linear-gradient(90deg, var(--c-accent-2), var(--c-high))"
elev: "linear-gradient(90deg, rgba(150,160,172,0.3), var(--c-elev))"
```

Görsel etkisi:

- Critical sektörler kırmızıya gider.
- High sektörler turuncuya gider.
- Elevated sektörler gümüşte kalır.
- Risk yoğunluğu renk ile hızlı okunur.

## 11. Tipografi

Ekranda üç font rolü vardır:

| Font | Teknik değişken | Kullanım |
|---|---|---|
| Space Grotesk | `--font-display` | Panel başlıkları, haber başlıkları, badge'ler. |
| Hanken Grotesk | `--font-ui` | Genel UI ve açıklama metinleri. |
| JetBrains Mono | `--font-mono` | Sayılar, zaman, IP, yüzde değerleri. |

Font sınıfları:

```css
.c-disp {
  font-family: var(--font-disp);
}

.c-mono {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
}
```

Görsel etkisi:

- Başlıklar modern ve teknik görünür.
- Sayılar hizalı ve ölçülebilir görünür.
- Ekran genelinde dashboard hissi güçlenir.

## 12. Boşluk, Radius ve Ölçü Sistemi

| Tasarım değeri | Kod | Kullanım |
|---|---|---|
| Ana ekran padding | `10px` | Panel kenar boşluğu. |
| Panel arası gap | `10px` | Paneller arası ritim. |
| Ana panel radius | `12px` | Büyük panel köşeleri. |
| Kart radius | `8px` | Haber kartları ve satırlar. |
| Badge radius | `5px` | Küçük etiketler. |
| Alt panel satırı | `264px` | Regions + Sectors satır yüksekliği. |
| Regions panel genişliği | `304px` | Sol alt panel sabit genişliği. |

Bu ölçüler `CyberSecPanel.tsx` ve `app/globals.css` içinde tanımlıdır.

## 13. Görsel Hiyerarşi

Cyber News ekranında dikkat sırası şu şekilde kurulmuştur:

1. Harita ve seçili haber kartı.
2. Haber başlıkları.
3. Threat Context değerleri.
4. Region/Sector metrikleri.
5. Metadata, zaman, label ve ayraçlar.

Bu hiyerarşi şu tekniklerle sağlanır:

- Koyu siyah arka plan genel gürültüyü azaltır.
- Kırmızı sadece aktif/seçili/kritik yerlerde kullanılır.
- Gümüş metin kademeleri ile içerik önceliği ayrılır.
- İnce border ve shadow panelleri ayırır ama ekranda kalabalık yaratmaz.
- Hover ve seçili durumlar düşük ama fark edilir animasyonlarla verilir.

## 14. Renk Kodları ve Gradient Davranışı

Bu bölüm, Cyber News ekranındaki temel renkleri ve gradientlerin görsel davranışını özetler.

### 14.1 Ana Renk Kodları

| Renk grubu | Kod / token | Renk değeri | Kullanım |
|---|---|---:|---|
| Ana siyah zemin | `--c-bg-base` | `#060305` | Ekranın genel arka planı. |
| Derin siyah | `--c-bg-deep` | `#030203` | Daha koyu arka plan ve derinlik etkisi. |
| Panel siyahı | `--c-panel-bg` | `#060406` | Panel yüzeyleri. |
| Harita kara rengi | `land` | `#221a1e` | Dünya haritasındaki kara parçaları. |
| Ana kırmızı | `--c-accent` | `#ff2b3d` | Aktif vurgu, seçili durum, progress bar bitişi. |
| Koyu kırmızı | `--c-accent-2` | `#b3121f` | Kırmızı gradient başlangıcı. |
| Kırmızı metin | `--c-accent-text` | `rgba(255, 86, 96, 1)` | Aktif metrik ve pozitif vurgu metinleri. |
| Kırmızı border | `--c-accent-border` | `rgba(255, 72, 84, 0.42)` | Seçili haber kartı border rengi. |
| Kırmızı glow | `--c-accent-glow` | `rgba(255, 43, 61, 0.42)` | Parlama/ışık etkisi. |
| Parlak gümüş | `--c-silver` | `rgba(196, 202, 212, 0.94)` | Kaynak adı, confidence ve güçlü ikincil metinler. |
| Soluk gümüş | `--c-silver-dim` | `rgba(150, 158, 170, 0.74)` | İkonlar ve pasif gümüş detaylar. |

### 14.2 Metin Renk Kodları

| Token | Renk değeri | Kullanım davranışı |
|---|---:|---|
| `--c-t1` | `rgba(238, 240, 244, 0.98)` | En parlak metin, haber başlığı gibi ana içerikler. |
| `--c-t2` | `rgba(214, 219, 226, 0.92)` | Birincil değer ve önemli içerik metni. |
| `--c-t3` | `rgba(176, 184, 196, 0.82)` | Gövde metni ve bilgi değerleri. |
| `--c-t4` | `rgba(132, 142, 156, 0.72)` | Özet, panel başlığı ve ikincil açıklamalar. |
| `--c-t5` | `rgba(96, 105, 119, 0.64)` | Label, metadata ve zaman bilgisi. |
| `--c-t6` | `rgba(70, 78, 90, 0.6)` | En düşük vurgu: ayraç, rank, pasif nokta. |

### 14.3 Risk / Severity Renk Kodları

| Seviye | Metin rengi | Arka plan | Border | Görsel davranış |
|---|---:|---:|---:|---|
| Critical | `rgba(255, 72, 82, 0.98)` | `rgba(255, 56, 68, 0.13)` | `rgba(255, 72, 82, 0.4)` | En güçlü alarm seviyesi, kırmızı görünür. |
| High | `rgba(255, 122, 47, 0.95)` | `rgba(255, 122, 47, 0.11)` | `rgba(255, 122, 47, 0.34)` | Turuncu/sıcak risk vurgusu. |
| Medium | `rgba(241, 194, 79, 0.95)` | `rgba(241, 194, 79, 0.12)` | `rgba(241, 194, 79, 0.32)` | Altın sarısı orta risk. |
| Low / Elevated | `rgba(176, 184, 196, 0.82)` | `rgba(176, 184, 196, 0.07)` | `rgba(176, 184, 196, 0.2)` | Daha sakin, gümüş risk seviyesi. |

### 14.4 Gradient Davranışları

| Gradient | Kod | Yön / davranış | Kullanım |
|---|---|---|---|
| Ana kırmızı gradient | `linear-gradient(90deg, #b3121f 0%, #ff2b3d 100%)` | Soldan sağa koyu kırmızıdan parlak kırmızıya geçer. | Ana vurgu çizgileri ve progress barlar. |
| Bölge progress gradienti | `linear-gradient(90deg, var(--c-accent-2), var(--c-accent))` | Koyu kırmızı başlar, parlak kırmızıda biter. | Most Mentioned Regions bar dolgusu. |
| Seçili haber gradienti | `linear-gradient(180deg, rgba(255,43,61,0.17), rgba(255,43,61,0.05))` | Yukarıdan aşağıya kırmızı yoğunluğu azalır. | Seçili haber kartı arka planı. |
| Panel yüzey gradienti | `linear-gradient(180deg, rgba(20,16,18,0.28), rgba(7,5,7,0.55) 50%)` | Üstten alta koyulaşan siyah/kırmızımsı panel yüzeyi. | Tüm `.cyber-panel` yüzeyleri. |
| Panel doku gradienti | `repeating-linear-gradient(135deg, rgba(255,255,255,0.01) 0 1px, transparent 1px 7px)` | 135 derece ince tekrar eden çizgi dokusu verir. | Panel yüzeyindeki karbon/hairline hissi. |
| Harita radial gradienti | `radial-gradient(120% 100% at 50% 36%, #0c0a0d 0%, #070507 58%, #040305 100%)` | Merkez daha açık, kenarlara doğru daha koyu olur. | Harita arka planı. |
| Critical sektör gradienti | `linear-gradient(90deg, var(--c-accent-2), var(--c-crit))` | Koyu kırmızıdan critical kırmızıya geçer. | Critical sektör barı. |
| High sektör gradienti | `linear-gradient(90deg, var(--c-accent-2), var(--c-high))` | Koyu kırmızıdan turuncuya geçer. | High sektör barı. |
| Elevated sektör gradienti | `linear-gradient(90deg, rgba(150,160,172,0.3), var(--c-elev))` | Soluk gümüşten daha belirgin gümüşe geçer. | Elevated sektör barı. |

Gradient davranış özeti:

- `90deg` gradientler yataydır; soldan sağa ilerler.
- `180deg` gradientler dikeydir; yukarıdan aşağıya ilerler.
- Kırmızı gradientlerde başlangıç genelde `#b3121f`, bitiş genelde `#ff2b3d` veya risk rengine bağlıdır.
- Siyah panel gradientleri düz siyahı kırar, yüzeye hacim verir.
- Harita radial gradienti merkez odak oluşturur ve kenarlara doğru karartma sağlar.
- Transparan `rgba(...)` renkler, siyah zeminle karışarak sert değil premium ve kontrollü bir görünüm üretir.

## 15. Kısa Sonuç

Cyber News ekranının görsel tasarımı; **derin siyah zemin**, **koyu kırmızıdan parlak kırmızıya geçen premium gradientler**, **soğuk gümüş metin hiyerarşisi** ve **hafif metal/cam panel yüzeyleri** üzerine kuruludur.

En önemli görsel kararlar:

- Siyah zemin baskındır; kırmızı vurgu kontrollü kullanılır.
- `#b3121f -> #ff2b3d` geçişi ana kırmızı gradient dilidir.
- Paneller düz siyah değil; gradient, border ve shadow ile katmanlı görünür.
- Haber seçimi kırmızı gradient ve border ile anlaşılır.
- Harita koyu kara parçaları ve kırmızı sınırlarla Cyber News kimliğine bağlanır.
- Tipografi küçük, teknik ve dashboard odaklıdır.
