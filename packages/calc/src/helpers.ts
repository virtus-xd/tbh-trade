/**
 * Saf yardımcılar — fiyat seçimi, oran normalizasyonu, havuz değerleme.
 * Hepsi yan-etkisiz ve ayrı test edilir (docs/03).
 */
import { PRICE_FLOOR_CENTS, STEAM_FEE } from "shared";
import type { Pool, PriceBook, PriceOpts, PriceQuote } from "./types";

/** Varsayılan fiyat ayarları (config override edebilir). */
export const DEFAULT_PRICE_OPTS: PriceOpts = {
  volumeThreshold: 5,
  fee: STEAM_FEE,
  priceFloorCents: PRICE_FLOOR_CENTS,
};

/** Taban altı fiyatları (ghost/scam) ele: altındaysa null. */
function floor(v: number | null, opts: PriceOpts): number | null {
  if (v == null) return null;
  return v < opts.priceFloorCents ? null : v;
}

/**
 * Datamined oranlar ~%100 değil (örn. immortal 0.50+0.50+0.0025) → 1'e normalize.
 * Toplam ≤ 0 ise tüm değerleri 0 döndürür (anlamlı dağılım yok).
 */
export function normalizeOdds<K extends string>(odds: Record<K, number>): Record<K, number> {
  const keys = Object.keys(odds) as K[];
  let total = 0;
  for (const k of keys) total += odds[k] ?? 0;
  const out = {} as Record<K, number>;
  if (total <= 0) {
    for (const k of keys) out[k] = 0;
    return out;
  }
  for (const k of keys) out[k] = (odds[k] ?? 0) / total;
  return out;
}

/**
 * Satış EV bazı: hacim eşiği aşılıyorsa median, değilse lowest'a düşer.
 * Hiç fiyat yoksa null (fiyatsız).
 */
export function sellPrice(q: PriceQuote | null, opts: PriceOpts): number | null {
  if (!q) return null;
  if (q.volume != null && q.volume >= opts.volumeThreshold && q.median != null) return floor(q.median, opts);
  if (q.lowest != null) return floor(q.lowest, opts);
  if (q.median != null) return floor(q.median, opts); // son çare: hacim yok ama medyan var
  return null;
}

/** Alış maliyeti bazı: her zaman en ucuz liste (lowest). Yoksa null. Taban altı (ghost) → null. */
export function buyPrice(q: PriceQuote | null, opts: PriceOpts = DEFAULT_PRICE_OPTS): number | null {
  if (!q) return null;
  if (q.lowest != null) return floor(q.lowest, opts);
  if (q.median != null) return floor(q.median, opts);
  return null;
}

/**
 * Havuzdaki HER üye için (eşit olasılıklı) komisyon-öncesi satış değeri.
 * - tradable değil → 0 (Legendary altı pazar değeri 0; eksik veri DEĞİL).
 * - tradable ama fiyatsız → 0  + `missing=true` (güvenilmez).
 */
export function poolSellValues(
  pool: Pool,
  prices: PriceBook,
  opts: PriceOpts = DEFAULT_PRICE_OPTS,
): { values: number[]; missing: boolean } {
  let missing = false;
  const values = pool.map((e) => {
    if (!e.tradable) return 0;
    const sell = sellPrice(prices.get(e.refType, e.id), opts);
    if (sell == null) {
      missing = true;
      return 0;
    }
    return sell;
  });
  return { values, missing };
}

/**
 * Havuzun komisyon-öncesi ortalama satış değeri (cents). Eşit olasılık varsayımı:
 * tüm üyeler (tradable olmayanlar 0 değerle) paydaya girer. Boş havuz → 0 + missing.
 */
export function poolAverageSell(
  pool: Pool,
  prices: PriceBook,
  opts: PriceOpts = DEFAULT_PRICE_OPTS,
): { avg: number; missing: boolean } {
  if (pool.length === 0) return { avg: 0, missing: true };
  const { values, missing } = poolSellValues(pool, prices, opts);
  let sum = 0;
  for (const v of values) sum += v;
  return { avg: sum / values.length, missing };
}

/** Σ prob × poolAvgSell × (1 - fee) → tam sayı cents'e yuvarlanmış beklenen brüt gelir. */
export function expectedSellCents(
  outcomes: { prob: number; avg: number }[],
  fee: number,
): number {
  let ev = 0;
  for (const o of outcomes) ev += o.prob * o.avg;
  return Math.round(ev * (1 - fee));
}

/**
 * Tek denemede net>0 olma olasılığı. Havuz item'ları eşit olasılıklı:
 * P = Σ_outcome prob × (kazanan item sayısı / havuz boyu),
 * kazanan = item satış geliri (value×(1-fee)) > costCents.
 */
export function profitProbability(
  outcomes: { prob: number; values: number[] }[],
  costCents: number,
  fee: number,
): number {
  let p = 0;
  for (const o of outcomes) {
    if (o.values.length === 0) continue;
    let win = 0;
    for (const v of o.values) if (v * (1 - fee) > costCents) win++;
    p += o.prob * (win / o.values.length);
  }
  return p;
}
