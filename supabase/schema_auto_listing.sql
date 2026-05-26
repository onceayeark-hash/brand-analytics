-- BRAND ANALYTICS — schema_auto_listing.sql
-- 自動出品フォームの下書き保存テーブル
-- 適用順: schema_step7.sql → schema_step7_5.sql → schema_stage1_learning.sql → このファイル

CREATE TABLE IF NOT EXISTS draft_listings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_ja       text,
  title_en       text,
  source_url     text,
  source_site    text,        -- 'ebay' | 'yahoo' | 'rakuten' | 'other'
  category_id    text,
  sku            text,
  brand          text,
  condition      text        DEFAULT 'New',
  weight_g       integer,
  images_json    jsonb       DEFAULT '[]',   -- [{ name, size, thumb }]
  price_usd      numeric(10,2),
  cost_jpy       integer,
  target_margin  numeric(5,2) DEFAULT 25,
  desc_en        text,
  condition_desc text,
  settings_json  jsonb       DEFAULT '{}',
  quality_score  integer     DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE draft_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "draft_listings_own" ON draft_listings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_draft_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_draft_listings_updated_at ON draft_listings;
CREATE TRIGGER trg_draft_listings_updated_at
  BEFORE UPDATE ON draft_listings
  FOR EACH ROW EXECUTE FUNCTION update_draft_listings_updated_at();

CREATE INDEX IF NOT EXISTS idx_draft_listings_user_updated
  ON draft_listings(user_id, updated_at DESC);
