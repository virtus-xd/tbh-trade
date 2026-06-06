/**
 * SteamDirectProvider — ücretsiz, rate-limitli resmî Steam Pazarı uçları.
 * Değişmez kural #1: yalnız bu (server-side) worker Steam'e gider.
 */
import {
  type EnumeratePage,
  HttpError,
  type MarketListing,
  parsePriceToCents,
  type PriceOverview,
  type PriceProvider,
} from "./types";

const UA = "Mozilla/5.0 (TBH-Trade price-ingest)";

interface RenderResult {
  name?: string;
  hash_name?: string;
  sell_price?: number; // cents
  sell_listings?: number;
  asset_description?: { type?: string; name_color?: string; market_hash_name?: string };
}
interface RenderResponse {
  success?: boolean;
  total_count?: number;
  results?: RenderResult[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new HttpError(res.status, `GET ${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export class SteamDirectProvider implements PriceProvider {
  constructor(
    private readonly appId: number,
    private readonly currency: number,
  ) {}

  async enumerate(start: number, count: number): Promise<EnumeratePage> {
    const url =
      `https://steamcommunity.com/market/search/render/?appid=${this.appId}` +
      `&norender=1&start=${start}&count=${count}&currency=${this.currency}`;
    const data = await getJson<RenderResponse>(url);
    if (!data.success) throw new HttpError(502, `search/render success=false (start=${start})`);
    const listings: MarketListing[] = (data.results ?? []).map((r) => {
      const ad = r.asset_description ?? {};
      return {
        hashName: r.hash_name ?? ad.market_hash_name ?? r.name ?? "",
        name: r.name ?? "",
        sellPriceCents: typeof r.sell_price === "number" ? r.sell_price : null,
        sellListings: typeof r.sell_listings === "number" ? r.sell_listings : null,
        type: ad.type ?? null,
        nameColor: ad.name_color ?? null,
      };
    });
    return { totalCount: data.total_count ?? listings.length, listings };
  }

  async priceOverview(hashName: string): Promise<PriceOverview | null> {
    const url =
      `https://steamcommunity.com/market/priceoverview/?appid=${this.appId}` +
      `&currency=${this.currency}&market_hash_name=${encodeURIComponent(hashName)}`;
    const data = await getJson<{
      success?: boolean;
      lowest_price?: string;
      median_price?: string;
      volume?: string;
    }>(url);
    if (!data.success) return null;
    return {
      lowestCents: parsePriceToCents(data.lowest_price),
      medianCents: parsePriceToCents(data.median_price),
      volume: data.volume ? Number.parseInt(data.volume.replace(/[^0-9]/g, ""), 10) || null : null,
    };
  }
}
