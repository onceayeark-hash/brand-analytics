# アーキテクチャ

## 実装順序（STAGE1 更新版）
```
① UI骨格    index.html + js/core/ 骨格     ← 完了
② OAuth認証  js/core/auth.js               ← 完了
③ 仕入シミュレーター js/features/profit.js         ← 完了（PPD統合は④で）
── PHASE 0: Supabase設定完成 ──────────────── ← 次（Anon Key修正・EF deploy・SQL適用）
④ PPD統合   profit.js に在庫保有日数計算を追加
⑤ 取引記録  js/features/transactions.js 新規実装（学習型手数料の土台）
⑥ ダッシュボード js/features/dashboard.js（スコアなし版・指標+シミュレーター）
⑦ ファイナンス js/features/finance.js
⑧ アカウント保護 js/features/protection.js
```

## アクセス制御の実装方法
```javascript
// html要素のdata-tier属性を更新するだけで全UI制御が変わる
document.documentElement.setAttribute('data-tier', 'connected');

// nav.js側でlockedクラスの付け外しを行う
// data-requires="connected" の nav-item を tier に応じてロック/解除
```

## グローバル名前空間（BA）
各 `js/core/*.js` が `window.BA.<モジュール名>` に自身を登録する（例: `BA.crypto` `BA.auth` `BA.api`）。個別メソッドは各ファイルを参照。

## Supabase スキーマ
テーブル定義・適用順序・適用日の記録は `supabase/MIGRATIONS.md` を参照（`supabase/*.sql` が実体）。

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
