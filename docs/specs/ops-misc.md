*CLAUDE.md から分離（2026-07-18）・内容は原文維持*
*eBay遷移最小化（旧CLAUDE.mdに2重記載・1本目が完全上位互換のため1本目を採用）＋トライアル管理＋LINEアラート*

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
