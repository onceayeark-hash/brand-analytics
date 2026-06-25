# スキル管理ガイド（Claude・ユーザー共用）
> このファイルは Claude の自動スキル選定ルールと、ユーザー向けのスキル一覧を兼ねる。
> 「どのスキルが何をするか」を把握したいときはここを読む。

---

## 使用スキル一覧（brand-analytics 有効 22個）

### 【A】常時稼働（すべての作業で自動適用）

| スキル | 何をするか | 発動条件 |
|---|---|---|
| `everything-claude-code:token-budget-advisor` | 複雑な質問の前に回答深度を提示 | 常時 |
| `everything-claude-code:context-budget` | コンテキスト残量が少ないとき警告 | 常時 |

---

### 【B】実装プロセス（作業の流れに沿って自動発動）

| スキル | 何をするか | 発動条件 |
|---|---|---|
| `superpowers:brainstorming` | 新機能・コンポーネントの要件と設計を整理する | 新機能の検討・設計議論の開始時 |
| `superpowers:writing-plans` | 多ステップ実装の計画書を作成する | spec・要件が揃ったとき・コード着手前 |
| `everything-claude-code:plan` | 設計をユーザーと確認してから実装を開始する | 新機能実装前（writing-plans の後） |
| `everything-claude-code:feature-dev` | 機能コードを構造的に実装する | 実際にコードを書くとき |
| `superpowers:verification-before-completion` | 完了宣言前に動作確認コマンドを必ず実行する | 「実装完了」と言う前 |
| `code-review:code-review` | コードの正確性・品質・セキュリティをレビュー | コード完成後（必須） |
| `superpowers:requesting-code-review` | コードレビューを正式に依頼する手順 | 主要機能の実装完了時 |
| `superpowers:receiving-code-review` | レビューフィードバックを正しく受け取る手順 | レビュー結果を受けたとき |
| `superpowers:systematic-debugging` | バグ・テスト失敗・予期しない動作を体系的に調査 | エラー・バグ報告を受けたとき |

---

## ⚡ 自動発動ルール（ユーザー指示不要・Claude が必ず自分で実行する）

> **これは提案ではなく強制ルールである。**
> ユーザーが「レビューして」「確認して」と言わなくても、以下のトリガーが発生したら Claude は自分でスキルを呼ぶこと。
> 呼ばずに「完了」を宣言することは禁止。

| # | トリガー（このとき） | 必ず呼ぶスキル | 目的 |
|---|---|---|---|
| A | 任意の機能実装が完了したとき | `code-review:code-review` | 正確性・品質・バグを独立検証 |
| B | `auth.js` / `crypto.js` / トークン・OAuth処理を変更したとき | `everything-claude-code:security-review` | セキュリティ脆弱性を独立検証 |
| C | HTML / CSS / JS の UI 部分を変更・新規実装したとき | `hallmark audit <変更ファイル>` | 66ゲートでUI品質・アンチパターンを採点 |
| D | 「実装完了」「完了しました」と言う直前 | `superpowers:verification-before-completion` | 動作確認を完了宣言前に必ず実行 |
| E | eBay API 仕様の不明点が出て調査が必要なとき | `Explore`（バックグラウンド） | 調査中もコーディングを止めない |

### トリガーB 対象ファイル明示リスト（2026-06-25追加・check-security-coverageで同期保証）

```
背景：トリガーBの表記「auth.js / crypto.js / トークン・OAuth処理を変更したとき」は自然文の
  判断頼みだったため、実際にOAuthトークン交換を行う supabase/functions/ebay-token/index.ts が
  文字列一致せず対象漏れになっていた（仕入れインテリジェンスプロジェクトで発見した同型バグの
  横展開検証で発覚）。以下は実在ファイルの明示列挙（グロブ・自然文推測のみに頼らない）。

対象ファイル（@security-critical マーカー付与済み）：
  js/core/auth.js
  js/core/crypto.js
  js/core/api.js          ← Authorization Bearerトークンをヘッダに直接付与する箇所を含む
  js/core/claude.js       ← Supabaseセッションの access_token（JWT）を直接取得・送信する
  js/core/monitor.js      ← エラーログ／通知メールに認証情報が混入するリーク経路の懸念
  js/features/settings.js       ← 2026-06-25追加（code-reviewer指摘）。BA.auth.getEbayToken()でトークンを直接参照
  supabase/functions/ebay-token/index.ts   ← EBAY_CERT_ID（Client Secret）を扱う実体。本リスト整備の発端
  supabase/functions/call-claude/index.ts  ← ANTHROPIC_API_KEY を扱う

対象外（@not-security-critical マーカー付与済み・認証情報を扱わないと判断）：
  js/core/cache.js
  js/core/i18n.js
  js/features/admin.js / dashboard.js / finance.js / listing-quality.js /
    profit.js / protection.js / sourcing.js / transactions.js
    （2026-06-25・境界をjs/featuresに拡大した際にgrep確認済み・8ファイル一括）
  js/features/auto-listing.js   ← 2026-06-26・DeepL APIキーのlocalStorage読み取り/送信コードを撤去し
    Claude API（BA.claude.call経由・JWT認証はclaude.js側で処理）に置き換えたため対象外に変更
  supabase/functions/exchange-rate/index.ts

★2026-06-25・最初のcode-reviewerレビューで「境界ディレクトリがjs/core・supabase/functionsのみで
  js/featuresが対象外になっており、auto-listing.js/settings.jsが漏れている」とHIGH指摘を受け、
  境界をjs/featuresに拡大して対応した（同型バグの再発・検出の実例）。js/ui/配下は全ファイルgrep確認済みで
  認証情報を扱うものが無かったため境界には含めていない（status-banner.jsの"token_expired"は状態名の
  文字列であり実トークンではない）。

★本リストは手書きのため単独では同期保証がない。`npm run check:security`
  （scripts/check-security-coverage.js）で実態とこのリストを双方向に突き合わせる。
  リストを更新する際は、対象ファイルへのマーカー付与とセットで行うこと（片方だけでは
  ERRORで弾かれる・fail-closed）。

★別件で発見した関連リスク（本リストの対象外・別途対応要）：
  BRAND_ANALYTICS/files/auth.js・crypto.js 等は index.html が読み込んでいない死んだコピー。
  誤って編集しても実際の挙動には反映されない。削除または明示的な「未使用」注記が望ましい
  （今回はスコープ外として未対応）。
```

### 実行順序（UIを含む機能実装の場合）

```
コード完成
  → A: code-review
  → B: security-review（auth/crypto変更時のみ）
  → C: hallmark audit（UI変更時のみ）
  → D: verification-before-completion
  → 完了宣言
```

### hallmark audit の結果処理ルール

- `Critical` / `High` 判定あり → **修正してから完了宣言**（ユーザーに確認不要・Claude が直接修正）
- `Medium` / `Low` のみ → ユーザーに一覧を提示して判断を委ねる
- 修正後は **hallmark audit を再実行してクリアを確認**してから完了宣言

### code-review の結果処理ルール

- バグ・セキュリティ・正確性の指摘 → **修正してから完了宣言**
- スタイル・提案のみ → ユーザーに提示して判断を委ねる

---

### 【C】UI・フロントエンド（画面実装時に自動発動）

| スキル | 何をするか | 発動条件 |
|---|---|---|
| `ui-ux-pro-max` | プロレベルのUI/UX設計知識を適用する | UI新規実装・レイアウト改善時（最初に呼ぶ） |
| `frontend-design:frontend-design` | グラフ・データ可視化の視覚設計を強化する | グラフ・チャート・ダッシュボード実装時 |
| `everything-claude-code:dashboard-builder` | KPIカード・メトリクス表示を設計する | ダッシュボード・グラフ実装時（frontend-designと併用） |
| `everything-claude-code:frontend-patterns` | UIコンポーネントのパターンを適用する | UIコンポーネント新規実装時 |

**UI衝突ルール：**
- `ui-ux-pro-max` と `frontend-design` は**両方呼ぶ**（互いを補完する）
- `design-philosophy.md` の内容がすべてのUIスキルより**最優先**
- 3つが衝突したら → `design-philosophy.md` ＞ `ui-ux-pro-max` ＞ `frontend-design` の順

---

### 【D】eBay・ビジネスロジック（専門領域の実装時）

| スキル | 何をするか | 発動条件 |
|---|---|---|
| `everything-claude-code:api-connector-builder` | eBay API接続・認証・リトライ処理を設計する | eBay API接続の実装時 |
| `everything-claude-code:finance-billing-ops` | 利益計算・手数料ロジックのパターンを確認する | 利益計算・手数料・学習型手数料の実装前（必須） |
| `everything-claude-code:market-research` | 競合・市場データの調査手法を適用する | eBayカテゴリ・競合・市場データ調査時 |
| `everything-claude-code:deep-research` | eBay API仕様の詳細調査を行う | eBay APIの仕様調査・不明点解消時 |
| `everything-claude-code:claude-api` | Claude API / Anthropic SDK の実装を最適化する | claude.js・call-claude Edge Functionの実装時 |

---

### 【E】データベース・セキュリティ（インフラ実装時）

| スキル | 何をするか | 発動条件 |
|---|---|---|
| `everything-claude-code:postgres-patterns` | Supabase/PostgreSQLのスキーマ設計を最適化する | DBスキーマ設計・マイグレーション作成時 |
| `everything-claude-code:security-review` | auth.js・OAuth・暗号化のセキュリティを検証する | auth.js・crypto.js・トークン処理を含む変更後（必須） |

---

### 【F】セッション管理（会話の開始・終了時）

| スキル | 何をするか | 発動条件 |
|---|---|---|
| `everything-claude-code:resume-session` | 前回セッションの状態を復元する | セッション開始時（ユーザーが `/resume-session` で明示） |
| `everything-claude-code:save-session` | 現在のセッション状態を保存する | セッション終了時（ユーザーが `/save-session` で明示） |

---

## スキル発動の優先順位

複数のスキルが同時に該当する場合：

```
1. 【A】常時稼働スキル（常に適用）
2. 【B】プロセススキル（作業フローを決める）
3. 【C/D/E】実装スキル（具体的な作業を強化）
```

**例：新しいダッシュボード画面を作るとき**
```
① superpowers:brainstorming（要件整理）
② superpowers:writing-plans（計画書作成）
③ ui-ux-pro-max（UI設計）
④ frontend-design + dashboard-builder（グラフ実装）
⑤ feature-dev（コーディング）
⑥ code-review（完成後レビュー）
⑦ verification-before-completion（完了確認）
```

---

## スキル使用時の通知ルール

スキルを呼んだとき、以下の形式で必ずアナウンスする：

```
▶ [スキル名] を使用：[理由1行]
```

例：`▶ ui-ux-pro-max を使用：ダッシュボードカードのレイアウト改善のため`

---

## 使用しないスキル（brand-analytics 対象外）

以下のスキルは誤発動を防ぐため、このプロジェクトでは**呼ばない**：

| カテゴリ | スキル群 |
|---|---|
| 他言語 | java-*, kotlin-*, swift-*, rust-*, go-*, cpp-*, perl-*, dart-* |
| 他フレームワーク | django-*, laravel-*, springboot-*, nextjs-*, nuxt4-* |
| 無関係業界 | healthcare-*, hipaa-*, defi-*, energy-procurement, logistics-*, customs-* |
| 無関係ツール | vercel:*(本番デプロイ時以外), figma:*(Figma未使用), video-editing, manim-video |

---

*v2.0: 2026-05-31 全面改訂（529スキル→22スキル選定・ユーザー可読形式・衝突ルール追加）*
*v1.0: 2026-05-24 初版（Claude向け指示書のみ）*
