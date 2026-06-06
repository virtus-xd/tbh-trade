/** Fiyat sağlayıcı soyutlaması — Steam doğrudan veya 3rd-party arkasına geçilebilir. */

export interface MarketListing {
  hashName: string; // market_hash_name (canonical)
  name: string;
  sellPriceCents: number | null; // en düşük listeleme fiyatı (cents)
  sellListings: number | null; // aktif liste sayısı (likidite proxy'si)
  type: string | null; // asset_description.type, örn "Helmet - Lv. 10"
  nameColor: string | null; // grade rengi (Steam paleti)
}

export interface EnumeratePage {
  totalCount: number;
  listings: MarketListing[];
}

export interface PriceOverview {
  lowestCents: number | null;
  medianCents: number | null;
  volume: number | null; // son 24s satış adedi
}

export interface PriceProvider {
  /** Toplu liste + en düşük fiyat (ucuz; sayfa başına ~10-100). */
  enumerate(start: number, count: number): Promise<EnumeratePage>;
  /** Tek item median/volume (pahalı; çok rate-limitli) — desteklenmiyorsa null. */
  priceOverview(hashName: string): Promise<PriceOverview | null>;
}

/** HTTP hatası — 429 tespiti için status taşır. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** "$1,234.56" → 123456 cents. Para birimi simgesi/binlik ayraç toleranslı. */
export function parsePriceToCents(text: string | null | undefined): number | null {
  if (!text) return null;
  // Rakam, nokta ve virgül dışını at; virgülü binlik ayraç kabul edip kaldır.
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
