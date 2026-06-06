/**
 * price-ingest worker entry — `pnpm ingest:once`.
 *
 * ⚠️ DEĞİŞMEZ KURAL #1: Steam Pazarı'na giden TEK yer bu worker'dır (server-side).
 * Frontend asla Steam'e dokunmaz; tüm fiyatlar buradan DB cache'ine yazılır.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: "../../.env" });

// dotenv yüklendikten SONRA import et (config + db process.env okur).
const { runIngest } = await import("./ingest");
const { recordRun } = await import("./runs");
const { getQueryClient } = await import("db");

const once = process.argv.includes("--once");
console.log(`[price-ingest] başlıyor (once=${once})…`);

try {
  const report = await recordRun("ingest", () => runIngest());
  console.log("✅ Ingest tamam:");
  console.table(report);
} catch (err) {
  console.error("❌ Ingest başarısız:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await getQueryClient().end();
}
