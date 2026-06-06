/** Worker yapılandırması — .env'den okunur (sırlar repoda değil). */

const num = (v: string | undefined, d: number): number => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};

export const config = {
  appId: num(process.env.STEAM_APP_ID, 3678970),
  currency: num(process.env.STEAM_CURRENCY, 1), // 1 = USD
  provider: (process.env.PRICE_PROVIDER ?? "steam_direct") as "steam_direct" | "thirdparty",
  thirdpartyApiKey: process.env.THIRDPARTY_API_KEY ?? "",

  // Rate-limit (Değişmez kural #1 — yalnız worker Steam'e gider)
  dailyBudget: num(process.env.INGEST_DAILY_BUDGET, 4000), // günlük maks istek
  priceOverviewDelayMs: num(process.env.INGEST_MIN_DELAY_MS, 3500), // priceoverview çok limitli
  enumerateDelayMs: num(process.env.INGEST_ENUMERATE_DELAY_MS, 1500), // search/render ucuz
  volumeThreshold: num(process.env.PRICE_VOLUME_THRESHOLD, 5), // median kullanımı için min hacim

  // ingest:once davranışı
  priceOverviewLimit: num(process.env.INGEST_PRICEOVERVIEW_LIMIT, 0), // 0 = atla (429 riskini önle)
  maxPages: num(process.env.INGEST_MAX_PAGES, 0), // 0 = tümü
} as const;
