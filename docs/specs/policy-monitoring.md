*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

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

