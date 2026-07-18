*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

### 【STAGE2後半】自動値下げ機能（新規ファイル：repricing.js）

ルールベースで出品商品の価格を自動調整する機能。

APIについて：
eBay Trading APIを使用。
eBay Developer Programへの登録・本番キー生成で
自動的にスコープが付与されるため特別な申請不要。

ルール設定（ユーザーが設定可能）：
・出品から○日経過した商品を○%値下げ
・競合の最安値より$X/○%高い場合に自動調整
・値下げの下限：目標粗利率○%を下回らない
・値下げの上限回数：1商品につき最大○回まで
・対象商品フィルター：
  カテゴリ・価格帯・出品日で絞り込み可能

実行タイミング：
Supabase Edge Functionsのcronジョブで
1日1回または任意の時間に実行

必要なAPI：
・eBay Trading API（ReviseItem）
  → eBay Developer Program登録で自動付与
・Supabase Edge Functions（定期実行）

UI：
「設定」ページの新セクションとして追加
「自動値下げルール」

---

