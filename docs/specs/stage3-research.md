*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

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
　・成約率・PPD・価格帯・マーケットプレイス別データを自動分析してサマリー生成
　・蓄積するたびにトレンド追跡が可能になる（ツールの核心的価値）

② Growth Check後：Marketplace Insights API申請
　・eBay公式の成約データAPI・審査通過後に即申請

③ STAGE4：ZIK Analytics API
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

#### リサーチ画面 UI 仕様（確定・2026-06-02）

##### ブランド選択（最上段）

| 要素 | 仕様 |
|---|---|
| プリセットリスト | Louis Vuitton / Chanel / Gucci / Hermès / Prada / Balenciaga / Fendi / Celine / Dior / Burberry / Coach / Rolex / Cartier（随時追加） |
| カスタム追加 | リストにないブランドは自由入力で追加可能 |
| 連動 | ブランド選択 → そのブランドの terapeak_snapshots・research_items が自動絞り込み表示 |

##### キーワード・型番検索

- 自由入力欄（例：Neverfull・2wayショルダー等）
- ブランド × キーワードで蓄積データを横断検索

##### 絞り込みフィルターバー（Terapeak UI 準拠・日本語化）

```
[ 状態 ▾ ] [ 形式 ▾ ] [ 価格 ▾ ] [ 評価 ▾ ]  ☐ 日本出品者のみ  [ リセット ]
```

**状態フィルター**（チェックボックス複数選択）
- □ 新品 / □ 未使用に近い / □ 中古 / □ 非常に良い / □ 良い / □ 可 / □ ジャンク

**形式フィルター**（チェックボックス複数選択）
- □ オークション / □ ベストオファー対応 / □ 固定価格

**価格フィルター**: $ [最小] 〜 $ [最大]（空欄で全範囲）

**評価フィルター**（ラジオ）: すべて表示 / 最高評価のみ / 最高評価を除外

**日本出品者のみ（独立チェックボックス）**
- ☐ 日本出品者のみ（デフォルト：チェックなし = 全世界）
- Terapeak の「その他フィルター > 出品者の所在地 > Japan」を独立させた設計
- 理由：同業日本セラーとの比較が主目的のため 1クリックで切り替えられるべき

##### 並び替え
- 価格：高い順 / 安い順 / 日付：新しい順 / 古い順 / 販売額：高い順 / 安い順

##### 取り込みボタン（Browse API は on-demand のみ）

```
[ 出品中 ] [ 販売済み※ ] [ 両方 ]  →  [ 検索・取り込む ]
```
- **出品中**: Browse API を on-demand で呼び出し → 上位200件取得・保存（itemId 重複除外）
- **販売済み**: Terapeak CSV アップロードへ誘導（Browse API では取得不可）
- **更新ボタン**: 再検索時は新着のみ追加（既存 itemId はスキップ）
- ※Browse API の自動・定期実行はしない。ユーザーが検索したときのみ on-demand で取得

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

#### データアーキテクチャ（確定・2026-06-02）

**蓄積の核心は Terapeak CSV。Browse API は補助的 on-demand 利用。**

FX のヒストリカルデータと同じ考え方：
- 実際に約定した取引データ（= Terapeak 成約データ）が本物のローソク足
- 出品中価格（= Browse API）は気配値に過ぎず、売れるとは限らない

| データ種別 | 取得方法 | 役割 |
|---|---|---|
| **成約データ（核心）** | Terapeak CSV 定期アップロード（月1〜週1） | 時系列トレンド・成約率の蓄積 |
| **出品中データ（補助）** | Browse API on-demand（ユーザーが検索したときのみ） | 今の競合状況を瞬時に確認 |

**蓄積の価値：** Terapeak CSV を繰り返しアップロードするほど、同一ブランド・同一モデルの時系列データが積み上がる。これは Terapeak 単体では見えない「トレンド推移」であり、ツールの最大の差別化になる。

#### 入力（合法ルートのみ）

| 入力方法 | 内容 | 規約根拠 |
|---|---|---|
| Terapeak CSV | ユーザーが Terapeak からエクスポートしたCSVをアップロード → Claude が構造化・保存 | ユーザー自身のデータ操作・合法 |
| Browse API | ユーザーが検索を実行したときのみ on-demand で取得（自動・定期実行はしない） | eBay 公式 API・合法 |
| ユーザー貼付 | ユーザーが手動でページを開き、テキストまたはスクショを貼る → Claude API で構造化 | C-06 準拠：アクセスはユーザー、ツールは読むだけ |

**⚠️ URL 自動 fetch 禁止：** 「URL を貼ると自動取得」は C-06 違反。UI で「URL ではなくページ内容のテキストを貼ってください」と明示ガードを設けること。

#### 処理フロー
```
① 入力（Terapeak CSV / Browse API on-demand / ユーザー貼付）
② Claude API で構造化（商品名・状態・価格・成約率・カテゴリ）
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
-- Terapeak CSV 1回分のスナップショット（蓄積・トレンド追跡の核心）
CREATE TABLE terapeak_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users NOT NULL,
  keyword             text NOT NULL,
  marketplace         text NOT NULL,  -- 'EBAY_US'|'EBAY_AU'|'EBAY_GB'|'EBAY_DE'|'EBAY_CA'|'EBAY_IT'|'EBAY_FR'|'EBAY_ES'
  search_date         date NOT NULL,
  sell_through_rate   numeric(5,2),   -- 成約率（%）
  avg_sold_price_usd  numeric(10,2),  -- 平均成約価格
  avg_days_to_sell    numeric(5,1),   -- 平均販売日数
  total_sold          integer,        -- 成約件数
  total_listed        integer,        -- 出品件数
  price_range_min_usd numeric(10,2),
  price_range_max_usd numeric(10,2),
  raw_csv_data        jsonb,          -- Claude が抽出した元データ
  claude_summary      text,           -- Claude が生成したサマリー
  created_at          timestamptz DEFAULT now()
);

-- 仕入れ候補リスト（GO/NO-GO の判断と結果を蓄積）
CREATE TABLE research_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users NOT NULL,
  marketplace          text NOT NULL DEFAULT 'EBAY_US',
  source_type          text NOT NULL CHECK (source_type IN ('browse_api','user_paste')),
  source_label         text,          -- UI表示用（C-07③ 視覚分離）
  source_url           text,
  terapeak_snapshot_id uuid REFERENCES terapeak_snapshots(id),
  product_name         text NOT NULL,
  condition            text,
  ebay_category        text,
  list_price_usd       numeric(10,2),
  cost_price_jpy       integer,
  profit_usd           numeric(10,2),
  margin_pct           numeric(5,2),
  roi_pct              numeric(5,2),
  go_nogo              text CHECK (go_nogo IN ('go','nogo','review')),
  go_nogo_reasons      jsonb,
  vero_risk            boolean DEFAULT false,
  vero_note            text,
  outcome              text CHECK (outcome IN ('bought','sold','passed','pending')),
  user_notes           text,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE terapeak_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_snapshots" ON terapeak_snapshots USING (user_id = auth.uid());
CREATE POLICY "users_own_research"  ON research_items     USING (user_id = auth.uid());
```

**`terapeak_snapshots` が蓄積の核心:**
- 同じキーワード・ブランドを異なる日付・マーケットプレイスでアップロードするたびに行が増える
- `search_date` × `marketplace` × `keyword` で時系列トレンドを自動生成
- `outcome` で「GO判定→実際に買った→実際に売れた」まで追跡
- データを取得するほど半永久的に価値が高まる（FX ヒストリカルデータと同じ考え方）

#### 技術レビュー所見（2026-06-02・確定）
- **蓄積の核心 = Terapeak CSV**（成約した本物のデータ）。Browse API は気配値に過ぎない
- 同業者は全員 Terapeak を使っている → 全員が同じ起点から始められる
- Browse API は自動・定期実行せず on-demand のみ。自動化のコストと価値が釣り合わない
- 「消えた出品 = 成約」追跡は**廃止確定**（取り下げ・期間切れと区別不可）
- ユーザー貼付→Claude 構造化: テキストで 85-95%・スクショで 75-90%
- connected tier の月 50 回制限がリサーチ用途でボトルネックになる可能性 → SaaS 化時に再検討

#### sold データ取得 A案 検証所見（2026-06-02・確定）

**A案の概要：**
ユーザーが eBay の sold 検索ページをブラウザで開き HTML 保存 → ツールに渡す → Claude が構造化

**検証結果：A案は現実的。暫定採用。Growth Check 後に Marketplace Insights API へ移行。**

##### 抽出精度
- **Complete HTML 保存**（ウェブページ、完全）を使用。「HTML のみ」保存は JS レンダリング欠落で不可
- 商品名 90-95%・価格 90-95%・画像 URL 85-90%・コンディション 80-90%
- 1ページ最大 240 件（URL に `_ipg=240` 追加）
- コスト：1ページあたり $0.02 未満（問題なし）

##### データ品質・必須実装
- **`LH_BIN=1` フィルター推奨**（固定価格のみ）→ 未払いオークション混入を排除
- 90日制限あり → UI に「過去90日のデータ」と明示
- 外れ値除去：IQR 法（下限 Q1-1.5×IQR / 上限 Q3+1.5×IQR）をデフォルト適用
- 「○個売れました」は累計数のため「販売実績（累計・参考）」として表示
- 回転日数の単品計算は不可 → 「週次販売率（推定）」で代替表示

##### 規約適合
- C-06：ユーザーが操作主体・ツールは eBay に一切アクセスしない → スクレイピング非該当
- C-07③：`source: 'ebay_sold_search'` ラベルで視覚的分離
- UI に「手動取得・自動ツール禁止」の注意喚起を必ず表示（RES-15）

##### 移行パス（スキーマ互換）
```
今（STAGE3）
  ユーザーが HTML 保存 → Claude 抽出 → research_items に保存

Growth Check 通過後
  Marketplace Insights API（buy.marketplace.insights）が自動取得
  → 同じ research_items テーブルに保存（移行コストゼロ）
```

#### 関連 ISSUES: S-01 / S-04 / X-04 / X-05 / X-08 / RES-13 / RES-14 / RES-15

---

