/**
 * calc — Saf, yan-etkisiz olasılık/EV motoru (docs/03-calc-engine.md).
 *
 * UI ve worker bu paketi paylaşır; DB'den bağımsızdır (fiyatlar PriceBook,
 * havuzlar/oranlar argüman olarak enjekte edilir). Tüm para cents (USD).
 */

// Değişmez kural #4 ve #3 ile hizalı sabitler (shared'dan yeniden ihraç).
export { STEAM_FEE, TRADABLE_MIN_TIER, TRADABLE_MIN_GRADE } from "shared";

export * from "./types";
export {
  DEFAULT_PRICE_OPTS,
  normalizeOdds,
  sellPrice,
  buyPrice,
  poolSellValues,
  poolAverageSell,
  expectedSellCents,
  profitProbability,
} from "./helpers";
export { evaluateSynthesis, SYNTH_INPUT_COUNT } from "./synthesis";
export { evaluateCraft } from "./craft";
export { scanOpportunities, isFeasible } from "./scan";
