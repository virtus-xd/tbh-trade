/**
 * seed — Datamined JSON → Supabase (idempotent upsert, game_version damgalı).
 *
 * Faz 1 (bu tur): dokümanlarda HAZIR olan veri — grades, item_types,
 * synthesis_tiers, synthesis_rates, main_weapon craft_recipes.
 * items/materials/synthesis_drops/craft_drops ve kalan craft slotları
 * datamine-import sonrası eklenecek (scripts/datamine-import.ts).
 *
 * Idempotent: tekrar çalıştırınca aynı satırları upsert eder (onConflictDoUpdate).
 */
import { config } from "dotenv";

config({ path: "../.env" });

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb, getQueryClient, schema } from "db";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data");
const read = <T>(file: string): T =>
  JSON.parse(readFileSync(join(dataDir, file), "utf8")) as T;

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type GradeRow = {
  id: number;
  key: string;
  name: string;
  colorHex: string;
  alchemyGold: number;
  socketsD: number;
  socketsE: number;
  socketsI: number;
  tradable: boolean;
};
type ItemTypeRow = { key: string; name: string; category: string };
type TierRow = {
  tier: number;
  levelMin: number;
  levelMax: number;
  cubeLevel: number;
  goldCost: number;
};
type RateRow = {
  inputKey: string;
  resultKey: string;
  probability: number;
  isFail: boolean;
  isGreatSuccess: boolean;
};
type CraftRow = {
  slot: string;
  tier: number;
  levelMin: number;
  levelMax: number;
  possibleItemCount: number;
  gradeOdds: Record<string, number>;
};
type ItemRow = {
  gameId: number;
  typeKey: string;
  level: number;
  gradeKey: string;
  nameEn: string;
  nameTr: string | null;
  slug: string;
  imageUrl: string | null;
};
type MaterialRow = {
  gameId: number;
  nameEn: string;
  nameTr: string | null;
  slug: string;
  gradeKey: string;
  category: string;
  imageUrl: string | null;
};
type CraftMaterialRow = { slot: string; tier: number; materialGameId: number; qty: number };
type CraftDropRow = { slot: string; tier: number; resultGradeKey: string; itemGameId: number };
type SynthDropRow = {
  category: string;
  resultGradeKey: string;
  tier: number;
  itemGameId: number | null;
  materialGameId: number | null;
};

async function main(): Promise<void> {
  const db = getDb();
  const gameVersion = process.env.GAME_VERSION ?? null;

  const grades = read<GradeRow[]>("grades.json");
  const gradeIdByKey = new Map(grades.map((g) => [g.key, g.id]));

  // 1) grades
  for (const row of grades) {
    await db
      .insert(schema.grades)
      .values(row)
      .onConflictDoUpdate({ target: schema.grades.id, set: row });
  }

  // 2) item_types
  for (const row of read<ItemTypeRow[]>("item_types.json")) {
    await db
      .insert(schema.itemTypes)
      .values(row)
      .onConflictDoUpdate({ target: schema.itemTypes.key, set: row });
  }

  // 3) synthesis_tiers
  for (const row of read<TierRow[]>("synthesis_tiers.json")) {
    await db
      .insert(schema.synthesisTiers)
      .values(row)
      .onConflictDoUpdate({ target: schema.synthesisTiers.tier, set: row });
  }

  // 4) synthesis_rates (keys → grade ids, probability → numeric string)
  for (const r of read<RateRow[]>("synthesis_rates.json")) {
    const inputGradeId = gradeIdByKey.get(r.inputKey);
    const resultGradeId = gradeIdByKey.get(r.resultKey);
    if (inputGradeId === undefined || resultGradeId === undefined) {
      throw new Error(`Bilinmeyen grade: ${r.inputKey} → ${r.resultKey}`);
    }
    const row = {
      inputGradeId,
      resultGradeId,
      probability: String(r.probability),
      isFail: r.isFail,
      isGreatSuccess: r.isGreatSuccess,
      gameVersion,
    };
    await db
      .insert(schema.synthesisRates)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.synthesisRates.inputGradeId, schema.synthesisRates.resultGradeId],
        set: row,
      });
  }

  // 5) craft_recipes (yalnız main_weapon hattı — diğer slotlar datamine'da)
  for (const r of read<CraftRow[]>("craft_recipes.json")) {
    const row = { ...r, gameVersion };
    await db
      .insert(schema.craftRecipes)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.craftRecipes.slot, schema.craftRecipes.tier],
        set: row,
      });
  }

  // 6) items (gear) — datamine-import çıktısı (varsa)
  if (existsSync(join(dataDir, "items.json"))) {
    const typeIdByKey = new Map(
      (await db.select({ id: schema.itemTypes.id, key: schema.itemTypes.key }).from(schema.itemTypes)).map(
        (t) => [t.key, t.id],
      ),
    );
    const itemRows = read<ItemRow[]>("items.json").map((r) => {
      const typeId = typeIdByKey.get(r.typeKey);
      const gradeId = gradeIdByKey.get(r.gradeKey);
      if (typeId === undefined || gradeId === undefined) {
        throw new Error(`items: bilinmeyen type/grade: ${r.typeKey}/${r.gradeKey} (game_id ${r.gameId})`);
      }
      return {
        gameId: r.gameId,
        typeId,
        gradeId,
        level: r.level,
        nameEn: r.nameEn,
        nameTr: r.nameTr,
        slug: r.slug,
        imageUrl: r.imageUrl,
      };
    });
    for (const part of chunk(itemRows, 500)) {
      await db
        .insert(schema.items)
        .values(part)
        .onConflictDoUpdate({
          target: schema.items.gameId,
          // market_hash_name / tradable Faz 2'de Steam eşlemesiyle set edilir → korunur.
          set: {
            typeId: sql`excluded.type_id`,
            gradeId: sql`excluded.grade_id`,
            level: sql`excluded.level`,
            nameEn: sql`excluded.name_en`,
            nameTr: sql`excluded.name_tr`,
            slug: sql`excluded.slug`,
            imageUrl: sql`excluded.image_url`,
          },
        });
    }
  }

  // 7) materials — datamine-import çıktısı (varsa)
  if (existsSync(join(dataDir, "materials.json"))) {
    const materialRows = read<MaterialRow[]>("materials.json").map((r) => {
      const gradeId = gradeIdByKey.get(r.gradeKey);
      if (gradeId === undefined) {
        throw new Error(`materials: bilinmeyen grade ${r.gradeKey} (game_id ${r.gameId})`);
      }
      return {
        gameId: r.gameId,
        nameEn: r.nameEn,
        nameTr: r.nameTr,
        slug: r.slug,
        gradeId,
        category: r.category,
        imageUrl: r.imageUrl,
      };
    });
    for (const part of chunk(materialRows, 500)) {
      await db
        .insert(schema.materials)
        .values(part)
        .onConflictDoUpdate({
          target: schema.materials.gameId,
          set: {
            nameEn: sql`excluded.name_en`,
            nameTr: sql`excluded.name_tr`,
            slug: sql`excluded.slug`,
            gradeId: sql`excluded.grade_id`,
            category: sql`excluded.category`,
            imageUrl: sql`excluded.image_url`,
          },
        });
    }
  }

  // 8+9) craft_recipe_materials + craft_drops (recipe_id slot+tier ile çözülür)
  if (
    existsSync(join(dataDir, "craft_recipe_materials.json")) ||
    existsSync(join(dataDir, "craft_drops.json"))
  ) {
    const recipeId = new Map(
      (
        await db
          .select({ id: schema.craftRecipes.id, slot: schema.craftRecipes.slot, tier: schema.craftRecipes.tier })
          .from(schema.craftRecipes)
      ).map((r) => [`${r.slot}|${r.tier}`, r.id]),
    );

    if (existsSync(join(dataDir, "craft_recipe_materials.json"))) {
      const materialId = new Map(
        (await db.select({ id: schema.materials.id, gameId: schema.materials.gameId }).from(schema.materials))
          .filter((m): m is { id: number; gameId: number } => m.gameId !== null)
          .map((m) => [m.gameId, m.id]),
      );
      const rows = read<CraftMaterialRow[]>("craft_recipe_materials.json").map((r) => {
        const rid = recipeId.get(`${r.slot}|${r.tier}`);
        const mid = materialId.get(r.materialGameId);
        if (rid === undefined || mid === undefined) {
          throw new Error(`craft_recipe_materials çözülemedi: ${r.slot} t${r.tier} mat ${r.materialGameId}`);
        }
        return { recipeId: rid, materialId: mid, qty: r.qty };
      });
      for (const part of chunk(rows, 500)) {
        await db
          .insert(schema.craftRecipeMaterials)
          .values(part)
          .onConflictDoUpdate({
            target: [schema.craftRecipeMaterials.recipeId, schema.craftRecipeMaterials.materialId],
            set: { qty: sql`excluded.qty` },
          });
      }
    }

    if (existsSync(join(dataDir, "craft_drops.json"))) {
      const itemId = new Map(
        (await db.select({ id: schema.items.id, gameId: schema.items.gameId }).from(schema.items))
          .filter((i): i is { id: number; gameId: number } => i.gameId !== null)
          .map((i) => [i.gameId, i.id]),
      );
      const rows = read<CraftDropRow[]>("craft_drops.json").map((r) => {
        const rid = recipeId.get(`${r.slot}|${r.tier}`);
        const gid = gradeIdByKey.get(r.resultGradeKey);
        const iid = itemId.get(r.itemGameId);
        if (rid === undefined || gid === undefined || iid === undefined) {
          throw new Error(`craft_drops çözülemedi: ${r.slot} t${r.tier} ${r.resultGradeKey} item ${r.itemGameId}`);
        }
        return { recipeId: rid, resultGradeId: gid, itemId: iid };
      });
      // Türetilmiş + doğal unique yok → tam yenile (idempotent).
      await db.delete(schema.craftDrops);
      for (const part of chunk(rows, 1000)) {
        await db.insert(schema.craftDrops).values(part);
      }
    }
  }

  // 10) synthesis_drops (TÜRETİLMİŞ havuzlar; tam yenile — idempotent)
  if (existsSync(join(dataDir, "synthesis_drops.json"))) {
    const itemId = new Map(
      (await db.select({ id: schema.items.id, gameId: schema.items.gameId }).from(schema.items))
        .filter((i): i is { id: number; gameId: number } => i.gameId !== null)
        .map((i) => [i.gameId, i.id]),
    );
    const materialId = new Map(
      (await db.select({ id: schema.materials.id, gameId: schema.materials.gameId }).from(schema.materials))
        .filter((m): m is { id: number; gameId: number } => m.gameId !== null)
        .map((m) => [m.gameId, m.id]),
    );
    const rows = read<SynthDropRow[]>("synthesis_drops.json").map((r) => {
      const gid = gradeIdByKey.get(r.resultGradeKey);
      if (gid === undefined) throw new Error(`synthesis_drops: bilinmeyen grade ${r.resultGradeKey}`);
      const iid = r.itemGameId !== null ? itemId.get(r.itemGameId) : null;
      const mid = r.materialGameId !== null ? materialId.get(r.materialGameId) : null;
      if ((r.itemGameId !== null && iid === undefined) || (r.materialGameId !== null && mid === undefined)) {
        throw new Error(`synthesis_drops FK çözülemedi: item ${r.itemGameId} / mat ${r.materialGameId}`);
      }
      return { category: r.category, resultGradeId: gid, tier: r.tier, itemId: iid ?? null, materialId: mid ?? null };
    });
    await db.delete(schema.synthesisDrops);
    for (const part of chunk(rows, 1000)) {
      await db.insert(schema.synthesisDrops).values(part);
    }
  }

  // Özet sayımlar (DB'den doğrulama)
  const sqlc = getQueryClient();
  const [counts] = await sqlc<
    {
      grades: number;
      item_types: number;
      items: number;
      materials: number;
      synthesis_tiers: number;
      synthesis_rates: number;
      craft_recipes: number;
      craft_recipe_materials: number;
      craft_drops: number;
      synthesis_drops: number;
    }[]
  >`select
      (select count(*) from grades)::int                  as grades,
      (select count(*) from item_types)::int              as item_types,
      (select count(*) from items)::int                   as items,
      (select count(*) from materials)::int               as materials,
      (select count(*) from synthesis_tiers)::int         as synthesis_tiers,
      (select count(*) from synthesis_rates)::int         as synthesis_rates,
      (select count(*) from craft_recipes)::int           as craft_recipes,
      (select count(*) from craft_recipe_materials)::int  as craft_recipe_materials,
      (select count(*) from craft_drops)::int             as craft_drops,
      (select count(*) from synthesis_drops)::int          as synthesis_drops`;

  console.log(`✅ Seed tamam (game_version=${gameVersion ?? "(tanımsız)"}).`);
  console.table(counts);
  await sqlc.end();
}

main().catch((err: unknown) => {
  console.error("❌ Seed başarısız:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
