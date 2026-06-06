# CLAUDE.md — TBH Trade

> Bu dosya Claude Code'un projeyi anlaması için ana giriş noktasıdır. Detaylar `docs/` altındaki dosyalardadır; kodlamadan önce ilgili `docs/*` dosyasını oku.

## Proje
**TBH Trade** (açılımı: *Task Bar Hero Trade*). "TBH: Task Bar Hero" (Steam appid **3678970**) oyunundaki **Sentez (Synthesis)** ve **Üretim (Craft)** işlemlerinin olasılıklarını, **Steam Topluluk Pazarı** fiyatlarıyla birleştirip *"bu işlem kârlı mı?"* sorusunu cevaplayan, halka açık, SEO-odaklı bir web aracı. Mantık = CS2 trade-up hesaplayıcılarının bu oyuna uyarlanmışı.

## Teknoloji yığını (karar verildi)
- **Web + API:** Next.js (App Router) + TypeScript + Tailwind. Hosting: **Vercel**.
- **DB:** **Supabase (Postgres)**. ORM: **Drizzle** (drizzle-kit migration'ları). `supabase-js` yalnızca gerekirse (auth/storage).
- **Fiyat toplama worker'ı:** Node, Vercel Cron veya Supabase Scheduled Function ile tetiklenir.
- **Hesap motoru:** ayrı saf TS paketi `packages/calc` (Vitest ile test).
- **Para birimi:** USD (`currency=1`), ama sistem currency-aware.
- **Dil:** Kod/identifier İngilizce; UI **EN birincil + TR** (i18n). Doküman prosası Türkçe.

## Monorepo yapısı (pnpm workspaces)
```
apps/web                 # Next.js (UI + API routes + SEO)
packages/calc            # Saf TS olasılık/EV motoru (UI'dan bağımsız, test edilebilir)
packages/db              # Drizzle şema + migration + tipli sorgular
packages/shared          # Ortak tipler/enumlar (grades, slots, categories)
workers/price-ingest     # Steam fiyat toplama worker'ı + PriceProvider'lar
seed/                    # Datamined JSON verisi + seed script (grades, gear, recipes...)
docs/                    # Spec dosyaları (bu repo)
```

## DEĞİŞMEZ KURALLAR (bunları asla ihlal etme)
1. **Frontend ASLA doğrudan Steam'e istek atmaz.** CORS + 429 rate-limit + ban riski. Tüm fiyatlar DB cache'inden okunur; sadece `workers/price-ingest` server-side Steam'e gider.
2. **Olasılıkları her zaman normalize et** (datamined oranlar yer yer ~%100 değil) — bkz. `calc.normalizeOdds`.
3. **Sadece Legendary ve üzeri kademe tradable.** (Steam'de gözlemlenen gerçek: Legendary gear listeleniyor; common/uncommon/rare hiç listelenmiyor.) Daha düşük kademelerin **$ pazar değeri 0**'dır (sadece altın/alchemy değeri ayrı gösterilir). Sabit: `TRADABLE_MIN_GRADE = Legendary` (tier_index 4).
4. **Fiyat asimetrisi:** Girdi/malzeme **alırken** listeleme fiyatını ödersin (cost = lowest_price). Çıktıyı **satarken** komisyon düşülür (gelir = price × (1 − `STEAM_FEE`)). `STEAM_FEE = 0.15` (config).
5. **Sentez Immortal'dan itibaren FAIL olabilir** (aynı kademede kalır = değer kaybı). EV ve "fail olasılığı" bunu yansıtmalı.
6. Tüm oran/reçete/katalog verisi **versiyonlanır** (`source`, `game_version`) ve UI "datamined, yama ile değişebilir" notu gösterir.
7. **localStorage/sessionStorage kullanma** (gerekmez); durum React state + DB.

## Temel komutlar (kurulduğunda)
```
pnpm i
pnpm dev                 # apps/web
pnpm --filter calc test  # motor testleri
pnpm db:generate         # drizzle migration üret
pnpm db:migrate          # migration uygula
pnpm seed                # datamined veriyi yükle
pnpm ingest:once         # fiyat toplama worker'ını bir kez çalıştır
```

## Okuma sırası (docs/)
1. `docs/01-product-and-game.md` — Oyun mekaniği + datamined tablolar (doğruluk kaynağı).
2. `docs/02-data-model.md` — Postgres şeması (DDL).
3. `docs/03-calc-engine.md` — Olasılık/EV matematiği + TS API.
4. `docs/04-data-and-ingestion.md` — Steam fiyat toplama + datamine import + isim eşleme.
5. `docs/05-architecture.md` — Mimari, app yapısı, SEO.
6. `docs/06-roadmap-tasks.md` — Fazlara bölünmüş görev listesi (buradan başla).

## Başlangıç
`docs/06-roadmap-tasks.md` → **Faz 0**'dan başla. Her faz sonunda acceptance kriterlerini doğrula.
