/**
 * Ingest pipeline — Değişmez kural #1: Steam'e yalnız burası (server-side) gider.
 *
 * Akış: enumerate (sayfalı, rate-limitli) → eşle → market_prices upsert +
 * price_history insert + items/materials.market_hash_name/tradable + audit.
 * Opsiyonel: öncelikli item'lar için priceOverview (median/volume).
 */
import { sql } from "drizzle-orm";
import { getDb, getQueryClient, schema } from "db";
import { config } from "./config";
import { getProvider } from "./providers";
import type { MarketListing } from "./providers/types";
import { buildCatalog, matchListing, type RefType } from "./match";
import { callWithRetry, RateLimiter } from "./ratelimit";

const chunk = <T>(a: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
};

export interface IngestReport {
  pagesFetched: number;
  totalListings: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  itemsMatched: number;
  materialsMatched: number;
  pricesWritten: number;
  priceOverviews: number;
  matchRatePct: number;
  budgetUsed: number;
  http429: number;
  http5xx: number;
}

export interface IngestOptions {
  maxPages?: number; // 0/undefined = tümü
  priceOverviewLimit?: number;
}

export async function runIngest(opts: IngestOptions = {}): Promise<IngestReport> {
  const maxPages = opts.maxPages ?? config.maxPages;
  const poLimit = opts.priceOverviewLimit ?? config.priceOverviewLimit;
  const db = getDb();
  const sqlc = getQueryClient();
  const provider = getProvider();
  const limiter = new RateLimiter(config.dailyBudget);
  const catalog = await buildCatalog(db);

  const priceByRef = new Map<string, { refType: RefType; refId: number; lowestCents: number | null; volume: number | null }>();
  const history: { refType: RefType; refId: number; priceCents: number; volume: number | null }[] = [];
  const mapItem: { id: number; hn: string }[] = [];
  const mapMaterial: { id: number; hn: string }[] = [];
  const audit: { hashName: string; status: string; refType: RefType | null; refId: number | null }[] = [];
  const matchedListings: { listing: MarketListing; refType: RefType; refId: number }[] = [];

  let pagesFetched = 0;
  let totalListings = 0;
  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;

  // --- enumerate (sayfalı) ---
  let start = 0;
  let total = Number.POSITIVE_INFINITY;
  while (start < total) {
    if (maxPages > 0 && pagesFetched >= maxPages) break;
    const page = await callWithRetry(() => provider.enumerate(start, 100), {
      limiter,
      delayMs: config.enumerateDelayMs,
    });
    pagesFetched++;
    total = page.totalCount;
    if (page.listings.length === 0) break;

    for (const listing of page.listings) {
      totalListings++;
      const r = matchListing(listing, catalog);
      audit.push({ hashName: listing.hashName, status: r.status, refType: r.refType ?? null, refId: r.refId ?? null });
      if (r.status === "matched" && r.refType && r.refId !== undefined) {
        matched++;
        priceByRef.set(`${r.refType}:${r.refId}`, {
          refType: r.refType,
          refId: r.refId,
          lowestCents: listing.sellPriceCents,
          volume: listing.sellListings,
        });
        if (listing.sellPriceCents !== null) {
          history.push({ refType: r.refType, refId: r.refId, priceCents: listing.sellPriceCents, volume: listing.sellListings });
        }
        (r.refType === "item" ? mapItem : mapMaterial).push({ id: r.refId, hn: listing.hashName });
        matchedListings.push({ listing, refType: r.refType, refId: r.refId });
      } else if (r.status === "ambiguous") {
        ambiguous++;
      } else {
        unmatched++;
      }
    }
    start += page.listings.length;
  }

  // --- DB yazımı ---
  const priceRows = [...priceByRef.values()].map((p) => ({
    refType: p.refType,
    refId: p.refId,
    currency: config.currency,
    lowestCents: p.lowestCents,
    volume: p.volume,
  }));
  for (const part of chunk(priceRows, 500)) {
    await db
      .insert(schema.marketPrices)
      .values(part)
      .onConflictDoUpdate({
        target: [schema.marketPrices.refType, schema.marketPrices.refId, schema.marketPrices.currency],
        set: {
          lowestCents: sql`excluded.lowest_cents`,
          volume: sql`excluded.volume`,
          fetchedAt: sql`now()`,
        },
      });
  }
  for (const part of chunk(history.map((h) => ({ ...h, currency: config.currency })), 1000)) {
    await db.insert(schema.priceHistory).values(part);
  }

  // market_hash_name + tradable (toplu VALUES update)
  await applyMapping(sqlc, "items", mapItem);
  await applyMapping(sqlc, "materials", mapMaterial);

  // audit (PK market_hash_name) — son durumu upsert
  const auditDedup = new Map(audit.map((a) => [a.hashName, a]));
  for (const part of chunk([...auditDedup.values()], 500)) {
    await db
      .insert(schema.marketMappingAudit)
      .values(
        part.map((a) => ({
          marketHashName: a.hashName,
          status: a.status,
          matchedRefType: a.refType,
          matchedRefId: a.refId,
        })),
      )
      .onConflictDoUpdate({
        target: schema.marketMappingAudit.marketHashName,
        set: {
          status: sql`excluded.status`,
          matchedRefType: sql`excluded.matched_ref_type`,
          matchedRefId: sql`excluded.matched_ref_id`,
          seenAt: sql`now()`,
        },
      });
  }

  // --- opsiyonel priceOverview (öncelikli: en çok listelenenler) ---
  let priceOverviews = 0;
  if (poLimit > 0) {
    const priority = matchedListings
      .filter((m) => m.listing.sellListings !== null)
      .sort((a, b) => (b.listing.sellListings ?? 0) - (a.listing.sellListings ?? 0))
      .slice(0, poLimit);
    for (const m of priority) {
      const ov = await callWithRetry(() => provider.priceOverview(m.listing.hashName), {
        limiter,
        delayMs: config.priceOverviewDelayMs,
      });
      if (!ov) continue;
      priceOverviews++;
      await db
        .update(schema.marketPrices)
        .set({ medianCents: ov.medianCents, volume: ov.volume ?? undefined })
        .where(
          sql`${schema.marketPrices.refType} = ${m.refType} and ${schema.marketPrices.refId} = ${m.refId} and ${schema.marketPrices.currency} = ${config.currency}`,
        );
      if (ov.medianCents !== null) {
        await db.insert(schema.priceHistory).values({
          refType: m.refType,
          refId: m.refId,
          currency: config.currency,
          priceCents: ov.medianCents,
          volume: ov.volume,
        });
      }
    }
  }

  return {
    pagesFetched,
    totalListings,
    matched,
    ambiguous,
    unmatched,
    itemsMatched: mapItem.length,
    materialsMatched: mapMaterial.length,
    pricesWritten: priceRows.length,
    priceOverviews,
    matchRatePct: totalListings ? Math.round((matched / totalListings) * 1000) / 10 : 0,
    budgetUsed: limiter.usedCount,
    http429: limiter.count429,
    http5xx: limiter.count5xx,
  };
}

/** Toplu market_hash_name + tradable güncellemesi (tek VALUES sorgusu/parça). */
async function applyMapping(
  sqlc: ReturnType<typeof getQueryClient>,
  table: "items" | "materials",
  rows: { id: number; hn: string }[],
): Promise<void> {
  if (rows.length === 0) return;
  const ident = sqlc(table);
  for (const part of chunk(rows, 500)) {
    const values = part.map((r) => [r.id, r.hn]);
    await sqlc`
      update ${ident} as t
      set market_hash_name = (v.hn)::text, tradable = true
      from (values ${sqlc(values)}) as v(id, hn)
      where t.id = (v.id)::int`;
  }
}
