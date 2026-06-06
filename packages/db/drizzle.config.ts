import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// .env repo kökünde tutulur; drizzle-kit packages/db içinden çalışır.
config({ path: "../../.env" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // Faz 0: tablo yok; bağlantı yalnız migrate/check için gerekli.
    url: process.env.DATABASE_URL ?? "",
  },
  // Datamined tablolar versiyonlanır (Değişmez kural #6); migration'lar
  // packages/db/drizzle/ altında repoya commit edilir.
  verbose: true,
  strict: true,
});
