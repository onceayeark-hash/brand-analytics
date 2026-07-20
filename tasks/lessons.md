# Lessons — セッション間の学習記録

> Claude Codeはセッション開始時にこのファイルを読み、同じ指摘を繰り返さないこと。
> 修正・指摘があった場合は都度ここに追記する。

> **【必須姿勢】** このファイルを読んだ後、過去の改善・修正履歴を「なぜそう変えたか」まで理解した上で実装に臨むこと。
> 特に以下を自問すること：
> - 今から書くコードは、過去の指摘をすべて満たしているか？
> - グラフ・UIは `frontend-design` の水準を満たす視覚的インパクトがあるか？
> - 利益計算・手数料ロジックは `finance-billing-ops` のパターンに沿っているか？
> - 「とりあえず動く」ではなく「ユーザーが満足する」レベルか？
> 過去の指摘を読み飛ばした実装は、やり直しになる。

---

## フォーマット
```
### YYYY-MM-DD
- [ファイル or 機能] 指摘内容 → 正しいアプローチ
```

---

<!-- ここから下に記録を追加 -->

### 2026-05-13
- [デザイン全体] 現行ダークテーマは重厚感があり良いが、清潔感・スムーズ感が不足 → ライトモード（eBayライクなホワイトベース）との切り替えモードを実装する
  - ダーク: 現行のネイビー×ゴールド（glassmorphism）を維持
  - ライト: ホワイトベース × ゴールドアクセント（清潔感・スムーズ感を優先）
  - UIにダーク/ライト切り替えトグルを配置（OSの設定画面にあるようなスライドボタン型）
  - CSS変数（:root / [data-theme="light"]）で一元管理する

### 2026-05-14
- [CSS全体] UIは論理ピクセル（CSSピクセル）で設計すること。8dp Gridルール（8の倍数）を守る
  - ボタン・input・select に min-height:44px（Apple HIG 最小タップ領域）を必ず付与する
  - padding は 4dp 単位（4, 8, 12, 16, 20, 24...）まで許容。9px・14px・22px などは NG
  - gap は 8px か 12px・16px に統一（10px は 8 か 12 に丸める）
  - 新規コンポーネントは最初から 8dp Grid で設計する
- [auth.js] _ensureValidToken のトークンリフレッシュを直接 eBay API に投げていた → Cert ID（Client Secret）はフロントに置けないため必ず Edge Function（ebay-token）経由にする
- [init順序] BA.crypto.init() は async なので await が必要。await BA.crypto.init() → await BA.auth.init() の順を必ず守る
- [設計変更] 健全性スコア（重み付き計算・S〜Dランク）を廃止 → 生数値表示＋閾値アラートのみに変更。理由：スコアのエビデンスがなく誤解を招く
- [設計変更] 手数料をハードコード値から学習型に変更 → transaction_logs テーブルに実取引データを蓄積し、移動平均で手数料率を自動調整。対象：eBay FVF・Payoneer・真贋サービス送料・為替乖離。5件未満はフォールバック値を使う
- [新ファイル] js/features/transactions.js を新規追加（取引記録入力UI + 学習型手数料計算エンジン）

### 2026-05-23
- [Skills強化] グラフ・計算系の品質に不満があったため、以下のSkillsを `context/skills.md` に追加導入した
  - `frontend-design`：グラフ・UI実装時に `dashboard-builder` と必ず併用。「視覚的インパクト」を意識した設計を行う
  - `finance-billing-ops`：利益計算・学習型手数料ロジックの実装前に必ず呼ぶ。計算パターンを確認してから書き始める
  - `postgres-patterns`：transaction_logs等のDBスキーマ設計時に使用
  - `market-research`：eBay市場・競合調査時に使用
- [品質基準の引き上げ] ユーザーの要求水準は「動けばいい」ではなく「満足できる」レベル。グラフは見た目の説得力、計算は財務ロジックとしての正確性を優先すること

### 2026-05-24
- [設計哲学書] `context/design-philosophy.md` を新規作成。以降の実装は必ずこれを参照する
- [テーマ] ライトテーマをデフォルトに変更確定。ダークは切り替えで残す
- [グラフ] データ5件未満はグラフ非表示。件数メッセージを表示する（哲学書②参照）
- [入力UI] ＋／－スピナーボタン全廃。テキスト直打ちに統一（哲学書③参照）
- [数値表示] USD=$1,234.00、%=19.00%、ゼロ自動計算=—、マイナス=赤色（哲学書の表参照）
- [レイアウト] max-width:1080px確定。padding:`max(40px, calc((100% - 1080px) / 2))`
- [哲学書の運用] 哲学書は「実態の記録」。実装と食い違う場合は実装を優先し哲学書を更新する
- [未定義事項] 哲学書に答えがない場合は独自判断せず確認フォーマットで必ず確認を求めること

### 2026-05-24（続）
- [ボタン設計] 全ボタンを4階層（Primary/Secondary/Ghost/Danger）に分類・統一 → design-philosophy.md ⑦に記載
  - btn-secondary: オレンジ枠線・オレンジ文字に変更（以前は灰色枠）
  - btn-danger: 新規追加（白背景・赤枠・赤文字）
  - 「リセット」系は必ず btn-danger を使う
  - Primaryは1画面1〜2個まで
- [protection.js] 「日本語をコピー」廃止 → 「定型文を保存」(Primary)に変更。localStorage（ba_saved_templates）に保存
- [ラベル規則] 全ボタンラベルを「動詞＋目的語」形式に統一。「OK」「はい」禁止
- [レイアウト] 左起点化：.panel を padding:28px 40px + max-width:1160px に変更。calc()による中央浮きを廃止
- [仕入れメーター] 右パネル空状態：「—」→ ⚡アイコン＋ガイドテキストに変更。条件ドット：未入力=グレー、入力済み=オレンジ✓（data-touched で判定）
- [protection.js] eBay OAuth状態ボタン動的化：未接続=オレンジPrimary、接続済み=グレーテキスト表示
- [protection.js] テンプレートラベル「日本語」「English」を 9px→13px、font-weight:500 に変更

### 【確定】翻訳API: DeepL 採用（2026-05-23決定）
- **決定**: DeepL API を採用（Google翻訳 API は不採用）
- **理由**: 日本語の自然さ・文章品質・データ保護ポリシーの観点でDeepLが圧倒的に優位
- **実装方式**: 短期 → ユーザー自身のAPIキー（localStorage）。Stripe実装後 → 開発者1キーで全ユーザー処理（サブスク料金に内包）

### 2026-05-25
- [dashboard.js] 健全性シミュレーター・問題件数入力欄の+/-ボタンを廃止（バグ修正）
  - `type="number"` → `type="text" inputmode="numeric" pattern="[0-9]*"` に変更
  - `<div class="input-wrap">` + `<div class="input-prefix">件</div>` 構造を廃止
  - 「件」を `<span>` として入力欄の右隣（枠外）に配置
  - width:80px のシンプルな `.input` に統一（他の入力欄と同スタイル）
  - イベントハンドラ（parseInt）は変更不要・テキスト値でも動作確認済み
  - 対象指標：取引不良率・未解決ケース率・遅延発送率・追跡情報なし率・INAD率（全5種）
- [dashboard.js] KPIカード背景色統一：粗利益カードの `class="card highlight"` → `class="card"` に変更。白背景（#ffffff）に統一
- [dashboard.js] 未入力値表示統一：`'---'`（三本線）→ `'—'`（全角横棒1本）に統一。`_jpy()` 関数と各カードfallback表示の全箇所を変更
- [finance.js] ボタン競合修正：「eBay連携 →」を `btn-primary` → `btn-secondary` に変更。同一画面にPrimaryが2つ並ぶ状態を解消。「取引記録を追加する」のみPrimaryに統一
- [tutorial.js / profit.js / transactions.js] チュートリアル表示方式をオーバーレイ→インラインバナーに全面移行
  - tutorial.js: `_show()` を `return` で即時無効化（オーバーレイ廃止）
  - profit.js: `_tutorialBanner()` を追加。`ba_hint_profit` キーでlocalStorage管理。×で閉じると再表示しない
  - transactions.js: `_tutorialBanner()` を追加。`ba_hint_transactions` キーで管理
  - バナースタイル: `rgba(232,140,60,.08)` 背景・オレンジ枠・左に＋アイコン・右に×ボタン
- [profit.js] 為替レートカードを左パネル最下部→右パネル最下部（適用手数料率の下）に移動
  - 右パネルの順番：粗利益→費用内訳→PPD→適用手数料率→為替レート
  - イベントバインドは querySelector で引いているため移動後も変更不要
- [profit.js] 費用内訳カード空状態を実装：`_emptyBreakdown()` 関数を追加。未入力時（price=0）は7項目をグレー(#999999)・14px・右に「—」で表示。入力後は実金額に切替。`_render()` のtbodyと `_update()` の `else if` 分岐の両方に適用
- [listing-quality.js] 右パネル空状態：テキストを縦横中央揃えに変更。✏️アイコンをテキスト上に追加。`min-height:400px` + `flex` で左パネルと高さを揃える
- [profit.js] 費用内訳カード空状態：`_emptyBreakdown()` 追加。未入力時（price=0）は7項目グレー表示。`_render()` のtbodyと `_update()` の `else if` 分岐で切替

### 2026-05-29
- [tutorial.js → tour.js] オンボーディングをインラインバナーからプロダクトツアー形式に変更
  - `js/ui/tour.js` 新規作成（`window.BA.tour`）
  - index.html: `BA.tutorial?.init?.()` → `BA.tour?.init?.()` に差し替え
  - スポットライト実装：4パネルフレーム方式（z-index上書きなし・sidebar内要素にも対応）
  - design-philosophy.md ⑭ を改訂（オーバーレイ禁止 → プロダクトツアー採用に変更）
  - デバッグ時は Console で `BA.tour.reset()` → ページリロードでツアーが再表示される

### 2026-06-01（eBay OAuth テスト・紆余曲折の記録）

#### 環境構築でハマったこと
- [live-server] `C:\Users\admin` でコマンドを実行するとEPERMエラーが大量発生
  → 必ず `cd brand-analyticsフォルダ` してから `npx live-server --port=5500` を実行
- [serveo.net] SSHキー登録が必要・502エラーが出た → cloudflaredに切り替えて解決
- [cloudflared] URLが毎回変わる → eBay Portal・Supabase URL設定を毎回更新が必要

#### eBay Portalの罠（永久保存）
- Portalの「Test Sign In」ボタンは**絶対に使わない**
  → `ebaytkn`（レガシー）が返るだけ。OAuthテストにならない
  → 正しくはアプリの「eBayを連携する」ボタンから開始する
- RuName は `vplsttzs`（OAuth用）のみ使用。`kdbpfux`（旧・Auth'n'Auth専用）は触らない

#### サインイン周りでハマったこと
- [パスワードリセット] Site URLがlocalhostのままだとリセットメールがlocalhostに飛ぶ
  → cloudflaredURLに更新してから「Send magic link」を使う
- [localhost vs cloudflared] localhostで開くとSupabaseセッションがない（別ドメイン扱い）
  → 必ずcloudflaredのURLでアプリを開くこと
- [magic link] パスワード不要で最速サインイン
  → Supabase Dashboard → Authentication → Users → Send magic link

#### OAuthフロー診断コマンド（コンソールで実行）
```javascript
// サインイン状態確認
console.log('user:', BA.auth.getUser(), 'tier:', BA.auth.getTier())
```
→ `user: null` = 未サインイン / `user: {email:...}` = サインイン済み

#### 今日判明・解決したインフラ不足
- `ebay-token` Edge Function が未デプロイだった（404の原因）
  → `npx supabase functions deploy ebay-token --project-ref pvleyieegzqkwpqbpiax` で解決
- `ebay_tokens` テーブルが存在しなかった
  → SQL Editor でCREATE TABLE + RLS 4ポリシーを適用して解決

#### 現在地（2026/06/01終了時点）
- OAuthの往復（eBay→アプリへのリダイレクト）：成功 ✅
- Edge Function 500エラー：未解決 ❌
- 次のアクション：Supabase → Edge Functions → ebay-token → Logs でエラー内容を確認

### 2026-05-25（続）
- [settings.js] 新規作成。3セクション構成：
  - セクション1：手数料・閾値設定（5項目・`ba_settings` にJSON保存・`ba:settings-changed` dispatch）
  - セクション2：DeepL API設定（type="password"・接続テスト・`ba_deepl_key` 保存）
  - セクション3：eBay接続管理（接続状態に応じてドット色・ボタン動的切替）
  - `BA.settings.get()` で他モジュールから設定値取得可能
  - index.html に `<script>` タグと `BA.settings?.init?.()` を追加済み

### 2026-06-26
- [全体] hallmark audit を全25ファイルに実施（過去セッションでスキルが自発的に呼ばれていなかった疑いがあったため、まずスキル発火自体を直接検証 → 正常に発火することを確認。原因はファイル配置ミスではなく、トリガー表に沿った自発呼び出しの運用ギャップだったと判断）
- [admin.js] `STATUS_DOT` が `STATUS_COLOR` と別の生hex値を独自定義していた重複バグ → `STATUS_DOT = STATUS_COLOR` に統一
- [settings.js] 接続状態ドットが `#22c55e`/`#ef4444` という実トークン（`--green`=#4ece8a・`--red`=#e85454）とは違う色を使っていたバグ → `var(--green)`/`var(--red)` に統一
- [index.html] OAuth初期化処理に残っていた `console.log` ×3を削除（`console.error` は実エラー用なので残置）。`.connect-icon` の独自オレンジ（`#e66414`）→ `var(--accent-orange)` に統一。`.auth-input::placeholder` の生rgba → `var(--text-faint)` に統一
- [js/ui/stepper.js] design-philosophy.md ③「＋／－ボタン数値入力の全廃」に違反するファイルが存在 → grep確認の結果どこからも読み込まれていない完全な孤立コードだったため削除
- [js/ui/tutorial.js] `_show()` が冒頭で `return` し4ステップオンボーディング全体が到達不能なデッドコードだった（tour.jsへの移行済み・2026-05-29のlessons参照）→ ファイル削除＋index.htmlの`<script>`タグも削除
- [auto-listing.js] CLAUDE.mdで「DeepL廃止・Claude APIに一本化済み」と確定済みにも関わらず、localStorageのDeepL APIキーを読み取りクライアント側からPOST送信するコードが現存（@security-critical対象） → DeepL呼び出しを `BA.claude.call('title', ...)` 経由のClaude API呼び出しに置き換え。ファイル先頭のマーカーを `@security-critical` → `@not-security-critical` に変更し、context/skills.md のトリガーB対象ファイル明示リストも同期（`npm run check:security`通過確認済み）
- [profit.js] STAGE3着手前提条件（RES-01：`BA.profit.calculate(params)` 純粋関数化）を前倒しで一部実施 → 既存の内部関数 `_calculate`・`DEFAULTS`・`EBAY_FEE`・現在の為替レート取得用 `getExchangeRate()` を `window.BA.profit` に追加公開（既存ロジックは無変更、追加のみ）
- [sourcing.js] CLAUDE.mdで「廃止：GO/NO-GO → 仕入れ可能価格帯 ¥X〜¥Y に置き換え」と確定していたにも関わらず、GO/NO-GO判定UIが実装されたまま残っていた → `_verdict()` を削除し `_calcPriceBand()` を新設。「想定販売価格（USD）」入力を追加し、`BA.profit.calculate()` を仕入れ原価0円で呼び出して仕入れ原価以外の手数料合計を求め、目標粗利率から仕入れ原価の上限を逆算する方式に変更。下限は¥0固定（最小マージン設定が存在しないため）。達成不能な目標の場合は「この目標は達成不可」を表示

### 2026-06-28
- [セキュリティhook基盤] PostToolUse hook を `.claude/settings.json` に登録。`scripts/security-hook.js` が Edit/Write 後に `@security-critical` マーカーを検知し exit(2) で security-reviewer 手動実行を強制フィードバック
  - 「ブロック」ではなく「編集後のレビュー要求フィードバック」が正確な呼称（PostToolUse は編集後に走るため取り消し不可）
  - Claude Code のフック機構はプロセスレベルで stdin を書き込む → PowerShell パイプでのドライランは信頼できない（exit 0 になる）。`npm run test:hook` が正規の検証コマンド
  - `execSync` のシェル文字列構築は PostToolUse hook の security-guidance プラグイン指摘を受けて `spawnSync` + 引数配列に即変更（hook が自分で書いたコードのリスクを検知した実例）
  - `.claude/hookify.security-review-warning.local.md` は hookify 独自フォーマット（Claude Code の hook 機構とは別システム）で実質無効だったため削除
  - マーカー付与・check:security は 2026-06-25 セッションで完了済みのためスキップ

### 2026-07-02（全体再監査）
- [index.html / monitor.js / admin.js] `window._supabaseClient` を誰もセットしておらず、error_logs 保存・閾値メール・管理者パネルのログ表示が全て無言で停止していた（空箱） → `BA.auth.init()` 直後に `window._supabaseClient = BA.auth?.getSupabase?.() ?? null;` を注入して修正
- [settings.js] 存在しない `BA.auth.getEbayToken()` を呼んでおり、eBay接続状態が常に「未接続」表示だった → `isEbayConnected()` ＋ auth.js に新設した `getEbayTokenExpiry()`（有効期限msのみ返す・トークン素材は返さない）に置換
- [sourcing.js] `parseFloat(x) ?? 0` は NaN をガードできない（parseFloatはnullを返さない）→ `|| 0` に修正。未入力時「NaN%」表示バグ解消
- [解決済み・同日A案実装] crypto.js のセッションキーはページロード毎にランダム再生成のため、DBに保存した暗号化eBayトークンは次回ページロードで復号不能だった → **A案採用**：ebay-token Edge Function（v7デプロイ済み）がサーバー側で暗号化・保存。refresh_tokenはフロントに一切返さない。auth.jsからクライアント暗号化を撤去。旧形式token_dataはEF側で検知→行削除→再連携誘導（既存ユーザーは1回だけeBay再連携が必要）。security-reviewer通過（必須指摘なし・将来改善：専用シークレットEBAY_TOKEN_ENC_KEYへの鍵分離）
- [解決済み・同日適用] Supabase `error_logs` の SELECT ポリシー `admin_read_all` が `qual: true` だった → migration `restrict_error_logs_select_to_admin` で管理者メール（kakuta@staygold-reuse.co.jp）のみに制限・pg_policiesで検証済み
- [未実装確認] monitor.js が呼ぶ `notify-admin` Edge Function は未作成（閾値メール通知は現状404で無言スキップ）

### 2026-07-20
- [protection.js] eBay OAuth接続済み表示：2026-05-24の「接続済み=グレーテキスト表示」は ㉑v2.0-D（ステータスはピル型チップに統一）により上書き → 現在は `<span class="tag go">接続済み ✓</span>`（グリーンチップ）が正。システム状態の 正常/低下/障害中/未確認 も同様にチップ化（未確認用に `.tag.neutral` グレーチップを index.html に追加）
