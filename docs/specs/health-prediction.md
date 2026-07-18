*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

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

