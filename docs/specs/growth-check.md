*CLAUDE.md から分離（2026-07-18）・内容は原文維持*

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

