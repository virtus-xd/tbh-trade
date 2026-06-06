/**
 * `pnpm db:check` — Supabase Postgres bağlantısını doğrular (SELECT 1).
 * DATABASE_URL .env'den yüklenir.
 */
import { config } from "dotenv";

config({ path: "../../.env" });

async function main(): Promise<void> {
  // dotenv yüklendikten SONRA import et (client process.env okur).
  const { getQueryClient } = await import("./client");
  const sql = getQueryClient();
  try {
    const rows = await sql<{ ok: number }[]>`select 1 as ok`;
    console.log("✅ DB bağlantısı OK:", rows[0]);
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error("❌ DB bağlantısı BAŞARISIZ:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
