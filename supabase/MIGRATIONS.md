# Supabase スキーマ適用記録

> このファイルは本番 Supabase インスタンスへの SQL 適用状況を手動で管理する。
> 新しいスキーマファイルを適用したら必ずここに記録する。

---

## 適用順序（必ず上から順に適用する）

| # | ファイル | 内容 | 本番適用日 |
|---|---|---|---|
| 1 | `schema_step7.sql` | ベーステーブル（ebay_tokens・user_settings） | 未確認 |
| 2 | `schema_step7_5.sql` | 拡張テーブル（feedback_templates 5種 seed 含む） | 未確認 |
| 3 | `schema_stage1_learning.sql` | 学習型手数料システム（transaction_logs） | 未確認 |
| 4 | `schema_templates.sql` | フィードバックテンプレート管理 | 未確認 |
| 5 | `schema_stage2_claude.sql` | Claude API統合基盤（ebay_rules・call_log） | 未確認 |
| 6 | `schema_auto_listing.sql` | 自動出品機能（STAGE2後半用） | **未適用** |

---

## 適用手順

```
Supabase Dashboard → SQL Editor → New query → ファイル内容を貼り付け → Run
```

RLS（Row Level Security）は各スキーマファイル内で定義済み。  
適用後は `SELECT * FROM <テーブル名> LIMIT 1;` で存在確認すること。

---

## 未確認分の確認方法

本番に適用済みかどうか調べるには Supabase Dashboard → Table Editor でテーブルの存在を確認する。

| スキーマ | 確認するテーブル |
|---|---|
| schema_step7.sql | `ebay_tokens`・`user_settings` |
| schema_step7_5.sql | `feedback_templates` |
| schema_stage1_learning.sql | `transaction_logs` |
| schema_templates.sql | `feedback_templates`（seedデータ含む） |
| schema_stage2_claude.sql | `ebay_rules`・`ebay_rules_history` |

確認後はこのファイルの「本番適用日」欄を更新すること（例: `2026-06-28`）。

---

## 注意事項

- `schema_auto_listing.sql` は STAGE2後半着手時に適用する（現時点では未適用で正しい）
- 同じファイルを2回適用しても `CREATE TABLE IF NOT EXISTS` 構文のため冪等
- RLS ポリシーの重複追加はエラーになる場合があるため、2回目適用時は `DROP POLICY IF EXISTS` を先に実行
