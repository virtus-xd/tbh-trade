/**
 * Tek-item manuel fiyat yenileme — kullanıcı "güncel fiyatları al" tuşu için.
 *
 * Değişmez kural #1 KORUNUR: Steam'e yine yalnız bu server-side worker mantığı
 * gider (frontend route handler üzerinden çağırır). Ban/429 riskine karşı item
 * başına COOLDOWN: bu pencere içinde tekrar istenirse Steam'e GİTMEZ, cache döner.
 * Böylece tuşa kaç kez basılırsa basılsın Steam çağrısı item başına en fazla
 * pencerede bir olur.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "db";
import { config } from "./config";
import { getProvider } from "./providers";

export const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 dk

export interface RefreshResult {
  ok: boolean;
  refreshed: boolean; // Steam'e gidildi mi?
  reason?: "cooldown" | "not_tradable" | "not_found" | "no_data";
  lowestCents: number | null;
  medianCents: number | null;
  volume: number | null;
  fetchedAtIso: string | null;
}

export async function refreshOne(refType: "item" | "material", id: number): Promise<RefreshResult> {
  const db = getDb();
  const empty = { lowestCents: null, medianCents: null, volume: null, fetchedAtIso: null };

  const tbl = refType === "item" ? schema.items : schema.materials;
  const refRows = await db
    .select({ hash: tbl.marketHashName, tradable: tbl.tradable })
    .from(tbl)
    .where(eq(tbl.id, id))
    .limit(1);
  const ref = refRows[0];
  if (!ref) return { ok: false, refreshed: false, reason: "not_found", ...empty };

  // Mevcut cache satırı (cooldown + fallback için).
  const curRows = await db
    .select({
      lowest: schema.marketPrices.lowestCents,
      median: schema.marketPrices.medianCents,
      volume: schema.marketPrices.volume,
      fetchedAt: schema.marketPrices.fetchedAt,
    })
    .from(schema.marketPrices)
    .where(
      and(
        eq(schema.marketPrices.refType, refType),
        eq(schema.marketPrices.refId, id),
        eq(schema.marketPrices.currency, config.currency),
      ),
    )
    .limit(1);
  const cur = curRows[0];
  const curSnapshot = cur
    ? {
        lowestCents: cur.lowest,
        medianCents: cur.median,
        volume: cur.volume,
        fetchedAtIso: cur.fetchedAt ? new Date(cur.fetchedAt).toISOString() : null,
      }
    : empty;

  if (!ref.tradable || !ref.hash) {
    return { ok: true, refreshed: false, reason: "not_tradable", ...curSnapshot };
  }

  // Cooldown: yakın zamanda çekildiyse Steam'e gitme.
  if (cur?.fetchedAt && Date.now() - new Date(cur.fetchedAt).getTime() < REFRESH_COOLDOWN_MS) {
    return { ok: true, refreshed: false, reason: "cooldown", ...curSnapshot };
  }

  const ov = await getProvider().priceOverview(ref.hash);
  if (!ov) return { ok: true, refreshed: false, reason: "no_data", ...curSnapshot };

  await db
    .insert(schema.marketPrices)
    .values({
      refType,
      refId: id,
      currency: config.currency,
      lowestCents: ov.lowestCents,
      medianCents: ov.medianCents,
      volume: ov.volume,
    })
    .onConflictDoUpdate({
      target: [schema.marketPrices.refType, schema.marketPrices.refId, schema.marketPrices.currency],
      set: {
        lowestCents: sql`excluded.lowest_cents`,
        medianCents: sql`excluded.median_cents`,
        volume: sql`excluded.volume`,
        fetchedAt: sql`now()`,
      },
    });

  const pc = ov.lowestCents ?? ov.medianCents;
  if (pc != null) {
    await db.insert(schema.priceHistory).values({
      refType,
      refId: id,
      currency: config.currency,
      priceCents: pc,
      volume: ov.volume,
    });
  }

  return {
    ok: true,
    refreshed: true,
    lowestCents: ov.lowestCents,
    medianCents: ov.medianCents,
    volume: ov.volume,
    fetchedAtIso: new Date().toISOString(),
  };
}
