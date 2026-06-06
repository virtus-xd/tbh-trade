/**
 * Senaryo kurucu — DB'yi TOPLU okuyup `packages/calc` için ScanRepo + PriceBook
 * üretir. (Tek tek sorgu yerine her tabloyu bir kez çekip bellekte gruplar.)
 */
import { buildBookFromRows, type PriceRow } from "./pricebook";
import { getQueryClient } from "db";
import { buyPrice } from "calc";
import type {
  CraftScenario,
  GradeKey,
  Pool,
  PriceBook,
  ScanRepo,
  SynthCategory,
  SynthRate,
  SynthScenario,
} from "calc";
import type { CraftSlot } from "shared";

type Sql = ReturnType<typeof getQueryClient>;

function avgBuyOverPool(pool: Pool, prices: PriceBook): number | null {
  let sum = 0;
  let n = 0;
  for (const e of pool) {
    if (!e.tradable) continue;
    const p = buyPrice(prices.get(e.refType, e.id));
    if (p == null) continue;
    sum += p;
    n += 1;
  }
  return n > 0 ? Math.round(sum / n) : null;
}

export async function buildScanRepo(): Promise<{ repo: ScanRepo; prices: PriceBook }> {
  const sql: Sql = getQueryClient();

  // --- Fiyat defteri ---
  const priceRows = (await sql`
    SELECT ref_type, ref_id, lowest_cents, median_cents, volume FROM market_prices WHERE currency = 1
  `) as PriceRow[];
  const prices = buildBookFromRows(priceRows);

  // --- Sentez oranları (girdi kademesine göre) ---
  const rateRows = (await sql`
    SELECT ig.key AS input_grade, rg.key AS result_grade, r.probability, r.is_fail, r.is_great_success
    FROM synthesis_rates r
    JOIN grades ig ON r.input_grade_id = ig.id
    JOIN grades rg ON r.result_grade_id = rg.id
    ORDER BY ig.id, rg.id
  `) as Array<{
    input_grade: GradeKey;
    result_grade: GradeKey;
    probability: string;
    is_fail: boolean;
    is_great_success: boolean;
  }>;
  const ratesByInput = new Map<GradeKey, SynthRate[]>();
  for (const r of rateRows) {
    const arr = ratesByInput.get(r.input_grade) ?? [];
    arr.push({
      resultGradeKey: r.result_grade,
      probability: Number(r.probability),
      isFail: r.is_fail,
      isGreatSuccess: r.is_great_success,
    });
    ratesByInput.set(r.input_grade, arr);
  }

  // --- Sentez havuzları: (category|tier) → grade → Pool ---
  const synthDropRows = (await sql`
    SELECT d.category, d.tier, g.key AS grade, d.item_id, d.material_id,
           COALESCE(i.tradable, m.tradable, false) AS tradable
    FROM synthesis_drops d
    JOIN grades g ON d.result_grade_id = g.id
    LEFT JOIN items i ON d.item_id = i.id
    LEFT JOIN materials m ON d.material_id = m.id
  `) as Array<{
    category: SynthCategory;
    tier: number;
    grade: GradeKey;
    item_id: number | null;
    material_id: number | null;
    tradable: boolean;
  }>;

  const synthPools = new Map<string, Map<GradeKey, Pool>>(); // key `${category}|${tier}`
  for (const r of synthDropRows) {
    const key = `${r.category}|${r.tier}`;
    let byGrade = synthPools.get(key);
    if (!byGrade) {
      byGrade = new Map();
      synthPools.set(key, byGrade);
    }
    const refType = r.item_id != null ? "item" : "material";
    const id = r.item_id ?? r.material_id;
    if (id == null) continue;
    const arr = byGrade.get(r.grade) ?? [];
    arr.push({ refType: refType as "item" | "material", id, tradable: r.tradable });
    byGrade.set(r.grade, arr);
  }

  const synthScenarios: SynthScenario[] = [];
  for (const [key, dropsByGrade] of synthPools) {
    const [categoryStr, tierStr] = key.split("|");
    const category = categoryStr as SynthCategory;
    const tier = Number(tierStr);
    for (const [inputGradeKey, inputPool] of dropsByGrade) {
      const rates = ratesByInput.get(inputGradeKey);
      if (!rates || rates.length === 0) continue; // bu kademeden sentez yok
      const inputGradeTradable = inputPool.some((e) => e.tradable);
      const inputUnitCents = inputGradeTradable ? avgBuyOverPool(inputPool, prices) : null;
      synthScenarios.push({
        category,
        inputGradeKey,
        tier,
        inputUnitCents,
        rates,
        dropsByGrade,
      });
    }
  }

  // --- Üretim reçeteleri ---
  const recipeRows = (await sql`
    SELECT id, slot, tier, grade_odds FROM craft_recipes
  `) as Array<{ id: number; slot: CraftSlot; tier: number; grade_odds: Partial<Record<GradeKey, number>> }>;

  const matRows = (await sql`
    SELECT recipe_id, material_id, qty FROM craft_recipe_materials
  `) as Array<{ recipe_id: number; material_id: number; qty: number }>;
  const matsByRecipe = new Map<number, { id: number; qty: number }[]>();
  for (const r of matRows) {
    const arr = matsByRecipe.get(r.recipe_id) ?? [];
    arr.push({ id: r.material_id, qty: r.qty });
    matsByRecipe.set(r.recipe_id, arr);
  }

  const craftDropRows = (await sql`
    SELECT cd.recipe_id, g.key AS grade, cd.item_id, i.tradable
    FROM craft_drops cd
    JOIN grades g ON cd.result_grade_id = g.id
    JOIN items i ON cd.item_id = i.id
  `) as Array<{ recipe_id: number; grade: GradeKey; item_id: number; tradable: boolean }>;
  const dropsByRecipe = new Map<number, Map<GradeKey, Pool>>();
  for (const r of craftDropRows) {
    let byGrade = dropsByRecipe.get(r.recipe_id);
    if (!byGrade) {
      byGrade = new Map();
      dropsByRecipe.set(r.recipe_id, byGrade);
    }
    const arr = byGrade.get(r.grade) ?? [];
    arr.push({ refType: "item", id: r.item_id, tradable: r.tradable });
    byGrade.set(r.grade, arr);
  }

  const craftScenarios: CraftScenario[] = recipeRows.map((rec) => ({
    slot: rec.slot,
    tier: rec.tier,
    gradeOdds: rec.grade_odds,
    materials: matsByRecipe.get(rec.id) ?? [],
    dropsByGrade: dropsByRecipe.get(rec.id) ?? new Map(),
  }));

  const repo: ScanRepo = {
    synthesisScenarios: () => synthScenarios,
    craftScenarios: () => craftScenarios,
  };
  return { repo, prices };
}
