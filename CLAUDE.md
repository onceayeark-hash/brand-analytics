# BRAND ANALYTICS — 実装指示書
## Claude Code: このファイルを最初に読み込んでから実装を開始すること

---

## セッション開始時の必須手順
1. `tasks/lessons.md` を読み、過去の指摘事項を確認する
2. **`context/design-philosophy.md` を読み、UI設計哲学書を把握する（新規実装・修正前に必須）**
3. 以下の詳細仕様を参照する
4. `context/skills.md` の実装タイミング表と **⚡自動発動ルール** を確認する

---

## ⚡ 自動実行ルール（ユーザーが指示しなくても Claude が必ず実行する）

> 以下は「提案」ではない。発動条件を満たしたら Claude が自律的に実行する強制ルール。
> ユーザーが「レビューして」「確認して」「監査して」と言わなくても実行すること。

| トリガー | 自動実行するスキル |
|---|---|
| 任意の機能実装が完了したとき | `code-review:code-review` |
| `auth.js` / `crypto.js` / トークン・OAuth 処理を変更したとき | `everything-claude-code:security-review` |
| HTML / CSS / JS の UI 部分を変更・新規実装したとき | `hallmark audit <変更ファイル名>` |
| 「実装完了」「完了しました」と言う直前 | `superpowers:verification-before-completion` |

**詳細な実行順序・結果処理ルールは `context/skills.md` の ⚡ 自動発動ルールセクションに定義されている。**

---

## スキル管理（詳細）
以下のSkillsが有効であることを把握する：
   - グラフ・UI実装時 → `frontend-design`（必須・`dashboard-builder`と併用）
   - 利益計算・手数料ロジック実装時 → `finance-billing-ops`（実装前に必ず呼ぶ）
   - DBスキーマ設計時 → `postgres-patterns`
   - 市場調査時 → `market-research`

---

## 詳細仕様（分割管理）

@context/skills.md
@context/specs.md
@context/design-philosophy.md
@context/architecture.md
@context/coding-rules.md

---

## 障害対応プロトコル（Claude Code 必読）

### ユーザーからエラー報告を受けたとき、必ずこの順で診断する

1. **Supabase `error_logs` テーブルを確認**
   ```sql
   SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 50;
   ```

2. **外部サービスの死活確認**
   | サービス | ステータスページ |
   |---|---|
   | Supabase | https://status.supabase.com |
   | Google Cloud | https://status.cloud.google.com |
   | eBay API | https://developer.ebay.com/support |

3. **エラーコード別の対応方針**
   | コード | 原因 | 対応 |
   |---|---|---|
   | `SUPABASE_DOWN` | Supabase障害 | status.supabase.com確認・復旧待ち |
   | `AUTH_GOOGLE_FAIL` | Google OAuth失敗 | Google Cloud Console確認 |
   | `EBAY_API_ERROR` | eBay API障害 | eBay Developer Portal確認 |
   | `EBAY_TOKEN_EXPIRED` | eBayトークン期限切れ | Edge Function再実行 |
   | `JS_UNHANDLED` | フロントエンドバグ | スタックトレース確認 |
   | `NETWORK_ERROR` | ネットワーク断 | ユーザー環境確認 |

4. **新しい外部サービスを追加するたびに必ずここに追記する**
   - サービス名・ステータスページURL・エラーコード・対応方針を追加すること

### 監視アーキテクチャ
- フロントエンドエラー → `js/core/monitor.js` が収集 → Supabase `error_logs` に保存
- 閾値超過（同一エラー5件以上/1時間）→ Edge Function `notify-admin` がメール送信
- 管理者パネル（`panel-admin`）で error_logs をリアルタイム表示

---

## 費用内訳カード（profit.js）空状態の表示仕様

未入力時（計算前）の費用内訳カードには
以下の項目名をグレーテキストで表示し
右側に「—」を並べる。
入力が始まると実際の金額に切り替わる。

表示項目（上から順に）：
- eBay手数料　　—
- Promoted　　　—
- Payoneer　　　—
- 送料　　　　　—
- 関税　　　　　—
- 真贋サービス　—
- 仕入れ原価　　—

スタイル：
- 項目名：グレー（#999999）・14px
- 「—」：グレー（#999999）・右詰め
- 各行の上下padding：8px

---

## 設定ページ（settings）コンテンツ仕様

設定ページには以下の2セクションを実装する。
（DeepL APIは廃止・Claude APIに一本化済み）

### セクション1：手数料・閾値設定
各値はlocalStorageに保存し
ページリロード後も維持する。

| 項目 | デフォルト値 | 入力形式 |
|------|------------|---------|
| 目標粗利率 | 25% | テキスト直打ち・%は枠外 |
| 競合増加率上限 | 15% | テキスト直打ち・%は枠外 |
| 最低成約率 | 30% | テキスト直打ち・%は枠外 |
| Payoneer手数料率 | 2% | テキスト直打ち・%は枠外 |
| 真贋サービス送料 | ¥1,500 | テキスト直打ち・¥は枠外 |
| 販売対象国 | ebay.com | チェックボックス複数選択 |

販売対象国の設定は競合リサーチの
デフォルト検索対象国として自動反映される。

変更した値は仕入れメーター・利益計算機に
自動で反映されること。

### 送料・関税テーブル設定
価格帯ごとの送料・関税補填額を事前登録する。
利益計算機で「テーブル自動適用」選択時に使用。

| 価格帯（$） | 送料（$） | 関税補填（$） |
|---|---|---|
| 0〜99.99 | 35 | 0 |
| 100〜149.99 | 35 | 0 |
| 150〜199.99 | 35 | 0 |
（行の追加・削除・編集が可能）

・localStorageに保存
・行は自由に追加・削除・編集可能
・販売価格入力時に該当行を自動検索して適用

### セクション2：eBay接続管理
- 現在の接続状態を表示
  （接続済み：緑ドット / 未接続：赤ドット）
- 未接続時：「eBayを連携する」ボタン（Primary）
- 接続済み時：「接続済み ✓」表示＋
  「再接続する」ボタン（Secondary）
- トークン有効期限の表示（接続済み時）

---

## 追加実装機能仕様（確定）

---

### 【即時実装】ROI表示（profit.js）✅ 実装済み

利益計算機の粗利益・PPDの横に
ROIを追加表示する。

計算式：
ROI = (粗利益 ÷ 仕入れ原価) × 100

表示場所：
粗利益（シミュレーション）カードの
粗利率の下に追加

表示形式：
ROI: 234.00%（小数2桁固定）
マイナスの場合：赤色文字

---

### 送料・関税の入力方式（3択）

利益計算機はあくまで概算・参考値のため
セラーが自分の思考に合わせて選択できる設計とする。
強制・制限はしない。

① 手動入力（デフォルト）
　毎回数値を直接入力する

② 価格帯テーブル自動適用
　設定ページで登録したテーブルから
　販売価格に該当する行を自動適用する

③ SpeedPAK自動計算（STAGE2後半実装）
　重量・サイズ・発送先から自動算出する
　FedEx / DHL / Economy の3択で最安値ハイライト

---

### 【STAGE2前半】ベストオファー価格シミュレーション（profit.js拡張）

「このオファー価格を承認したら実際の粗利はいくらか」
を瞬時に計算するシミュレーター。

実装場所：
利益計算機の下部に折りたたみ式パネルとして追加
「ベストオファーシミュレーター」セクション

入力項目：
・オファー金額（$）
・目標タブ切替「目標粗利率(%) / 目標粗利額(¥)」
  - %タブ：設定ページの目標粗利率を既定値として参照・シミュレーター内で上書き可
  - ¥タブ：設定ページの目標粗利額（¥）を既定値として参照・上書き可

出力項目：
・オファー承認後の粗利益（USD / JPY）※JPYはX-10実レート換算
・オファー承認後の粗利率
・オファー承認後のROI
・最低承認可能価格（アクティブタブの目標を満たす最小オファー価格を逆算）
・差額：▼$X.XX（−X.XX%）形式で出品価格との比較を表示

表示形式：
現在の設定価格との差額を
「▼$X.XX（-X.XX%）」で表示する

確定仕様（2026/06/02）：
・データ連携：profit.jsの現在の入力値（原価・手数料率・送料・関税・真贋費用）を参照。再入力なし
・計算タイミング：リアルタイム（オファー入力・タブ切替・目標値変更で即再計算。debounce可）
・$500未満のオファーは真贋サービス料を自動ゼロ（$500以上は¥1,500計上）
・eBay手数料$750 Cap適用
・JPY換算はX-10 exchange-rate Edge Function経由の実レート使用
・最低承認可能価格の逆算：eBay Cap区間と真贋$500段差の両区間で解き整合解を採用
・達成不能な目標設定時は「この目標は達成不可」を表示
・設定ページに「目標粗利額（¥）」フィールドを新設（ba_settingsのtargetProfitJpyキー）

---

### 【STAGE2前半】返品コスト計算（profit.js拡張）

返品率を考慮した実質粗利益を計算する。

実装場所：
利益計算機の「手数料」セクションの下に追加

入力項目：
・想定返品率（%）（デフォルト：0%）
・返品時の処理費用（$）（デフォルト：$0）
・再販可能かどうか（チェックボックス）

計算ロジック：
再販可能：返品コスト = 処理費用のみ
再販不可：返品コスト = 処理費用 + 仕入れ原価 × 返品率

出力：
「返品考慮後の実質粗利益」として
通常の粗利益の下に小さく表示

---

### 【STAGE2後半】自動値下げ機能（新規ファイル：repricing.js）

ルールベースで出品商品の価格を自動調整する機能。

APIについて：
eBay Trading APIを使用。
eBay Developer Programへの登録・本番キー生成で
自動的にスコープが付与されるため特別な申請不要。

ルール設定（ユーザーが設定可能）：
・出品から○日経過した商品を○%値下げ
・競合の最安値より$X/○%高い場合に自動調整
・値下げの下限：目標粗利率○%を下回らない
・値下げの上限回数：1商品につき最大○回まで
・対象商品フィルター：
  カテゴリ・価格帯・出品日で絞り込み可能

実行タイミング：
Supabase Edge Functionsのcronジョブで
1日1回または任意の時間に実行

必要なAPI：
・eBay Trading API（ReviseItem）
  → eBay Developer Program登録で自動付与
・Supabase Edge Functions（定期実行）

UI：
「設定」ページの新セクションとして追加
「自動値下げルール」

---

### 【STAGE2後半】発送料自動計算（profit.js拡張）

SpeedPAK（FedEx/DHL）の送料を
重量・サイズ・発送先から自動計算する。

実装場所：
利益計算機の「送料・関税」セクション
送料の入力方法に「SpeedPAK自動計算」を追加

入力項目：
・梱包サイズ（縦×横×高さ cm）
・梱包重量（kg）
・発送先国

出力：
・SpeedPAK FedEx料金
・SpeedPAK DHL料金
・SpeedPAK Economy料金
→ 3つを並べて最安値をハイライト表示

API：
・FedEx Rate API
・DHL Rate API
（各社Developer Programへの登録が必要）

---

### 【STAGE2後半】自動出品（auto-listing.js）

#### 設計方針（確定）
eBayの全出品項目を網羅した上で
AIによる自動補完＋人間確認という
シンプルかつ高精度な設計とする。
eBay Seller Hubを経由せず
BRAND ANALYTICS内で完結する。
翻訳はClaude APIに一本化（DeepL廃止）。

---

#### 実装範囲（確定）

| 機能 | STAGE | API |
|---|---|---|
| 新規出品 | STAGE2後半 | Sell Inventory API |
| 既存出品の修正 | STAGE2後半 | Sell Inventory API |
| 写真URL指定での出品 | STAGE2後半 | EPS API |
| 一括修正 | STAGE3 | repricing.jsと連動 |
| Supabase写真管理 | STAGE3 | Supabase Storage |
| AI写真解析・Item Specifics補完 | STAGE3 | Claude API＋Vision |

---

#### OAuthスコープ（追加必要）

以下をauth.jsのスコープ設定に追記する：
・https://api.ebay.com/oauth/api_scope/sell.inventory
・https://api.ebay.com/oauth/api_scope/sell.account
・https://api.ebay.com/oauth/api_scope/commerce.taxonomy.readonly

既存ユーザーは再認証が必要。

---

#### 出品フォームの項目構成（全網羅）

**基本情報**
- タイトル（80文字・Claude自動生成＋確認）
- サブタイトル（任意・有料）
- カテゴリ（Taxonomy APIで候補提示）
- コンディション（New/Used/New other等）
- 商品説明文（Claude自動生成＋確認）
- 原産国（COO）← DDP対応で必須

**Item Specifics（Claude自動補完）**
- Taxonomy APIでカテゴリ別の必須・推奨項目を動的取得
- Claude APIが商品名・ブランドから値を自動推測
- 必須項目：赤ハイライト
- 推奨項目：黄ハイライト
- ユーザーが確認・修正してOK
- 商品識別子（UPC/EAN/MPN）も含む

**価格・出品形式**
- 固定価格
- オークション（開始価格・リザーブ・期間）
- ベストオファー対応（ON/OFF・自動承認設定）
- 数量

**写真・動画**
STAGE2後半：URL直接指定（最大24枚）
STAGE3　　：ドラッグ＆ドロップアップロード
　　　　　　Supabase Storageで管理
　　　　　　同一ブランド写真の再利用
　　　　　　AI写真解析でItem Specifics自動補完

**配送設定**
- 送料方式（手動/テーブル自動/SpeedPAK）
- 発送元（日本固定）
- 発送先国（販売対象国設定から自動反映）
- DDP/DDU設定（$2,500未満は自動DDP）
- 配送ポリシー（sell.account APIから取得）

**返品設定**
- 返品受付（ON/OFF）
- 返品期間（30日推奨）
- 返品送料負担（バイヤー/セラー）
- 返品ポリシー（sell.account APIから取得）
※返品ポリシーのUI設計はSTAGE2着手時に他社ツール参考画像を確認してから設計する

**プロモーション**
- Promoted Listings（%設定）
- ストアカテゴリ

---

#### Item Specifics自動補完フロー

```
① ユーザーがブランド名・商品名を入力
↓
② カテゴリ候補をTaxonomy APIが提示
→ ユーザーが選択
↓
③ 選択カテゴリの必須・推奨項目を取得
↓
④ Claude APIが全項目の値を自動推測
（ブランド・商品名・説明文から判断）
↓
⑤ 確認画面を表示
・必須項目：赤（未入力は出品不可）
・推奨項目：黄（任意）
・AI補完済み：グリーンチェック
↓
⑥ ユーザーが確認・修正
↓
⑦ 出品APIに送信
```

---

#### 既存出品の修正フロー

```
① 出品一覧からeBay Item IDで検索
② 現在の出品データを取得・表示
③ 修正箇所を編集
（価格・説明文・送料・Item Specifics等）
④ 確認後にRevise APIで上書き
⑤ 修正履歴をSupabaseに記録
```

---

#### 一括修正フロー（STAGE3）

対象の選択方法：
・カテゴリで絞り込み
・価格帯で絞り込み
・出品日で絞り込み
・ブランドで絞り込み

一括修正できる項目：
・価格（%増減・固定値変更）
・送料設定
・DDP/DDU設定
・Promoted Listings率
・返品ポリシー

repricing.jsの自動値下げルールと連動。
関税改定時の全商品一括価格更新にも対応。

---

#### 下書き機能（AL-08解決）

・入力途中でも下書き保存可能
・Supabaseのdraftsテーブルに保存
・下書き一覧から再編集・出品が可能
・テンプレートとして保存も可能
（同一ブランドの次回出品を効率化）

---

#### VeROリスクスキャン（自動）

出品前にClaudeがブランド名を確認
→ VeROリスクがあれば警告表示
→「このブランドはVeRO登録の可能性があります」
→ ユーザーが確認してから出品

---

#### リスティング品質チェック（Claude API自動判定）

手動チェックボックスは廃止。
Claudeが以下を自動判定する：

| 項目 | 判定方法 |
|---|---|
| タイトル文字数・語数 | 文字カウント（コード） |
| Cassini最適化 | Claude分析 |
| 説明文の構造化 | Claude分析 |
| モバイル最適化 | Claude分析 |
| 状態詳細説明 | Claude分析 |
| 商品識別子 | 説明文・Specificsから検出 |
| VeROリスク | ブランド名で判定 |
| GPSR対応 | 販売対象国がEUの場合のみ確認 |

手動判断が必要な項目（最小限）：
・正規認定ディーラーかどうか（設定ページで一度登録）
・30日返品ポリシー（sell.account APIから自動取得）

---

### 【STAGE3】競合リサーチ・国別選択（新規機能）

eBay各国マーケットプレイスの競合出品データを
自動取得・分析する機能。

---

#### データ取得方針（確定）

| データ項目 | 取得方法 | 備考 |
|---|---|---|
| 競合出品数 | Browse API（自動） | 検索時に毎回取得・時系列保存 |
| 現在の価格帯（最安〜最高） | Browse API（自動） | |
| 出品形式比率（固定/オークション） | Browse API（自動） | |
| 平均成約価格 | 手動入力（Terapeak参照） | 入力欄にTerapeak導線を表示 |
| セルスルー率（成約率） | 手動入力（Terapeak参照） | 同上 |
| 平均送料 | 手動入力（Terapeak参照） | 同上 |

---

## 競合リサーチ・成約データ取得方針（確定・2026-05-31）

### データ取得の優先順位

① STAGE3：Terapeak CSV × Claude分析（最優先・最強コスパ）
　・ユーザーがTerapeakでCSV出力 → アップロード → Claude自動分析
　・コスト0・精度最高（Terapeak本体データ）・実装容易
　・成約率・PPD・価格帯を自動分析してサマリー生成

② STAGE3同時進行：「消えた出品」追跡（サイレント稼働）
　・Browse APIで毎日検索 → 消えた出品IDを成約と判定
　・6ヶ月後に自前成約データベースが完成
　・ユーザーが増えるほど精度向上（集合知）

③ Growth Check後：Marketplace Insights API申請
　・eBay公式の成約データAPI・審査通過後に即申請

④ STAGE4：ZIK Analytics API
　・Terapeakを持っていないユーザー向けの代替手段として位置づけ
　・メインはTerapeak CSVルートで割り切る

### 競合リサーチの限界値
・仕入れ判断まで（何を・いくらで・どの国で・いつ仕入れるか）
・出品後の動向はツール全体の他機能（自動出品・値下げ・健全性）が担う

### 廃止・変更
・「Terapeak API・Marketplace Insights API：実装対象外（恒久決定）」は撤回
　→ Marketplace Insights APIはGrowth Check後に申請する
・ZIK Analytics APIはSTAGE4でTerapeak非保有者向け代替として実装

---

#### 検索フィルター仕様（確定）

**コンディション**
- New / Used / すべて
- デフォルト：Used

**形式**
- ☑ ベストオファー対応（デフォルトON）
- ☑ 固定価格（デフォルトON）
- ☐ オークション（デフォルトOFF）

**出品者の所在地**
- Japan / すべて（トグル選択）
- デフォルト：Japan
- 理由：日本セラーはeBayバイヤーから品質・信頼性で高評価を得ており
　「Japan」出品者を意図的に探すバイヤーが多数存在する。
　競合分析の主軸は「Japanセラー内での自分の位置づけ」とする。

**価格帯**
- $ [____] 〜 $ [____]（任意・空欄で全範囲）

---

#### 3つの検索モード

**モード①：販売国と自動連動（デフォルト）**
設定ページの「販売対象国」と完全連動。
自分が実際に売っている市場だけをリサーチ。

**モード②：手動選択**
国を個別チェックで自由に選択。
新規市場の開拓検討時に使用。

**モード③：ebay.com固定**
ワンクリックでebay.comのみに切り替え。

いずれのモードも常に選択可能とし
「選べない状態」は作らない。

対応サイト一覧：
- ebay.com（アメリカ）
- ebay.co.uk（イギリス）
- ebay.de（ドイツ）
- ebay.com.au（オーストラリア）
- ebay.fr（フランス）
- ebay.it（イタリア）
- ebay.es（スペイン）
- ebay.ca（カナダ）
- ebay.com.hk（香港）
- ebay.nl（オランダ）

---

#### Browse APIで自動生成するもの

競合出品数を検索ごとに記録・蓄積することで
Terapeakが提供しない「競合増加率の時系列トレンド」を
自動生成する。

仕入れメーター（sourcing.js）の
競合増加率フィールドへ自動引き渡しを実装する。

---

#### Claude APIによる統合分析

Browse API取得データ＋web検索を
Claudeが統合して国別横断サマリーを自動生成する。

---

#### タブ構造（確定）

タブ1「推奨商品リサーチ」
　成約率・PPD・価格上昇トレンドで
　仕入れ推奨商品を発見する
　→ 緑系カラー「GO」イメージ

タブ2「回避商品リサーチ」
　成約率の低さ・長期在庫・価格下落トレンドで
　仕入れを避けるべき商品を特定する
　→ 赤系カラー「STOP」イメージ

---

#### 判断指標（共通）

・競合出品数（自動取得）
・競合増加率（前回比・自動計算）
・現在価格帯（自動取得）
・平均成約価格（手動入力）
・セルスルー率（手動入力）
・推定PPD（粗利益÷平均売却日数）

---

#### STAGE4での拡張予定

ZIK Analytics APIとの統合を実装。
Terapeakを持っていないユーザー向けの代替手段として位置づける。
メインの成約データ取得はTerapeak CSVルート（STAGE3実装）で完結させ、
ZIK APIはあくまで補完的な選択肢として提供する。
ユーザーがAPIキーを設定することでTerapeak同等の成約データを自動取得できる設計にする。
設定ページ（settings）に「ZIK Analytics連携」セクションを追加予定。

---

### 【STAGE3】仕入れリサーチパイプライン（合法ハイブリッド）｜設計メモ
*記録日：2026-06-02 / 技術・規約レビュー済み*

#### 目的
「抽出→利益計算→GO/NO-GO→保存」の一気通貫を合法範囲（C-06/C-07準拠）で実現。
profit.js の統一基準で赤字掴みを構造的に防ぎ、リサーチ時間を短縮する。

#### 入力（合法ルートのみ）

| 入力方法 | 内容 | 規約根拠 |
|---|---|---|
| Browse API | 競合出品データ（出品数・価格・カテゴリ等） | eBay 公式 API・合法 |
| ユーザー貼付 | ユーザーが手動でページを開き、テキストまたはスクショを貼る → Claude API で構造化 | C-06 準拠：アクセスはユーザー、ツールは読むだけ |

**⚠️ URL 自動 fetch 禁止：** 「URL を貼ると自動取得」は C-06 違反。UI で「URL ではなくページ内容のテキストを貼ってください」と明示ガードを設けること。

#### 処理フロー
```
① 入力（Browse API / ユーザー貼付）
② Claude API で構造化（商品名・状態・価格・カテゴリ）
③ profit.js の現在設定に自動投入（3層UI・X-10 為替）
   ※ BA.profit.calculate(params) 純粋関数化が前提条件
④ GO/NO-GO 判定（設定の粗利率・PPD 閾値を参照 = S-01 解決）
⑤ VeRO/ブランド規約/関税リスクフラグを添付（X-05・判断は人間）
⑥ GO 候補を Supabase research_items テーブルに保存（S-04 解決）
```

#### やらないこと（規約ガード）
- eBay / Amazon 等の自動スクレイピング（C-06）
- eBay データの AI 学習利用（C-07①）
- 競合価格連動の自動 repricing（C-07②）
- eBay データと非 eBay データの視覚的未分離（C-07③ → source_label 必須）
- 仕入れ判断の自動化（C-01 → 候補と理由を提示し判断はセラー）

#### 実装の前提条件（STAGE3 着手前に完了していること）
1. **profit.js リファクタ**: `BA.profit.calculate(params)` 純粋関数化
2. **source_label の UI 表示**: 「eBay Browse API」「ユーザー入力」を視覚的に分離（C-07③）
3. **URL 自動 fetch ガード**: UI で明示的に防ぐ

#### DB スキーマ（STAGE3 着手時に schema_stage3.sql で作成）
```sql
CREATE TABLE research_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  source_type     text NOT NULL CHECK (source_type IN ('browse_api','user_paste')),
  source_label    text,
  source_url      text,
  product_name    text NOT NULL,
  condition       text,
  ebay_category   text,
  list_price_usd  numeric(10,2),
  cost_price_jpy  integer,
  profit_usd      numeric(10,2),
  margin_pct      numeric(5,2),
  roi_pct         numeric(5,2),
  go_nogo         text CHECK (go_nogo IN ('go','nogo','review')),
  go_nogo_reasons jsonb,
  vero_risk       boolean DEFAULT false,
  vero_note       text,
  user_notes      text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE research_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_research" ON research_items USING (user_id = auth.uid());
```

#### 技術レビュー所見（2026-06-02）
- Browse API で成約データは取れない。設計の手動補完方針は正しい
- ユーザー貼付→Claude 構造化: テキストで 85-95%・スクショで 75-90%
- connected tier の月 50 回制限がリサーチ用途でボトルネックになる可能性あり → SaaS 化時に tier 設計を再検討
- 「消えた出品 = 成約」追跡の誤差（取り下げ・期間切れと区別不可）→ UI に誤差注釈が必要
- Keepa API（$20/月）は将来の合法仕入れ元価格補完として有望

#### 関連 ISSUES: S-01 / S-04 / X-04 / X-05 / X-08

---

## 追加機能のSTAGE別実装順序

STAGE1完了前：ROI表示 ✅
STAGE2前半　：ベストオファーシミュ・返品コスト計算・Claude API統合基盤
STAGE2後半　：自動値下げ・発送料自動計算・自動出品
STAGE3　　　：競合リサーチ・国別選択・一括修正・写真管理

---

## アカウント健全性予測（dashboard.js拡張）

### 概要
現在の健全性指標から「いつ閾値を超えるか」を
時間軸で予測し、AIが具体的改善アクションを提案する。

### 監視指標・閾値

| 指標 | Below Standard | Top Rated |
|---|---|---|
| Defect Rate | 2% | 0.5% |
| Late Shipment Rate | 10% | 3% |
| Cases Closed Without Resolution | 0.3% | 0.3% |
| Tracking Uploaded On Time | — | 95% |
| Valid Tracking Rate | — | 95% |

### 計算ロジック

許容残件数 =（閾値% × 総取引数）− 現在違反件数
超過予測日数 = 許容残件数 ÷（直近30日クレーム数 ÷ 30）

### Claude APIへの入力データ

・各指標の現在値
・直近30日の販売数・違反発生数
・出力形式：JSON（most_risky / days_until_breach /
　remaining_violations / actions[]）

### アラートレベル

- 緑：全指標が安全圏
- 黄：閾値の70%超過 →「あと○件・推定○日」表示
- 赤：閾値の90%超過 → 緊急アラート＋AI改善提案3件

### データ取得

PHASE 1：手動入力（即時実装可能）
PHASE 2：seller_standards_profile API自動取得（D-02解決）

### 実装ファイル

dashboard.js に追加
新関数：predictHealthBreach() / getAIHealthAdvice()

---

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

## eBay Japanポリシー自動監視システム

### 概要
eBayの規約・手数料・関税・プログラム変更を
自動検知してツールに即時反映する仕組み。
ユーザーは何もしなくても常に最新情報で計算される。

---

### 監視対象URL・情報源

#### 手数料・関税
・https://export.ebay.com/en/resources/important-updates/
・https://export.ebay.com/ja/fees/
・https://export.ebay.com/ja/seller-updates/

#### プログラム・規約
・VeROプログラム（知的財産権侵害リスト）
　https://pages.ebay.com/seller-center/listing-and-marketing/vero-program.html
・Authenticity Guaranteeの対象カテゴリ変更
・Seller Performance Standards（基準値変更）
・Managed Payments（決済ポリシー変更）
・eBay International Shipping / SpeedPAK更新

#### 関税・通関
・US関税情報ページ
・Orange Connex（SpeedPAK）料金更新

---

### 3層実装構成

#### 層①：定期監視
Supabase Edge Functions（毎日1回 cron）
→ Claude API + web_searchで上記URLの最新情報を取得
→ 前回取得内容と差分を比較
→ 変更検知時に層②③を起動

#### 層②：自動更新（B層ルールDB）
変更検知時：
→ ebay_rulesテーブルを自動更新
→ ebay_rules_historyテーブルに変更履歴を記録

#### 層③：アラート通知
変更検知時：
→ 管理者にメール通知
→ ツール内に「重要：eBayポリシーが更新されました」バナーを表示
→ 設定ページの「eBayルール管理」に変更履歴を表示

---

### VeRO監視の特別設計

VeRO（Verified Rights Owner）は
ブランドの知的財産権保護プログラム。
VeRO対象商品を出品すると即座にリスティング削除・
アカウント停止リスクがある。

ツールへの反映：
・auto-listing.jsのタイトル生成時にVeROリスクブランドを警告表示
・仕入れメーター（sourcing.js）のリスクスコアにVeROリスクを加味
・「このブランドはVeRO登録あり」を仕入れ判定画面に赤字で警告

---

### 監視項目一覧（B層ルールDB管理）

| item_key | 内容 | 更新頻度 |
|---|---|---|
| fvf_cap | eBay手数料上限Cap | 年数回 |
| fvf_rate_standard | 標準FVF率 | 年数回 |
| promoted_min | Promoted最低料金 | 年数回 |
| us_tariff_rate_japan | 日本→US関税率 | 随時 |
| ddp_threshold_usd | DDP義務しきい値 | 随時 |
| deminimis_usd | デミニミス基準額 | 随時 |
| speedpak_ddp_included | SpeedPAKでDDP込みか | 随時 |
| authenticity_categories | 真贋対象カテゴリ | 随時 |
| vero_risk_brands | VeROリスクブランドリスト | 随時 |
| seller_standard_defect | Defect Rate閾値 | 年数回 |

---

### 実装タイミング
STAGE2後半（Claude API統合基盤実装後）
監視・通知基盤はrepricing.jsのcron基盤と共用する

---

### 競合リサーチの標準フィルター設計思想

日本セラーはeBayバイヤーから
品質・信頼性で高評価を得ており
「Japan」出品者を意図的に探す
バイヤーが多数存在する。

そのため競合分析の主軸は：
「Japanセラーの中での自分の位置づけ」
→ 出品者所在地：Japanをデフォルトにする

全体市場も必要な場合は
「すべて」に切り替えて確認する。

## eBaymag連携設計

### eBaymagとの役割分担（確定）

eBaymagはeBay公式の無料多国展開ツール。
BRAND ANALYTICSはeBaymagと競合しない。
2つは補完関係として設計する。

---

### eBaymag連携で実現する機能

#### 国別売上の一元管理
eBaymagで多国展開した商品の
各国売上をBRAND ANALYTICSに集約して表示。

表示項目：
・国別の売上金額（USD換算・現地通貨）
・国別の粗利・ROI
・国別の成約率・PPD
・どの国が最も利益率が高いかの比較

#### 国別価格最適化の提案
・競合リサーチで取得した国別価格データと照合
・「ebay.co.ukは競合が少なく単価が高い→価格を5%上げ推奨」
　をClaude APIが提案

#### eBaymag対応の注意事項をツール内に表示
・出品リミットの消費（国数×商品数が必要）
・固定価格（Buy It Now）のみ対応
・Out of stock設定がONである必要がある
・EU向け規制（GPSR・EPR・LUCID等）の警告

---

### 対応国（eBaymag準拠）

| サイト | 言語 | 通貨 |
|---|---|---|
| ebay.com | 英語 | USD |
| ebay.co.uk | 英語 | GBP |
| ebay.de | ドイツ語 | EUR |
| ebay.fr | フランス語 | EUR |
| ebay.it | イタリア語 | EUR |
| ebay.es | スペイン語 | EUR |
| ebay.com.au | 英語 | AUD |
| ebay.ca | 英語 | CAD |

---

### 実装タイミング
STAGE3（競合リサーチ・国別選択と同時）
Finances APIで各国売上データを取得して集計する。
---

## 管理者パネル（panel-admin）仕様

### 概要
BRAND ANALYTICSの管理者（オーナー）専用画面。
別ツール不要・ツール内に統合する。
ClaudeAPIがデータを統合分析し
経営判断に必要なコメントを自動生成する。

---

### STAGE2後半実装

**ユーザー管理**
・総会員数・プラン別人数（Free/Standard/Pro）
・新規登録数・解約数（週次・月次）
・各ユーザーの最終ログイン・利用状況

**システム状態**
・Supabase DB・eBay API・Claude APIの死活確認
・エラーログ一覧（error_logsテーブルから取得）
・API呼び出し回数・残量

---

### STAGE3実装

**売上・収益ダッシュボード**
・月次MRR（月次定期収益）
・チャーン率（解約率）
・ARPU（ユーザー1人あたり収益）
・収益推移グラフ

**規約監視ログ**
・週1回自動監視（毎週月曜深夜3時実行）
・39項目の最終確認日・変更検知履歴
・変更があった場合の影響ユーザー数表示
・緊急対応スイッチ（影響機能の一時停止）

監視コスト目安：
週1回 × 39項目 = 月約$10〜$15

**AIによる経営サマリー（週次自動生成）**
Claude APIが以下のデータを統合して
管理者向けコメントを自動生成する：

入力データ：
・会員数・プラン構成・チャーン率
・エラー発生状況
・規約変更検知状況
・API利用コスト

出力例：
「今週の状況：
会員数47名（先週比+3名）
チャーン率2.1%（目標3%以下・良好）
規約変更：DDP閾値が$2,500→$500に変更検知
→ 全会員の出品価格設定に影響の可能性
→ 緊急メール送信を推奨します」

※これはオーナー自身のビジネス管理のための
AIサポートであり、eBay規約上の問題なし。

---

## eBaymag連携設計（確定・2026-05-29追記）

### 基本方針
- BRAND ANALYTICSはeBaymag連携の「起点」かつ「集約先」
- eBaymag経由のみで得られる手数料無料特典があるため、代替ではなく必須連携
- 単純な「多国展開ボタン」ではなく、売上データの還流まで含めた設計

### 展開フロー
1. BRAND ANALYTICSでUS出品を管理（既存フロー）
2. 「eBaymagで多国展開」ボタン → eBaymag（ebaymag.com）を1クリックで開く
3. eBaymagが他7カ国（UK/DE/AU/CA/IT/FR/ES）に自動展開
4. 各国の売上・取引データはeBay Finances APIでBRAND ANALYTICSに集約

### 実装上の注意
- eBaymag側の操作（インポート・サイト有効化）はeBaymag内で完結する
- BRAND ANALYTICSはFinances APIで各国売上を統合表示するのみ
- eBaymag内の変更はオリジナルサイトに反映されない（eBaymag仕様）
  → 重要な変更は必ずオリジナルサイト（eBay.com）で行うこと
- Out of stock設定は必ずONのまま維持（eBaymag在庫連動の必須条件）

### Finances APIでの売上集約
- seller_id × marketplace_id の組み合わせで各国売上を取得
- 対象マーケットプレイス: EBAY_US / EBAY_GB / EBAY_DE / EBAY_AU / EBAY_CA / EBAY_IT / EBAY_FR / EBAY_ES
- finance.jsで「国別売上内訳」として表示（STAGE2対応）

---

## eBayを開く回数の最小化設計（確定・2026-05-29追記）

### 基本方針
- BRAND ANALYTICSから「eBayを探す」手間をゼロにする
- 対象ページへ1クリックで直接ジャンプする設計

### 実装対象（優先順）

| 機能 | 遷移先eBayページ | 実装箇所 |
|---|---|---|
| メッセージ確認 | https://www.ebay.com/messages | protection.js |
| ケース対応 | https://www.ebay.com/resolutionCenter | protection.js |
| フィードバック確認 | https://www.ebay.com/fdbk/feedback_profile | protection.js |
| 取引詳細 | https://www.ebay.com/sh/ord/details?orderid={id} | finance.js / transactions.js |
| 健全性ダッシュボード | https://www.ebay.com/sh/perf/dashboard | dashboard.js |
| Seller Hub全体 | https://www.ebay.com/sh/ovw | nav.js |

### 実装ルール
```javascript
// 共通ヘルパー（nav.js or notify.js に定義）
function openEbay(path) {
  window.open('https://www.ebay.com' + path, '_blank', 'noopener');
}

// 使用例
openEbay('/messages');           // メッセージ
openEbay('/resolutionCenter');   // ケース
```

- 新しいタブで開く（noopener必須）
- BRAND ANALYTICSのセッションを維持するため同一タブ遷移は禁止
- URLはBA_CONFIG等に集約せずインラインで記述してよい（変更頻度低）

管理者パネル監視設計（確定）
- インフラ死活：Supabase / Claude API / eBay API / GitHub
- 課金アラート：各サービスの閾値超えで警告表示
- 事業KPI：DAU・機能別使用率・エラー率
- 全データはSupabase admin_logsテーブルに集約

---

## 管理者パネル監視設計（確定・2026-05-29追記）

### 基本方針
- エラー表示だけでなく「対処ボタン」をセットで表示する
- 非エンジニアのオーナーが迷わず自走できる設計
- アラート＋該当ページへの1クリック遷移＋Claude相談ボタンの3点セット

### 監視対象（3層）

#### ① インフラ層（死活監視）
| 対象 | 監視項目 |
|---|---|
| Supabase | DB接続・ストレージ使用量・プラン上限% |
| Claude API | 月間トークン使用量・エラー率 |
| eBay API | 接続状態・APIコール残数 |
| GitHub | 最終デプロイ日時・ビルド成否 |

#### ② 課金検討アラート層
| トリガー | メッセージ |
|---|---|
| Supabase使用量70%超 | 「プランアップグレード検討時期です」 |
| Claude API月額$10超 | 「API費用増加・料金設計見直し推奨」 |
| ユーザー数30人超 | 「Supabase Pro移行を検討してください」 |
| eBay APIコール上限80%超 | 「呼び出し頻度の最適化が必要です」 |

#### ③ 事業・品質層
| 項目 | 内容 |
|---|---|
| アクティブユーザー数 | DAU / MAU推移 |
| 機能別使用率 | どの機能が使われているか |
| エラー発生率 | 機能別エラー頻度 |
| OAuth再接続率 | トークン失効の頻度 |

### アラートのUI仕様（非エンジニア対応）
すべてのアラートに以下の3点をセットで表示する：

### 実装仕様
- 全ログはSupabaseのadmin_logsテーブルに集約
- 各サービスのStatus API・Usage APIを定期ポーリング（15分間隔）
- Google Cloudは現時点で構成外のため監視対象外（導入時に追加）

### openAdmin共通ヘルパー
```javascript
// nav.js または admin.js に定義
function openService(url) {
  window.open(url, '_blank', 'noopener');
}

// 各サービスの遷移先
const ADMIN_URLS = {
  supabase:    'https://supabase.com/dashboard',
  anthropic:   'https://console.anthropic.com/settings/usage',
  ebay_dev:    'https://developer.ebay.com/my/usage',
  github:      'https://github.com/[repo]/actions',
  claude_chat: 'https://claude.ai',
};

---

## eBaymag連携設計（確定・2026-05-29追記）

### 基本方針
- BRAND ANALYTICSはeBaymag連携の「起点」かつ「集約先」
- eBaymag経由のみで得られる手数料無料特典があるため代替ではなく必須連携
- 単純な「多国展開ボタン」ではなく売上データの還流まで含めた設計

### 展開フロー
1. BRAND ANALYTICSでUS出品を管理（既存フロー）
2. 「eBaymagで多国展開」ボタン → ebaymag.com/?locale=ja を1クリックで開く
3. eBaymagが他7カ国（UK/DE/AU/CA/IT/FR/ES）に自動展開
4. 各国の売上・取引データはeBay Finances APIでBRAND ANALYTICSに集約

### 実装上の注意
- eBaymag側の操作はeBaymag内で完結する
- BRAND ANALYTICSはFinances APIで各国売上を統合表示するのみ
- eBaymag内の変更はオリジナルサイトに反映されない（eBaymag仕様）
  → 重要な変更は必ずオリジナルサイト（eBay.com）で行うこと
- Out of stock設定は必ずONのまま維持（eBaymag在庫連動の必須条件）

### Finances APIでの売上集約
- 対象マーケットプレイス：EBAY_US / EBAY_GB / EBAY_DE / EBAY_AU / EBAY_CA / EBAY_IT / EBAY_FR / EBAY_ES
- finance.jsで「国別売上内訳」として表示（STAGE2対応）

---

## eBayを開く回数の最小化設計（確定・2026-05-29追記）

### 基本方針
- BRAND ANALYTICSから「eBayを探す」手間をゼロにする
- 対象ページへ1クリックで直接ジャンプする設計
- 新しいタブで開く（noopener必須）・同一タブ遷移禁止

### 実装対象

| 機能 | 遷移先 | 実装箇所 |
|---|---|---|
| メッセージ確認 | /messages | protection.js |
| ケース対応 | /resolutionCenter | protection.js |
| フィードバック確認 | /fdbk/feedback_profile | protection.js |
| 取引詳細 | /sh/ord/details?orderid={id} | finance.js |
| 健全性ダッシュボード | /sh/perf/dashboard | dashboard.js |
| Seller Hub全体 | /sh/ovw | nav.js |

### 共通ヘルパー
```javascript
function openEbay(path) {
  window.open('https://www.ebay.com' + path, '_blank', 'noopener');
}
```

---

## 無料トライアル管理設計（確定・2026-05-29追記）

### 対策構成
- trial_started_at：Supabaseのuser_settingsに記録
- trial_expires_at：trial_started_atから14日後に自動ロック
- ebay_seller_id：OAuth連携時に取得・一意キーとして保存
  → 同一seller_idは2度トライアル不可（メアド変更対策）
- 使い捨てメール対策・カード認証：SaaS化フェーズで追加

### ロック時のUI
- 機能をグレーアウト
- 「トライアル終了・プランを選択」画面に遷移
- eBay再連携しても seller_id が一致すれば解除不可

---

## LINEアラート設計（確定・2026-05-29追記）

### 採用方針
- LINE Messaging API採用（個人LINE・公式LINE両方に対応）
- 各ユーザーが自分のLINEをBRAND ANALYTICSに紐づける設計
- 個人LINEと公式LINE、どちらか一方または両方を登録可能

【UI修正依頼①】
オンボーディングツアーのボタン（←戻る / 次へ→）が
改行されて縦に並んでいる。横並びになるよう修正。
該当：js/ui/tour.js または関連CSS

【UI修正依頼②】
左サイドバーのナビゲーション項目（利益計算機・仕入れメーター・
取引記録など）の文字が暗くて見えない。
アクティブでない項目も読める明るさに修正。
該当：js/ui/nav.js または関連CSS

*最終更新: 2026-05-31 | 自動出品実装方針追記*

---

## 自動出品機能の実装方針（確定・2026-05-31）

### 難易度評価（Claude Code評価）
- タイトル自動生成：★★☆☆☆（Claude APIに投げるだけ）
- Item Specifics自動補完：★★★☆☆（Taxonomy API + Claude）
- VeROリスクスキャン：★★☆☆☆
- Sell Inventory APIでの実際の出品：★★★★★（最大の山）

### 出品の3ステップ（必須）
① createOrReplaceInventoryItem（商品情報登録）
② createOffer（価格・ポリシー・カテゴリ設定）
③ publishOffer（実際に出品）

### 実装順序（確定）
STEP 1：Compatible Application Growth Check申請（先決・絶対条件）
STEP 2：カテゴリ選択 + Item Specifics取得
STEP 3：Claude APIで自動補完 + 確認画面
STEP 4：createOrReplaceInventoryItem
STEP 5：createOffer + publishOffer
STEP 6：VeRO・品質チェック・下書き
STEP 7：写真URL・EPS API

### 重要な設計原則
・AI提案 → セラー確認 → OK → 出品の人間確認フローを絶対に維持する
・1件出品できれば残りは拡張という進め方で進む
・サンドボックスと本番の動作が一致しないことがあるため
　最終確認は必ず本番APIで行う
・審査が通ってから実装開始という順序を守る

---

## Compatible Application Growth Check 申請ノウハウ（2026-06-01）

申請先：https://developer.ebay.com/grow/application-growth-check

### 申請前に必ず揃えるもの

| 項目 | 必須度 | 備考 |
|---|---|---|
| eBay OAuthが本番で動作すること | 必須 | 動かないと審査デモができない |
| プライバシーポリシーのURL | 必須 | 審査フォームに入力欄あり |
| 利用規約のURL | 強く推奨 | |
| アプリのスクリーンショット | 推奨 | 主要画面5〜10枚 |
| 機能説明の英語サマリー | 推奨 | 審査はeBayの英語チームが行う |

### 審査説明文（英語・そのまま使える）

**Short description（1〜2文）:**
> BRAND ANALYTICS is a revenue management and account health tool for Japanese eBay sellers. It helps sellers accurately calculate profits, monitor account performance, and manage their eBay business — all in one place.

**Detailed description（審査フォームの詳細欄）:**
> This tool uses the eBay Finances API, seller_standards_profile API, and Browse API to help Japanese sellers understand their own data more clearly. It is not a competing marketplace. The purpose is to support eBay seller success by providing profit simulation, account health monitoring, competitive research, and AI-assisted listing optimization. All user data is handled with AES-GCM 256-bit encryption and Supabase Row Level Security. Client credentials are stored exclusively in server-side Edge Functions and never exposed to the frontend.

**日本語メモ（説明の骨格）:**
- 日本人eBayセラー向けの収益管理・アカウント健全性ツール
- Finances API・seller_standards_profile APIを使ってセラーが自分のデータを把握できる
- 競合マーケットプレイスの構築ではなく、eBayセラーの成功支援が目的
- Client Secretはフロントに置かずEdge Functionのみで使用
- AES-GCM 256bitでトークンを暗号化・Supabase RLSでユーザーデータを分離

### 審査で評価されるポイント（優先順）

1. **APIの正規利用**：スクレイピングなし・競合サービスでないこと
2. **セキュリティ**：Client Secretのサーバーサイド管理・暗号化
3. **ユーザー保護**：プライバシーポリシー・データ分離
4. **eBayへの貢献**：セラーが成功する = eBayの売上が増える構図
5. **動作するアプリ**：OAuth含め実際に動くデモが見せられること

### 審査の現実的なシナリオ

- 一発通過：50%
- 追加情報提出を求められて通過：25%
- 条件付き承認（一部スコープのみ）：15%
- 却下：10%（主な理由はコードではなくドキュメント不備）

### 申請タイミング（推奨）

```
eBay OAuth本番テスト完了
       ↓
プライバシーポリシー・利用規約を作成
       ↓
申請（← ここ）
       ↓
審査期間：1〜4週間が目安
       ↓
承認後：sell.inventoryスコープ追加・自動出品実装開始
```

