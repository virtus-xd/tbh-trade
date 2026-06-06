# 06 — Yol Haritası & Görev Listesi (Claude Code buradan başlar)

Her görev küçük ve doğrulanabilir. Faz sonunda **acceptance** kriterlerini geç, sonra ilerle.

## Faz 0 — İskelet
- [ ] pnpm workspaces monorepo: `apps/web`, `packages/{calc,db,shared}`, `workers/price-ingest`, `seed`, `scripts`.
- [ ] Next.js (App Router, TS, Tailwind) `apps/web`; çalışan ana sayfa.
- [ ] Supabase projesi bağlandı; `packages/db` Drizzle kurulumu + `DATABASE_URL`.
- [ ] `packages/shared`: GradeKey, CraftSlot, SynthCategory, MaterialCategory enumları + grade meta (renk, tier_index, tradable).
- [ ] `.env.example` dolduruldu; README çalıştırma adımları.
- **Acceptance:** `pnpm dev` ana sayfayı açar; `pnpm --filter calc test` boş suite geçer; DB'ye bağlanılır.

## Faz 1 — Şema + statik veri (datamine)
- [ ] `docs/02` DDL'ini Drizzle şemasına çevir; `pnpm db:generate && db:migrate`.
- [ ] `seed/`: `grades.json`, `synthesis_rates.json`, `synthesis_tiers.json`, **Main weapon** `craft_recipes` satırları → bu repodaki tablolardan **birebir** doldur.
- [ ] `scripts/datamine-import.ts`: taskbarhero.wiki'den `items`, `materials`, `synthesis_drops`, kalan 6 craft slotu (`craft_recipes`+`craft_drops`) çek → `seed/*.json`. (Önce gömülü JSON / `/database`; olmazsa cheerio/Playwright.)
- [ ] `pnpm seed`: idempotent upsert, `game_version` damgalı.
- **Acceptance:** DB'de 10 grade, 20 tip, ~5760 item, ~115+ malzeme, 9 satır synthesis_rates, 8 synthesis_tier, 56 craft_recipe; tutarlılık testi (her recipe'in grade_odds toplamı ~1; her drop havuzu boş değil).

## Faz 2 — Steam isim eşleme + fiyat worker
- [ ] `PriceProvider` arayüzü + `SteamDirectProvider` (`search/render` enumerate + `priceOverview`).
- [ ] `scripts/map-market-names.ts`: Steam listelerini çek → `items/materials.market_hash_name` eşle, `tradable` güncelle, `market_mapping_audit` raporu.
- [ ] Worker akışı: enumerate → öncelikli priceOverview → `market_prices` + `price_history` yaz. Rate-limit: concurrency=1, gecikme+jitter, 429 backoff, günlük bütçe.
- [ ] `/api/ingest` (cron secret korumalı) + cron tanımı (Vercel/Supabase). `pnpm ingest:once`.
- [ ] `ThirdPartyProvider` iskeleti + env switch (`PRICE_PROVIDER`).
- **Acceptance:** `pnpm ingest:once` 429 almadan bir batch fiyatı `market_prices`'a yazar; eşleşmeyen isim raporu üretilir; eşleşme oranı raporlanır.

## Faz 3 — Hesap motoru (packages/calc)
- [ ] `normalizeOdds`, `poolAverageSell`, fiyat seçimi (median/lowest/eşik).
- [ ] `evaluateSynthesis` (fail/great + farm modu) + `evaluateCraft`.
- [ ] `scanOpportunities` → `opportunities` tablosuna yaz.
- [ ] Vitest: `docs/03` "test senaryoları" + kenar durumlar (fiyatsız havuz, normalize, fail prob, komisyon).
- **Acceptance:** Tüm calc testleri yeşil; motor DB'den bağımsız (PriceBook enjekte edilir).

## Faz 4 — Hesaplayıcı UI
- [ ] `/api/calc` route (senaryo → EvalResult; calc + db price).
- [ ] **Sentez** sayfası: kategori + kademe + tier seç → maliyet, çıktı dağılım tablosu (grade renkli), EV, ROI, **fail %**, kâr %, başabaş. Tradable olmayan girdide "farm modu".
- [ ] **Üretim** sayfası: slot + tier → malzeme maliyeti + aynı sonuç paneli.
- [ ] "Eksik veri / datamined / son güncelleme zamanı" rozetleri.
- **Acceptance:** Gerçek cache fiyatlarıyla iki hesaplayıcı doğru EvalResult gösterir; fiyatsız senaryo uyarı verir.

## Faz 5 — Fırsat tarayıcı + DB sayfaları + SEO + i18n
- [ ] `/opportunities`: `opportunities` cache'inden ROI sıralı tablo + filtreler (sentez/üretim, kademe, slot).
- [ ] `/item/[slug]`, `/material/[slug]` ISR detay (fiyat + "bunu üreten/sentezleyen senaryolar" + trend grafiği).
- [ ] `sitemap.ts`, `robots.ts`, JSON-LD, OG, hreflang; `next-intl` EN/TR.
- [ ] Footer yasal + metodoloji sayfası.
- **Acceptance:** Lighthouse SEO ≥ 95; sitemap tüm item+senaryo URL'lerini içerir; TR/EN geçiş çalışır.

## Faz 6 — Cila
- [ ] Trend grafikleri (`price_history`), "günün fırsatları" otomasyonu.
- [ ] (Opsiyonel) auth + `calc_presets` kayıtlı senaryolar.
- [ ] `ingest_runs` log + basit health dashboard (429 oranı, kapsam, eşlenmeyen isim).
- **Acceptance:** Worker düzenli çalışıyor; veri tazeliği UI'da görünür; temel analytics.

## Genel acceptance / "bitti" tanımı
- Frontend hiçbir yerde Steam'e doğrudan istek atmıyor (grep ile doğrula).
- Oranlar normalize; Legendary+ dışı pazar değeri 0; komisyon satışta uygulanıyor; sentez fail EV'ye yansıyor.
- Tüm datamined veri `source`+`game_version` damgalı ve yeniden seed edilebilir.
