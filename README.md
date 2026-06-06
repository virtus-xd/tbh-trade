# TBH Trade (Task Bar Hero Trade)

TBH: Task Bar Hero oyunundaki **Sentez** ve **Üretim** işlemlerinin olasılıklarını Steam Pazarı fiyatlarıyla birleştirip *"kârlı mı?"* sorusunu cevaplayan, halka açık SEO aracı.

## Hızlı başlangıç
```bash
pnpm i
cp .env.example .env            # değerleri doldur (Supabase, Steam, cron secret)
pnpm db:generate && pnpm db:migrate
pnpm seed                       # datamined veriyi yükle
pnpm ingest:once                # bir kez fiyat çek
pnpm dev                        # apps/web
```

## Dokümanlar
- **`CLAUDE.md`** — başla buradan (kurallar + yapı + komutlar).
- `docs/01-product-and-game.md` — oyun mekaniği + datamined tablolar.
- `docs/02-data-model.md` — DB şeması.
- `docs/03-calc-engine.md` — olasılık/EV matematiği + TS API.
- `docs/04-data-and-ingestion.md` — Steam fiyat toplama + datamine import + isim eşleme.
- `docs/05-architecture.md` — mimari + SEO.
- `docs/06-roadmap-tasks.md` — fazlı görev listesi (geliştirme buradan yürür).

## Mutlak kural
Frontend **asla** Steam'e doğrudan istek atmaz. Fiyatlar yalnız `workers/price-ingest` tarafından çekilip DB'de cache'lenir.

> Resmî değil — fan yapımı bir araç. Oyun isim/varlıkları sahiplerine aittir.
