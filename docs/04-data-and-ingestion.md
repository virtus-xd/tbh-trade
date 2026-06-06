# 04 — Veri Kaynakları, Import & Fiyat Toplama

## A. Datamine import (statik veri → seed)
Amaç: katalog + reçete + oran verisini repo içinde **seed JSON** olarak tutmak (runtime'da wiki'ye bağımlı olmamak). Yamada yeniden üretilir.

**Kaynaklar:**
- **taskbarhero.wiki** (birincil, oyundan datamined): `/grades`, `/gear`, `/materials`, `/synthesis`, `/crafting`, `/database` (45 dataset, ~25.664 satır), görseller `taskbarhero.wiki/game/...`.
- **taskbarhero.org** (ikincil + i18n isimleri; TR dahil 14 dil): `/tr/items/`, `/en/items/`, `/en/cube/`.

**`seed/` çıktıları (JSON):**
```
seed/grades.json            # 01-product-and-game.md §3 tablosu (hazır, elle de girilebilir)
seed/item_types.json        # 20 tip
seed/items.json             # ~5760 gear (game_id, type, level, grade, name_en/tr, image)
seed/materials.json         # ~115-125 malzeme
seed/synthesis_rates.json   # §6 tablosu (HAZIR — bu dokümandan birebir)
seed/synthesis_tiers.json   # §6 kademe tablosu (HAZIR)
seed/synthesis_drops.json   # 203 çıktı havuzu (wiki'den çekilecek)
seed/craft_recipes.json     # 56 reçete (Main weapon HAZIR; 6 slot çekilecek)
seed/craft_recipe_materials.json
seed/craft_drops.json
```

**Import stratejisi (Faz 1):**
1. Sayfalar JS-tabanlı (Astro/Next). Önce **gömülü JSON / `__NEXT_DATA__` / `/database` veri dosyalarını** ara (en temizi). Bulunamazsa HTML tablo parse (cheerio) veya headless (Playwright) ile çek.
2. Tek seferlik `scripts/datamine-import.ts` → `seed/*.json` üretir. Çıktı repoya commit edilir (idempotent).
3. `synthesis_rates`, `synthesis_tiers`, `grades` ve **Main weapon craft satırları** zaten bu dokümanlarda → bunları elle seed'e koy; gerisi script.
4. Telif/atıf: veri "datamined, fan kaynaklı" — UI'da kaynak + "yama ile değişebilir" notu; mümkünse kaynak wiki'lere atıf linki.

**Seed yükleme:** `pnpm seed` → JSON'ları DB'ye yazar (upsert, idempotent). `game_version` damgası.

## B. Steam isim eşleme (market_hash_name)
**Sorun:** EV için her tradable eşya/malzemenin **kesin Steam `market_hash_name`'i** lazım.

**Kaynak (canonical):** Steam pazarındaki gerçek listeler.
```
GET https://steamcommunity.com/market/search/render/?appid=3678970&norender=1&start=0&count=100
→ { success, total_count, results:[ { name, hash_name, sell_price, sell_price_text, sell_listings, asset_description{...} } ] }
```
`start`'ı 100'er artırarak `total_count`'a kadar dön. Bu, **gerçekten satılan** tüm item'ların `hash_name`'lerini + anlık fiyatını verir.

**Eşleme:**
1. Tüm Steam listelerini çek → `market_mapping_audit`'e yaz.
2. Her `hash_name`'i katalog `items`/`materials` ile eşle (önce tam isim, sonra normalize/fuzzy). Eşleşeni `market_hash_name` + `tradable=true` olarak işaretle.
3. `status: matched|ambiguous|unmatched` raporla → eşlenemeyenler elle düzeltme listesi.
> Steam item adları kademe/seviye eki içerebilir; gerçek listeleri inceleyip normalize kuralını oradan çıkar (Faz 2 görevi). Sadece Legendary+ ve tradable malzemeler listede çıkar.

## C. Fiyat toplama worker'ı (`workers/price-ingest`)
**Mutlak kural:** Sadece worker (server-side) Steam'e gider. Frontend asla.

**Sağlayıcı soyutlaması (hibrit):**
```ts
interface PriceProvider {
  // toplu liste + fiyat (ucuz, sayfa başına 100)
  enumerate(appid:number, start:number, count:number): Promise<MarketListing[]>;
  // tek item median/volume (seçili öncelikli item'lar için)
  priceOverview(appid:number, currency:number, hashName:string): Promise<PriceOverview|null>;
}
class SteamDirectProvider implements PriceProvider {}   // ücretsiz, rate-limitli
class ThirdPartyProvider  implements PriceProvider {}   // örn. steamwebapi.com (ücretli)
// seçim: env PRICE_PROVIDER=steam_direct|thirdparty
```

**Steam endpoint'leri:**
- Liste + lowest: `search/render` (yukarıda). **Ana toplama bunun üzerinden** (100'lük batch, ucuz).
- Median/volume: `https://steamcommunity.com/market/priceoverview/?appid=3678970&currency=1&market_hash_name=<urlencoded>` → `{success, lowest_price, median_price, volume}`. Fiyatlar **"$1.23"** string → cents'e parse et. **Çok rate-limitli** → yalnız öncelikli item'lar için.

**Rate-limit yönetimi (kritik):**
- Tek eşzamanlılık (concurrency=1), istek arası ~3–5 sn + jitter.
- 429'da exponential backoff + uzun cooldown (≥60 sn); günlük bütçe sınırı.
- Öncelik sırası: yüksek hacimli + Legendary+ + fırsat skoru yüksek item'lar daha sık; düşük öncelik nadiren.
- Tüm fiyatlar `market_prices`'a (son durum) + `price_history`'ye (trend) yazılır.
- **Eşik kuralı:** belirli pencerede 429 oranı X'i aşar veya kapsam %Y altına düşerse → log + (env açıksa) `ThirdPartyProvider`'a düş.

**Zamanlama:** Vercel Cron veya Supabase Scheduled Function. Örn. tam tarama 6 saatte bir; öncelikli alt küme saatte bir. Tetikleyici `INGEST_CRON_SECRET` ile korunur.

**Worker akışı (her çalışma):**
1. `enumerate` ile katalog+lowest güncelle, yeni `hash_name` varsa mapping audit'e ekle.
2. Öncelikli item'lar için `priceOverview` (median/volume).
3. Fiyatları yaz → `scanOpportunities` çalıştır → `opportunities` cache'ini yenile.

## D. Para birimi
`currency=1` (USD). `STEAM_CURRENCY` env'den; sistem currency-aware (ileride çoklu birim için `market_prices.currency` zaten var).
