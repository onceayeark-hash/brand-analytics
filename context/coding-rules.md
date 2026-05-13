# コーディング規約

## 基本ルール
- `const` / `let` のみ使用（`var` 禁止）
- クラスベース or モジュールパターンで統一
- エラーハンドリングは**全APIコールに必須**
- `console.log` はデバッグ後に必ず削除
- コメントは日本語OK
- `Promise.all()` 禁止 → `Promise.allSettled()` 使用
- タイムアウトは `AbortController` で実装

## APIリトライ仕様（確定）
```javascript
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: [1000, 2000, 4000],  // 指数バックオフ
  timeoutMs: 10000,                // タイムアウト10秒
};
// 並列処理: Promise.allSettled() 統一（Promise.all() 禁止）
```
