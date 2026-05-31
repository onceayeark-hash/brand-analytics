# BRAND ANALYTICS｜現在地ノート
最終更新：2026/05/30

---

## 今やっていること
② eBay OAuthテスト → 🔄 進行中
　→ serveo.net（固定URL）で再開予定
　→ 次回開始コマンド：
　　 ssh -R brand-analytics:80:localhost:5500 serveo.net
　→ 固定URL：https://brand-analytics.serveo.net

## 次回セッション開始前に必ず実施
・Supabase Dashboard → Authentication → URL Configuration
　- Site URL：https://brand-analytics.serveo.net
　- Redirect URLs：https://brand-analytics.serveo.net/**
・eBay Developer Portal → RuName vplsttzs の Auth accepted URL
　→ https://brand-analytics.serveo.net/ に更新

## 確定したeBay設定値
- 使用RuName：StayGold_-StayGold-BRANDA-vplsttzs（OAuth用・新規作成）
- 旧RuName（kdbpfux）：Auth'n'Auth専用のため使用しない
- Client ID（生産）：StayGold-BRANDANA-PRD-7183f64d5-3fad581c
- config.local.js：EBAY_REDIRECT_URI更新済み（vplsttzs）

## 次にやること（優先順）

① eBay OAuthテスト完了（最優先）
　→ serveo.net起動
　→ サインイン → 「eBayを連携する」
　→ URLに ?code=XXX&state=YYY が返れば成功

② STAGE2：ベストオファーシミュレーター
③ STAGE2：返品コスト計算
④ 送料・関税テーブル設定
⑤ プライバシーポリシー・利用規約の作成
⑥ Compatible Application Growth Check申請
⑦ 17TRACK API連携（STAGE2後半）
⑧ SpeedPAK送料請求CSVインポート（STAGE2後半）

## 完了済み（STAGE1）
✅ 認証バグ2件修正
✅ ROI表示
✅ 費用内訳カード空状態表示
✅ 設定ページ実装・DeepL削除
✅ P-01 eBay手数料Cap修正
✅ Finances API接続
✅ Supabaseスキーマ PHASE 0完了
✅ D-01：粗利計算式修正
✅ D-02：健全性API接続確認
✅ F-01〜F-03：ファイナンス表示修正
✅ ダーク/ライトモード統一

## 完了済み（STAGE2着手）
✅ Claude API統合基盤実装
✅ VS Codeインストール・brand-analytics接続済み
✅ cloudflared導入済み（npx cloudflared tunnel --url http://localhost:5500）

## 未解決・保留中
- eBay OAuthテスト未完了（serveo.netで次回再開）
- 自動出品STAGE2着手時：他社ツール参考画像確認後に設計
- ZIK Analytics API統合：STAGE4検討
- FedEx/DHL API申請：STAGE2後半着手時

## 懸念点
- D-02：tracking指標キー名（TRACKING_NOT_UPLOADED）→OAuth接続後に実機確認
- D-04：送料・関税カラム未追加（DDP対応・スキーマ拡張が必要）
- Compatible Application Growth Check申請→SaaS公開前に必須
　https://developer.ebay.com/grow/application-growth-check
