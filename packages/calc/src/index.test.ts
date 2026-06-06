import { describe, it, expect } from "vitest";
import { STEAM_FEE, TRADABLE_MIN_TIER } from "./index";

// Değişmez sabitler — Kural #4 (komisyon) ve Kural #3 (tradable taban).
describe("calc sabitleri", () => {
  it("Steam komisyonu %15 (Kural #4)", () => {
    expect(STEAM_FEE).toBe(0.15);
  });

  it("Tradable taban kademesi Legendary (tier_index 4, Kural #3)", () => {
    expect(TRADABLE_MIN_TIER).toBe(4);
  });
});
