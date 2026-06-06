/**
 * Sunucu-yalnız calc veri katmanı (Değişmez kural #1: tarayıcı Steam'e gitmez;
 * tüm fiyatlar DB cache'inden okunur). DB satırlarını `packages/calc` girdilerine
 * (PriceBook + havuzlar + oranlar + girdi fiyatı) çevirir ve motoru çağırır.
 *
 * Bu modül `db`/`postgres` import ettiği için ASLA bir client component'ten
 * import edilmemeli — yalnız RSC ve route handler'lardan.
 */
import "server-only";
import { buyPrice, evaluateCraft, evaluateSynthesis } from "calc";
import type { GradeKey, Pool, PriceBook, PriceQuote, SynthCategory, SynthRate } from "calc";
import { CRAFT_SLOTS, type CraftSlot } from "shared";
import { getQueryClient } from "db";
import type {
  CraftOptions,
  CraftResult,
  HealthSummary,
  IngestRunRow,
  ItemDetail,
  MaterialDetail,
  MaterialLine,
  OpportunityListItem,
  PricePoint,
  PriceSnapshot,
  SynthesisOptions,
  SynthesisResult,
} from "./calc-types";

type Sql = ReturnType<typeof getQueryClient>;
const db = (): Sql => getQueryClient();

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// --- Fiyat defteri ---------------------------------------------------------
export interface LoadedPriceBook {
  prices: PriceBook;
  lastUpdatedIso: string | null;
}

export async function loadPriceBook(): Promise<LoadedPriceBook> {
  const rows = (await db()`
    SELECT ref_type, ref_id, lowest_cents, median_cents, volume, fetched_at
    FROM market_prices WHERE currency = 1
  `) as Array<{
    ref_type: string;
    ref_id: number;
    lowest_cents: number | null;
    median_cents: number | null;
    volume: number | null;
    fetched_at: string | Date;
  }>;

  const map = new Map<string, PriceQuote>();
  let latest = 0;
  for (const r of rows) {
    map.set(`${r.ref_type}:${r.ref_id}`, {
      lowest: toNum(r.lowest_cents),
      median: toNum(r.median_cents),
      volume: toNum(r.volume),
    });
    const t = new Date(r.fetched_at).getTime();
    if (t > latest) latest = t;
  }

  const prices: PriceBook = { get: (refType, id) => map.get(`${refType}:${id}`) ?? null };
  return { prices, lastUpdatedIso: latest > 0 ? new Date(latest).toISOString() : null };
}

// --- Havuz yükleme ---------------------------------------------------------
type DropRow = { grade: GradeKey; item_id: number | null; material_id: number | null; tradable: boolean };

function groupPools(rows: DropRow[]): Map<GradeKey, Pool> {
  const pools = new Map<GradeKey, Pool>();
  for (const r of rows) {
    const refType = r.item_id != null ? "item" : "material";
    const id = r.item_id ?? r.material_id;
    if (id == null) continue;
    const entry = { refType: refType as "item" | "material", id, tradable: r.tradable };
    const arr = pools.get(r.grade);
    if (arr) arr.push(entry);
    else pools.set(r.grade, [entry]);
  }
  return pools;
}

/** Havuzdaki tradable+fiyatlı üyelerin ortalama alış (lowest) fiyatı; yoksa null. */
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

// --- Sentez ----------------------------------------------------------------
export async function evaluateSynthesisScenario(args: {
  category: SynthCategory;
  inputGradeKey: GradeKey;
  tier: number;
}): Promise<SynthesisResult> {
  const { category, inputGradeKey, tier } = args;
  const { prices, lastUpdatedIso } = await loadPriceBook();

  const dropRows = (await db()`
    SELECT g.key AS grade, d.item_id, d.material_id,
           COALESCE(i.tradable, m.tradable, false) AS tradable
    FROM synthesis_drops d
    JOIN grades g ON d.result_grade_id = g.id
    LEFT JOIN items i ON d.item_id = i.id
    LEFT JOIN materials m ON d.material_id = m.id
    WHERE d.category = ${category} AND d.tier = ${tier}
  `) as DropRow[];
  const dropsByGrade = groupPools(dropRows);

  const rateRows = (await db()`
    SELECT rg.key AS result_grade, r.probability, r.is_fail, r.is_great_success
    FROM synthesis_rates r
    JOIN grades ig ON r.input_grade_id = ig.id
    JOIN grades rg ON r.result_grade_id = rg.id
    WHERE ig.key = ${inputGradeKey}
    ORDER BY rg.id
  `) as Array<{ result_grade: GradeKey; probability: string; is_fail: boolean; is_great_success: boolean }>;
  const rates: SynthRate[] = rateRows.map((r) => ({
    resultGradeKey: r.result_grade,
    probability: Number(r.probability),
    isFail: r.is_fail,
    isGreatSuccess: r.is_great_success,
  }));

  const inputPool = dropsByGrade.get(inputGradeKey) ?? [];
  const inputGradeTradable = inputPool.some((e) => e.tradable);
  const inputUnitCents = inputGradeTradable ? avgBuyOverPool(inputPool, prices) : null;
  const inputPriceMissing = inputGradeTradable && inputUnitCents == null;

  const result = evaluateSynthesis({
    inputGradeKey,
    category,
    tier,
    inputUnitCents,
    rates,
    dropsByGrade,
    prices,
  });

  return {
    kind: "synthesis",
    result,
    meta: {
      category,
      inputGradeKey,
      tier,
      inputUnitCents,
      inputGradeTradable,
      inputPriceMissing,
      inputPoolSize: inputPool.length,
      breakevenInputCents: Math.round(result.evSellCents / 9),
      lastUpdatedIso,
    },
  };
}

// --- Üretim ----------------------------------------------------------------
export async function evaluateCraftScenario(args: {
  slot: CraftSlot;
  tier: number;
}): Promise<CraftResult | null> {
  const { slot, tier } = args;
  const { prices, lastUpdatedIso } = await loadPriceBook();

  const recipeRows = (await db()`
    SELECT id, grade_odds FROM craft_recipes WHERE slot = ${slot} AND tier = ${tier} LIMIT 1
  `) as Array<{ id: number; grade_odds: Partial<Record<GradeKey, number>> }>;
  const recipe = recipeRows[0];
  if (!recipe) return null;

  const matRows = (await db()`
    SELECT crm.material_id, crm.qty, m.name_en, m.tradable
    FROM craft_recipe_materials crm
    JOIN materials m ON crm.material_id = m.id
    WHERE crm.recipe_id = ${recipe.id}
    ORDER BY crm.material_id
  `) as Array<{ material_id: number; qty: number; name_en: string; tradable: boolean }>;

  const materials: { id: number; qty: number }[] = matRows.map((m) => ({ id: m.material_id, qty: m.qty }));
  const materialLines: MaterialLine[] = matRows.map((m) => {
    const unit = buyPrice(prices.get("material", m.material_id));
    return {
      id: m.material_id,
      nameEn: m.name_en,
      qty: m.qty,
      unitCents: unit,
      lineCents: unit != null ? unit * m.qty : null,
    };
  });

  const dropRows = (await db()`
    SELECT g.key AS grade, cd.item_id, NULL::int AS material_id, i.tradable
    FROM craft_drops cd
    JOIN grades g ON cd.result_grade_id = g.id
    JOIN items i ON cd.item_id = i.id
    WHERE cd.recipe_id = ${recipe.id}
  `) as DropRow[];
  const dropsByGrade = groupPools(dropRows);

  const result = evaluateCraft({
    slot,
    tier,
    gradeOdds: recipe.grade_odds,
    materials,
    dropsByGrade,
    prices,
  });

  return {
    kind: "craft",
    result,
    meta: {
      slot,
      tier,
      materials: materialLines,
      breakevenCostCents: result.evSellCents,
      lastUpdatedIso,
    },
  };
}

// --- Form seçenekleri ------------------------------------------------------
export async function synthesisOptions(): Promise<SynthesisOptions> {
  // Geçerli girdi kademesi = o (kategori,tier) havuzunda bulunan VE sentez oranı olan kademe.
  const rows = (await db()`
    SELECT d.category, d.tier, g.key AS grade, g.id
    FROM (SELECT DISTINCT category, tier, result_grade_id FROM synthesis_drops) d
    JOIN grades g ON d.result_grade_id = g.id
    WHERE g.id IN (SELECT DISTINCT input_grade_id FROM synthesis_rates)
    ORDER BY d.category, d.tier, g.id
  `) as Array<{ category: SynthCategory; tier: number; grade: GradeKey; id: number }>;

  const byCat = new Map<SynthCategory, Map<number, GradeKey[]>>();
  for (const r of rows) {
    let tiers = byCat.get(r.category);
    if (!tiers) {
      tiers = new Map();
      byCat.set(r.category, tiers);
    }
    const arr = tiers.get(r.tier);
    if (arr) arr.push(r.grade);
    else tiers.set(r.tier, [r.grade]);
  }

  const categories = [...byCat.entries()].map(([key, tiers]) => ({
    key,
    tiers: [...tiers.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tier, inputGrades]) => ({ tier, inputGrades })),
  }));
  return { categories };
}

export async function loadOpportunities(limit = 200): Promise<OpportunityListItem[]> {
  const rows = (await db()`
    SELECT id, kind, payload, cost_cents, ev_cents, net_cents, roi, profit_prob, fail_prob, computed_at
    FROM opportunities ORDER BY roi DESC LIMIT ${limit}
  `) as Array<{
    id: number;
    kind: "synthesis" | "craft";
    payload: Record<string, unknown>;
    cost_cents: number;
    ev_cents: number;
    net_cents: number;
    roi: string;
    profit_prob: string | null;
    fail_prob: string | null;
    computed_at: string | Date;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload,
    costCents: r.cost_cents,
    evCents: r.ev_cents,
    netCents: r.net_cents,
    roi: Number(r.roi),
    profitProb: toNum(r.profit_prob),
    failProb: toNum(r.fail_prob),
    computedAtIso: new Date(r.computed_at).toISOString(),
  }));
}

// --- Health dashboard ------------------------------------------------------
function mapRun(r: {
  id: number; kind: "ingest" | "scan"; ok: boolean; started_at: string | Date;
  finished_at: string | Date | null; duration_ms: number | null;
  stats: Record<string, unknown> | null; error: string | null;
}): IngestRunRow {
  return {
    id: r.id,
    kind: r.kind,
    ok: r.ok,
    startedAtIso: new Date(r.started_at).toISOString(),
    finishedAtIso: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    durationMs: r.duration_ms,
    stats: r.stats,
    error: r.error,
  };
}

export async function loadHealthSummary(): Promise<HealthSummary> {
  type RunRow = Parameters<typeof mapRun>[0];
  const recent = (await db()`
    SELECT id, kind, ok, started_at, finished_at, duration_ms, stats, error
    FROM ingest_runs ORDER BY started_at DESC LIMIT 20
  `) as RunRow[];
  const runs = recent.map(mapRun);

  const counts = (await db()`
    SELECT
      (SELECT count(*) FROM market_prices WHERE currency = 1) AS prices_total,
      (SELECT max(fetched_at) FROM market_prices WHERE currency = 1) AS last_price,
      (SELECT count(*) FROM items WHERE tradable) AS tradable_items,
      (SELECT count(*) FROM items i WHERE i.tradable AND EXISTS
        (SELECT 1 FROM market_prices p WHERE p.ref_type='item' AND p.ref_id=i.id)) AS priced_items,
      (SELECT count(*) FROM materials WHERE tradable) AS tradable_materials,
      (SELECT count(*) FROM materials m WHERE m.tradable AND EXISTS
        (SELECT 1 FROM market_prices p WHERE p.ref_type='material' AND p.ref_id=m.id)) AS priced_materials,
      (SELECT count(*) FROM market_mapping_audit WHERE status='unmatched') AS unmatched,
      (SELECT count(*) FROM market_mapping_audit WHERE status='ambiguous') AS ambiguous,
      (SELECT count(*) FROM opportunities) AS opp_count,
      (SELECT max(computed_at) FROM opportunities) AS opp_computed
  `) as Array<{
    prices_total: number; last_price: string | Date | null;
    tradable_items: number; priced_items: number;
    tradable_materials: number; priced_materials: number;
    unmatched: number; ambiguous: number;
    opp_count: number; opp_computed: string | Date | null;
  }>;
  const c = counts[0];

  return {
    lastIngest: runs.find((r) => r.kind === "ingest") ?? null,
    lastScan: runs.find((r) => r.kind === "scan") ?? null,
    recentRuns: runs.slice(0, 10),
    lastPriceIso: c?.last_price ? new Date(c.last_price).toISOString() : null,
    pricesTotal: Number(c?.prices_total ?? 0),
    tradableItems: Number(c?.tradable_items ?? 0),
    pricedItems: Number(c?.priced_items ?? 0),
    tradableMaterials: Number(c?.tradable_materials ?? 0),
    pricedMaterials: Number(c?.priced_materials ?? 0),
    unmatchedNames: Number(c?.unmatched ?? 0),
    ambiguousNames: Number(c?.ambiguous ?? 0),
    opportunitiesCount: Number(c?.opp_count ?? 0),
    opportunitiesComputedIso: c?.opp_computed ? new Date(c.opp_computed).toISOString() : null,
  };
}

// --- Detay sayfaları -------------------------------------------------------
async function loadPriceSnapshot(refType: "item" | "material", id: number): Promise<PriceSnapshot | null> {
  const rows = (await db()`
    SELECT lowest_cents, median_cents, volume, fetched_at
    FROM market_prices WHERE ref_type = ${refType} AND ref_id = ${id} AND currency = 1 LIMIT 1
  `) as Array<{ lowest_cents: number | null; median_cents: number | null; volume: number | null; fetched_at: string | Date }>;
  const r = rows[0];
  if (!r) return null;
  return {
    lowestCents: toNum(r.lowest_cents),
    medianCents: toNum(r.median_cents),
    volume: toNum(r.volume),
    fetchedAtIso: r.fetched_at ? new Date(r.fetched_at).toISOString() : null,
  };
}

async function loadHistory(refType: "item" | "material", id: number): Promise<PricePoint[]> {
  const rows = (await db()`
    SELECT price_cents, observed_at FROM price_history
    WHERE ref_type = ${refType} AND ref_id = ${id} AND currency = 1
    ORDER BY observed_at ASC LIMIT 90
  `) as Array<{ price_cents: number; observed_at: string | Date }>;
  return rows.map((r) => ({ iso: new Date(r.observed_at).toISOString(), cents: r.price_cents }));
}

export async function loadItemDetail(slug: string): Promise<ItemDetail | null> {
  const rows = (await db()`
    SELECT i.id, i.slug, i.name_en, i.name_tr, g.key AS grade, i.level, i.tradable,
           i.market_hash_name, i.image_url
    FROM items i JOIN grades g ON i.grade_id = g.id WHERE i.slug = ${slug} LIMIT 1
  `) as Array<{
    id: number; slug: string; name_en: string; name_tr: string | null; grade: GradeKey;
    level: number; tradable: boolean; market_hash_name: string | null; image_url: string | null;
  }>;
  const it = rows[0];
  if (!it) return null;

  const craftedBy = (await db()`
    SELECT DISTINCT cr.slot, cr.tier FROM craft_drops cd
    JOIN craft_recipes cr ON cd.recipe_id = cr.id WHERE cd.item_id = ${it.id} ORDER BY cr.tier
  `) as Array<{ slot: CraftSlot; tier: number }>;

  const fromSynthesis = (await db()`
    SELECT DISTINCT d.category, d.tier, g.key AS result_grade FROM synthesis_drops d
    JOIN grades g ON d.result_grade_id = g.id WHERE d.item_id = ${it.id} ORDER BY d.tier
  `) as Array<{ category: SynthCategory; tier: number; result_grade: GradeKey }>;

  return {
    id: it.id, slug: it.slug, nameEn: it.name_en, nameTr: it.name_tr, gradeKey: it.grade,
    level: it.level, tradable: it.tradable, marketHashName: it.market_hash_name, imageUrl: it.image_url,
    price: it.tradable ? await loadPriceSnapshot("item", it.id) : null,
    history: it.tradable ? await loadHistory("item", it.id) : [],
    craftedBy: craftedBy.map((c) => ({ slot: c.slot, tier: c.tier })),
    fromSynthesis: fromSynthesis.map((s) => ({ category: s.category, tier: s.tier, resultGradeKey: s.result_grade })),
  };
}

export async function loadMaterialDetail(slug: string): Promise<MaterialDetail | null> {
  const rows = (await db()`
    SELECT m.id, m.slug, m.name_en, m.name_tr, g.key AS grade, m.category, m.tradable,
           m.market_hash_name, m.image_url
    FROM materials m JOIN grades g ON m.grade_id = g.id WHERE m.slug = ${slug} LIMIT 1
  `) as Array<{
    id: number; slug: string; name_en: string; name_tr: string | null; grade: GradeKey;
    category: string; tradable: boolean; market_hash_name: string | null; image_url: string | null;
  }>;
  const mat = rows[0];
  if (!mat) return null;

  const usedInCraft = (await db()`
    SELECT cr.slot, cr.tier, crm.qty FROM craft_recipe_materials crm
    JOIN craft_recipes cr ON crm.recipe_id = cr.id WHERE crm.material_id = ${mat.id} ORDER BY cr.tier
  `) as Array<{ slot: CraftSlot; tier: number; qty: number }>;

  const fromSynthesis = (await db()`
    SELECT DISTINCT d.category, d.tier, g.key AS result_grade FROM synthesis_drops d
    JOIN grades g ON d.result_grade_id = g.id WHERE d.material_id = ${mat.id} ORDER BY d.tier
  `) as Array<{ category: SynthCategory; tier: number; result_grade: GradeKey }>;

  return {
    id: mat.id, slug: mat.slug, nameEn: mat.name_en, nameTr: mat.name_tr, gradeKey: mat.grade,
    category: mat.category, tradable: mat.tradable, marketHashName: mat.market_hash_name, imageUrl: mat.image_url,
    price: mat.tradable ? await loadPriceSnapshot("material", mat.id) : null,
    history: mat.tradable ? await loadHistory("material", mat.id) : [],
    usedInCraft: usedInCraft.map((c) => ({ slot: c.slot, tier: c.tier, qty: c.qty })),
    fromSynthesis: fromSynthesis.map((s) => ({ category: s.category, tier: s.tier, resultGradeKey: s.result_grade })),
  };
}

/** Sitemap için tüm slug'lar (+ tradable bilgisi öncelik için). */
export async function allItemSlugs(): Promise<string[]> {
  const rows = (await db()`SELECT slug FROM items ORDER BY id`) as Array<{ slug: string }>;
  return rows.map((r) => r.slug);
}
export async function allMaterialSlugs(): Promise<string[]> {
  const rows = (await db()`SELECT slug FROM materials ORDER BY id`) as Array<{ slug: string }>;
  return rows.map((r) => r.slug);
}

export async function craftOptions(): Promise<CraftOptions> {
  const rows = (await db()`
    SELECT slot, tier FROM craft_recipes ORDER BY tier
  `) as Array<{ slot: CraftSlot; tier: number }>;

  const bySlot = new Map<CraftSlot, number[]>();
  for (const r of rows) {
    const arr = bySlot.get(r.slot);
    if (arr) arr.push(r.tier);
    else bySlot.set(r.slot, [r.tier]);
  }
  // CRAFT_SLOTS sırasını koru
  const slots = CRAFT_SLOTS.filter((s) => bySlot.has(s)).map((slot) => ({
    slot,
    tiers: (bySlot.get(slot) ?? []).slice().sort((a, b) => a - b),
  }));
  return { slots };
}
