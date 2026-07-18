*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

## Claude API統合基盤（全機能共通）

### 設計方針

AIは「提案」する。人間が「決定」する。
全機能で理由を必ず表示し、最終判断はユーザーに委ねる。
ユーザーが修正した結果はSupabaseに保存し、次回の精度向上に活かす。
翻訳はClaude APIに一本化（DeepL廃止・確定）。

---

### プロンプト3層構造

#### A層：コアプロンプト（恒久知識）
変わらないeBay基本ルールをシステムプロンプトに記載。
- 出品禁止カテゴリ・フィードバック方針
- Cassini検索アルゴリズムの基本原則
- アカウント健全性の評価ロジック
- eBay規約の基本方針

#### B層：動的ルールDB（改定追従）
Supabaseに `ebay_rules` テーブルを作成。
API呼び出し時に毎回読み込んでシステムプロンプトに追加。
改定があればテーブル更新のみでコード修正不要。

```sql
CREATE TABLE ebay_rules (
  id uuid PRIMARY KEY,
  category text,
  item_key text,
  value text,
  description text,
  effective_date date,
  updated_at timestamp
);
```

初期登録データ（最低限）：
| item_key | value | 内容 |
|---|---|---|
| fvf_cap | 750 | eBay手数料上限Cap（USD） |
| fvf_rate_standard | 13.25 | 標準カテゴリFVF率（%） |
| promoted_min | 2.0 | Promoted Listings最低料金（%） |
| payoneer_rate | 2.0 | Payoneer手数料率（%） |
| authenticity_categories | ハンドバッグ,スニーカー,腕時計,宝飾品 | 真贋対象カテゴリ |
| us_tariff_rate_japan | 15 | 日本→US関税率% |
| ddp_threshold_usd | 2500 | DDP義務しきい値USD |
| deminimis_usd | 0 | デミニミス撤廃済み |
| speedpak_ddp_included | true | SpeedPAK使用時DDP込み |
| vero_risk_brands | （随時更新） | VeROリスクブランドリスト |

#### C層：リアルタイム検索（最新情報補完）
Claude APIにweb_searchツールを付与。
判断に迷う場合は自動でeBayアナウンスページを検索し
根拠を表示してから回答。

---

### 実装構成（完了済み）

- js/core/claude.js ✅
- supabase/functions/call-claude/index.ts ✅
- ebay_rules・ebay_rules_historyテーブル ✅
- ANTHROPIC_API_KEY登録済み ✅

### AIコスト管理設計

ユーザー1人あたりの月間API呼び出し上限を設ける。

| tier | 上限 |
|---|---|
| free | 0回 |
| connected | 50回 |
| premium | 無制限 |

---

### Claude API統合機能リスト

#### STAGE2前半実装

**① アカウント健全性予測（dashboard.js拡張）**
現在の健全性指標から「いつ閾値を超えるか」を
時間軸で予測し、AIが具体的改善アクションを提案する。

**② ベストオファーAI判定（profit.js拡張）**
過去承認実績＋現在の市場価格から
「承認推奨 / 要交渉 / 却下推奨」を理由付きで提案。
最終判断は必ずユーザーが行う。

**③ AI返信文案生成（protection.js拡張）**
バイヤーのメッセージ内容を貼り付けると
状況に合わせた英文返信を即生成。
INADケース・クレーム・問い合わせを自動分類。
RabbiT・Bee対抗機能。

**④ Cassini最適タイトル生成（auto-listing.js）**
商品情報からeBay検索アルゴリズム（Cassini）向けの
80文字タイトルをAI生成。
禁止キーワードチェックをB層ルールDBと照合して自動除外。
Specifics-IN対抗機能。

**⑤ Item Specifics自動補完（auto-listing.js）**
カテゴリと商品名からeBay必須スペックを自動推測・入力。
Taxonomy APIと組み合わせて必須項目を動的に展開する。

#### STAGE2後半実装

**⑥ 仕入れリスクスコア（sourcing.js拡張）**
ブランド・カテゴリ・季節・競合数から
「このタイミングの仕入れリスクは高/中/低」を判定。

**⑦ バイヤー感情分析（protection.js拡張）**
メッセージのトーンを分析し
「このバイヤーは悪評リスクあり」を事前検知。

**⑧ 在庫滞留警告（新規）**
出品から○日経過・成約なしの商品を自動検知し
「値下げ推奨タイミング」をアラート。

**⑨ AI売上コーチング（dashboard.js拡張）**
月次で売上データを分析し
「先月比-15%の主因と改善アクション」を提案。

#### STAGE3実装

**⑩ AI競合分析レポート（competitive-research.js）**
Browse API＋web検索データをClaudeが統合し
「この商品の競合状況サマリー」を自動生成。

**⑪ 週次仕入れ推奨レポート（新規）**
過去の取引実績＋市場データから
「今週仕入れるべき商品TOP5」を自動レポート生成。

**⑫ 月次AIサマリー（dashboard.js拡張）**
月末に「今月の総括・来月の戦略提案」をAIが自動生成。

---

### 将来の収益化モデル候補

Freeプラン：AI機能なし・基本機能のみ
Standardプラン：月$19〜$29・AI機能あり（月50回まで）
Proプラン：月$49〜・AI機能無制限

事業化タイミング：STAGE3完了後に有料化検討
クローズドβ：STAGE2完了後に数名に無料提供・フィードバック収集

---

