-- ============================================================
-- BRAND ANALYTICS — schema_stage2_claude.sql
-- Claude API統合基盤 / B層動的ルールDB
--
-- 適用順序: schema_step7.sql → schema_step7_5.sql → (本ファイル)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. ebay_rules テーブル
--    B層動的ルールDB。改定があればこのテーブルを更新するだけで
--    コード変更なしにAIのプロンプトに反映される。
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.ebay_rules (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category       text        NOT NULL
                             CHECK (category IN ('fee', 'policy', 'specifics')),
  item_key       text        NOT NULL UNIQUE,
  value          text        NOT NULL,
  description    text,
  effective_date date,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.ebay_rules IS 'Claude API B層: eBayルール動的DB。AIのシステムプロンプトに毎回読み込まれる。';
COMMENT ON COLUMN public.ebay_rules.category       IS 'fee=手数料 / policy=規約 / specifics=特記事項';
COMMENT ON COLUMN public.ebay_rules.item_key       IS 'ルール識別キー（fvf_cap 等）。UNIQUE制約あり';
COMMENT ON COLUMN public.ebay_rules.value          IS 'ルール値（数値も text で保存）';
COMMENT ON COLUMN public.ebay_rules.effective_date IS 'この値が有効になった日付';

-- RLS 有効化（管理者のみ書き込み・全ユーザー読み取り可）
ALTER TABLE public.ebay_rules ENABLE ROW LEVEL SECURITY;

-- 全ユーザー読み取り可（認証済み・未認証問わず）
CREATE POLICY "ebay_rules_select_all"
  ON public.ebay_rules FOR SELECT
  USING (true);

-- 書き込みは service_role のみ（RLS はバイパスされる）
-- フロントからの INSERT/UPDATE/DELETE はポリシー不在で全て拒否される

-- インデックス
CREATE INDEX idx_ebay_rules_category ON public.ebay_rules (category);

-- ────────────────────────────────────────────────────────────
-- 2. 初期データ（CLAUDE.md記載の5件）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.ebay_rules (category, item_key, value, description, effective_date) VALUES
  ('fee',       'fvf_cap',                '750',
   'eBay手数料上限Cap（USD）',                              '2024-01-01'),

  ('fee',       'fvf_rate_standard',      '13.25',
   '標準カテゴリFVF率（%）',                               '2024-01-01'),

  ('fee',       'promoted_min',           '2.0',
   'Promoted Listings最低料金（%）',                       '2024-01-01'),

  ('fee',       'payoneer_rate',          '2.0',
   'Payoneer手数料率（%）',                                '2024-01-01'),

  ('specifics', 'authenticity_categories','ハンドバッグ,スニーカー,腕時計,宝飾品',
   '真贋保証対象カテゴリ（$500以上でセラー国内送料発生）',  '2024-01-01')

ON CONFLICT (item_key) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 3. ebay_rules_history テーブル
--    ebay_rules が変更されたときの履歴ログ。
--    ポリシー自動監視システム（CLAUDE.md「eBay Japanポリシー監視」層②）で使用。
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.ebay_rules_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key   text        NOT NULL,
  old_value  text,
  new_value  text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source_url text,
  summary    text
);

COMMENT ON TABLE  public.ebay_rules_history IS 'ebay_rules の変更履歴。ポリシー自動監視で自動 INSERT される。';
COMMENT ON COLUMN public.ebay_rules_history.source_url IS '変更元URL（eBayアナウンスページ等）';
COMMENT ON COLUMN public.ebay_rules_history.summary    IS '変更内容の日本語要約';

-- RLS 有効化（全ユーザー読み取り可・書き込みは service_role のみ）
ALTER TABLE public.ebay_rules_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ebay_rules_history_select_all"
  ON public.ebay_rules_history FOR SELECT
  USING (true);

-- インデックス（item_key 検索 + 時系列ソート用）
CREATE INDEX idx_ebay_rules_history_item_key   ON public.ebay_rules_history (item_key);
CREATE INDEX idx_ebay_rules_history_changed_at ON public.ebay_rules_history (changed_at DESC);


-- ────────────────────────────────────────────────────────────
-- 4. 自動履歴記録トリガー
--    ebay_rules.value が変更されたとき自動的に history に INSERT する。
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_record_ebay_rule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO public.ebay_rules_history
      (item_key, old_value, new_value, summary)
    VALUES
      (NEW.item_key, OLD.value, NEW.value,
       format('自動記録: %s が %s → %s に変更', NEW.item_key, OLD.value, NEW.value));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ebay_rules_on_update
  AFTER UPDATE ON public.ebay_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_record_ebay_rule_change();
