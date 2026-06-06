/**
 * Üretim (Craft) değerlendirme — docs/03 §"Üretim değerlendirme".
 *
 * Girdi: reçete malzemeleri (sabit miktar) → kademe dağılımlı tek eşya.
 * Craft'ta fail kavramı yoktur (failProb=0); maliyet malzeme alış fiyatlarıdır.
 */
import {
  DEFAULT_PRICE_OPTS,
  buyPrice,
  expectedSellCents,
  normalizeOdds,
  poolSellValues,
  profitProbability,
} from "./helpers";
import type {
  CraftSlot,
  EvalResult,
  GradeKey,
  Outcome,
  Pool,
  PriceBook,
  PriceOpts,
} from "./types";

export interface EvaluateCraftArgs {
  slot: CraftSlot;
  tier: number;
  gradeOdds: Partial<Record<GradeKey, number>>;
  materials: { id: number; qty: number }[];
  dropsByGrade: Map<GradeKey, Pool>;
  prices: PriceBook;
  opts?: PriceOpts;
}

export function evaluateCraft(args: EvaluateCraftArgs): EvalResult {
  const opts = args.opts ?? DEFAULT_PRICE_OPTS;
  const { materials, gradeOdds, dropsByGrade, prices } = args;

  // 1. Maliyet: Σ qty × material.lowest. Fiyatsız malzeme → hasMissingPrices.
  let costCents = 0;
  let hasMissingPrices = false;
  for (const m of materials) {
    const unit = buyPrice(prices.get("material", m.id));
    if (unit == null) {
      hasMissingPrices = true;
      continue; // eksik malzeme maliyete 0 katkı; senaryo güvenilmez işaretlenir
    }
    costCents += unit * m.qty;
  }

  // 2. Kademe dağılımı normalize → her kademe için havuz değeri.
  const norm = normalizeOdds(gradeOdds as Record<string, number>);
  const outcomes: Outcome[] = [];
  const evParts: { prob: number; avg: number }[] = [];
  const profitParts: { prob: number; values: number[] }[] = [];

  for (const key of Object.keys(norm) as GradeKey[]) {
    const prob = norm[key] ?? 0;
    if (prob <= 0) continue;
    const pool = dropsByGrade.get(key) ?? [];
    const { values, missing } = poolSellValues(pool, prices, opts);
    if (missing) hasMissingPrices = true;
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    outcomes.push({ gradeKey: key, prob, isFail: false, isGreat: false, poolAvgSell: avg });
    evParts.push({ prob, avg });
    profitParts.push({ prob, values });
  }

  const evSellCents = expectedSellCents(evParts, opts.fee);
  const netCents = evSellCents - costCents;
  const roi = costCents > 0 ? netCents / costCents : null;
  const profitProb = profitProbability(profitParts, costCents, opts.fee);

  return {
    costCents,
    evSellCents,
    netCents,
    roi,
    failProb: 0,
    profitProb,
    outcomes,
    hasMissingPrices,
    farmMode: costCents === 0 && materials.length === 0,
  };
}
