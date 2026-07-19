# BRAND ANALYTICS — 実装指示書
## Claude Code: このファイルを最初に読み込んでから実装を開始すること

---

## ナビゲーション・機能名称（確定・2026-06-02）

| 旧称 | 確定名称 | ファイル | 備考 |
|---|---|---|---|
| 仕入シミュレーター | **仕入シミュレーター** | profit.js | 表示名変更・ファイル名は実装時に変更 |
| （新規） | **ブランドリサーチ** | research.js（新規） | STAGE3で実装 |
| 仕入れメーター | 仕入れメーター | sourcing.js | 変更なし |

### ナビゲーション構成（STAGE3実装後・確定）

```
【アナリティクス】        ← 起動時にここが最初に表示される
  ダッシュボード          ← デフォルト画面（今月粗利・健全性・アラート）
  ファイナンス
  アカウント保護

【ツール】
  仕入シミュレーター      ← 旧：利益計算機
  ブランドリサーチ        ← STAGE3新規
  取引記録

【設定】
  設定
```

**設計思想：** 開いた瞬間に「自分のビジネスの現状」が見える。アナリティクスで現状把握 → ツールで行動、という流れを視覚的に作る。空白の計算フォームをデフォルト画面にしない。

**廃止：** 仕入れメーター → ブランドリサーチに機能吸収・タブ削除
**廃止：** GO/NO-GO → 「仕入れ可能価格帯 ¥X〜¥Y」に置き換え。判断は常にセラー。

### ブランドリサーチ → 仕入シミュレーター の橋
ブランドリサーチのヒストグラムに「この価格で計算する →」ボタンを設置。
押すと中央値が仕入シミュレーターに自動入力されてタブが切り替わる。

### nav.js 実装変更（次の実装セッションで対応）
- ダッシュボードをデフォルト表示パネルに変更
- ナビにセクション区切り「アナリティクス」「ツール」「設定」を追加
- 仕入れメーターのタブを削除
- ブランドリサーチタブは **Growth Check 通過・Marketplace Insights API 承認後** に追加

### ⚠️ リサーチ機能の実装方針（2026-06-03 確定）
ブランドリサーチ・競合リサーチ機能は **本体から分離・保留**。
URL fetch（ツールが eBay に HTTP リクエスト送信）は **ToS 違反のため実装しない**。
sold データの合法的自動取得手段が存在しないことが検証により確認済み。
→ 詳細：`docs/RESEARCH_DECISION.md` 参照

---

## セッション開始時の必須手順
1. `tasks/lessons.md` を読み、過去の指摘事項を確認する
2. 以下の詳細仕様を参照する
3. `context/skills.md` の実装タイミング表と **⚡自動発動ルール** を確認する

> **`context/design-philosophy.md`（UI設計哲学書）は毎セッションではなく、UI実装・修正に着手する前に必ず読む**（下記⚡ルール参照・オンデマンド化 2026-07-18）

---

## ⚡ 自動実行ルール（ユーザーが指示しなくても Claude が必ず実行する）

> 以下は「提案」ではない。発動条件を満たしたら Claude が自律的に実行する強制ルール。
> ユーザーが「レビューして」「確認して」「監査して」と言わなくても実行すること。

| トリガー | 自動実行するスキル |
|---|---|
| HTML / CSS / JS の UI 部分を変更・新規実装する**前** | `context/design-philosophy.md` を読む（オンデマンド必読） |
| 任意の機能実装が完了したとき | `code-review:code-review` |
| `auth.js` / `crypto.js` / トークン・OAuth 処理を変更したとき | `everything-claude-code:security-review` |
| HTML / CSS / JS の UI 部分を変更・新規実装したとき | `hallmark audit <変更ファイル名>` |
| UI変更の完了宣言前 | design-philosophy.md ㉑-F のUI自己チェック4項目（claude-in-chrome/Playwright-mcp） |
| 「実装完了」「完了しました」と言う直前 | `superpowers:verification-before-completion` |

**詳細な実行順序・結果処理ルールは `context/skills.md` の ⚡ 自動発動ルールセクションに定義されている。**

---

## モデル使い分けルール（セッション消費の最適化・2026-07-18）

> Fable 5 はセッション消費が速い。**高リスク・高難易度の実装に温存**し、それ以外は Opus / Sonnet 5 を使う。

### セッション本体（切替は `/model` によるユーザー操作）

| 作業タイプ | 推奨モデル |
|---|---|
| **高リスク・高難易度**：auth.js / crypto.js / トークン・OAuth・Edge Function のセキュリティ実装、DBスキーマ・マイグレーション、利益計算ロジックの新規設計、複数ファイル横断の大規模リファクタ、アーキテクチャ設計判断 | **Fable 5** |
| 通常の機能実装・UI実装・中規模バグ修正 | **Opus**（`/fast` で高速化可・格下げなし） |
| 定型作業：ドキュメント整理・転記・小修正・調査・進捗確認・スタイル調整 | **Sonnet 5** |

**発火手順（Claude が自律実行）：**
1. セッション開始時・新タスク受領時に上表で作業タイプを判定する
2. 現在のモデルと不一致なら、**作業着手前に**「この作業は ○○ が適切です。`/model ○○` で切替を推奨します」と1回だけ提案する
3. 切替はユーザー操作のため、提案後は現行モデルのまま作業を継続してよい（提案の繰り返しは禁止）
4. 1セッション内で作業タイプが「高リスク」へ格上がりした場合（例：軽微修正のつもりが auth.js に波及）も同様に提案する

### サブエージェント（Claude が Agent の model パラメータで自動指定）

| 用途 | model 指定 |
|---|---|
| 調査・探索（Explore 等） | `sonnet` |
| code-review（⚡ルールA） | `opus` |
| security-review（⚡ルールB・auth/crypto関連） | `fable` または `opus` |
| 定型・大量の機械的処理 | `haiku` または `sonnet` |

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
@context/architecture.md
@context/coding-rules.md

> `context/design-philosophy.md` は自動読込から除外（2026-07-18）。UI実装・修正時に⚡ルールに従いオンデマンドで読む。

---

## 仕様参照表（実装前に該当MDを必ず読む）

> 機能仕様は CLAUDE.md から `docs/specs/` に分離済み（2026-07-18・原文維持）。
> 該当機能に着手する前に、対応するMDを必ず読み込むこと。

| 実装対象 | 読むファイル |
|---|---|
| ベストオファーシミュレーター | `docs/specs/stage2-best-offer.md` |
| 返品コスト計算 | `docs/specs/stage2-returns-cost.md` |
| 自動値下げ（repricing.js） | `docs/specs/stage2-repricing.md` |
| SpeedPAK送料自動計算 | `docs/specs/stage2-shipping-calc.md` |
| 自動出品（auto-listing.js） | `docs/specs/stage2-auto-listing.md` |
| ブランドリサーチ・STAGE3全般 | `docs/specs/stage3-research.md` |
| アカウント健全性予測 | `docs/specs/health-prediction.md` |
| ダッシュボード最終利益2層 | `docs/specs/dashboard-final-profit.md` |
| Claude API統合基盤 | `docs/specs/claude-api-platform.md` |
| eBayポリシー監視・VeRO | `docs/specs/policy-monitoring.md` |
| eBaymag連携 | `docs/specs/ebaymag.md` |
| 管理者パネル | `docs/specs/admin-panel.md` |
| トライアル・LINE・eBay遷移最小化 | `docs/specs/ops-misc.md` |
| Growth Check申請 | `docs/specs/growth-check.md` |
| UI実装・修正（全般） | `context/design-philosophy.md` |
| 実装済みUI仕様（費用内訳カード・設定ページ・ROI・送料関税3択） | `js/features/CLAUDE.md`（自動読込） |

---

## 障害対応プロトコル

> 2026-07-19: `.claude/skills/error-diagnosis/` へ移設。ユーザーからエラー・障害報告を
> 受けたときは `error-diagnosis` スキルが自動発動する。

---

## 追加機能のSTAGE別実装順序

STAGE1完了前：ROI表示 ✅
STAGE2前半　：ベストオファーシミュ・返品コスト計算・Claude API統合基盤
STAGE2後半　：自動値下げ・発送料自動計算・自動出品
STAGE3　　　：競合リサーチ・国別選択・一括修正・写真管理

---


*2026-07-18: 憲法化。機能仕様は docs/specs/ に分離（原文維持）*
