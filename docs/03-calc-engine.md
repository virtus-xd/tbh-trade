# 03 — Hesap Motoru (packages/calc)

Saf, yan-etkisiz TypeScript. UI ve worker aynı motoru kullanır. Tüm para **cents (USD)**. Vitest ile her fonksiyon test edilir.

## Sabitler
```ts
export const STEAM_FEE = 0.15;                 // satışta komisyon
export const TRADABLE_MIN_TIER = 4;            // legendary (grades.tier_index)
```

## Fiyat seçimi
- **Alış maliyeti bazı:** `lowest_cents` (en ucuz listeden alırsın).
- **Satış EV bazı:** hacim yeterliyse `median_cents`, değilse `lowest_cents`. (Eşik config; örn. volume ≥ 5.)
- Fiyat yoksa item "fiyatsız" → EV'ye 0 katkı + UI'da "eksik veri" işareti; senaryo "güvenilmez" sayılır.
- Tradable olmayan kademe (Legendary altı) → pazar değeri **0** (altın değeri ayrı, $ değil).

## Çekirdek tipler
```ts
type GradeKey = 'common'|'uncommon'|'rare'|'legendary'|'immortal'|'arcana'|'beyond'|'celestial'|'divine'|'cosmic';

interface PriceBook { get(refType:'item'|'material', id:number): { lowest:number; median:number; volume:number } | null }

interface Outcome { gradeKey: GradeKey; prob: number; isFail: boolean; isGreat: boolean; poolAvgSell: number; }

interface EvalResult {
  costCents: number;
  evSellCents: number;     // komisyon düşülmüş beklenen brüt gelir
  netCents: number;        // evSell - cost
  roi: number;             // net / cost
  failProb: number;        // sentez: aynı kademe olasılığı
  profitProb: number;      // tek denemede net>0 olma olasılığı
  outcomes: Outcome[];     // dağılım (UI tablosu)
  hasMissingPrices: boolean;
}
```

## Yardımcılar
```ts
// Datamined oranlar ~%100 değil → 1'e normalize et
function normalizeOdds(odds: Record<string, number>): Record<string, number>;

// Bir havuzdaki tradable eşyaların satış-bazlı ortalama değeri (cents). Tradable değilse 0.
function poolAverageSell(pool: {refType:'item'|'material'; id:number; tradable:boolean}[], prices: PriceBook): { avg:number; missing:boolean };
```

## Sentez değerlendirme
Girdi: 9 eşya (aynı kademe+kategori). Tek sentez aksiyonu.
```ts
function evaluateSynthesis(args: {
  inputGradeKey: GradeKey;
  category: 'gear'|'accessory'|'material';
  tier: number;
  inputUnitCents: number | null;   // bir girdinin alış fiyatı (tradable değilse null → "farm modu")
  rates: SynthRate[];              // synthesis_rates (input grade)
  dropsByGrade: Map<GradeKey, Pool>; // synthesis_drops (kategori+tier)
  prices: PriceBook;
}): EvalResult;
```
Algoritma:
1. `outcomes` = normalize(rates) → her sonuç kademesi için `prob`, `isFail`, `isGreat`.
2. Her sonuç için `poolAvgSell = poolAverageSell(dropsByGrade[grade])`.
3. `costCents = 9 × inputUnitCents` (null ise farm modu: cost=0, ama `inputUnitCents` "fırsat maliyeti" olarak ayrı raporlanır; ROI gösterilmez, "net kazanç" gösterilir).
4. `evSellCents = round( Σ prob × poolAvgSell × (1 - STEAM_FEE) )`.
5. `netCents = evSellCents - costCents`; `roi = cost>0 ? net/cost : null`.
6. `failProb = Σ prob where isFail`.
7. `profitProb` = Σ over item-level dağılım: `P(item) × [price_item × (1-FEE) > costCents]`. (Havuz item'larının fiyatları biliniyorsa item bazında; yoksa kademe ortalamasıyla yaklaşık.)

> **Fail'in EV'ye etkisi:** Immortal+ sentezde `isFail` sonucu aynı kademe havuzudur → `poolAvgSell` ≈ girdiyle aynı seviye; yani fail olasılığı yüksek olduğunda `evSell` çöker. Bu otomatik olarak doğru çıkar.

## Üretim değerlendirme
```ts
function evaluateCraft(args: {
  slot: CraftSlot;
  tier: number;
  gradeOdds: Record<GradeKey, number>;   // craft_recipes.grade_odds
  materials: { id:number; qty:number }[]; // craft_recipe_materials
  dropsByGrade: Map<GradeKey, Pool>;      // craft_drops
  prices: PriceBook;
}): EvalResult;
```
Algoritma:
1. `costCents = Σ qty × prices.material(id).lowest`. Herhangi malzeme fiyatsızsa `hasMissingPrices=true`.
2. `outcomes` = normalize(gradeOdds) → her kademe için `poolAvgSell`.
3. `evSellCents = round( Σ prob × poolAvgSell × (1-FEE) )`.
4. `netCents`, `roi`, `profitProb` sentezdeki gibi (craft'ta fail kavramı yok; `failProb=0`).

## Fırsat tarayıcı
```ts
// Tüm geçerli senaryoları (sentez: kategori×grade×tier; üretim: slot×tier) tara,
// güncel fiyatlarla EvalResult üret, opportunities tablosuna yaz (roi DESC).
function scanOpportunities(repo, prices): OpportunityRow[];
```
- Yalnız "feasible" senaryolar (girdileri tradable + fiyatı var) ROI sıralamasına girer.
- Worker fiyat güncellemesinden sonra çalışır; sonuç `opportunities` tablosunda cache'lenir.

## Test senaryoları (Vitest — en az bunlar)
- `normalizeOdds` 1'e toplar.
- Immortal sentez: failProb ≈ 0.50; evSell fail havuzunu içerir.
- Craft T8 Main weapon: cost = 1× Arcane Ore fiyatı; evSell yalnız immortal+arcana+beyond havuzlarından gelir (rare/leg = 0).
- Fiyatsız havuz → hasMissingPrices=true, senaryo sıralamadan düşer.
- Para birimi/komisyon: evSell = brüt × 0.85 doğrulaması.
