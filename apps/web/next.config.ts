import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Yerel geliştirme: monorepo kökündeki .env'i yükle (Next yalnız app dizininden
// okur). Vercel'de env dashboard'tan gelir; orada dosya yoksa bu no-op'tur ve
// mevcut process.env değerlerinin ÜZERİNE yazmaz (dotenv varsayılanı).
loadEnv({ path: "../../.env" });

const withNextIntl = createNextIntlPlugin(); // ./i18n/request.ts (varsayılan)

const nextConfig: NextConfig = {
  // Workspace paketleri TS kaynaktan transpile edilir (önceden build gerekmez).
  transpilePackages: ["shared", "db", "calc", "price-ingest"],
  // postgres-js Node API'leri kullanır → /api/ingest server (nodejs) bundle'ında dışarıda tut.
  serverExternalPackages: ["postgres"],
};

export default withNextIntl(nextConfig);
