# BRAND ANALYTICS — 実装指示書
## Claude Code: このファイルを最初に読み込んでから実装を開始すること

---

## セッション開始時の必須手順
1. `tasks/lessons.md` を読み、過去の指摘事項を確認する
2. 以下の詳細仕様を参照する

---

## 詳細仕様（分割管理）

@context/skills.md
@context/specs.md
@context/architecture.md
@context/coding-rules.md

---

## 障害対応プロトコル（Claude Code 必読）

### ユーザーからエラー報告を受けたとき、必ずこの順で診断する

1. **Supabase `error_logs` テーブルを確認**
   ```sql
   SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 50;
   ```

2. **外部サービスの死活確認**
   | サービス | ステータスページ |
   |---|---|
   | Supabase | https://status.supabase.com |
   | Google Cloud | https://status.cloud.google.com |
   | eBay API | https://developer.ebay.com/support |

3. **エラーコード別の対応方針**
   | コード | 原因 | 対応 |
   |---|---|---|
   | `SUPABASE_DOWN` | Supabase障害 | status.supabase.com確認・復旧待ち |
   | `AUTH_GOOGLE_FAIL` | Google OAuth失敗 | Google Cloud Console確認 |
   | `EBAY_API_ERROR` | eBay API障害 | eBay Developer Portal確認 |
   | `EBAY_TOKEN_EXPIRED` | eBayトークン期限切れ | Edge Function再実行 |
   | `JS_UNHANDLED` | フロントエンドバグ | スタックトレース確認 |
   | `NETWORK_ERROR` | ネットワーク断 | ユーザー環境確認 |

4. **新しい外部サービスを追加するたびに必ずここに追記する**
   - サービス名・ステータスページURL・エラーコード・対応方針を追加すること

### 監視アーキテクチャ
- フロントエンドエラー → `js/core/monitor.js` が収集 → Supabase `error_logs` に保存
- 閾値超過（同一エラー5件以上/1時間）→ Edge Function `notify-admin` がメール送信
- 管理者パネル（`panel-admin`）で error_logs をリアルタイム表示

---
*最終更新: 2026-05-15 | 監視・障害対応プロトコル追加*
