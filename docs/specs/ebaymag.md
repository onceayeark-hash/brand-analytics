*CLAUDE.md から分離（2026-07-18）・内容は原文維持*
*旧CLAUDE.mdに3重記載されていたeBaymag連携設計を統合（1本目＋2本目全文＋3本目の独自行1点を注記）*

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


※3本目の記載より：「eBaymagで多国展開」ボタンのリンク先は ebaymag.com/?locale=ja とする
