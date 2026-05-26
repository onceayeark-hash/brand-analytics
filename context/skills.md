# 自動適用 Skills

## トークン管理（常時）
- **token-budget-advisor**: 複雑な質問の前に回答深度(1〜4)を提示する
- **context-budget**: コンテキスト使用量が多い場合に警告・整理を促す

## 実装フロー（用途別に自動起動）
| タイミング | Skill |
|---|---|
| 新機能の実装前 | `plan` → 設計を確認してから実装開始 |
| eBay API接続の実装時 | `api-connector-builder` |
| ダッシュボード・グラフ実装時 | `dashboard-builder` + `frontend-design` |
| グラフUIの視覚設計・レイアウト改善時 | `frontend-design` |
| 機能コードを書くとき | `feature-dev` |
| コード完成後 | `code-review` |
| auth.js・OAuth・暗号化の実装後 | `security-review`（必須） |
| eBay APIの仕様調査 | `deep-research` |
| UIコンポーネント実装時 | `frontend-patterns` |
| 取引記録・学習型手数料・利益計算の実装時 | `finance-billing-ops` |
| transaction_logs・DBスキーマ設計時 | `postgres-patterns` |
| eBayカテゴリ・競合・市場データ調査時 | `market-research` |

## ルール
1. `security-review` は auth.js・crypto.js・トークン処理を含む変更に**必ず**実行する
2. `plan` を省略して実装を開始しない
3. 回答深度はデフォルト **50%（Moderate）**。ユーザーが指定した場合はそれに従う
4. グラフ・チャート実装時は `frontend-design` を必ず併用し、視覚的インパクトを優先する
5. 利益計算・手数料ロジックの実装時は `finance-billing-ops` を先に呼び、計算パターンを確認してから実装する
