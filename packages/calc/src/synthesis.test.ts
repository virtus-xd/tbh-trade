import { describe, it, expect } from "vitest";
import { evaluateSynthesis } from "./synthesis";
import type { GradeKey, Pool, PriceBook, PriceQuote, SynthRate } from "./types";

function book(map: Record<string, PriceQuote>): PriceBook {
  return { get: (t, id) => map[`${t}:${id}`] ?? null };
}

// Immortal sentez datamined oranları (seed/synthesis_rates.json).
const immortalRates: SynthRate[] = [
  { resultGradeKey: "immortal", probability: 0.5, isFail: true, isGreatSuccess: false },
  { resultGradeKey: "arcana", probability: 0.5, isFail: false, isGreatSuccess: false },
  { resultGradeKey: "beyond", probability: 0.0025, isFail: false, isGreatSuccess: true },
];

function immortalPools(): Map<GradeKey, Pool> {
  return new Map<GradeKey, Pool>([
    ["immortal", [{ refType: "item", id: 1, tradable: true }]],
    ["arcana", [{ refType: "item", id: 2, tradable: true }]],
    ["beyond", [{ refType: "item", id: 3, tradable: true }]],
  ]);
}

const immortalPrices = book({
  "item:1": { lowest: 10000, median: 10000, volume: 0 },
  "item:2": { lowest: 50000, median: 50000, volume: 0 },
  "item:3": { lowest: 200000, median: 200000, volume: 0 },
});

describe("evaluateSynthesis — Immortal", () => {
  it("failProb ≈ 0.50 (aynı kademe normalize sonrası)", () => {
    const r = evaluateSynthesis({
      inputGradeKey: "immortal",
      category: "gear",
      tier: 6,
      inputUnitCents: 8000,
      rates: immortalRates,
      dropsByGrade: immortalPools(),
      prices: immortalPrices,
    });
    expect(r.failProb).toBeCloseTo(0.5 / 1.0025, 4);
    expect(r.failProb).toBeCloseTo(0.5, 2);
  });

  it("evSell fail havuzunu içerir ve komisyon uygular (brüt × 0.85)", () => {
    const r = evaluateSynthesis({
      inputGradeKey: "immortal",
      category: "gear",
      tier: 6,
      inputUnitCents: 8000,
      rates: immortalRates,
      dropsByGrade: immortalPools(),
      prices: immortalPrices,
    });
    // outcomes fail (immortal) havuzunu da taşır
    const fail = r.outcomes.find((o) => o.isFail);
    expect(fail?.poolAvgSell).toBe(10000);
    // evSell = round( Σ prob×poolAvgSell × 0.85 )
    const gross = r.outcomes.reduce((s, o) => s + o.prob * o.poolAvgSell, 0);
    expect(r.evSellCents).toBe(Math.round(gross * 0.85));
    // cost = 9 × 8000
    expect(r.costCents).toBe(72000);
    expect(r.netCents).toBe(r.evSellCents - 72000);
    expect(r.roi).toBeCloseTo(r.netCents / 72000, 10);
    expect(r.farmMode).toBe(false);
  });
});

describe("evaluateSynthesis — farm modu", () => {
  it("inputUnitCents null → cost 0, roi null, net = evSell", () => {
    const r = evaluateSynthesis({
      inputGradeKey: "immortal",
      category: "gear",
      tier: 6,
      inputUnitCents: null,
      rates: immortalRates,
      dropsByGrade: immortalPools(),
      prices: immortalPrices,
    });
    expect(r.costCents).toBe(0);
    expect(r.roi).toBeNull();
    expect(r.farmMode).toBe(true);
    expect(r.netCents).toBe(r.evSellCents);
  });
});

describe("evaluateSynthesis — fiyatsız havuz", () => {
  it("tradable ama fiyatsız çıktı → hasMissingPrices", () => {
    const pools = new Map<GradeKey, Pool>([
      ["immortal", [{ refType: "item", id: 1, tradable: true }]],
      ["arcana", [{ refType: "item", id: 99, tradable: true }]], // fiyatı yok
      ["beyond", [{ refType: "item", id: 3, tradable: true }]],
    ]);
    const r = evaluateSynthesis({
      inputGradeKey: "immortal",
      category: "gear",
      tier: 6,
      inputUnitCents: 8000,
      rates: immortalRates,
      dropsByGrade: pools,
      prices: book({
        "item:1": { lowest: 10000, median: 10000, volume: 0 },
        "item:3": { lowest: 200000, median: 200000, volume: 0 },
      }),
    });
    expect(r.hasMissingPrices).toBe(true);
  });
});
