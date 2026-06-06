import { describe, it, expect } from "vitest";
import { evaluateCraft } from "./craft";
import type { GradeKey, Pool, PriceBook, PriceQuote } from "./types";

function book(map: Record<string, PriceQuote>): PriceBook {
  return { get: (t, id) => map[`${t}:${id}`] ?? null };
}

// Main weapon T8 datamined oranları (seed/craft_recipes.json).
const t8Odds: Partial<Record<GradeKey, number>> = {
  rare: 0.48,
  legendary: 0.3,
  immortal: 0.18,
  arcana: 0.038,
  beyond: 0.002,
};

function t8Pools(): Map<GradeKey, Pool> {
  return new Map<GradeKey, Pool>([
    ["rare", [{ refType: "item", id: 1, tradable: false }]], // Legendary altı → $0
    ["legendary", [{ refType: "item", id: 10, tradable: true }]],
    ["immortal", [{ refType: "item", id: 20, tradable: true }]],
    ["arcana", [{ refType: "item", id: 30, tradable: true }]],
    ["beyond", [{ refType: "item", id: 40, tradable: true }]],
  ]);
}

describe("evaluateCraft — Main weapon T8", () => {
  it("rare havuzu $0 (tradable değil), Legendary+ EV'ye katkı; komisyon 0.85", () => {
    const prices = book({
      "material:100": { lowest: 1000, median: 1000, volume: 0 }, // Arcane Ore
      "item:10": { lowest: 2000, median: 2000, volume: 0 },
      "item:20": { lowest: 8000, median: 8000, volume: 0 },
      "item:30": { lowest: 40000, median: 40000, volume: 0 },
      "item:40": { lowest: 300000, median: 300000, volume: 0 },
    });
    const r = evaluateCraft({
      slot: "main_weapon",
      tier: 8,
      gradeOdds: t8Odds,
      materials: [{ id: 100, qty: 1 }],
      dropsByGrade: t8Pools(),
      prices,
    });

    expect(r.costCents).toBe(1000);
    expect(r.failProb).toBe(0); // craft'ta fail yok

    const rare = r.outcomes.find((o) => o.gradeKey === "rare");
    const leg = r.outcomes.find((o) => o.gradeKey === "legendary");
    expect(rare?.poolAvgSell).toBe(0);
    expect(leg?.poolAvgSell).toBe(2000);

    // evSell = round( (0.3*2000 + 0.18*8000 + 0.038*40000 + 0.002*300000) * 0.85 )
    //        = round( 4160 * 0.85 ) = 3536
    expect(r.evSellCents).toBe(3536);
    expect(r.netCents).toBe(3536 - 1000);
    expect(r.roi).toBeCloseTo((3536 - 1000) / 1000, 10);
  });

  it("malzeme fiyatsız → hasMissingPrices", () => {
    const r = evaluateCraft({
      slot: "main_weapon",
      tier: 8,
      gradeOdds: t8Odds,
      materials: [{ id: 100, qty: 1 }], // fiyatı yok
      dropsByGrade: t8Pools(),
      prices: book({ "item:10": { lowest: 2000, median: 2000, volume: 0 } }),
    });
    expect(r.hasMissingPrices).toBe(true);
  });
});
