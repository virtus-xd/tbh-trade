# 02 — Veri Modeli (Postgres / Supabase)

ORM: **Drizzle**. Aşağıdaki DDL referanstır; Drizzle şemasına çevrilip migration üretilecek. Tüm para alanları **integer cents** (USD sent) olarak saklanır (float yok). Oran alanları `numeric`.

## Enumlar / sabitler
- `grade_key`: common, uncommon, rare, legendary, immortal, arcana, beyond, celestial, divine, cosmic
- `synth_category`: gear, accessory, material
- `craft_slot`: main_weapon, sub_weapon, helmet, armor, gloves, boots, accessory
- `material_category`: crafting, decoration, engraving, inscription, offering, soulstone
- `ref_type`: item, material

## Tablolar (DDL)
```sql
-- Nadirlikler
CREATE TABLE grades (
  id           smallint PRIMARY KEY,          -- tier_index 1..10
  key          text UNIQUE NOT NULL,
  name         text NOT NULL,
  color_hex    text NOT NULL,
  alchemy_gold integer NOT NULL,
  sockets_d    smallint NOT NULL,
  sockets_e    smallint NOT NULL,
  sockets_i    smallint NOT NULL,
  tradable     boolean NOT NULL DEFAULT false
);

-- Eşya tipleri (20)
CREATE TABLE item_types (
  id        serial PRIMARY KEY,
  key       text UNIQUE NOT NULL,             -- sword, bow, ...
  name      text NOT NULL,
  category  text NOT NULL                     -- weapon|offhand|armor|accessory
);

-- Gear katalogu (~5760)
CREATE TABLE items (
  id               serial PRIMARY KEY,
  game_id          integer UNIQUE,            -- datamine ID
  type_id          integer NOT NULL REFERENCES item_types(id),
  level            smallint NOT NULL,
  grade_id         smallint NOT NULL REFERENCES grades(id),
  name_en          text NOT NULL,
  name_tr          text,
  slug             text UNIQUE NOT NULL,      -- SEO URL
  market_hash_name text,                      -- Steam eşlemesi (null = listelenmemiş)
  tradable         boolean NOT NULL DEFAULT false,  -- grade.tradable && market_hash_name var
  image_url        text
);
CREATE INDEX ON items (grade_id, level);
CREATE INDEX ON items (type_id);

-- Malzemeler (~115-125)
CREATE TABLE materials (
  id               serial PRIMARY KEY,
  game_id          integer UNIQUE,
  name_en          text NOT NULL,
  name_tr          text,
  slug             text UNIQUE NOT NULL,
  grade_id         smallint NOT NULL REFERENCES grades(id),
  category         text NOT NULL,             -- material_category
  market_hash_name text,
  tradable         boolean NOT NULL DEFAULT false,
  image_url        text
);

-- SENTEZ: kademe-yükseltme oranları
CREATE TABLE synthesis_rates (
  input_grade_id    smallint NOT NULL REFERENCES grades(id),
  result_grade_id   smallint NOT NULL REFERENCES grades(id),
  probability       numeric(8,6) NOT NULL,
  is_fail           boolean NOT NULL DEFAULT false,   -- aynı kademe
  is_great_success  boolean NOT NULL DEFAULT false,   -- +2 kademe
  source            text NOT NULL DEFAULT 'taskbarhero.wiki',
  game_version      text,
  PRIMARY KEY (input_grade_id, result_grade_id)
);

-- SENTEZ: reçete kademeleri
CREATE TABLE synthesis_tiers (
  tier        smallint PRIMARY KEY,
  level_min   smallint NOT NULL,
  level_max   smallint NOT NULL,
  cube_level  smallint NOT NULL,
  gold_cost   integer NOT NULL
);

-- SENTEZ: çıktı havuzları (203) — bir (kategori, sonuç kademe, tier) için olası eşyalar
CREATE TABLE synthesis_drops (
  id              serial PRIMARY KEY,
  category        text NOT NULL,              -- synth_category
  result_grade_id smallint NOT NULL REFERENCES grades(id),
  tier            smallint NOT NULL REFERENCES synthesis_tiers(tier),
  item_id         integer REFERENCES items(id),       -- gear/accessory için
  material_id     integer REFERENCES materials(id)    -- material kategorisi için
);
CREATE INDEX ON synthesis_drops (category, result_grade_id, tier);

-- ÜRETİM: reçeteler (56)
CREATE TABLE craft_recipes (
  id                  serial PRIMARY KEY,
  slot                text NOT NULL,          -- craft_slot
  tier                smallint NOT NULL,
  level_min           smallint NOT NULL,
  level_max           smallint NOT NULL,
  cube_level          smallint,
  gold_cost           integer DEFAULT 0,
  grade_odds          jsonb NOT NULL,         -- {"uncommon":0.5,"rare":0.4,...}
  possible_item_count integer,
  source              text NOT NULL DEFAULT 'taskbarhero.wiki',
  game_version        text,
  UNIQUE (slot, tier)
);

CREATE TABLE craft_recipe_materials (
  recipe_id   integer NOT NULL REFERENCES craft_recipes(id),
  material_id integer NOT NULL REFERENCES materials(id),
  qty         smallint NOT NULL,
  PRIMARY KEY (recipe_id, material_id)
);

-- ÜRETİM: çıktı havuzu (slot+kademe+tier için olası eşyalar)
CREATE TABLE craft_drops (
  id              serial PRIMARY KEY,
  recipe_id       integer NOT NULL REFERENCES craft_recipes(id),
  result_grade_id smallint NOT NULL REFERENCES grades(id),
  item_id         integer NOT NULL REFERENCES items(id)
);
CREATE INDEX ON craft_drops (recipe_id, result_grade_id);

-- FİYAT: son durum (cache) — frontend hep buradan okur
CREATE TABLE market_prices (
  ref_type      text NOT NULL,                -- item|material
  ref_id        integer NOT NULL,
  currency      smallint NOT NULL DEFAULT 1,  -- 1=USD
  lowest_cents  integer,                      -- alış maliyeti bazı
  median_cents  integer,                      -- satış EV bazı (yeterli hacimde)
  volume        integer,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ref_type, ref_id, currency)
);

-- FİYAT: geçmiş (trend grafiği, opsiyonel ama şema baştan dursun)
CREATE TABLE price_history (
  ref_type    text NOT NULL,
  ref_id      integer NOT NULL,
  currency    smallint NOT NULL DEFAULT 1,
  price_cents integer NOT NULL,
  volume      integer,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON price_history (ref_type, ref_id, observed_at);

-- Önceden hesaplanmış fırsat skorları (opportunity scanner cache)
CREATE TABLE opportunities (
  id          serial PRIMARY KEY,
  kind        text NOT NULL,                  -- synthesis|craft
  payload     jsonb NOT NULL,                 -- senaryo tanımı (kategori/slot/grade/tier...)
  cost_cents  integer NOT NULL,
  ev_cents    integer NOT NULL,               -- komisyon düşülmüş net beklenen gelir
  net_cents   integer NOT NULL,
  roi         numeric(8,4) NOT NULL,
  profit_prob numeric(6,4),
  fail_prob   numeric(6,4),
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON opportunities (kind, roi DESC);

-- Steam isim eşleme denetimi (eşlenemeyenleri raporla)
CREATE TABLE market_mapping_audit (
  market_hash_name text PRIMARY KEY,
  matched_ref_type text,
  matched_ref_id   integer,
  status           text NOT NULL,             -- matched|ambiguous|unmatched
  seen_at          timestamptz NOT NULL DEFAULT now()
);

-- (Opsiyonel) kullanıcı senaryoları — auth eklenirse
CREATE TABLE calc_presets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  kind       text NOT NULL,
  payload    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## Notlar
- `items.tradable` türetilmiş: `grades.tradable AND market_hash_name IS NOT NULL`. Seed/ingest sonrası güncellenir.
- `market_prices` "son durum"; `price_history` zaman serisi. Frontend EV hesabı `market_prices`'tan okur.
- `synthesis_drops`/`craft_drops` çıktı havuzlarını taşır → EV'de kademe-içi ortalama fiyat bunlardan hesaplanır.
- Tüm datamined tablolar `source` + `game_version` taşır; yeni yamada yeniden seed edilebilir.
