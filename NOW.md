# BRAND ANALYTICS｜現在地ノート
最終更新：2026/05/31

---

## 今やっていること
② eBay OAuthテスト → 🔄 進行中
　→ serveo.net（固定URL）で再開予定
　→ 次回開始コマンド：
　　 ssh -R brand-analytics:80:localhost:5500 serveo.net
　→ 固定URL：https://brand-analytics.serveo.net

## 次回セッション開始前に必ず実施（順番通りに）

□ ① Live Server起動
　cd "C:\Users\admin\OneDrive\Desktop\物販事業　一式\■会社関連\AI一式\claudcord一式\brand-analytics"
　npx live-server --port=5500

□ ② serveo.net起動（固定URL）
　ssh -R brand-analytics:80:localhost:5500 serveo.net
　→ 固定URL：https://brand-analytics.serveo.net

□ ③ eBay Developer Portal設定（初回のみ）
　RuName：StayGold_-StayGold-BRANDA-vplsttzs
　Auth accepted URL：https://brand-analytics.serveo.net/
　Auth declined URL：https://brand-analytics.serveo.net/

□ ④ Supabase Edge Function確認
　supabase functions list
　→ ebay-tokenが一覧に出ればOK
　→ 出なければ：supabase functions deploy ebay-token

□ ⑤ Supabase Edge Function Secrets確認
　Supabase Dashboard → Edge Functions → Secrets
　EBAY_CLIENT_ID と EBAY_CERT_ID が登録済みか確認

□ ⑥ ブラウザで開く
　https://brand-analytics.serveo.net
　→ サインイン → 「eBayを連携する」クリック
　→ URLに ?code=XXX&state=YYY が返れば成功！

## 過去のループ・失敗パターン（再発防止）
- localtunnelはURLが毎回変わるため使用禁止→serveo.net固定URL一択
- eBay PortalのラジオボタンはUI表示のみ・OAuth動作に無関係（変更不要）
- Portalの「テストサインイン」はレガシーフロー・OAuthテストにならない（使用禁止）
- callbackURLに/auth/ebay/callbackは不要→ルートURL（/）で動く
- Supabase設定なしではOAuthリダイレクトが拒否される

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

## 更新：2026/05/31

### 完了済み追加（本日）
✅ auth.js #1〜#6 修正・適用完了
　- #1 フォールバックRuName kdbpfux → vplsttzs
　- #2/#3 リフレッシュ失敗時のtier・UI上書き問題修正
　- #4 disconnectEbay() エラー処理追加
　- #5 BA.crypto.destroy() 重複呼び出し除去
　- #6 redirectTo のhash除去追加

### 設計変更（本日確定）
- X-06（17TRACK API）：廃止
　理由：Ship&co不使用のため不要
- X-07（SpeedPAK CSV）：送料テーブル設定に置き換え
　理由：手動CSV取り込みは非現実的
- 送料設計方針確定：
　①出品送料（表示額）②実送料コスト の2欄を
　設定ページに追加。重量帯ごとに一度設定→自動適用

### 保留決定
- #8（claude.js使用制限）：SaaS化時に再設計
- #7（claude.js JWT retry）：今回対象外

### 次にやること（更新）
① eBay OAuthテスト完了（最優先・変わらず）
② STAGE2：ベストオファーシミュレーター
③ STAGE2：返品コスト計算
④ 送料・関税テーブル設定（設計確定済み・実装待ち）
⑤ プライバシーポリシー・利用規約の作成
⑥ Compatible Application Growth Check申請
⑦ ~~17TRACK API連携~~ 廃止
⑧ ~~SpeedPAK送料請求CSVインポート~~ → X-09に置き換え
