/**
 * Sentez (Synthesis) değerlendirme — docs/03 §"Sentez değerlendirme".
 *
 * Girdi: 9 eşya (aynı kademe+kategori) → tek sentez aksiyonu. Sonuç bir kademe
 * dağılımıdır (yükselme / büyük başarı / Immortal+'da fail = aynı kademe).
 */
import {
  DEFAULT_PRICE_OPTS,
  expectedSellCents,
  poolSellValues,
  profitProbability,
} from "./helpers";
import type {
  EvalResult,
  GradeKey,
  Outcome,
  Pool,
  PriceBook,
  PriceOpts,
  SynthCategory,
  SynthRate,
} from "./types";

/** Bir sentez aksiyonunda tüketilen girdi sayısı (9 eşya). */
export const SYNTH_INPUT_COUNT = 9;

export interface EvaluateSynthesisArgs {
  inputGradeKey: GradeKey;
  category: SynthCategory;
  tier: number;
  /** Bir girdinin alış fiyatı; tradable değilse null → farm modu (cost=0, roi=null). */
  inputUnitCents: number | null;
  rates: SynthRate[];
  dropsByGrade: Map<GradeKey, Pool>;
  prices: PriceBook;
  opts?: PriceOpts;
}

export function evaluateSynthesis(args: EvaluateSynthesisArgs): EvalResult {
  const opts = args.opts ?? DEFAULT_PRICE_OPTS;
  const { rates, dropsByGrade, prices } = args;

  let total = 0;
  for (const r of rates) total += r.probability;

  const outcomes: Outcome[] = [];
  const evParts: { prob: number; avg: number }[] = [];
  const profitParts: { prob: number; values: number[] }[] = [];
  let hasMissingPrices = false;

  for (const r of rates) {
    const prob = total > 0 ? r.probability / total : 0;
    const pool = dropsByGrade.get(r.resultGradeKey) ?? [];
    const { values, missing } = poolSellValues(pool, prices, opts);
    if (missing) hasMissingPrices = true;
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    outcomes.push({
      gradeKey: r.resultGradeKey,
      prob,
      isFail: r.isFail,
      isGreat: r.isGreatSuccess,
      poolAvgSell: avg,
    });
    evParts.push({ prob, avg });
    profitParts.push({ prob, values });
  }

  const farmMode = args.inputUnitCents == null;
  const costCents = farmMode ? 0 : SYNTH_INPUT_COUNT * (args.inputUnitCents as number);
  const evSellCents = expectedSellCents(evParts, opts.fee);
  const netCents = evSellCents - costCents;
  const roi = costCents > 0 ? netCents / costCents : null;

  let failProb = 0;
  for (const o of outcomes) if (o.isFail) failProb += o.prob;

  const profitProb = profitProbability(profitParts, costCents, opts.fee);

  return {
    costCents,
    evSellCents,
    netCents,
    roi,
    failProb,
    profitProb,
    outcomes,
    hasMissingPrices,
    farmMode,
  };
}
