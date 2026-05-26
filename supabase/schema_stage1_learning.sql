-- ══════════════════════════════════════════════
-- BRAND ANALYTICS — schema_stage1_learning.sql
-- 学習型手数料計算システム用テーブル
-- 適用順: schema_step7.sql → schema_step7_5.sql → このファイル
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transaction_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- 取引基本情報
  sale_price_usd    numeric(10,2) NOT NULL CHECK (sale_price_usd >= 0),
  traded_at         date          NOT NULL,

  -- 手数料実額（USD）
  ebay_fee_usd      numeric(10,2) NOT NULL DEFAULT 0 CHECK (ebay_fee_usd >= 0),
  promoted_fee_usd  numeric(10,2) NOT NULL DEFAULT 0 CHECK (promoted_fee_usd >= 0),
  payoneer_fee_usd  numeric(10,2) NOT NULL DEFAULT 0 CHECK (payoneer_fee_usd >= 0),

  -- 真贋サービス（$500以上のみ）
  auth_service_jpy  integer       NOT NULL DEFAULT 0 CHECK (auth_service_jpy >= 0),
  auth_service_incl boolean       NOT NULL DEFAULT true,

  -- 仕入れ・受取
  cost_price_jpy    integer       NOT NULL DEFAULT 0 CHECK (cost_price_jpy >= 0),
  received_jpy      integer       NOT NULL DEFAULT 0 CHECK (received_jpy >= 0),

  -- 取引時の為替レート（為替乖離計算用）
  exchange_rate     numeric(8,2),

  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_logs_user_id
  ON transaction_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_logs_traded_at
  ON transaction_logs (user_id, traded_at DESC);

ALTER TABLE transaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_logs_own_data"
  ON transaction_logs
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);
