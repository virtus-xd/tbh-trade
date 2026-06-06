/**
 * map-market-names — Steam listelerini çekip katalogla eşler, market_hash_name +
 * tradable günceller, market_mapping_audit raporu üretir (docs/04 §B).
 *
 * Ingest pipeline mapping + audit'i zaten yapar; bu script onu çalıştırıp
 * eşleşmeyen/belirsiz isim raporunu öne çıkarır.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: "../.env" });

const { runIngest } = await import("price-ingest");
const { getQueryClient } = await import("db");

const sqlc = getQueryClient();
try {
  console.log("[map-market-names] Steam listeleri çekiliyor + eşleniyor…");
  const report = await runIngest();
  console.table(report);

  const byStatus = await sqlc<{ status: string; n: number }[]>`
    select status, count(*)::int as n from market_mapping_audit group by status order by n desc`;
  console.log("\n=== market_mapping_audit (status dağılımı) ===");
  console.table(byStatus);

  const unmatched = await sqlc<{ market_hash_name: string }[]>`
    select market_hash_name from market_mapping_audit
    where status <> 'matched' order by market_hash_name limit 50`;
  console.log(`\n=== eşleşmeyen/belirsiz örnekler (${unmatched.length}, ilk 50) ===`);
  for (const u of unmatched) console.log("  ", u.market_hash_name);
} catch (err) {
  console.error("❌ map-market-names başarısız:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sqlc.end();
}
