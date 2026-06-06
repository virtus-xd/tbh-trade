/** market_prices satırlarından calc PriceBook kurar. */
import type { PriceBook, PriceQuote } from "calc";

export interface PriceRow {
  ref_type: string;
  ref_id: number;
  lowest_cents: number | null;
  median_cents: number | null;
  volume: number | null;
}

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function buildBookFromRows(rows: PriceRow[]): PriceBook {
  const map = new Map<string, PriceQuote>();
  for (const r of rows) {
    map.set(`${r.ref_type}:${r.ref_id}`, {
      lowest: toNum(r.lowest_cents),
      median: toNum(r.median_cents),
      volume: toNum(r.volume),
    });
  }
  return { get: (refType, id) => map.get(`${refType}:${id}`) ?? null };
}
