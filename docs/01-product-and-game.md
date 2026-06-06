# 01 — Ürün & Oyun Mekaniği (doğruluk kaynağı)

Bu dosya oyunun, projeyle ilgili tüm mekaniğini ve datamined sayısal verisini içerir. Sayısal veriler **taskbarhero.wiki** (oyundan birebir datamined) ve **taskbarhero.org** kaynaklıdır; yama ile değişebilir.

## 1. Oyun özeti
TBH: Task Bar Hero — görev çubuğunda çalışan idle/AFK hack-and-slash RPG (Steam appid **3678970**, çıkış 27 May 2026). Heroes bölümleri otomatik döner, eşya/altın/malzeme toplar. Tüm eşya işlemleri **Hero-dric Cube** ekranında yapılır (Lv4'te açılır).

## 2. Cube fonksiyonları (projeyi ilgilendirenler)
- **Synthesis (Sentez):** Aynı **kademe + kategoriden** 9 eşya → 1 (genelde) üst kademe eşya.
- **Craft (Üretim):** Seçilen **slot** + **seviye aralığı** için gerekli **malzeme(ler)** → o slotta rastgele 1 eşya.
- (Alchemy/Decoration/Engraving/Inscription/Removal/Offering — kataloğda dururlar, hesaba doğrudan girmezler.)

## 3. Nadirlik (Grade) merdiveni — 10 kademe
`tier_index` artan = daha nadir. **Legendary (index 4) ve üzeri tradable.** (Steam'de gözlemlenen: Legendary gear listeleniyor; rare ve altı hiç listelenmiyor.)

| idx | key | Ad | Renk | Alchemy altın | Soket D/E/I | tradable |
|-----|-----|----|------|---------------|-------------|----------|
| 1 | common | Common | #e4e4e4 | 10 | 0/0/0 | hayır |
| 2 | uncommon | Uncommon | #54fc0c | 30 | 1/0/0 | hayır |
| 3 | rare | Rare | #2f8bfc | 90 | 1/1/0 | hayır |
| 4 | legendary | Legendary | #fc9c0c | 270 | 2/2/0 | **evet** |
| 5 | immortal | Immortal | #fc2424 | 810 | 2/2/1 | **evet** |
| 6 | arcana | Arcana | #b40cfc | 2.592 | 3/2/1 | **evet** |
| 7 | beyond | Beyond | #fc246c | 8.294 | 3/2/2 | **evet** |
| 8 | celestial | Celestial | #6ccce4 | 29.029 | 3/2/2 | **evet** |
| 9 | divine | Divine | #fce454 | 101.602 | 3/2/2 | **evet** (pratikte ~yok) |
| 10 | cosmic | Cosmic | #fcfcfc | 355.607 | 3/2/2 | **evet** (pratikte ~yok) |

## 4. Eşya tipleri (20) ve kategoriler
- **Weapon:** Sword, Bow, Staff, Scepter, Crossbow, Axe
- **Off-hand:** Shield, Arrow, Orb, Tome, Bolt, Hatchet
- **Armor:** Helmet, Armor, Gloves, Boots
- **Accessory:** Amulet, Earring, Ring, Bracer

Her tipin Lv1→Lv100 isim ilerlemesi var (örn. Sword: Lv1 Long Sword → … → Lv100 Radiant Sword). Toplam ~5.760 gear kaydı.

## 5. Malzeme kategorileri
- **CRAFTING** (üretim girdisi): Wood, Stone, Leather, Copper Nugget (Common) · Bronze/Iron Ingot (Uncommon) · Silver/Gold Ingot (Rare) · Stardust Ingot/Void Iron (Legendary) · Bloodstone/Thunderstone (Immortal) · Chaos Shard/Arcane Ore (Arcana) · Darksteel/Orichalcum (Beyond) · Moonstone/Sunstone (Celestial) · Mithril/Ethereal (Divine) · Adamantium/Aeon (Cosmic)
- **DECORATION** (gems), **ENGRAVING** (canavar malzemeleri), **INSCRIPTION** (scroll'lar), **OFFERING** (anniversary coin'ler), **SOULSTONE**.
- Malzemeler de tradable (Üretim girdileri ve Material-sentezi için pazardan alınabilir).

## 6. SENTEZ — datamined oranlar
3 kategori **ayrı** sentezlenir: **Gear / Accessory / Material** (karıştırılamaz). 9 girdi aynı kademe olmalı. Çıktı seviyesi, 9 girdinin **ortalama seviyesi** etrafında yuvarlanır.

**Kademe-yükseltme olasılıkları** (`synthesis_rates` tablosuna birebir):

| Girdi (9×) | result_grade : prob (flags) |
|---|---|
| common | uncommon: 0.95 · rare: 0.048 *(great)* |
| uncommon | rare: 0.96 · legendary: 0.038 *(great)* |
| rare | legendary: 0.98 · immortal: 0.024 *(great)* |
| legendary | immortal: 0.99 · arcana: 0.0099 *(great)* |
| immortal | immortal: 0.50 *(fail)* · arcana: 0.50 · beyond: 0.0025 *(great)* |
| arcana | arcana: 0.67 *(fail)* · beyond: 0.33 · celestial: 0.0017 *(great)* |
| beyond | beyond: 0.77 *(fail)* · celestial: 0.23 · divine: 0.0008 *(great)* |
| celestial | celestial: 0.83 *(fail)* · divine: 0.17 · cosmic: 0.0002 *(great)* |
| divine | divine: 0.91 *(fail)* · cosmic: 0.091 |

- **Immortal altı: fail YOK** (her zaman yükselir). **Immortal+: fail var** (aynı kademe).
- **great success = +2 kademe.** Cosmic sentezlenemez.
- Oranlar yer yer ~%100 değil → **normalize et**.

**Sentez reçete kademeleri** (`synthesis_tiers`):

| tier | level_min | level_max | cube_level | gold_cost |
|---|---|---|---|---|
| 1 | 1 | 10 | 1 | 0 |
| 2 | 10 | 20 | 10 | 100 |
| 3 | 15 | 30 | 20 | 500 |
| 4 | 20 | 40 | 30 | 1000 |
| 5 | 30 | 50 | 40 | 3000 |
| 6 | 40 | 65 | 50 | 5000 |
| 7 | 50 | 65 | 60 | 7000 |
| 8 | 65 | 80 | 70 | 10000 |

Çıktı havuzları datamine'da **Synthesis Drops (203 kayıt)** olarak var → `synthesis_drops` tablosuna import edilir; tahmin edilmez.

## 7. ÜRETİM — datamined reçeteler (56 = 7 slot × 8 kademe)
Slotlar: **Main weapon, Sub weapon, Helmet, Armor, Gloves, Boots, Accessory**. Çıktı tipi slota sabit; **kademe ve hangi eşya rastgele**; seviye seçilen aralıkta.

**Tam örnek — Main weapon hattı (birebir datamine):**

| tier | level | malzeme | grade_odds | possible_items |
|---|---|---|---|---|
| 1 | 1–10 | 1× Leather | uncommon .50, rare .40, legendary .08, immortal .02 | 72 |
| 2 | 10–20 | 1× Copper Nugget | unc .30, rare .52, leg .13, imm .045, arcana .005 | 84 |
| 3 | 20–30 | 1× Iron Ingot | unc .1801, rare .5601, leg .1801, imm .07, arc .009, beyond .0007 | 66 |
| 4 | 30–40 | 1× Iron Ingot | unc .11, rare .55, leg .23, imm .09, arc .018, bey .002 | 72 |
| 5 | 40 | 1× Gold Ingot | unc .07, rare .53, leg .26, imm .11, arc .028, bey .002 | 36 |
| 6 | 50–65 | 1× Void Iron | unc .015, rare .515, leg .29, imm .14, arc .038, bey .002 | 66 |
| 7 | 65–80 | 1× Thunderstone | rare .495, leg .30, imm .165, arc .038, bey .002 | 60 |
| 8 | 80 | 1× Arcane Ore | rare .48, leg .30, imm .18, arc .038, bey .002 | 30 |

> **DİKKAT:** Yalnız Main weapon hattı birebir doğrulandı. Diğer 6 slot aynı yapıda ama **kendi malzeme/oranlarına** sahip → Faz 1'de taskbarhero.wiki'den çekilip `craft_recipes`'e yazılacak. `possible_items` = o slot+seviye aralığındaki tüm kademelerdeki toplam aday eşya sayısı; kademe-içi dağılım `craft_drops` ile.

## 8. Steam Pazarı kuralları (kâr modelini etkiler)
- Sadece **Legendary+** satılabilir/listelenir; rare ve altı pratikte satılmaz.
- Satışta **%15 komisyon** (gelir = fiyat × 0.85).
- Satıştan önce **tüm soketler sökülür** (söküm malzemeyi yok eder) — yani trade için item soketsiz olmalı.
- **7 günlük satış kilidi** (yeni hesap/item).
- Off-platform/gerçek-para ticareti yasak ve banlanıyor.

## 9. Ürünün cevapladığı soru
Bir işlem (Sentez veya Üretim) için: (1) çıktı olasılık dağılımı, (2) girdi maliyeti, (3) komisyon düşülmüş beklenen değer (EV), (4) kâr/zarar & ROI, (5) risk (fail olasılığı, kâr olasılığı, başabaş). Matematik: `docs/03-calc-engine.md`.
