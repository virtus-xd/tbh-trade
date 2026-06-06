/**
 * /api/calc istek/yanıt tipleri — saf, DB/sunucu importu YOK.
 * Hem client component'ler hem sunucu (route + RSC) bunu paylaşır.
 */
import type { CraftSlot, EvalResult, GradeKey, RefType, SynthCategory } from "calc";

export type { CraftSlot, EvalResult, GradeKey, RefType, SynthCategory };

// --- İstek gövdeleri -------------------------------------------------------
export interface SynthesisRequest {
  kind: "synthesis";
  category: SynthCategory;
  inputGradeKey: GradeKey;
  tier: number;
  /** Manuel girdi-başı fiyat (cents). Verilirse otomatik en-ucuz yerine kullanılır. */
  inputUnitCents?: number | null;
}
export interface CraftRequest {
  kind: "craft";
  slot: CraftSlot;
  tier: number;
}
export type CalcRequest = SynthesisRequest | CraftRequest;

// --- Yanıt -----------------------------------------------------------------
export interface MaterialLine {
  id: number;
  nameEn: string;
  qty: number;
  unitCents: number | null;
  lineCents: number | null;
}

export interface SynthesisResult {
  kind: "synthesis";
  result: EvalResult;
  meta: {
    category: SynthCategory;
    inputGradeKey: GradeKey;
    tier: number;
    inputUnitCents: number | null; // kullanılan (manuel ya da otomatik) girdi-başı fiyat
    inputAutoCents: number | null; // otomatik en-ucuz piyasa fiyatı (override için referans)
    inputManual: boolean; // kullanıcı manuel fiyat mı girdi?
    inputGradeTradable: boolean;
    inputPriceMissing: boolean; // tradable ama fiyatsız (farm değil, eksik veri)
    inputPoolSize: number;
    breakevenInputCents: number; // net=0 yapan girdi-başı fiyat
    lastUpdatedIso: string | null;
  };
}

export interface CraftResult {
  kind: "craft";
  result: EvalResult;
  meta: {
    slot: CraftSlot;
    tier: number;
    materials: MaterialLine[];
    breakevenCostCents: number; // net=0 yapan toplam malzeme maliyeti
    lastUpdatedIso: string | null;
  };
}

export type CalcResponse = SynthesisResult | CraftResult;

// --- Form seçenekleri (RSC → client) --------------------------------------
export interface SynthTierOption {
  tier: number;
  inputGrades: GradeKey[];
}
export interface SynthCategoryOption {
  key: SynthCategory;
  tiers: SynthTierOption[];
}
export interface SynthesisOptions {
  categories: SynthCategoryOption[];
}

export interface CraftSlotOption {
  slot: CraftSlot;
  tiers: number[];
}
export interface CraftOptions {
  slots: CraftSlotOption[];
}

// --- Detay sayfaları -------------------------------------------------------
export interface PricePoint {
  iso: string;
  cents: number;
}
export interface RelatedCraft {
  slot: CraftSlot;
  tier: number;
}
export interface RelatedSynth {
  category: SynthCategory;
  tier: number;
  resultGradeKey: GradeKey;
}
export interface PriceSnapshot {
  lowestCents: number | null;
  medianCents: number | null;
  volume: number | null;
  fetchedAtIso: string | null;
}
export interface ItemDetail {
  id: number;
  slug: string;
  nameEn: string;
  nameTr: string | null;
  gradeKey: GradeKey;
  level: number;
  tradable: boolean;
  marketHashName: string | null;
  imageUrl: string | null;
  price: PriceSnapshot | null;
  history: PricePoint[];
  craftedBy: RelatedCraft[];
  fromSynthesis: RelatedSynth[];
}
export interface MaterialDetail {
  id: number;
  slug: string;
  nameEn: string;
  nameTr: string | null;
  gradeKey: GradeKey;
  category: string;
  tradable: boolean;
  marketHashName: string | null;
  imageUrl: string | null;
  price: PriceSnapshot | null;
  history: PricePoint[];
  usedInCraft: (RelatedCraft & { qty: number })[];
  fromSynthesis: RelatedSynth[];
}

// --- Health dashboard ------------------------------------------------------
export interface IngestRunRow {
  id: number;
  kind: "ingest" | "scan";
  ok: boolean;
  startedAtIso: string;
  finishedAtIso: string | null;
  durationMs: number | null;
  stats: Record<string, unknown> | null;
  error: string | null;
}
export interface HealthSummary {
  lastIngest: IngestRunRow | null;
  lastScan: IngestRunRow | null;
  recentRuns: IngestRunRow[];
  lastPriceIso: string | null;
  pricesTotal: number;
  tradableItems: number;
  pricedItems: number;
  tradableMaterials: number;
  pricedMaterials: number;
  unmatchedNames: number;
  ambiguousNames: number;
  opportunitiesCount: number;
  opportunitiesComputedIso: string | null;
}

// --- Fırsatlar (opportunities cache) --------------------------------------
export interface OpportunityListItem {
  id: number;
  kind: "synthesis" | "craft";
  payload: Record<string, unknown>;
  costCents: number;
  evCents: number;
  netCents: number;
  roi: number;
  profitProb: number | null;
  failProb: number | null;
  computedAtIso: string;
}
