/**
 * Steam market_hash_name → katalog (items/materials) eşleme.
 *
 * Gözlemlenen Steam formatları (docs/04 §B "isim normalize" görevi):
 *  - Gear:     "<NameEn> (<Grade>) <Variant>"  + type "<GearType> - Lv. <level>"
 *              örn "Iron Helmet (Immortal) A" / "Helmet - Lv. 10"
 *              Variant harfi (A,B,…) aynı ad+grade+level'daki affix varyantlarını
 *              ayırır → item id'leri artan sırada A,B,C ile eşlenir.
 *  - Material: hash_name = name_en (birebir), her kademede listelenebilir.
 */
import type { getDb } from "db";
import { schema } from "db";
import type { MarketListing } from "./providers/types";

type Db = ReturnType<typeof getDb>;

export interface Catalog {
  /** `${nameEn}|${gradeKey}|${level}` → item id'leri (artan = varyant A,B,C…). */
  gearByKey: Map<string, number[]>;
  /** name_en → material id. */
  materialByName: Map<string, number>;
  /** geçerli grade key'leri (gear paren içeriğini doğrulamak için). */
  gradeKeys: Set<string>;
}

export async function buildCatalog(db: Db): Promise<Catalog> {
  const grades = await db.select({ id: schema.grades.id, key: schema.grades.key }).from(schema.grades);
  const keyByGradeId = new Map(grades.map((g) => [g.id, g.key]));
  const gradeKeys = new Set(grades.map((g) => g.key));

  const items = await db
    .select({
      id: schema.items.id,
      nameEn: schema.items.nameEn,
      gradeId: schema.items.gradeId,
      level: schema.items.level,
    })
    .from(schema.items);

  const gearByKey = new Map<string, number[]>();
  for (const it of items) {
    const gradeKey = keyByGradeId.get(it.gradeId);
    if (!gradeKey) continue;
    const key = `${it.nameEn}|${gradeKey}|${it.level}`;
    const arr = gearByKey.get(key);
    if (arr) arr.push(it.id);
    else gearByKey.set(key, [it.id]);
  }
  for (const arr of gearByKey.values()) arr.sort((a, b) => a - b);

  const materials = await db
    .select({ id: schema.materials.id, nameEn: schema.materials.nameEn })
    .from(schema.materials);
  const materialByName = new Map(materials.map((m) => [m.nameEn, m.id]));

  return { gearByKey, materialByName, gradeKeys };
}

export type RefType = "item" | "material";
export type MatchStatus = "matched" | "ambiguous" | "unmatched";
export interface MatchResult {
  status: MatchStatus;
  refType?: RefType;
  refId?: number;
}

const GEAR_RE = /^(.+) \(([^)]+)\) ([A-Z])$/;
const LEVEL_RE = /Lv\.\s*(\d+)/;

export function matchListing(listing: MarketListing, catalog: Catalog): MatchResult {
  const m = GEAR_RE.exec(listing.hashName);
  if (m) {
    const name = m[1];
    const gradeWord = m[2];
    const variant = m[3];
    const gradeKey = gradeWord?.toLowerCase() ?? "";
    const lvlMatch = listing.type ? LEVEL_RE.exec(listing.type) : null;
    if (name && variant && catalog.gradeKeys.has(gradeKey) && lvlMatch?.[1]) {
      const level = Number.parseInt(lvlMatch[1], 10);
      const ids = catalog.gearByKey.get(`${name}|${gradeKey}|${level}`);
      if (ids && ids.length > 0) {
        const idx = variant.charCodeAt(0) - 65; // A→0
        const refId = ids[idx];
        if (refId !== undefined) return { status: "matched", refType: "item", refId };
        return { status: "ambiguous", refType: "item" }; // grup bilinir, varyant aşıyor
      }
      return { status: "unmatched" };
    }
    // paren içeriği grade değil → muhtemelen material adı parantezli; aşağı düş
  }

  const matId = catalog.materialByName.get(listing.hashName);
  if (matId !== undefined) return { status: "matched", refType: "material", refId: matId };

  return { status: "unmatched" };
}
