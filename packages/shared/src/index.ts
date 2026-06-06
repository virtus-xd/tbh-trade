/**
 * shared — Ortak tipler, enumlar ve sabitler.
 *
 * Tek doğruluk kaynağı: docs/01-product-and-game.md §3 (grade tablosu) ve
 * docs/02-data-model.md (enum listeleri). Kod/identifier İngilizce.
 */

export * from "./grades";

// ---------------------------------------------------------------------------
// Enumlar (docs/02-data-model.md "Enumlar / sabitler")
// Literal union + runtime dizi ikilisi: hem tip güvenliği hem iterasyon.
// ---------------------------------------------------------------------------

/** Nadirlik kademeleri — düşükten yükseğe (tier_index 1..10). */
export const GRADE_KEYS = [
  "common",
  "uncommon",
  "rare",
  "legendary",
  "immortal",
  "arcana",
  "beyond",
  "celestial",
  "divine",
  "cosmic",
] as const;
export type GradeKey = (typeof GRADE_KEYS)[number];

/** Üretim (Craft) slotları — docs/01 §7. */
export const CRAFT_SLOTS = [
  "main_weapon",
  "sub_weapon",
  "helmet",
  "armor",
  "gloves",
  "boots",
  "accessory",
] as const;
export type CraftSlot = (typeof CRAFT_SLOTS)[number];

/** Sentez kategorileri — ayrı sentezlenir, karıştırılamaz (docs/01 §6). */
export const SYNTH_CATEGORIES = ["gear", "accessory", "material"] as const;
export type SynthCategory = (typeof SYNTH_CATEGORIES)[number];

/** Malzeme kategorileri — docs/01 §5. */
export const MATERIAL_CATEGORIES = [
  "crafting",
  "decoration",
  "engraving",
  "inscription",
  "offering",
  "soulstone",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Fiyat referans tipi — docs/02 `ref_type`. */
export const REF_TYPES = ["item", "material"] as const;
export type RefType = (typeof REF_TYPES)[number];
