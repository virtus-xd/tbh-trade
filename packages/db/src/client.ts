import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

/**
 * Supabase Postgres bağlantısı (server-side). DATABASE_URL .env'den gelir.
 *
 * Tembel (lazy) kurulum: modül import edildiğinde değil, ilk kullanımda
 * bağlanır. Böylece DATABASE_URL gerektirmeyen kod yolları (örn. tip
 * importları) hata fırlatmadan çalışır.
 */
let _client: ReturnType<typeof postgres> | undefined;

export function getQueryClient(): ReturnType<typeof postgres> {
  if (!_client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL tanımlı değil. Repo kökünde .env oluşturup doldurun (bkz. .env.example).",
      );
    }
    // prepare:false → Supabase pooler (PgBouncer transaction mode) uyumu.
    _client = postgres(connectionString, { prepare: false });
  }
  return _client;
}

export function getDb() {
  return drizzle(getQueryClient(), { schema });
}
