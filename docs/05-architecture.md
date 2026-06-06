# 05 — Mimari, Uygulama Yapısı & SEO

## Sistem akışı
```
[Steam Market] ←(yalnız worker, rate-limitli)— [workers/price-ingest] —yaz→ [Supabase/Postgres]
                                                                                   ↑ oku
[Tarayıcı] ──HTTP──► [apps/web (Next.js): RSC + /api] ──► packages/calc + packages/db ┘
```
Frontend Steam'e hiç dokunmaz; her şey DB cache + calc motoru üzerinden.

## Monorepo (pnpm workspaces + turbo opsiyonel)
```
apps/web/
  app/                      # App Router
    (marketing)/            # ana sayfa, hakkında, metodoloji
    synthesis/              # sentez hesaplayıcı
    craft/                  # üretim hesaplayıcı
    opportunities/          # fırsat tarayıcı (en kârlılar)
    item/[slug]/            # eşya detay (ISR, SEO)
    material/[slug]/        # malzeme detay (ISR)
    api/
      calc/route.ts         # POST: senaryo → EvalResult (calc + db price)
      opportunities/route.ts# GET: cache'ten sıralı liste
      ingest/route.ts       # POST (cron secret): worker tetikleyici
    sitemap.ts / robots.ts
  components/  lib/  i18n/
packages/calc/              # saf motor (docs/03)
packages/db/                # drizzle şema + migration + query helpers
packages/shared/            # GradeKey, CraftSlot, enumlar, util
workers/price-ingest/       # PriceProvider'lar + scheduler entry
seed/                       # datamined JSON + seed script
scripts/                    # datamine-import.ts, map-market-names.ts
```

## Render & veri akışı
- **Hesaplayıcı sayfaları:** interaktif (client) form + `/api/calc` (server) → DB fiyat + calc. Sonuç tablosu renk-kodlu (grade renkleri §3).
- **Eşya/malzeme detay & fırsat sayfaları:** **ISR** (revalidate ~1 saat) — SEO için statik üretilir, fiyatlar periyodik tazelenir. Her tradable item ve her öne çıkan senaryo kalıcı URL.
- **Fırsat tarayıcı:** `opportunities` cache tablosundan okur (worker üretir), anlık hesap yapmaz.

## SEO (birincil hedef — halka açık ürün)
- Kalıcı URL şeması: `/item/<slug>`, `/material/<slug>`, `/synthesis/<category>-<grade>-t<tier>`, `/craft/<slot>-t<tier>`.
- `sitemap.xml` dinamik (tüm item + senaryo URL'leri), `robots.txt`, kanonik URL, **hreflang EN/TR**.
- JSON-LD: `Product` / `ItemList`; OG + Twitter Card görselleri (item ikonu).
- Performans: görseller CDN + lazy, RSC ile düşük JS, hızlı LCP.
- İçerik kancası: otomatik güncellenen **"Günün en kârlı işlemleri"** sayfası (organik trafik).
- Her sayfada özgün title/description; "datamined / yama ile değişebilir" + son fiyat güncelleme zamanı görünür (güven).

## i18n
- `next-intl` (veya App Router native). Mesaj dosyaları `i18n/en.json`, `i18n/tr.json`.
- Eşya/malzeme isimleri DB'de `name_en` + `name_tr`.

## Yasal / güven
- Footer: "Resmî değil — fan yapımı. Nugem/Tesseract Studio ile bağlantısız. Tüm oyun isim/varlıkları sahiplerine aittir."
- Metodoloji sayfası: oran kaynakları, fiyat tazeliği, komisyon/asimetri açıklaması.
- Reklam/affiliate slotları layout'ta yer ayrılmış (içerik sahibi yönetir), ama veri/öneri tarafsız.

## Gözlemlenebilirlik
- Worker: 429 oranı, kapsam %, son başarılı tarama zamanı loglanır (basit bir `ingest_runs` log tablosu eklenebilir).
- Eşlenemeyen `market_hash_name` sayısı dashboard'da.
