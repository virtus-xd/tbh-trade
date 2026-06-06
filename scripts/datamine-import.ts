/**
 * datamine-import — taskbarhero.wiki'den katalog verisini çekip seed/*.json üretir.
 *
 * Kaynak (keşif sonucu): SvelteKit statik sitesi `/data/<dataset>.json` dosyaları
 * sunuyor. Yalnız "birincil" dataset'lerin dosyası var; en önemlisi:
 *   /data/items.json  (5944 satır: GEAR 5760 + MATERIAL 125 + STAGEBOX 59)
 * Bu dosya zaten İŞLENMİŞ: çok-dilli isim (tr-TR dahil), grade, type, gear tipi,
 * level, icon, slug içerir. items + materials kataloğu buradan birebir türetilir.
 *
 * Crafting verisi `/data/recipes.json` içinde (sayfa-bazlı agregat dosya):
 *   { crafting:[56], synthesis:[533], cube:[31], extraction:[90], cubeInfo }
 * crafting[].result.itemsByGrade → craft_drops; materials → craft_recipe_materials.
 *
 * NOT: synthesis item havuzları (synthesis_drops) recipes.json'da YOK; items'tan
 * (kategori+grade+level-aralığı) türetilir — bkz. seed loader / Faz 3.
 *
 * Çıktı (repoya commit edilir, idempotent):
 *   seed/data/items.json                 (~5760 gear)
 *   seed/data/materials.json             (~115 material; kategori id-aralığından)
 *   seed/data/craft_recipes.json         (56 reçete)
 *   seed/data/craft_recipe_materials.json
 *   seed/data/craft_drops.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://taskbarhero.wiki";
const UA = "Mozilla/5.0 (TBH-Trade datamine; +https://github.com/)";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "data");

type RawItem = {
  id: number;
  name: Record<string, string> | null;
  grade: string;
  type: "GEAR" | "MATERIAL" | "STAGEBOX" | string;
  gear: string | null;
  level: number | null;
  icon: string | null;
  slug: string;
  marketable?: boolean;
};

const gradeKey = (g: string): string => g.toLowerCase();

/** Datamine gear tipi → shared Craft/item_types key. Oyundaki yazım düzeltmeleri. */
const TYPE_KEY_FIX: Record<string, string> = { earing: "earring" };
const typeKey = (gear: string): string => {
  const k = gear.toLowerCase();
  return TYPE_KEY_FIX[k] ?? k;
};
const enName = (n: RawItem["name"]): string | null => n?.["en-US"] ?? null;
const trName = (n: RawItem["name"]): string | null => n?.["tr-TR"] ?? null;
const imageUrl = (icon: string | null): string | null => (icon ? BASE + icon : null);

/** Materyal kategorisi — id ön-eki (datamine'daki sabit gruplama). */
function materialCategory(id: number): string | null {
  const p = Math.floor(id / 10000); // 110001 → 11
  if (p === 11) return "decoration"; // gems (110-119)
  if (p === 12) return "engraving"; // monster materials (120-129)
  if (p === 13) return "inscription"; // scrolls (130-139)
  if (p === 14) return "crafting"; // wood/ingots/ores (140-149)
  if (p === 16) return "offering"; // anniversary coins (160)
  if (p === 19) return "soulstone"; // soulstones (190)
  return null; // 15x: isimsiz placeholder → atla
}

/** Datamine craft `type` → shared CraftSlot. */
const SLOT_BY_TYPE: Record<string, string> = {
  MainWeapon: "main_weapon",
  SubWeapon: "sub_weapon",
  Helmet: "helmet",
  Armor: "armor",
  Gloves: "gloves",
  Boots: "boots",
  Accessory: "accessory",
};

type RawCraft = {
  type: string;
  tier: number;
  materials: { id: number; count: number }[];
  result: {
    gradeOdds: { grade: string; pct: number }[];
    levelMin: number;
    levelMax: number;
    distinct: number;
    itemsByGrade: Record<string, number[]>;
  };
};
type RawSynth = {
  tier: number;
  type: string; // Gear | Accessory | Material
  grade: string; // INPUT grade
  resultLevel: [number, number];
};
type RawRecipes = { crafting: RawCraft[]; synthesis: RawSynth[] };

const GEAR_CATS = new Set(["weapon", "offhand", "armor"]);

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  console.log("[datamine-import] /data/items.json çekiliyor…");
  const raw = await fetchJson<RawItem[]>(`${BASE}/data/items.json`);
  console.log(`  ${raw.length} ham satır alındı.`);

  // GEAR → items
  const items = raw
    .filter((r) => r.type === "GEAR" && r.gear && enName(r.name))
    .map((r) => ({
      gameId: r.id,
      typeKey: typeKey(r.gear as string),
      level: r.level ?? 1,
      gradeKey: gradeKey(r.grade),
      nameEn: enName(r.name) as string,
      nameTr: trName(r.name),
      slug: r.slug,
      imageUrl: imageUrl(r.icon),
    }));

  // MATERIAL → materials (isimli + kategorisi çözülebilenler)
  const materials = raw
    .filter((r) => r.type === "MATERIAL" && enName(r.name))
    .map((r) => ({ r, category: materialCategory(r.id) }))
    .filter((x): x is { r: RawItem; category: string } => x.category !== null)
    .map(({ r, category }) => ({
      gameId: r.id,
      nameEn: enName(r.name) as string,
      nameTr: trName(r.name),
      slug: r.slug,
      gradeKey: gradeKey(r.grade),
      category,
      imageUrl: imageUrl(r.icon),
    }));

  // --- Crafting (recipes.json: 56 reçete = 7 slot × 8 tier) ---------------
  console.log("[datamine-import] /data/recipes.json çekiliyor…");
  const recipes = await fetchJson<RawRecipes>(`${BASE}/data/recipes.json`);

  const craftRecipes = recipes.crafting.map((c) => {
    const slot = SLOT_BY_TYPE[c.type];
    if (!slot) throw new Error(`Bilinmeyen craft type: ${c.type}`);
    return {
      slot,
      tier: c.tier,
      levelMin: c.result.levelMin,
      levelMax: c.result.levelMax,
      possibleItemCount: c.result.distinct,
      gradeOdds: Object.fromEntries(
        c.result.gradeOdds.map((o) => [gradeKey(o.grade), Math.round(o.pct * 1e4) / 1e6]),
      ),
    };
  });

  const craftRecipeMaterials = recipes.crafting.flatMap((c) =>
    c.materials.map((m) => ({
      slot: SLOT_BY_TYPE[c.type],
      tier: c.tier,
      materialGameId: m.id,
      qty: m.count,
    })),
  );

  const craftDrops = recipes.crafting.flatMap((c) =>
    Object.entries(c.result.itemsByGrade).flatMap(([grade, ids]) =>
      ids.map((itemGameId) => ({
        slot: SLOT_BY_TYPE[c.type],
        tier: c.tier,
        resultGradeKey: gradeKey(grade),
        itemGameId,
      })),
    ),
  );

  // --- synthesis_drops (TÜRETME: synthesis recipe + rates + items/materials) ---
  // recipes.synthesis havuz vermez; her recipe için synthesis_rates'ten çıkan
  // output grade'lere göre items/materials'tan havuz türetilir.
  const itemTypes = JSON.parse(readFileSync(join(outDir, "item_types.json"), "utf8")) as {
    key: string;
    category: string;
  }[];
  const catByType = new Map(itemTypes.map((t) => [t.key, t.category]));
  const rates = JSON.parse(readFileSync(join(outDir, "synthesis_rates.json"), "utf8")) as {
    inputKey: string;
    resultKey: string;
  }[];
  const outputsByInput = new Map<string, string[]>();
  for (const r of rates) {
    const a = outputsByInput.get(r.inputKey) ?? [];
    a.push(r.resultKey);
    outputsByInput.set(r.inputKey, a);
  }

  type SynthDrop = {
    category: string;
    resultGradeKey: string;
    tier: number;
    itemGameId: number | null;
    materialGameId: number | null;
  };
  const seen = new Set<string>();
  const synthesisDrops: SynthDrop[] = [];
  for (const s of recipes.synthesis) {
    const category = s.type.toLowerCase(); // gear | accessory | material
    const outputs = outputsByInput.get(s.grade.toLowerCase()) ?? [];
    const [lvMin, lvMax] = s.resultLevel ?? [0, 0];
    for (const outKey of outputs) {
      if (category === "material") {
        for (const m of materials) {
          if (m.gradeKey !== outKey) continue;
          const k = `material|${outKey}|${s.tier}|${m.gameId}`;
          if (seen.has(k)) continue;
          seen.add(k);
          synthesisDrops.push({ category, resultGradeKey: outKey, tier: s.tier, itemGameId: null, materialGameId: m.gameId });
        }
      } else {
        for (const it of items) {
          if (it.gradeKey !== outKey || it.level < lvMin || it.level > lvMax) continue;
          const c = catByType.get(it.typeKey);
          const match = category === "gear" ? c !== undefined && GEAR_CATS.has(c) : c === "accessory";
          if (!match) continue;
          const k = `${category}|${outKey}|${s.tier}|${it.gameId}`;
          if (seen.has(k)) continue;
          seen.add(k);
          synthesisDrops.push({ category, resultGradeKey: outKey, tier: s.tier, itemGameId: it.gameId, materialGameId: null });
        }
      }
    }
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "synthesis_drops.json"), JSON.stringify(synthesisDrops, null, 0) + "\n");
  writeFileSync(join(outDir, "items.json"), JSON.stringify(items, null, 0) + "\n");
  writeFileSync(join(outDir, "materials.json"), JSON.stringify(materials, null, 0) + "\n");
  writeFileSync(join(outDir, "craft_recipes.json"), JSON.stringify(craftRecipes, null, 0) + "\n");
  writeFileSync(
    join(outDir, "craft_recipe_materials.json"),
    JSON.stringify(craftRecipeMaterials, null, 0) + "\n",
  );
  writeFileSync(join(outDir, "craft_drops.json"), JSON.stringify(craftDrops, null, 0) + "\n");

  // Özet
  const byType = new Map<string, number>();
  for (const i of items) byType.set(i.typeKey, (byType.get(i.typeKey) ?? 0) + 1);
  const byCat = new Map<string, number>();
  for (const m of materials) byCat.set(m.category, (byCat.get(m.category) ?? 0) + 1);

  console.log(`✅ items.json: ${items.length} gear (${byType.size} tip)`);
  console.log(`✅ materials.json: ${materials.length} material`);
  console.log("   kategoriler:", Object.fromEntries(byCat));
  console.log(`✅ craft_recipes.json: ${craftRecipes.length} reçete (7 slot × 8 tier)`);
  console.log(`✅ craft_recipe_materials.json: ${craftRecipeMaterials.length} satır`);
  console.log(`✅ craft_drops.json: ${craftDrops.length} satır`);
  console.log(`✅ synthesis_drops.json: ${synthesisDrops.length} satır (items'tan türetildi)`);
}

main().catch((err: unknown) => {
  console.error("❌ datamine-import başarısız:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
