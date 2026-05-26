-- BRAND ANALYTICS — schema_templates.sql
-- 適用順: schema_step7.sql → schema_step7_5.sql → schema_stage1_learning.sql → schema_auto_listing.sql → このファイル
-- 3テーブル: listing_templates / active_listings_cache / price_schedule_rules

-- ─── 出品テンプレート ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  desc_en     text,
  form_json   jsonb       DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE listing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_templates_own" ON listing_templates
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_listing_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listing_templates_updated_at ON listing_templates;
CREATE TRIGGER trg_listing_templates_updated_at
  BEFORE UPDATE ON listing_templates
  FOR EACH ROW EXECUTE FUNCTION update_listing_templates_updated_at();

CREATE INDEX IF NOT EXISTS idx_listing_templates_user_created
  ON listing_templates(user_id, created_at DESC);

-- ─── アクティブ出品キャッシュ ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_listings_cache (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebay_item_id  text        NOT NULL,
  title         text,
  current_price numeric(10,2),
  cost_jpy      integer,
  listed_at     date,
  thumbnail_url text,
  cached_at     timestamptz DEFAULT now(),
  UNIQUE(user_id, ebay_item_id)
);

ALTER TABLE active_listings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_listings_cache_own" ON active_listings_cache
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_active_listings_user_listed
  ON active_listings_cache(user_id, listed_at DESC);

-- ─── 値下げスケジュールルール（Premium専用） ─────────────────────────────────
CREATE TABLE IF NOT EXISTS price_schedule_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  days_threshold  integer     NOT NULL DEFAULT 14,
  reduce_pct      numeric(5,2) NOT NULL DEFAULT 10,
  min_price_usd   numeric(10,2),
  is_active       boolean     DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE price_schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_schedule_rules_own" ON price_schedule_rules
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_price_schedule_rules_user
  ON price_schedule_rules(user_id, created_at DESC);
