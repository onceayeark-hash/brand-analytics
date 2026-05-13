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

## 健全性スコア計算式（確定・eBay公式エビデンスベース）
```
score = Defect × 0.35
      + Cases   × 0.25
      + LateShip× 0.20
      + Tracking× 0.15
      + INAD    × 0.05

ランク: S=90↑ / A=75↑ / B=60↑ / C=45↑ / D=44↓
```
⚠️ **UI必須表示**: `「eBay公式基準を参考にした独自計算」`

## 利益計算式（確定）
```
粗利益 = 販売価格
       - eBay手数料（プラン×カテゴリ）
       - Promoted Listings費用
       - Payoneer手数料（デフォルト2%）
       - 送料（設定値 or 都度入力）
       - 関税（設定値 or 都度入力）
       - 真贋サービス送料（$500以上のみ・デフォルト¥1,500）
       - 仕入れ原価（円入力メイン）
```
⚠️ **UI必須表示**: `「シミュレーション値・実際の損益は取引記録による」`

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
