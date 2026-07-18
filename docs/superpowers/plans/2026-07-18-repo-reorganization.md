# リポジトリ整理・CLAUDE.md憲法化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 業務素材をリポジトリ外へ退避し、CLAUDE.md（67KB）を憲法（約10KB）＋オンデマンド仕様書群（docs/specs/）に再構成する。

**Architecture:** ファイル移動（Task 1-2）→ 仕様切り出し（Task 3-4）→ CLAUDE.md書き換え（Task 5）→ 検証（Task 6）の一方向フロー。転記は原文維持・重複のみ統合。

**Tech Stack:** git / ファイル操作のみ（コード変更なし）

## Global Constraints

- **コミット禁止**：全タスク完了→完了報告→ユーザー承認後に**1コミット**で確定する（承認条件2）。タスク毎のコミットは行わない
- 転記は**原文維持**。要約・改変・整形は禁止。完全重複（eBaymag×3・eBay遷移最小化×2）のみ統合
- 素材退避先：`C:\Users\admin\OneDrive\Desktop\物販事業　一式\■会社関連\AI一式\claudcord一式\brand-analytics_資料\`（リポジトリ外）
- 行番号は 2026-07-18 時点の CLAUDE.md（66,908 bytes）基準。切り出し前に見出しgrepで再確認すること
- `context/skills.md` は変更しない（check:security の同期対象のため）

---

### Task 1: 資料フォルダ新設＋未追跡素材の退避

**Files:**
- Create: `..\brand-analytics_資料\`（リポジトリ外フォルダ）
- Move: 未追跡素材6点 / Delete: 不要ファイル2点

- [ ] **Step 1: 退避先フォルダ作成と移動**

```powershell
$dst = "C:\Users\admin\OneDrive\Desktop\物販事業　一式\■会社関連\AI一式\claudcord一式\brand-analytics_資料"
New-Item -ItemType Directory -Force $dst
Move-Item "3PP developer Standard API.pdf" $dst
Move-Item "APIキー　パスワード.docx" $dst
Move-Item "スクショ画像" $dst
Move-Item "フリサポ画像" $dst
Move-Item "渡す材料 2026.05.24" $dst
```

- [ ] **Step 2: 不要ファイル削除**

```powershell
Remove-Item "ClaudeCode起動方法.txt"   # 0バイト空ファイル
# 削除前に同一確認： fc "BRAND_ANALYTICS_v4_プロジェクト指示欄.md" "_archive\BRAND_ANALYTICS_v4_プロジェクト指示欄.md"
Remove-Item "BRAND_ANALYTICS_v4_プロジェクト指示欄.md"
```

- [ ] **Step 3: 検証**

`git status --short` で `??` の素材4項目が消えていること。`ls ..\brand-analytics_資料` で6項目あること。

### Task 2: git追跡ファイルの整理＋screenshots/新設

**Files:**
- Modify: `.gitignore`
- git rm --cached: `CLAUDE.md.docx` / git rm(移動): `files/index.html`, `design/auth-screen.html`

- [ ] **Step 1: CLAUDE.md.docx を追跡解除して退避**

```powershell
git rm --cached "CLAUDE.md.docx"
Move-Item "CLAUDE.md.docx" "..\brand-analytics_資料"
```

- [ ] **Step 2: 死んだコピーを _archive へ**

```powershell
New-Item -ItemType Directory -Force "_archive\files", "_archive\design"
git rm --cached "files/index.html", "design/auth-screen.html"
Move-Item "files\index.html" "_archive\files\"
Move-Item "design\auth-screen.html" "_archive\design\"
Remove-Item "files", "design"   # 空になったことを確認してから
```

- [ ] **Step 3: screenshots/ 新設＋.gitignore 更新**

`screenshots/` フォルダを作成。`.gitignore` の「# 秘密情報」ブロックの後に追記：

```
# UI確認用スクリーンショット（一時ファイル）
screenshots/

# 業務素材はリポジトリ外 ..\brand-analytics_資料\ に退避（2026-07-18）
*.docx
*.pdf
```

- [ ] **Step 4: 検証**

`git status --short` に `D  CLAUDE.md.docx` / `D  files/index.html` / `D  design/auth-screen.html` が出ること。`git ls-files | grep docx` が空。

### Task 3: docs/specs/ への仕様切り出し（CLAUDE.md原文転記）

**Files:** Create: `docs/specs/` 配下14ファイル（下表）

**Interfaces:** Produces: Task 5 の仕様参照表が参照するファイル名（下表のパス名を正とする）

- [ ] **Step 1: 行範囲マッピングに従い転記（原文コピー）**

| 新ファイル | 元CLAUDE.md行範囲（見出し） |
|---|---|
| `docs/specs/stage2-best-offer.md` | 246-283（ベストオファー価格シミュレーション） |
| `docs/specs/stage2-returns-cost.md` | 284-305（返品コスト計算） |
| `docs/specs/stage2-repricing.md` | 306-337（自動値下げ機能） |
| `docs/specs/stage2-shipping-calc.md` | 338-364（発送料自動計算） |
| `docs/specs/stage2-auto-listing.md` | 365-550（自動出品）＋1583-1613（実装方針・STEP順序）を末尾に連結 |
| `docs/specs/stage3-research.md` | 551-895（STAGE3競合リサーチ〜成約データ方針〜リサーチ画面UI〜パイプライン〜DBスキーマ〜sold A案検証） |
| `docs/specs/health-prediction.md` | 905-950（アカウント健全性予測） |
| `docs/specs/dashboard-final-profit.md` | 951-993（最終利益2層設計） |
| `docs/specs/claude-api-platform.md` | 994-1143（Claude API統合基盤・機能リスト・コスト管理・収益化モデル） |
| `docs/specs/policy-monitoring.md` | 1144-1245（eBayポリシー自動監視・VeRO監視） |
| `docs/specs/ebaymag.md` | 1246-1300（1本目）を基礎に、1365-1391（2本目）を連結。1492-1517（3本目）は2本目とdiffし独自行（`ebaymag.com/?locale=ja` 等）のみ反映 |
| `docs/specs/admin-panel.md` | 1301-1364（パネル仕様）＋1425-1432（監視設計・確定ミニブロック）＋1433-1491（監視設計・追記版）を連結 |
| `docs/specs/ops-misc.md` | 1392-1424（eBay遷移最小化・1本目）＋1545-1560（無料トライアル管理）＋1561-1567（LINEアラート）。1518-1544（遷移最小化2本目）はdiffし独自行のみ反映 |
| `docs/specs/growth-check.md` | 1614-末尾（Growth Check申請ノウハウ） |

各ファイル冒頭に1行だけ付記：`*CLAUDE.md から分離（2026-07-18）・内容は原文維持*`

- [ ] **Step 2: 転記漏れ検証**

元CLAUDE.mdの `##`/`###` 見出し一覧を取り、各見出しが「新CLAUDE.mdに残留」「docs/specs/へ転記」「context/specs.mdへ転記（Task 4）」「重複統合により吸収」のいずれかに分類されることを表で確認。未分類ゼロ。

### Task 4: context/specs.md へ実装済みUI仕様を吸収

**Files:** Modify: `context/specs.md`（末尾に追記）

- [ ] **Step 1: 転記**

CLAUDE.md の以下4セクションを `context/specs.md` 末尾に原文追記：
- 133-155（費用内訳カード空状態の表示仕様）
- 156-204（設定ページコンテンツ仕様）
- 209-226（ROI表示 ✅実装済み）
- 227-245（送料・関税の入力方式3択）

- [ ] **Step 2: 検証**

`grep` で「費用内訳カード」「設定ページ」「ROI表示」「入力方式（3択）」の4見出しが context/specs.md に存在すること。

### Task 5: CLAUDE.md 憲法化

**Files:** Modify: `CLAUDE.md`（全面書き換え・目標約10KB）

- [ ] **Step 1: UI修正依頼①②の生死確認**

CLAUDE.md 1568-1581 の【UI修正依頼①】（tour.jsボタン改行）②（nav文字が暗い）について、`js/ui/tour.js`・`js/ui/nav.js`・CSS と `git log --oneline -- js/ui/tour.js js/ui/nav.js` を確認。修正済みの証跡があれば削除、なければ `ISSUES.md` 末尾に移記（削除はしない）。

- [ ] **Step 2: 新CLAUDE.md を構成**

残す章（原文維持・この順）：
1. ナビゲーション・機能名称（確定）＋設計思想＋⚠️リサーチ実装方針（6-53行）
2. セッション開始時の必須手順（54-61行）— ただし design-philosophy.md の行を「**UI実装・修正時に必ず読む**（毎セッションではない）」に変更
3. ⚡自動実行ルール（62-77行）— トリガー表に1行追加：`HTML/CSS/JSのUI部分を変更・新規実装する前 | context/design-philosophy.md を読む`
4. スキル管理（78-86行）
5. 詳細仕様の@import（87-96行）— `@context/design-philosophy.md` を削除し4ファイルに絞る
6. **仕様参照表（新設）**：

```markdown
## 仕様参照表（実装前に該当MDを必ず読む）

| 実装対象 | 読むファイル |
|---|---|
| ベストオファーシミュレーター | docs/specs/stage2-best-offer.md |
| 返品コスト計算 | docs/specs/stage2-returns-cost.md |
| 自動値下げ（repricing.js） | docs/specs/stage2-repricing.md |
| SpeedPAK送料自動計算 | docs/specs/stage2-shipping-calc.md |
| 自動出品（auto-listing.js） | docs/specs/stage2-auto-listing.md |
| ブランドリサーチ・STAGE3全般 | docs/specs/stage3-research.md |
| アカウント健全性予測 | docs/specs/health-prediction.md |
| ダッシュボード最終利益2層 | docs/specs/dashboard-final-profit.md |
| Claude API統合基盤 | docs/specs/claude-api-platform.md |
| eBayポリシー監視・VeRO | docs/specs/policy-monitoring.md |
| eBaymag連携 | docs/specs/ebaymag.md |
| 管理者パネル | docs/specs/admin-panel.md |
| トライアル・LINE・eBay遷移 | docs/specs/ops-misc.md |
| Growth Check申請 | docs/specs/growth-check.md |
| UI実装・修正（全般） | context/design-philosophy.md |
| 実装済みUI仕様（費用内訳・設定・ROI） | context/specs.md |
```

7. 障害対応プロトコル（97-132行）
8. 追加機能のSTAGE別実装順序（896-904行）
9. 末尾に更新履歴1行：`*2026-07-18: 憲法化。機能仕様は docs/specs/ に分離（原文維持）*`

- [ ] **Step 3: 検証**

`wc -c CLAUDE.md` が15KB以下。`@context` の import が4行のみ（design-philosophy なし）。

### Task 6: 全体検証＋完了報告

- [ ] **Step 1: 参照表パスの実在確認**

新CLAUDE.mdの参照表の全パスを `Test-Path` で確認。全て True。

- [ ] **Step 2: セキュリティチェック**

`npm run check:security` → PASS（skills.md無変更のため）。

- [ ] **Step 3: 消失ゼロ確認**

退避先6項目＋`_archive`2項目の存在確認。`git status --short` の全行が意図した変更（D×3・M×2程度・?? は docs/specs/ と docs/superpowers/ のみ）であること。

- [ ] **Step 4: ロード量測定と完了報告**

新CLAUDE.md＋@import 4ファイルの合計バイト数を測定し、旧比（約114KB）の削減率を報告。変更一覧を提示し**コミット承認を求める**（コミットメッセージ案：`refactor: リポジトリ整理・CLAUDE.md憲法化（素材退避・仕様をdocs/specs/に分離）`）。

- [ ] **Step 5: （承認後）1コミット実行 → push → 後続の C:\dev clone-fresh 移設へ**

- [ ] **Step 6: （新セッション・条件3）参照表実地テスト**

UI変更タスクを1件実行し、design-philosophy.md をオンデマンドで読みに行くことを確認する。
