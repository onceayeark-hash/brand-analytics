# BRAND ANALYTICS｜現在地ノート
最終更新：2026/06/26（hallmark audit 全25ファイル実施・仕様矛盾5件対応完了）

---

## 今やっていること
hallmark audit 完了（全25ファイル）。トークン違反一括修正・stepper.js/tutorial.js削除・
auto-listing.jsのDeepL→Claude API置換・sourcing.jsのGO/NO-GO→仕入れ可能価格帯置換まで完了。
残りはsettings.jsの未実装2セクション（下記「未解決・保留中」参照）。

## ⚡ 次回セッション冒頭で必ずやること（優先度順）

### 【1】ブラウザ Claude に確認依頼（セッション切れのため次回持ち越し）
以下の実装をブラウザ Claude に見せて動作・デザイン確認をしてもらう。

① **P-11: 粗利率⇔粗利額トグル**（利益計算機 CENTER列・粗利益カード直下）
   - 粗利率モード：率% 入力 → 対応粗利額¥ 表示
   - 粗利額モード：額¥ 入力 → 対応粗利率% 表示
   - トグル切替で値が自動変換される（リセットなし）
   - 両モードのスクショを取って確認

② **P-10: ベストオファーシミュレーター（常設カード）**
   - 右カラムに常設カードとして表示されているか
   - 入力前案内→入力後結果の両状態確認

③ **m-2: コントラスト改善**（breadcrumb / サイドバー文字 / font-weight）
   - ヘッダー「利益計算機」文字が読みやすくなっているか

### 【2】hallmark audit 残件（ブラウザ確認後に着手）
残り：M-1（:focus-visible）・M-3（easing tokens）・M-4（type scale）・m-3（reduced-motion）・m-4（!important）

## 🚀 前倒し実装3件（2026-07-02 オーナー承認・スペック向上枠）

> 2026-07-02 全体監査後にオーナーが承認。既存ロードマップより前倒しで実装する。

### 【前倒し①】Terapeak CSV 取り込み・蓄積の最小版
- **やること**: CSVアップロード → Claude構造化 → `terapeak_snapshots` テーブルに保存する導線だけ先行実装（分析UI・トレンド表示は後のSTAGE3で）
- **理由**: Growth Check 承認不要（ユーザー自身のエクスポートデータ・規約上問題なし）。蓄積型の核心価値のため、開始が遅れた分のデータは永久に手に入らない
- **前提**: schema_stage3 の terapeak_snapshots 定義は CLAUDE.md に確定済み

### 【前倒し②】仕入れメーターの計算精度向上
- **やること**: `_calcPriceBand()`（sourcing.js）の価格帯逆算に送料・Promoted費用を反映する。現在は両方0円計算のため、$500未満の商品で上限額が送料$35前後ぶん甘く出る
- **方法**: profit.js の現在入力値 or 設定ページの送料テーブル（未実装なら暫定で設定値1つ）を参照
- **理由**: 「赤字掴みを構造的に防ぐ」道具の心臓部の精度に直結

### 【前倒し③】取引記録の確定申告用CSVエクスポート
- **やること**: transactions.js に「期間指定 → CSVダウンロード」を追加（販売価格・実手数料・実入金額・仕入原価・取引日）
- **理由**: transaction_logs は既に売上台帳の材料が揃う設計。オーナー自身が毎年使う実用機能・将来のSaaS訴求点。実装コスト小

---

## 次回セッション開始手順（順番通りに・必ず全部やる）

### 【手順1】ウィンドウ①：Live Server起動（PowerShell）
Windowsキー → 「PowerShell」と入力 → Enter
```
cd "C:\dev\brand-analytics"
```
※2026-07-02にOneDrive外へ移設（同期ロック・パス互換問題の回避）。旧パス
`C:\Users\admin\OneDrive\Desktop\物販事業　一式\■会社関連\AI一式\claudcord一式\brand-analytics`
は参照用アーカイブ。今後の作業・Claude Code起動は必ず C:\dev\brand-analytics で行う。
Enterを押してから：
```
npx live-server --port=5500
```
→「Serving "...brand-analytics"」と出ればOK

### 【手順2】ウィンドウ②：cloudflared起動（新しいCMDを開く）
Windowsキー → 「cmd」 → Enter（新しいウィンドウ）
```
npx cloudflared tunnel --url http://localhost:5500
```
→ `https://○○○○-○○○○.trycloudflare.com` が表示される
→ **このURLをメモ帳にコピーする（次の手順で使う）**

### 【手順3】eBay Developer Portalを更新（毎回必要）
https://developer.ebay.com/my/keys を開く
→ Production の「Edit」→ RuName `vplsttzs` をクリック
→ 以下2か所を今日のcloudflaredURLに書き換え：
　- Auth accepted URL → 今日のURL
　- Auth declined URL → 今日のURL
→「Save」をクリック

### 【手順4】SupabaseのURL設定を更新（毎回必要）
https://supabase.com/dashboard → Project Settings → Authentication → URL Configuration
→ Site URL → 今日のcloudflaredURL
→ Redirect URLs →「Add URL」で 今日のcloudflaredURL/** を追加
→「Save」をクリック

### 【手順5】サインイン
Supabase Dashboard → Authentication → Users
→ `kakuta@staygold-reuse.co.jp` の「Send magic link」をクリック
→ メールのリンクをクリック
→ 今日のcloudflaredURLでアプリが開く

### 【手順6】アプリを使い始める
サインイン後、eBay連携済みであればCONNECTED状態で起動する。

---

## 過去のループ・失敗パターン（再発防止）
- cloudflaredはURLが毎回変わる→起動のたびeBay Portal + Supabase URL設定を更新
- eBay PortalのラジオボタンはUI表示のみ・OAuth動作に無関係（変更不要）
- Portalの「テストサインイン」はレガシーフロー・OAuthテストにならない（使用禁止）
- localtunnel / serveo.netは使用禁止→cloudflared一択
- callbackURLに/auth/ebay/callbackは不要→ルートURL（/）で動く
- Supabase設定なしではOAuthリダイレクトが拒否される
- eBay Portalで編集すべきRuNameは**vplsttzs**のみ。kdbpfux（Auth'n'Auth）は触らない
- Supabase SecretsへのCert IDコピペ時は全角スペース・非ASCII文字の混入に注意（btoa crashの原因）

## 確定したeBay設定値
- 使用RuName：StayGold_-StayGold-BRANDA-vplsttzs（OAuth用・新規作成）
- 旧RuName（kdbpfux）：Auth'n'Auth専用のため使用しない
- Client ID（生産）：StayGold-BRANDANA-PRD-7183f64d5-3fad581c
- config.local.js：EBAY_REDIRECT_URI更新済み（vplsttzs）

## 次にやること（優先順・2026-06-03 再整理）

① **STAGE2：ベストオファーシミュレーター**（profit.js 拡張・実装中）
② **STAGE2：仕入シミュレーター 3層UI＋送料/関税の表示/実コスト分離**（実装中）
③ **C-03：プライバシーポリシー・利用規約の作成**
④ **C-02：Compatible Application Growth Check 申請準備**
   ※ 自動出品の本格公開・リサーチ機能再開の共通の鍵
⑤ **STAGE2後半：自動出品（AL-03〜07）** ※スコープ追加と実装作り込み・規約クリア
⑥ **X-11：全体パフォーマンス最適化**（最終STAGE）
~~⑦ 17TRACK API連携~~ 廃止
~~⑧ SpeedPAK送料請求CSVインポート~~ → X-09（送料テーブル設定）に置き換え

## STAGE2 後・着手候補（優先順に確定済み）

- **D-05：ダッシュボード「最終利益」2層設計**（主要STEP）
  実測層（Finances API実額）＋予測層（学習値）を分離実装
  実装前にブラウザ Claude と合算・分離設計を確定すること
- **PR-07：危険バイヤー登録＋ユーザー間共有**
  前提条件：C-03（プライバシーポリシー）整備・手動入力限定・事実ベース設計
- **PR-08：オファー通知＋利益計算→返答導線**
  前提条件：`sell.negotiation` スコープを auth.js に追加

## 最終フェーズ実装（ツール全体が固まってから）

- **PR-09：AI 返信生成（バイヤー対応文）**
  ブラウザ Claude と設計を確定してから着手。出戻り防止のため最後に実装

## 保留（再開条件が整うまで着手しない）

- **競合リサーチ・商品リサーチ（ブランドリサーチ）**
  再開条件：Growth Check 通過 → Marketplace Insights API 正攻法申請
  理由：合法な sold データ取得手段が現時点で存在しない（詳細：`docs/RESEARCH_DECISION.md`）

## 【STAGE3・設計確定】ブランドリサーチ
設計・技術レビュー・soldデータ取得A案検証済み（2026-06-02）→ CLAUDE.md STAGE3設計メモ参照

- soldデータ取得：A案（eBay sold HTML保存→Claude抽出）暫定採用
- Growth Check通過後：Marketplace Insights APIへ移行（スキーマ互換・移行コストゼロ）
- 実装前提条件：profit.js の BA.profit.calculate(params) 純粋関数化（RES-01）
- 着手タイミング：STAGE2完了後

## 完了済み（STAGE1）
✅ 認証バグ2件修正
✅ ROI表示
✅ 費用内訳カード空状態表示
✅ 設定ページ実装・DeepL削除
✅ P-01 eBay手数料Cap修正
✅ Finances API接続
✅ Supabaseスキーマ PHASE 0完了
✅ D-01：粗利計算式修正
✅ D-02：健全性API接続確認
✅ F-01〜F-03：ファイナンス表示修正
✅ ダーク/ライトモード統一

## 完了済み（UI修正・2026-06-05）
✅ UX-04：ツアーボタン縦並び修正（tour.js：ドット群shrink解除・ボタン群nowrap・padding詰め）
✅ UX-10：ツアーがログイン前に表示されるバグ修正（tour.js：認証チェック復活・ログインイベント監視追加）

## 完了済み（STAGE2着手）
✅ Claude API統合基盤実装
✅ VS Codeインストール・brand-analytics接続済み
✅ cloudflared導入済み（npx cloudflared tunnel --url http://localhost:5500）
✅ **eBay OAuth連携（2026/06/01完了）**
✅ **X-10：為替レートEdge Function化（2026/06/02完了）**
　- exchange-rate Edge Function新規作成・デプロイ済み
　- open.er-api.comのCORSエラー解消・リアルレート取得に変更
　- 原因：EBAY_CERT_ID に非ASCII文字（Latin1範囲外）が混入 → btoa()がクラッシュ
　- 対策①：btoa()をTextEncoder経由のUTF-8セーフ実装に置き換え（index.ts）
　- 対策②：Supabase SecretsのEBAY_CERT_IDをクリーンに再登録
　- 副産物：ebay-token全体をtry-catchで包みCORSヘッダ付きエラー返却に改善
　- 副産物：auth.jsの.single()→.maybeSingle()修正（ebay_tokens 0件時の406解消）
✅ Supabaseキープアライブ設定済み（GitHub Actions・週2回SELECT・anonキー使用）
　※2026年末までにレガシーanonキー→publishableキーへ差し替え要

## 未解決・保留中
- X-10：為替レートEdge Function化（次アクション）
- 自動出品STAGE2着手時：他社ツール参考画像確認後に設計
- ZIK Analytics API統合：STAGE4検討
- FedEx/DHL API申請：STAGE2後半着手時
- **settings.js：CLAUDE.md必須仕様の未実装セクション2件**（2026-06-26 hallmark audit発見）
  - 「送料・関税テーブル設定」（価格帯ごとの送料・関税補填額・行の追加削除編集可）
  - 「販売対象国」（チェックボックス複数選択・競合リサーチのデフォルト検索対象国に連動）
  - 仕様詳細：CLAUDE.md「設定ページ（settings）コンテンツ仕様」セクション参照

## 懸念点
- D-02：tracking指標キー名（TRACKING_NOT_UPLOADED）→OAuth接続後に実機確認
- D-04：送料・関税カラム未追加（DDP対応・スキーマ拡張が必要）
- Compatible Application Growth Check申請→SaaS公開前に必須
　https://developer.ebay.com/grow/application-growth-check

## 更新：2026/05/31

### 完了済み追加（本日）
✅ auth.js #1〜#6 修正・適用完了
　- #1 フォールバックRuName kdbpfux → vplsttzs
　- #2/#3 リフレッシュ失敗時のtier・UI上書き問題修正
　- #4 disconnectEbay() エラー処理追加
　- #5 BA.crypto.destroy() 重複呼び出し除去
　- #6 redirectTo のhash除去追加

### 設計変更（本日確定）
- X-06（17TRACK API）：廃止
　理由：Ship&co不使用のため不要
- X-07（SpeedPAK CSV）：送料テーブル設定に置き換え
　理由：手動CSV取り込みは非現実的
- 送料設計方針確定：
　①出品送料（表示額）②実送料コスト の2欄を
　設定ページに追加。重量帯ごとに一度設定→自動適用

### 保留決定
- #8（claude.js使用制限）：SaaS化時に再設計
- #7（claude.js JWT retry）：今回対象外

### 次にやること（更新：2026/06/01）
① X-10：為替レートEdge Function化（最優先）
② STAGE2：ベストオファーシミュレーター
③ STAGE2：返品コスト計算
④ 送料・関税テーブル設定（設計確定済み・実装待ち）
⑤ UX-09：進行中フィードバック強化
⑥ プライバシーポリシー・利用規約の作成
⑦ Compatible Application Growth Check申請
