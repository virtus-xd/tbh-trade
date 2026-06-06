/**
 * calc tipleri — docs/03-calc-engine.md "Çekirdek tipler".
 *
 * Motor DB'den bağımsızdır: fiyatlar `PriceBook` ile, havuzlar/oranlar argüman
 * olarak enjekte edilir. Tüm para alanları cents (USD).
 */
import type { CraftSlot, GradeKey, RefType, SynthCategory } from "shared";

export type { CraftSlot, GradeKey, RefType, SynthCategory };

/** market_prices satırının motor görünümü. Alanlar null olabilir (listelenmemiş/eksik). */
export interface PriceQuote {
  lowest: number | null; // alış maliyeti bazı (lowest_cents)
  median: number | null; // satış EV bazı (median_cents)
  volume: number | null; // medyan güvenilirliği için hacim
}

/** Fiyat erişimi — DB cache'inden okunur (frontend asla Steam'e gitmez). */
export interface PriceBook {
  get(refType: RefType, id: number): PriceQuote | null;
}

/** Bir çıktı havuzunun tek üyesi (gear item ya da material). */
export interface PoolEntry {
  refType: RefType;
  id: number;
  tradable: boolean; // grade.tradable && market_hash_name var
}

/** Belirli bir sonuç-kademesindeki olası çıktıların (eşit olasılıklı) havuzu. */
export type Pool = PoolEntry[];

/** Tek bir sonuç kademesinin dağılım satırı (UI tablosu). */
export interface Outcome {
  gradeKey: GradeKey;
  prob: number; // normalize edilmiş [0..1]
  isFail: boolean; // sentez: aynı kademe
  isGreat: boolean; // +2 kademe büyük başarı
  poolAvgSell: number; // havuzun komisyon ÖNCESİ ortalama satış değeri (cents)
}

export interface EvalResult {
  costCents: number; // girdi/malzeme alış maliyeti
  evSellCents: number; // komisyon düşülmüş beklenen brüt gelir
  netCents: number; // evSell - cost
  roi: number | null; // net / cost (farm modunda null)
  failProb: number; // sentez: aynı kademe olasılığı (craft'ta 0)
  profitProb: number; // tek denemede net>0 olma olasılığı
  outcomes: Outcome[];
  hasMissingPrices: boolean; // bir tradable havuz/malzeme fiyatsız → güvenilmez
  farmMode: boolean; // girdi tradable değil (alınamaz) → cost=0, roi=null
}

/** synthesis_rates'in tek input-kademesi için motor görünümü. */
export interface SynthRate {
  resultGradeKey: GradeKey;
  probability: number; // ham datamined oran (normalize edilmemiş)
  isFail: boolean;
  isGreatSuccess: boolean;
}

/** Fiyat seçimi ayarları (config'ten gelebilir). */
export interface PriceOpts {
  /** median kullanmak için min hacim (altındaysa lowest'a düşer). */
  volumeThreshold: number;
  /** satış komisyonu (Değişmez kural #4). */
  fee: number;
}

// --- scanOpportunities enjekte senaryoları --------------------------------

export interface SynthScenario {
  category: SynthCategory;
  inputGradeKey: GradeKey;
  tier: number;
  inputUnitCents: number | null;
  rates: SynthRate[];
  dropsByGrade: Map<GradeKey, Pool>;
}

export interface CraftScenario {
  slot: CraftSlot;
  tier: number;
  gradeOdds: Partial<Record<GradeKey, number>>;
  materials: { id: number; qty: number }[];
  dropsByGrade: Map<GradeKey, Pool>;
}

export interface ScanRepo {
  synthesisScenarios(): SynthScenario[];
  craftScenarios(): CraftScenario[];
}

export type OpportunityKind = "synthesis" | "craft";

export interface OpportunityRow {
  kind: OpportunityKind;
  payload: Record<string, unknown>; // senaryo tanımlayıcı (UI/DB için)
  result: EvalResult;
}
