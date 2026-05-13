# Lessons — セッション間の学習記録

> Claude Codeはセッション開始時にこのファイルを読み、同じ指摘を繰り返さないこと。
> 修正・指摘があった場合は都度ここに追記する。

---

## フォーマット
```
### YYYY-MM-DD
- [ファイル or 機能] 指摘内容 → 正しいアプローチ
```

---

<!-- ここから下に記録を追加 -->

### 2026-05-13
- [デザイン全体] 現行ダークテーマは重厚感があり良いが、清潔感・スムーズ感が不足 → ライトモード（eBayライクなホワイトベース）との切り替えモードを実装する
  - ダーク: 現行のネイビー×ゴールド（glassmorphism）を維持
  - ライト: ホワイトベース × ゴールドアクセント（清潔感・スムーズ感を優先）
  - UIにダーク/ライト切り替えトグルを配置（OSの設定画面にあるようなスライドボタン型）
  - CSS変数（:root / [data-theme="light"]）で一元管理する

### 2026-05-14
- [CSS全体] UIは論理ピクセル（CSSピクセル）で設計すること。8dp Gridルール（8の倍数）を守る
  - ボタン・input・select に min-height:44px（Apple HIG 最小タップ領域）を必ず付与する
  - padding は 4dp 単位（4, 8, 12, 16, 20, 24...）まで許容。9px・14px・22px などは NG
  - gap は 8px か 12px・16px に統一（10px は 8 か 12 に丸める）
  - 新規コンポーネントは最初から 8dp Grid で設計する
- [auth.js] _ensureValidToken のトークンリフレッシュを直接 eBay API に投げていた → Cert ID（Client Secret）はフロントに置けないため必ず Edge Function（ebay-token）経由にする
- [init順序] BA.crypto.init() は async なので await が必要。await BA.crypto.init() → await BA.auth.init() の順を必ず守る
