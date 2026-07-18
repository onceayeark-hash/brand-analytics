*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

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

