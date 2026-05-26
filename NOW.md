# BRAND ANALYTICS｜現在地ノート
最終更新：2026/05/26

---

## 今やっていること
競合リサーチ機能の設計方針を確定
→ CLAUDE.mdのSTAGE3仕様を書き直し済み
→ 次はROI表示から実装フェーズへ

---

## 次にやること（優先順）

① ROI表示を利益計算機に追加
　→ CLAUDE.mdに仕様記載済み
　→ 黒いClaudeに実装指示を出す
　→ 難易度低・今すぐできる

② 費用内訳カードの空状態表示を実装
　→ CLAUDE.mdに仕様記載済み
　→ 黒いClaudeに実装指示を出す

③ 設定ページのコンテンツを実装
　→ CLAUDE.mdに仕様記載済み
　→ 黒いClaudeに実装指示を出す

④ P-01：eBay手数料の上限Cap（$750）修正
　→ 高額商品で計算誤差が出るため早期対応推奨

⑤ api.js の実装
　→ Finances API接続の前提条件

⑥ cache.js の実装
　→ Finances API接続の前提条件

⑦ Supabaseスキーマの適用（PHASE 0）
　→ ユーザー側作業

⑧ Finances API接続（X-01）
　→ transactions・dashboard・financeが自動化

---

## 直近の決定事項
- DeepL API採用確定
- ファイル管理ルール確立
- NOW.md・ISSUES.mdをセッション引継ぎ用として運用
- eBay Trading APIはスコープ申請不要と確認

## 2026/05/26 競合リサーチ設計確定
- Terapeak CSV：エクスポート不可（恒久確定）
- Marketplace Insights API：実装対象外（恒久確定）
- Terapeak専用API：一般公開なし（恒久確定）
- STAGE3設計：Browse API（自動）＋手動補完のハイブリッド方式
- STAGE4候補：ZIK Analytics API統合

## 2026/05/26 追加実装機能確定（既記載）
- ROI表示（即時実装）
- ベストオファーシミュレーション（STAGE2前半）
- 返品コスト計算（STAGE2前半）
- 自動値下げ機能（STAGE2後半・Trading API利用）
- 発送料自動計算・SpeedPAK連携（STAGE2後半）
- 競合リサーチ・国別選択（STAGE3・Browse API方式）

## 2026/05/26 デザインセッション完了内容
- design-philosophy.mdに⑫〜⑮を追記
- CLAUDE.mdに費用内訳・設定ページの仕様を追記
- デザイン修正6件を完了

---

## 未解決・保留中
- 自動出品：STAGE2まで本格実装なし
- Payoneer直接連携：現実的でないと判断済み
- FedEx/DHL APIの申請：STAGE2後半着手時に実施
- ZIK Analytics API統合：STAGE4検討

---

## 懸念点
- api.js・cache.jsが未実装のためFinances API接続がまだできない
- Supabase PHASE 0（スキーマ適用）がユーザー側で未完了

---

## 機能別評価サマリー
| 機能 | 価値 | 優先度 |
|------|------|--------|
| サインイン・認証 | 高 | ✅ バグ2件修正済み |
| 利益計算機・PPD | 高 | ROI追加が次の一手 |
| 仕入れメーター | 低〜中 | STAGE3完成で価値向上 |
| 取引記録 | 中 | Finances API後に再設計 |
| ダッシュボード | 中 | 粗利計算式修正が最優先 |
| ファイナンス | 中 | Finances API後に価値最大化 |
| アカウント保護 | 低 | 実態修正・差別化再設計 |
| 自動出品 | 未完 | STAGE2で本格実装 |
| 競合リサーチ | 未実装 | STAGE3・Browse API方式で設計確定 |
