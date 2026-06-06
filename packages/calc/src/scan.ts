/**
 * Fırsat tarayıcı — docs/03 §"Fırsat tarayıcı".
 *
 * Tüm senaryoları (sentez + üretim) güncel fiyatlarla değerlendirir, yalnız
 * "feasible" olanları (girdiler tradable + fiyatı var → roi hesaplanabilir,
 * eksik fiyat yok) ROI'ye göre azalan sıralar. Senaryolar enjekte edilir
 * (ScanRepo) → motor DB'den bağımsız kalır. Çıktı `opportunities`'a yazılır.
 */
import { DEFAULT_PRICE_OPTS } from "./helpers";
import { evaluateCraft } from "./craft";
import { evaluateSynthesis } from "./synthesis";
import type {
  EvalResult,
  OpportunityRow,
  PriceBook,
  PriceOpts,
  ScanRepo,
} from "./types";

/** Bir sonuç ROI sıralamasına girmeye uygun mu? */
export function isFeasible(r: EvalResult): boolean {
  return r.roi != null && !r.hasMissingPrices;
}

export function scanOpportunities(
  repo: ScanRepo,
  prices: PriceBook,
  opts: PriceOpts = DEFAULT_PRICE_OPTS,
): OpportunityRow[] {
  const rows: OpportunityRow[] = [];

  for (const s of repo.synthesisScenarios()) {
    const result = evaluateSynthesis({
      inputGradeKey: s.inputGradeKey,
      category: s.category,
      tier: s.tier,
      inputUnitCents: s.inputUnitCents,
      rates: s.rates,
      dropsByGrade: s.dropsByGrade,
      prices,
      opts,
    });
    if (!isFeasible(result)) continue;
    rows.push({
      kind: "synthesis",
      payload: { category: s.category, inputGradeKey: s.inputGradeKey, tier: s.tier },
      result,
    });
  }

  for (const c of repo.craftScenarios()) {
    const result = evaluateCraft({
      slot: c.slot,
      tier: c.tier,
      gradeOdds: c.gradeOdds,
      materials: c.materials,
      dropsByGrade: c.dropsByGrade,
      prices,
      opts,
    });
    if (!isFeasible(result)) continue;
    rows.push({ kind: "craft", payload: { slot: c.slot, tier: c.tier }, result });
  }

  // roi DESC (feasible → roi non-null garanti).
  rows.sort((a, b) => (b.result.roi as number) - (a.result.roi as number));
  return rows;
}
