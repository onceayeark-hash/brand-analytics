# 仕様（確定済み）

## プロジェクト概要
- **目的**: eBayセラー向けブランド分析・利益計算・アカウント保護ツール
- **対象ユーザー**: 越境EC（eBay）セラー（日本人メイン）
- **フロント**: HTML + Vanilla JS（機能別ファイル分割構成）
- **認証**: Supabase Auth + eBay OAuth 2.0
- **DB**: Supabase（PostgreSQL + Row Level Security）
- **暗号化**: Web Crypto API（AES-GCM 256bit）
- **将来**: Electron化 → Stripe決済 → サブスク販売

## アクセス段階（3段階）
| tier        | 解放機能 |
|-------------|--------|
| `free`      | 為替・利益計算機、仕入れメーターのみ |
| `connected` | OAuth連携後・全機能解放 |
| `premium`   | STAGE4（Stripe実装後） |

制御: `user_settings.access_tier` / HTML属性 `data-tier` で制御

## アカウントパフォーマンス指標（生数値表示 — スコア化しない）
スコア計算・ランク付けは廃止。各指標の実数値をそのまま表示し、閾値超えをアラートで通知する。

| 指標 | eBay警告閾値 | eBay不合格閾値 |
|------|------------|-------------|
| 取引不良率 (Defect Rate) | — | 2%以上 |
| 未解決ケース率 (Cases Not Closed) | — | 0.3%以上 |
| 遅延発送率 (Late Shipment Rate) | 5%以上 | 10%以上 |
| 追跡情報なし率 (Tracking Uploaded) | — | 95%未満 |
| INAD率 (Item Not As Described) | — | 0.5%以上 |

**廃止理由**: 重み付きスコアのエビデンスがなく、ユーザーに誤解を招くため。

### 健全性シミュレーター（維持・スコアなし版）
- 「あと何件でXXX Rateが閾値を超えるか」を各指標ごとに逆算して表示
- 複合スコアなし・指標ごとの残件数のみ提示

## 利益計算式（学習型手数料対応版）
```
粗利益 = 販売価格
       - eBay手数料（学習済み実績率 or フォールバック値）
       - Promoted Listings費用
       - Payoneer手数料（学習済み実績率 or フォールバック2%）
       - 送料（設定値 or 都度入力）
       - 関税（設定値 or 都度入力）
       - 真贋サービス送料（$500以上のみ・学習済み実績値 or フォールバック¥1,500）
       - 仕入れ原価（円入力メイン）
```
⚠️ **UI必須表示**: `「シミュレーション値・実際の損益は取引記録による」`

### 学習型手数料計算システム
取引記録を蓄積するたびに手数料の推定精度が上がる仕組み。

**学習対象の4手数料:**
| 手数料 | フォールバック | 学習方法 |
|--------|--------------|---------|
| eBay FVF（最終価格手数料） | カテゴリ別デフォルト率 | 実取引の `ebay_fee / sale_price` の移動平均 |
| Payoneer手数料 | 2.0% | 実取引の `payoneer_fee / received_amount` の移動平均 |
| 真贋サービス送料 | ¥1,500 | $500以上取引の実送料の中央値 |
| 為替レート乖離 | 0円（乖離なし） | eBay受取額と実際の円換算額の差の平均 |

**データソース**: ユーザーが「取引記録を追加」フォームから手動入力（1件ずつ）

**取引記録フォームの入力項目:**
```
- 販売価格（USD）
- eBayから実際に引かれた手数料（USD）
- Payoneerへの実際の入金額（USD）
- 真贋サービス送料（JPY・$500以上の場合のみ）
- 仕入れ原価（JPY）
- 実際の受取金額（JPY）— 為替乖離計算用
- 取引日
```

**フォールバック動作**: 取引記録が5件未満の場合はデフォルト値を使用し、UIに件数を表示。

### $500境界ルール（重要）
- **$500以上**: 真贋サービス国内送料のみセラー負担（デフォルト¥1,500）
  → 国際送料・関税は **$0自動入力**（バイヤー負担）
- **$500以下**: 送料3択（manual / fixed $35 / buyer）
  → 関税2択（manual / zero）

## 仕入れ分析 Go/No-Go 閾値（UIで変更可）
| 条件 | デフォルト |
|------|-----------|
| 粗利率 ≥ | 25% |
| 競合出品数増加率 ≤ | 15% |
| Terapeak成約率 > | 30%（手動入力） |

⚠️ **UI必須表示**: `「暫定デフォルト値・実績に応じて変更推奨」`

## アラート11種（確定）
```javascript
// 予防系
DEFECT_WARNING       // 取引不良率 警告
LATESHIP_WARNING     // 遅延発送率 警告
TRACKING_WARNING     // 追跡情報提供率 警告
INAD_WARNING         // INAD（商品説明相違）警告
VIOLATION_UNRESOLVED // 違反未解決
CASE_OPENED          // ケース開設

// システム
OAUTH_EXPIRED        // eBay認証期限切れ
OAUTH_DISCONNECTED   // eBay認証切断
EBAY_API_DOWN        // eBay API障害
DATA_STALE           // データ鮮度切れ
SUPABASE_ERROR       // DB接続エラー
```

## eBay OAuth仕様（確定）
- ユーザーが**各自のeBayアカウント**で認証（必須）
- `access_token` + `refresh_token` を **AES-GCM 256bit** で暗号化保存
- セッションキー: **メモリのみ**・タブ終了時破棄
- トークン保存先: Supabase `ebay_tokens` テーブル（暗号化済み）

## フラグ管理
```javascript
const FLAGS = {
  TERAPEAK_AVAILABLE: false,  // Terapeak API取得後 true に変更
};
```

## Terapeak（現状）
- **現時点でAPIアクセス権なし** → 手動入力モードで設計継続
- 取得後: `FLAGS.TERAPEAK_AVAILABLE = true` に変更し、手動入力UIを自動入力に切り替え

## フィードバックテンプレート5種（schema_step7_5.sql に seed済み）
```
01: ポジティブ返礼
02: INAD（商品説明相違）対応
03: INR（未着）対応
04: ニュートラル改善宣言
05: 一般ネガティブ謝罪
各テンプレートは日英セット
```
