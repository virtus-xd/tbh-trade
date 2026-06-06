/**
 * Grade (nadirlik) meta — docs/01-product-and-game.md §3 tablosundan BİREBİR.
 * Değişmez kural #3: Legendary (tier_index 4) ve üzeri tradable; altı pazarda $0.
 * (Steam'de gözlemlenen gerçek: Legendary gear listeleniyor; common/uncommon/rare = 0.)
 */

import type { GradeKey } from "./index";

export interface GradeMeta {
  /** tier_index 1..10 — artan = daha nadir. DB `grades.id` ile aynı. */
  tierIndex: number;
  key: GradeKey;
  /** UI'da gösterilen ad (EN). */
  name: string;
  /** Oyun renk kodu (UI'da grade rengi). */
  colorHex: string;
  /** Alchemy altın değeri (oyun-içi, $ değil). */
  alchemyGold: number;
  /** Soket sayıları: Decoration / Engraving / Inscription. */
  sockets: { d: number; e: number; i: number };
  /** Steam Pazarı'nda satılabilir mi (Legendary+). */
  tradable: boolean;
}

/** En düşük tradable kademe — Değişmez kural #3 (Legendary). */
export const TRADABLE_MIN_TIER = 4;
export const TRADABLE_MIN_GRADE: GradeKey = "legendary";

/** Steam satış komisyonu — Değişmez kural #4 (config). */
export const STEAM_FEE = 0.15;

export const GRADES: readonly GradeMeta[] = [
  { tierIndex: 1, key: "common", name: "Common", colorHex: "#e4e4e4", alchemyGold: 10, sockets: { d: 0, e: 0, i: 0 }, tradable: false },
  { tierIndex: 2, key: "uncommon", name: "Uncommon", colorHex: "#54fc0c", alchemyGold: 30, sockets: { d: 1, e: 0, i: 0 }, tradable: false },
  { tierIndex: 3, key: "rare", name: "Rare", colorHex: "#2f8bfc", alchemyGold: 90, sockets: { d: 1, e: 1, i: 0 }, tradable: false },
  { tierIndex: 4, key: "legendary", name: "Legendary", colorHex: "#fc9c0c", alchemyGold: 270, sockets: { d: 2, e: 2, i: 0 }, tradable: true },
  { tierIndex: 5, key: "immortal", name: "Immortal", colorHex: "#fc2424", alchemyGold: 810, sockets: { d: 2, e: 2, i: 1 }, tradable: true },
  { tierIndex: 6, key: "arcana", name: "Arcana", colorHex: "#b40cfc", alchemyGold: 2592, sockets: { d: 3, e: 2, i: 1 }, tradable: true },
  { tierIndex: 7, key: "beyond", name: "Beyond", colorHex: "#fc246c", alchemyGold: 8294, sockets: { d: 3, e: 2, i: 2 }, tradable: true },
  { tierIndex: 8, key: "celestial", name: "Celestial", colorHex: "#6ccce4", alchemyGold: 29029, sockets: { d: 3, e: 2, i: 2 }, tradable: true },
  { tierIndex: 9, key: "divine", name: "Divine", colorHex: "#fce454", alchemyGold: 101602, sockets: { d: 3, e: 2, i: 2 }, tradable: true },
  { tierIndex: 10, key: "cosmic", name: "Cosmic", colorHex: "#fcfcfc", alchemyGold: 355607, sockets: { d: 3, e: 2, i: 2 }, tradable: true },
] as const;

/** Hızlı erişim: key → GradeMeta. */
export const GRADE_BY_KEY: Readonly<Record<GradeKey, GradeMeta>> = Object.fromEntries(
  GRADES.map((g) => [g.key, g]),
) as Record<GradeKey, GradeMeta>;

/** Bir kademe Steam'de satılabilir mi? */
export function isTradable(key: GradeKey): boolean {
  return GRADE_BY_KEY[key].tradable;
}
