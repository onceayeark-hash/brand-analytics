# BRAND ANALYTICS — 実装指示書
## Claude Code: このファイルを最初に読み込んでから実装を開始すること

---

## 自動適用 Skills（毎セッション有効）

### トークン管理（常時）
- **token-budget-advisor**: 複雑な質問の前に回答深度(1〜4)を提示する
- **context-budget**: コンテキスト使用量が多い場合に警告・整理を促す

### 実装フロー（用途別に自動起動）
| タイミング | Skill |
|---|---|
| 新機能の実装前 | `plan` → 設計を確認してから実装開始 |
| eBay API接続の実装時 | `api-connector-builder` |
| ダッシュボード・グラフ実装時 | `dashboard-builder` |
| 機能コードを書くとき | `feature-dev` |
| コード完成後 | `code-review` |
| auth.js・OAuth・暗号化の実装後 | `security-review`（必須） |
| eBay APIの仕様調査 | `deep-research` |
| UIコンポーネント実装時 | `frontend-patterns` |

### ルール
1. `security-review` は auth.js・crypto.js・トークン処理を含む変更に**必ず**実行する
2. `plan` を省略して実装を開始しない
3. 回答深度はデフォルト **50%（Moderate）**。ユーザーが指定した場合はそれに従う

---

## プロジェクト概要
- **目的**: eBayセラー向けブランド分析・利益計算・アカウント保護ツール
- **対象ユーザー**: 越境EC（eBay）セラー（日本人メイン）
- **フロント**: HTML + Vanilla JS（機能別ファイル分割構成）
- **認証**: Supabase Auth + eBay OAuth 2.0
- **DB**: Supabase（PostgreSQL + Row Level Security）
- **暗号化**: Web Crypto API（AES-GCM 256bit）
- **将来**: Electron化 → Stripe決済 → サブスク販売

---

## ファイル構成（確定）
```
index.html                 ← UIシェル・骨格のみ（ロジック禁止）
CLAUDE.md                  ← 本ファイル（実装指示書）

js/
  core/
    crypto.js              ← AES-GCM 256bit 暗号化・セッションキー管理
    i18n.js                ← 日英ローカライズ
    cache.js               ← Supabase キャッシュ読み書き・鮮度管理
    api.js                 ← eBay API クライアント（リトライ・タイムアウト）
    auth.js                ← Supabase Auth + eBay OAuth 2.0

  features/
    profit.js              ← ④ 為替・利益計算機（FREE・STAGE1）
    sourcing.js            ← 仕入れメーター Go/No-Go（FREE・STAGE1）
    dashboard.js           ← ① 健全性スコア + アラート（CONNECTED・STAGE1）
    finance.js             ← ② ファイナンス（CONNECTED・STAGE1）
    protection.js          ← ③ アカウント保護（CONNECTED・STAGE1）

  ui/
    nav.js                 ← ナビゲーション・パネル切替・tier制御
    charts.js              ← グラフ描画（将来Chart.js等）
    notify.js              ← アラート通知・トースト表示

supabase/
  schema_step7.sql         ← ベーステーブル（先に適用）
  schema_step7_5.sql       ← 拡張テーブル（次に適用）
  schema_stage2.sql        ← ⑤仕様完了後に作成（未作成）
```

---

## 実装順序（STAGE1）
```
① ⑤ UI骨格   index.html + js/core/ 骨格          ← 完了
② OAuth認証   js/core/auth.js                     ← 次
③ ④ 利益計算機 js/features/profit.js
④ ① 健全性    js/features/dashboard.js
⑤ ② ファイナンス js/features/finance.js
⑥ ③ アカウント保護 js/features/protection.js
```

---

## アクセス段階（3段階）
| tier        | 解放機能                                         |
|-------------|------------------------------------------------|
| `free`      | 為替・利益計算機、仕入れメーターのみ               |
| `connected` | OAuth連携後・全機能解放                           |
| `premium`   | STAGE4（Stripe実装後）                           |

制御: `user_settings.access_tier` / HTML属性 `data-tier` で制御

---

## アクセス制御の実装方法
```javascript
// html要素のdata-tier属性を更新するだけで全UI制御が変わる
document.documentElement.setAttribute('data-tier', 'connected');

// nav.js側でlockedクラスの付け外しを行う
// data-requires="connected" の nav-item を tier に応じてロック/解除
```

---

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

---

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

---

## 仕入れ分析 Go/No-Go 閾値（UIで変更可）
| 条件                     | デフォルト |
|--------------------------|-----------|
| 粗利率 ≥                 | 25%       |
| 競合出品数増加率 ≤        | 15%       |
| Terapeak成約率 >         | 30%（手動入力） |

⚠️ **UI必須表示**: `「暫定デフォルト値・実績に応じて変更推奨」`

---

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

---

## APIリトライ仕様（確定）
```javascript
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: [1000, 2000, 4000],  // 指数バックオフ
  timeoutMs: 10000,                // タイムアウト10秒
};
// 並列処理: Promise.allSettled() 統一（Promise.all() 禁止）
```

---

## eBay OAuth仕様（確定）
- ユーザーが**各自のeBayアカウント**で認証（必須）
- `access_token` + `refresh_token` を **AES-GCM 256bit** で暗号化保存
- セッションキー: **メモリのみ**・タブ終了時破棄
- トークン保存先: Supabase `ebay_tokens` テーブル（暗号化済み）

---

## フォールバック時UI表示（必須）
```
「※X時間前のデータを表示中（最新データ取得失敗）」
```
表示要素: `#stale-warning`（`visible` クラス付与で表示）

---

## SQLファイル適用順序
```
1. supabase/schema_step7.sql    ← ベーステーブル
2. supabase/schema_step7_5.sql  ← 拡張テーブル
3. supabase/schema_stage2.sql   ← 未作成（⑤仕様完了後）
```

---

## フラグ管理
```javascript
const FLAGS = {
  TERAPEAK_AVAILABLE: false,  // Terapeak API取得後 true に変更
};
```

---

## Supabase接続設定
```javascript
// ⚠️ ハードコード禁止。以下から読み込むこと
// - 開発時: .env ファイル
// - 本番時: Electron の設定ファイル or 環境変数
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
```

---

## グローバル名前空間（BA）
```javascript
// window.BA に各モジュールが登録する
window.BA = {
  crypto:     // BA.crypto.encrypt() / BA.crypto.decrypt()
  i18n:       // BA.i18n.t('key') / BA.i18n.setLang('ja')
  cache:      // BA.cache.get() / BA.cache.set() / BA.cache.isStale()
  api:        // BA.api.get() / BA.api.post() / BA.api.request()
  auth:       // BA.auth.init() / BA.auth.connectEbay() / BA.auth.getTier()
  nav:        // BA.nav.showPanel() / BA.nav.setTier()
  notify:     // BA.notify.alert() / BA.notify.toast() / BA.notify.clear()
};
```

---

## コーディング規約
- `const` / `let` のみ使用（`var` 禁止）
- クラスベース or モジュールパターンで統一
- エラーハンドリングは**全APIコールに必須**
- `console.log` はデバッグ後に必ず削除
- コメントは日本語OK
- `Promise.all()` 禁止 → `Promise.allSettled()` 使用
- タイムアウトは `AbortController` で実装

---

## フィードバックテンプレート5種（schema_step7_5.sql に seed済み）
```
01: ポジティブ返礼
02: INAD（商品説明相違）対応
03: INR（未着）対応
04: ニュートラル改善宣言
05: 一般ネガティブ謝罪
各テンプレートは日英セット
```

---

## Terapeak（現状）
- **現時点でAPIアクセス権なし** → 手動入力モードで設計継続
- 取得後: `FLAGS.TERAPEAK_AVAILABLE = true` に変更し、手動入力UIを自動入力に切り替え

---
*最終更新: 2026-04-28 | STAGE1実装開始*
