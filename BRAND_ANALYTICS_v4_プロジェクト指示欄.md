━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND ANALYTICS｜ツール開発 v4
引継ぎ元：v3　作成日：2026-05-10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【プロジェクト概要】
eBay越境ECセラー向け分析・管理SaaS
対象：日本人越境ECセラー（eBay販売者）
技術：HTML + 機能別JS / Supabase / eBay OAuth API / Terapeak API（申請中）
将来：Electron化 → Stripe決済 → サブスク販売

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【v4の最初のアクション（この順番で進める）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
① GitHub Desktopのインストールとリポジトリ設定（コード作成前に必ず実施）
② files/フォルダのJSをjs/core・features・uiに整理（未済なら②番目に）
③ OAuth認証（auth.js）の実装
   → CLAUDE.mdを最初に読み込ませること
   → Supabase接続設定（BA_CONFIG）の注入方法を開発環境で確認してから進める
④ OAuth完了後すぐ：①PPD・⑦健全性シミュレーターをSTAGE1最終として実装
⑤ STAGE2開始前：④CF予測とA9の役割分担を仕様設計で先に整理（必須）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【GitHub Desktop・コード管理（2026-05-11 追加）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 方針
コード作成を始める前に GitHub Desktop をインストールし、
GitHubリポジトリをコードの保存・バックアップ場所として使用する。
GoogleドライブはSQLファイル・設計書・スプシの保存先、
GitHubはコード（HTML・JS）の保存先として役割を分ける。

■ 導入手順（コード作成前に実施）
① GitHub Desktop をインストール
   https://desktop.github.com/
② GitHubアカウントでサインイン
③ 新規リポジトリ「brand-analytics」を作成（Private推奨）
④ ローカルの作業フォルダ（BRAND ANALYTICSフォルダ）を
   リポジトリとして登録

■ 運用ルール
・Claude Codeで実装・修正するたびに GitHub Desktop でコミット
・コミットメッセージ例：「STAGE1 profit.js 実装完了」
・コード作業前に必ず最新状態に同期してから開始
・動作確認が取れたタイミングでGitHubにプッシュ（アップロード）

■ 保存先の役割分担（確定）
・GitHub　→ コード（index.html・JSファイル・CLAUDE.md）
・Googledrive → SQLファイル・設計書・スプシ・参考デザイン

■ GitHubを使う理由
・コードの変更履歴を保持（いつでも前の状態に戻せる）
・PC破損・紛失時のコード完全復元
・将来Electron化・チーム開発時のベースとなる

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【完了済みSTEP（v3まで）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP1〜8・STEP7.5 すべて完了
STAGE1 ⑤UI骨格 実装完了（2026-04-28）
　- index.html（UIシェル・ネイビー×ゴールド・30KB）
　- js/core/ 5ファイル（crypto / i18n / cache / api / auth）
　- js/features/ 5ファイル（profit / sourcing / dashboard / finance / protection）
　- js/ui/ 3ファイル（nav / charts / notify）
　- CLAUDE.md（実装指示書）新規作成
FREE機能 完全実装済み：profit.js（利益計算機）/ sourcing.js（仕入れメーター）
dashboard.js・finance.js・protection.jsはスタブ状態
OAuth認証（auth.js）⏳ v4で最初に実装

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Googleドライブ保存ファイル（BRAND ANALYTICSフォルダ）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLAUDE.md                        ← 実装指示書（必ず最初に読み込む）
index.html                       ← ネイビー×ゴールドデザイン版（30KB・こちらが正）
files/フォルダ                   ← JSファイル15本（js/core・features・uiへ整理必要）
SQL/フォルダ                     ← schema_step7.sql・schema_step7_5.sql
BRAND_ANALYTICS_進捗管理_v3.xlsx ← 進捗管理スプシ
ebay-analytics.html              ← 参考デザイン（残しておく）
※ files/内のindex.htmlは古い版 → 単独保存のindex.html（30KB）を使うこと

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【デザインテーマ（確定・v3で決定）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
カラー    : ネイビー（#050d1a〜#1a3a6e）× ゴールド（#e8c96a, #c9a84c）
フォント  : Cormorant Garamond（serif・ロゴ・大きな数値）
           + DM Sans（body）+ IBM Plex Mono（labels）
カード    : glassmorphism（backdrop-filter: blur(12px)）
           + ホバー時ゴールドトップライン
ロゴ      : ダイヤモンド型アイコン「B」+ BRAND ANALYTICS serif体
背景      : ラジアルグラデーション大気感
元ネタ    : ebay-analytics.html（オーナーが気に入っていたデザイン）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【ファイル構成（確定）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
index.html（骨格のみ・ロジックは書かない）
js/core/     : auth.js / api.js / cache.js / i18n.js / crypto.js
js/features/ : profit.js / sourcing.js / dashboard.js / finance.js / protection.js 等
js/ui/       : nav.js / charts.js / notify.js
supabase/    : schema_step7.sql / schema_step7_5.sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【技術仕様（確定）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
フロント    : HTML（シェル）+ 機能別JSファイル構成
認証        : Supabase Auth + eBay OAuth
DB          : Supabase（PostgreSQL + RLS・user_idベース・JWT sub値使用）
暗号化      : Web Crypto API（AES-GCM 256bit・セッションキーはメモリのみ・終了時破棄）
APIリトライ : 最大3回・指数バックオフ（1→2→4秒）・タイムアウト10秒
並列処理    : Promise.allSettled()統一（Promise.all使用禁止）
為替キャッシュ: Supabase共有・全ユーザー共有・1時間1回のみAPIコール

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【アクセス段階（C案：段階解放型）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FREE      → 為替・利益計算機・仕入れメーターのみ
CONNECTED → OAuth連携後・全機能解放
PREMIUM   → STAGE4（Stripe）実装後
制御      : user_settings.access_tier / data-tier属性

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【健全性スコア（確定・eBay公式エビデンスベース）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
取引不良率（Defect Rate）        35%
未解決ケース率（Cases Closed）   25%
遅延発送率（Late Shipment）      20%
追跡情報提供率（Tracking）       15%
INADクレーム率（商品説明相違）    5%
ランク：S=90↑ / A=75↑ / B=60↑ / C=45↑ / D=44↓
UIに必ず免責表示：「eBay公式基準を参考にした独自計算」

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【利益計算式（確定・profit.js実装済み）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
粗利益 = 販売価格
       - eBay手数料（プラン×カテゴリ）
       - Promoted Listings費用
       - Payoneer手数料（デフォルト2%）
       - 送料（設定値 or 都度入力）
       - 関税（設定値 or 都度入力）
       - 真贋サービス送料（$500以上・デフォルト¥1,500）
       - 仕入れ原価（円入力メイン）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【$500境界の送料・関税設計（確定）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$500以上：セラー負担は真贋サービス国内送料のみ（デフォルト¥1,500）
          国際送料・関税はバイヤー負担（自動$0計算）
$500以下：送料3択（manual / fixed $35 / buyer）
          関税2択（manual / zero）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【仕入れ分析 Go/No-Go閾値（確定・UIで変更可）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
条件①：粗利率 ≥ 目標値（デフォルト25%）
条件②：競合出品数増加率 ≤ 15%（デフォルト）
条件③：Terapeak成約率 > 30%（デフォルト・手動入力）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【固定数値（確定）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目標粗利デフォルト：25%（ユーザー変更可）
オークネット倍率：×1.54 / エコオク倍率：×1.50
Terapeak警告閾値：残50リクエスト以下で警告表示

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【アラート11種（確定）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
予防系6：DEFECT_WARNING / LATESHIP_WARNING / TRACKING_WARNING
         INAD_WARNING / VIOLATION_UNRESOLVED / CASE_OPENED
システム5：OAUTH_EXPIRED / OAUTH_DISCONNECTED / EBAY_API_DOWN
          DATA_STALE / SUPABASE_ERROR

【UI必須表示（3箇所）】
健全性スコア：「eBay公式基準を参考にした独自計算」
利益計算機  ：「シミュレーション値・実際の損益は取引記録による」
判定閾値    ：「暫定デフォルト値・実績に応じて変更推奨」
フォールバック：「※X時間前のデータを表示中（最新データ取得失敗）」

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【SQLファイル管理】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
① schema_step7.sql　② schema_step7_5.sql　③ schema_stage2.sql（未作成）
フィードバックテンプレート5種×日英：schema_step7_5.sqlにseed登録済み

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【追加機能・実装STAGE（2026-05-10 決定）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ STAGE1最終（OAuth完了後すぐ・API不要）
　① PPD：粗利益 ÷ 在庫保有日数　A2（利益計算機）に統合実装
　⑦ 健全性シミュレーター：あと何件で評価が落ちるか逆算・手数料増加金額換算

✅ STAGE2前半（OAuth後）
　② 為替リスク管理：損益分岐レート・感応度グラフ・A4キャッシュ活用
　   ※Payoneer連携不可（API非公開）→ アプリ内通知で代替
　④ CF予測：fulfillment.getOrders + inventory API（OAuth・Terapeak不要）
　   ※A9（売上予測）と同一API → STAGE2仕様設計で役割分担を最初に決定（必須）
　⑤ PL ROI分析：Finances API advertisingFee使用

🔴 STAGE2後半（Terapeak承認後）
　③ 銘柄ランキング：スコア = 成約率 × 粗利率 × 回転日数(逆数) × 競合密度(逆数)
　ブランドランキング：スコア = 月間総売上額 ÷ 平均回転日数
　　DBテーブル：brand_rankings_cache（brand_name, category, monthly_sold_count,
　　monthly_gmv_usd, avg_days_to_sell, avg_sale_price_usd, brand_score, period_days, cached_at）

⬜ 保留：⑥ 季節性ヒートマップ（データ前提が厳しい）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Terapeak API（申請実施中・2026-05-10）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
sell.marketplace.insights.readonly 承認申請済み・数週間で結果
承認後：CLAUDE.mdのTERAPEAK_AVAILABLEをtrueに更新
不承認時：ユーザーCSVアップロード方式で代替検討

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【STAGE2以降の残事項】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A7カテゴリ別分析 / A8競合分析 / A9売上予測：仕様未完
P4 VeRO監視：v1.1以降（API未公開）
STEP9ペルソナ設計：STAGE3テスト時
Supabase：50ユーザー超で$25/月（オーナーのインフラコスト）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Claude Code】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・Windows コマンドプロンプト（cmd）から起動
・インストール：npm install -g @anthropic-ai/claude-code
・CLAUDE.mdを最初に読み込ませてから作業開始すること
・ファイル構成はCSS変数・機能別分割でClaude Codeと相性良く設計済み
