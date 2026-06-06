import { describe, it, expect } from "vitest";
import {
  DEFAULT_PRICE_OPTS,
  buyPrice,
  normalizeOdds,
  poolAverageSell,
  profitProbability,
  sellPrice,
} from "./helpers";
import type { Pool, PriceBook, PriceQuote } from "./types";

function book(map: Record<string, PriceQuote>): PriceBook {
  return { get: (t, id) => map[`${t}:${id}`] ?? null };
}

describe("normalizeOdds", () => {
  it("oranları 1'e toplar (datamined ~%100 değil)", () => {
    const n = normalizeOdds({ a: 0.5, b: 0.5, c: 0.0025 }); // toplam 1.0025
    const sum = n.a + n.b + n.c;
    expect(sum).toBeCloseTo(1, 10);
    expect(n.a).toBeCloseTo(0.5 / 1.0025, 10);
  });

  it("toplam 0 ise tüm değerler 0", () => {
    const n = normalizeOdds({ a: 0, b: 0 });
    expect(n.a).toBe(0);
    expect(n.b).toBe(0);
  });
});

describe("sellPrice", () => {
  const opts = DEFAULT_PRICE_OPTS; // volumeThreshold 5
  it("hacim eşiği aşılınca median", () => {
    expect(sellPrice({ lowest: 100, median: 120, volume: 10 }, opts)).toBe(120);
  });
  it("hacim düşükse lowest'a düşer", () => {
    expect(sellPrice({ lowest: 100, median: 120, volume: 2 }, opts)).toBe(100);
  });
  it("lowest yoksa median'a düşer", () => {
    expect(sellPrice({ lowest: null, median: 120, volume: 1 }, opts)).toBe(120);
  });
  it("hiç fiyat yoksa null", () => {
    expect(sellPrice({ lowest: null, median: null, volume: null }, opts)).toBeNull();
    expect(sellPrice(null, opts)).toBeNull();
  });
});

describe("buyPrice", () => {
  it("her zaman lowest", () => {
    expect(buyPrice({ lowest: 100, median: 120, volume: 10 })).toBe(100);
  });
  it("lowest yoksa median, yoksa null", () => {
    expect(buyPrice({ lowest: null, median: 120, volume: 10 })).toBe(120);
    expect(buyPrice(null)).toBeNull();
  });
});

describe("poolAverageSell", () => {
  it("tradable olmayan üye 0 değerle paydaya girer", () => {
    const pool: Pool = [
      { refType: "item", id: 1, tradable: true },
      { refType: "item", id: 2, tradable: false }, // Legendary altı → $0
    ];
    const prices = book({ "item:1": { lowest: 1000, median: 1000, volume: 0 } });
    const { avg, missing } = poolAverageSell(pool, prices);
    expect(avg).toBe(500); // (1000 + 0) / 2
    expect(missing).toBe(false); // tradable-olmayan eksik veri değil
  });

  it("tradable ama fiyatsız üye → missing=true", () => {
    const pool: Pool = [{ refType: "item", id: 1, tradable: true }];
    const { avg, missing } = poolAverageSell(pool, book({}));
    expect(avg).toBe(0);
    expect(missing).toBe(true);
  });

  it("boş havuz → avg 0, missing true", () => {
    const { avg, missing } = poolAverageSell([], book({}));
    expect(avg).toBe(0);
    expect(missing).toBe(true);
  });
});

describe("profitProbability", () => {
  it("yalnız geliri maliyeti aşan item'lar sayılır", () => {
    // tek outcome, prob 1, 2 item: biri kârlı biri değil → 0.5
    const p = profitProbability(
      [{ prob: 1, values: [10000, 100] }],
      5000, // cost; gelir = value*0.85 → 8500>5000 ✓, 85<5000 ✗
      0.15,
    );
    expect(p).toBeCloseTo(0.5, 10);
  });
});
