import { describe, it, expect } from "vitest";
import { scanOpportunities } from "./scan";
import type {
  CraftScenario,
  GradeKey,
  Pool,
  PriceBook,
  PriceQuote,
  ScanRepo,
  SynthScenario,
} from "./types";

function book(map: Record<string, PriceQuote>): PriceBook {
  return { get: (t, id) => map[`${t}:${id}`] ?? null };
}

const prices = book({
  "material:100": { lowest: 1000, median: 1000, volume: 0 },
  "item:10": { lowest: 50000, median: 50000, volume: 0 }, // yüksek ROI craft çıktısı
  "item:20": { lowest: 12000, median: 12000, volume: 0 },
});

// Yüksek ROI üretim: 1000 maliyet → büyük çıktı.
const goodCraft: CraftScenario = {
  slot: "main_weapon",
  tier: 8,
  gradeOdds: { legendary: 1 },
  materials: [{ id: 100, qty: 1 }],
  dropsByGrade: new Map<GradeKey, Pool>([["legendary", [{ refType: "item", id: 10, tradable: true }]]]),
};

// Düşük ROI sentez: pahalı girdi, mütevazı çıktı.
const okSynth: SynthScenario = {
  category: "gear",
  inputGradeKey: "legendary",
  tier: 6,
  inputUnitCents: 1500,
  rates: [{ resultGradeKey: "immortal", probability: 1, isFail: false, isGreatSuccess: false }],
  dropsByGrade: new Map<GradeKey, Pool>([["immortal", [{ refType: "item", id: 20, tradable: true }]]]),
};

// Infeasible: fiyatsız çıktı havuzu (hasMissingPrices) → elenmeli.
const missingSynth: SynthScenario = {
  category: "gear",
  inputGradeKey: "legendary",
  tier: 6,
  inputUnitCents: 1500,
  rates: [{ resultGradeKey: "immortal", probability: 1, isFail: false, isGreatSuccess: false }],
  dropsByGrade: new Map<GradeKey, Pool>([["immortal", [{ refType: "item", id: 999, tradable: true }]]]),
};

// Farm modu: roi null → elenmeli.
const farmSynth: SynthScenario = {
  category: "gear",
  inputGradeKey: "legendary",
  tier: 6,
  inputUnitCents: null,
  rates: [{ resultGradeKey: "immortal", probability: 1, isFail: false, isGreatSuccess: false }],
  dropsByGrade: new Map<GradeKey, Pool>([["immortal", [{ refType: "item", id: 20, tradable: true }]]]),
};

const repo: ScanRepo = {
  synthesisScenarios: () => [okSynth, missingSynth, farmSynth],
  craftScenarios: () => [goodCraft],
};

describe("scanOpportunities", () => {
  it("yalnız feasible senaryolar, ROI azalan sıralı", () => {
    const rows = scanOpportunities(repo, prices);
    // okSynth + goodCraft feasible; missing/farm elenir
    expect(rows).toHaveLength(2);
    expect(rows[0]?.kind).toBe("craft"); // daha yüksek ROI
    expect(rows[1]?.kind).toBe("synthesis");
    // ROI azalan
    expect((rows[0]?.result.roi ?? 0) >= (rows[1]?.result.roi ?? 0)).toBe(true);
  });

  it("fiyatsız ve farm senaryoları sıralamaya girmez", () => {
    const rows = scanOpportunities(repo, prices);
    const kinds = rows.map((r) => JSON.stringify(r.payload));
    // missingSynth ve farmSynth aynı payload'a sahip okSynth ile; toplam synth=1 olmalı
    expect(rows.filter((r) => r.kind === "synthesis")).toHaveLength(1);
    expect(kinds.length).toBe(2);
  });
});
