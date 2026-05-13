# アーキテクチャ

## ファイル構成（確定）
```
index.html                 ← UIシェル・骨格のみ（ロジック禁止）
CLAUDE.md                  ← 実装指示書

js/
  core/
    crypto.js              ← AES-GCM 256bit 暗号化・セッションキー管理
    i18n.js                ← 日英ローカライズ
    cache.js               ← Supabase キャッシュ読み書き・鮮度管理
    api.js                 ← eBay API クライアント（リトライ・タイムアウト）
    auth.js                ← Supabase Auth + eBay OAuth 2.0

  features/
    profit.js              ← 為替・利益計算機（FREE・STAGE1）✅完了
    sourcing.js            ← 仕入れメーター Go/No-Go（FREE・STAGE1）✅完了
    dashboard.js           ← 健全性スコア + アラート（CONNECTED・STAGE1）
    finance.js             ← ファイナンス（CONNECTED・STAGE1）
    protection.js          ← アカウント保護（CONNECTED・STAGE1）

  ui/
    nav.js                 ← ナビゲーション・パネル切替・tier制御
    charts.js              ← グラフ描画（将来Chart.js等）
    notify.js              ← アラート通知・トースト表示

supabase/
  schema_step7.sql         ← ベーステーブル（先に適用）
  schema_step7_5.sql       ← 拡張テーブル（次に適用）
  schema_stage2.sql        ← ⑤仕様完了後に作成（未作成）

tasks/
  lessons.md               ← セッション間の学習記録（毎回読む）
```

## 実装順序（STAGE1）
```
① UI骨格    index.html + js/core/ 骨格     ← 完了
② OAuth認証  js/core/auth.js               ← 次
③ 利益計算機 js/features/profit.js         ← 完了
④ 健全性    js/features/dashboard.js
⑤ ファイナンス js/features/finance.js
⑥ アカウント保護 js/features/protection.js
```

## アクセス制御の実装方法
```javascript
// html要素のdata-tier属性を更新するだけで全UI制御が変わる
document.documentElement.setAttribute('data-tier', 'connected');

// nav.js側でlockedクラスの付け外しを行う
// data-requires="connected" の nav-item を tier に応じてロック/解除
```

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

## SQLファイル適用順序
```
1. supabase/schema_step7.sql    ← ベーステーブル
2. supabase/schema_step7_5.sql  ← 拡張テーブル
3. supabase/schema_stage2.sql   ← 未作成（⑤仕様完了後）
```

## Supabase接続設定
```javascript
// ⚠️ ハードコード禁止
// - 開発時: .env ファイル
// - 本番時: Electron の設定ファイル or 環境変数
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
```

## フォールバック時UI表示（必須）
```
「※X時間前のデータを表示中（最新データ取得失敗）」
```
表示要素: `#stale-warning`（`visible` クラス付与で表示）
