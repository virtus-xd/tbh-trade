/**
 * Fırsat tarama entry — `pnpm scan:once`.
 * Fiyat cache'i (market_prices) güncel olmalı; bu yalnız hesap + yazım yapar,
 * Steam'e GİTMEZ.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: "../../.env" });

const { runScan } = await import("./scan");
const { recordRun } = await import("./runs");
const { getQueryClient } = await import("db");

console.log("[scan] fırsatlar hesaplanıyor…");

try {
  const report = await recordRun("scan", () => runScan());
  console.log("✅ Scan tamam:");
  console.table(report);
} catch (err) {
  console.error("❌ Scan başarısız:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await getQueryClient().end();
}
