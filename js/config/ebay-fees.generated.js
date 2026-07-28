// ============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND
// ★GENERATED — 手で編集しない。値の変更は正本(config/fees/ebay.json)を更新し本スクリプトを再実行する（決定194・判断B）。
// 正本: shiire-intelligence/config/fees/ebay.json
//   source_sha256: d5eacbb2ddacc2e22f64a548383777329e01a76bcc6ea57c6e525551971835e1
//   source_mtime:  2026-07-28T16:45:12.210Z
//   generated_at:  2026-07-28T16:55:18.644Z
//   generator:     shiire-intelligence/scripts/sync-ebay-fees.js
// ★UI(profit.js)とツール(ceilingEngine)で天井が食い違ったら、まず source_sha256 を
//   正本のハッシュと突合＝一致すれば「計算式の差」、不一致なら「同期し忘れ」。
// ============================================================================
window.BA = window.BA || {};
window.BA.ebayFees = {
  "_provenance": {
    "source_path": "shiire-intelligence/config/fees/ebay.json",
    "source_sha256": "d5eacbb2ddacc2e22f64a548383777329e01a76bcc6ea57c6e525551971835e1",
    "source_mtime": "2026-07-28T16:45:12.210Z",
    "generated_at": "2026-07-28T16:55:18.644Z",
    "generator": "shiire-intelligence/scripts/sync-ebay-fees.js",
    "note": "★GENERATED — 手で編集しない。値の変更は正本(config/fees/ebay.json)を更新し本スクリプトを再実行する（決定194・判断B）。"
  },
  "international_payment_rate": 0.0135,
  "per_order_fixed_usd": 0.35,
  "payoneer_rate": 0.02,
  "authentication_shipping_jpy": 1500,
  "final_value_fee_cap_usd": 750,
  "high_value_usd": 500,
  "final_value_fee_table": {
    "starter": {
      "shoes_sneakers": 0.15,
      "handbags": 0.15,
      "jewelry_watches": 0.15,
      "electronics": 0.1325,
      "motors": 0.1325,
      "clothing": 0.1325,
      "other": 0.1325
    },
    "basic": {
      "shoes_sneakers": 0.15,
      "handbags": 0.15,
      "jewelry_watches": 0.15,
      "electronics": 0.125,
      "motors": 0.125,
      "clothing": 0.125,
      "other": 0.125
    },
    "premium": {
      "shoes_sneakers": 0.15,
      "handbags": 0.15,
      "jewelry_watches": 0.15,
      "electronics": 0.12,
      "motors": 0.12,
      "clothing": 0.12,
      "other": 0.12
    },
    "anchor": {
      "shoes_sneakers": 0.15,
      "handbags": 0.15,
      "jewelry_watches": 0.15,
      "electronics": 0.12,
      "motors": 0.12,
      "clothing": 0.12,
      "other": 0.12
    }
  },
  "_confidence": {
    "international_payment_rate": "web_unverified",
    "per_order_fixed_usd": "web_unverified"
  }
};
