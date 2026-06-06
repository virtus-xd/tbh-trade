/**
 * Drizzle şema — docs/02-data-model.md DDL'inin birebir karşılığı.
 *
 * Kurallar:
 * - Tüm para alanları integer cents (USD). Float yok (Değişmez kural #4).
 * - Oran alanları numeric. Datamined tablolar source + game_version taşır (#6).
 * - Enum kolonları DDL'e sadık olsun diye `text` + `$type<>()` ile tiplenir
 *   (shared'daki literal union'lar uygulama tarafında tip güvenliği sağlar).
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  CraftSlot,
  GradeKey,
  MaterialCategory,
  RefType,
  SynthCategory,
} from "shared";

// --- Nadirlikler ----------------------------------------------------------
export const grades = pgTable("grades", {
  id: smallint("id").primaryKey(), // tier_index 1..10
  key: text("key").$type<GradeKey>().notNull().unique(),
  name: text("name").notNull(),
  colorHex: text("color_hex").notNull(),
  alchemyGold: integer("alchemy_gold").notNull(),
  socketsD: smallint("sockets_d").notNull(),
  socketsE: smallint("sockets_e").notNull(),
  socketsI: smallint("sockets_i").notNull(),
  tradable: boolean("tradable").notNull().default(false),
}).enableRLS();

// --- Eşya tipleri (20) ----------------------------------------------------
export const itemTypes = pgTable("item_types", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // sword, bow, ...
  name: text("name").notNull(),
  category: text("category").notNull(), // weapon|offhand|armor|accessory
}).enableRLS();

// --- Gear katalogu (~5760) ------------------------------------------------
export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id").unique(), // datamine ID
    typeId: integer("type_id")
      .notNull()
      .references(() => itemTypes.id),
    level: smallint("level").notNull(),
    gradeId: smallint("grade_id")
      .notNull()
      .references(() => grades.id),
    nameEn: text("name_en").notNull(),
    nameTr: text("name_tr"),
    slug: text("slug").notNull().unique(), // SEO URL
    marketHashName: text("market_hash_name"), // Steam eşlemesi (null = listelenmemiş)
    tradable: boolean("tradable").notNull().default(false), // grade.tradable && market_hash_name var
    imageUrl: text("image_url"),
  },
  (t) => [
    index("items_grade_level_idx").on(t.gradeId, t.level),
    index("items_type_idx").on(t.typeId),
  ],
).enableRLS();

// --- Malzemeler (~115-125) ------------------------------------------------
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").unique(),
  nameEn: text("name_en").notNull(),
  nameTr: text("name_tr"),
  slug: text("slug").notNull().unique(),
  gradeId: smallint("grade_id")
    .notNull()
    .references(() => grades.id),
  category: text("category").$type<MaterialCategory>().notNull(),
  marketHashName: text("market_hash_name"),
  tradable: boolean("tradable").notNull().default(false),
  imageUrl: text("image_url"),
}).enableRLS();

// --- SENTEZ: kademe-yükseltme oranları ------------------------------------
export const synthesisRates = pgTable(
  "synthesis_rates",
  {
    inputGradeId: smallint("input_grade_id")
      .notNull()
      .references(() => grades.id),
    resultGradeId: smallint("result_grade_id")
      .notNull()
      .references(() => grades.id),
    probability: numeric("probability", { precision: 8, scale: 6 }).notNull(),
    isFail: boolean("is_fail").notNull().default(false), // aynı kademe
    isGreatSuccess: boolean("is_great_success").notNull().default(false), // +2 kademe
    source: text("source").notNull().default("taskbarhero.wiki"),
    gameVersion: text("game_version"),
  },
  (t) => [primaryKey({ columns: [t.inputGradeId, t.resultGradeId] })],
).enableRLS();

// --- SENTEZ: reçete kademeleri --------------------------------------------
export const synthesisTiers = pgTable("synthesis_tiers", {
  tier: smallint("tier").primaryKey(),
  levelMin: smallint("level_min").notNull(),
  levelMax: smallint("level_max").notNull(),
  cubeLevel: smallint("cube_level").notNull(),
  goldCost: integer("gold_cost").notNull(),
}).enableRLS();

// --- SENTEZ: çıktı havuzları (203) ----------------------------------------
export const synthesisDrops = pgTable(
  "synthesis_drops",
  {
    id: serial("id").primaryKey(),
    category: text("category").$type<SynthCategory>().notNull(),
    resultGradeId: smallint("result_grade_id")
      .notNull()
      .references(() => grades.id),
    tier: smallint("tier")
      .notNull()
      .references(() => synthesisTiers.tier),
    itemId: integer("item_id").references(() => items.id), // gear/accessory
    materialId: integer("material_id").references(() => materials.id), // material kategorisi
  },
  (t) => [index("synthesis_drops_lookup_idx").on(t.category, t.resultGradeId, t.tier)],
).enableRLS();

// --- ÜRETİM: reçeteler (56) -----------------------------------------------
export const craftRecipes = pgTable(
  "craft_recipes",
  {
    id: serial("id").primaryKey(),
    slot: text("slot").$type<CraftSlot>().notNull(),
    tier: smallint("tier").notNull(),
    levelMin: smallint("level_min").notNull(),
    levelMax: smallint("level_max").notNull(),
    cubeLevel: smallint("cube_level"),
    goldCost: integer("gold_cost").default(0),
    gradeOdds: jsonb("grade_odds").$type<Partial<Record<GradeKey, number>>>().notNull(),
    possibleItemCount: integer("possible_item_count"),
    source: text("source").notNull().default("taskbarhero.wiki"),
    gameVersion: text("game_version"),
  },
  (t) => [uniqueIndex("craft_recipes_slot_tier_uq").on(t.slot, t.tier)],
).enableRLS();

export const craftRecipeMaterials = pgTable(
  "craft_recipe_materials",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => craftRecipes.id),
    materialId: integer("material_id")
      .notNull()
      .references(() => materials.id),
    qty: smallint("qty").notNull(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.materialId] })],
).enableRLS();

// --- ÜRETİM: çıktı havuzu -------------------------------------------------
export const craftDrops = pgTable(
  "craft_drops",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => craftRecipes.id),
    resultGradeId: smallint("result_grade_id")
      .notNull()
      .references(() => grades.id),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id),
  },
  (t) => [index("craft_drops_recipe_grade_idx").on(t.recipeId, t.resultGradeId)],
).enableRLS();

// --- FİYAT: son durum (cache) — frontend hep buradan okur -----------------
export const marketPrices = pgTable(
  "market_prices",
  {
    refType: text("ref_type").$type<RefType>().notNull(),
    refId: integer("ref_id").notNull(),
    currency: smallint("currency").notNull().default(1), // 1=USD
    lowestCents: integer("lowest_cents"), // alış maliyeti bazı
    medianCents: integer("median_cents"), // satış EV bazı
    volume: integer("volume"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.refType, t.refId, t.currency] })],
).enableRLS();

// --- FİYAT: geçmiş (trend) ------------------------------------------------
export const priceHistory = pgTable(
  "price_history",
  {
    refType: text("ref_type").$type<RefType>().notNull(),
    refId: integer("ref_id").notNull(),
    currency: smallint("currency").notNull().default(1),
    priceCents: integer("price_cents").notNull(),
    volume: integer("volume"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_series_idx").on(t.refType, t.refId, t.observedAt)],
).enableRLS();

// --- Önceden hesaplanmış fırsat skorları ----------------------------------
export const opportunities = pgTable(
  "opportunities",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // synthesis|craft
    payload: jsonb("payload").notNull(),
    costCents: integer("cost_cents").notNull(),
    evCents: integer("ev_cents").notNull(), // komisyon düşülmüş net beklenen gelir
    netCents: integer("net_cents").notNull(),
    roi: numeric("roi", { precision: 8, scale: 4 }).notNull(),
    profitProb: numeric("profit_prob", { precision: 6, scale: 4 }),
    failProb: numeric("fail_prob", { precision: 6, scale: 4 }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("opportunities_kind_roi_idx").on(t.kind, t.roi.desc())],
).enableRLS();

// --- Steam isim eşleme denetimi -------------------------------------------
export const marketMappingAudit = pgTable("market_mapping_audit", {
  marketHashName: text("market_hash_name").primaryKey(),
  matchedRefType: text("matched_ref_type"),
  matchedRefId: integer("matched_ref_id"),
  status: text("status").notNull(), // matched|ambiguous|unmatched
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// --- Worker çalışma logu (health dashboard) -------------------------------
export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // ingest | scan
    ok: boolean("ok").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    stats: jsonb("stats"), // IngestReport / ScanReport
    error: text("error"),
  },
  (t) => [index("ingest_runs_kind_started_idx").on(t.kind, t.startedAt.desc())],
).enableRLS();

// --- (Opsiyonel) kullanıcı senaryoları ------------------------------------
export const calcPresets = pgTable("calc_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
