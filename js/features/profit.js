/**
 * BRAND ANALYTICS — profit.js
 * ④ 為替・利益計算機（FREE 機能）
 *
 * 利益計算式（確定）:
 *   粗利益 = 販売価格
 *            - eBay手数料（プラン×カテゴリ）
 *            - Promoted Listings費用
 *            - Payoneer手数料（デフォルト2%）
 *            - 送料（$500以下：3択 / $500以上：$0自動）
 *            - 関税（$500以下：2択 / $500以上：$0自動）
 *            - 真贋サービス送料（$500以上のみ・デフォルト¥1,500）
 *            - 仕入れ原価（円入力メイン）
 *
 * $500境界ルール:
 *   $500以上 → 国際送料・関税 = $0 自動入力（バイヤー負担）
 *             真贋サービス国内送料はセラー負担（デフォルト¥1,500）
 *   $500未満 → 送料3択 / 関税2択
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // eBay 手数料テーブル（確定値）
  // ─────────────────────────────────────
  const EBAY_FEE = {
    // プラン別カテゴリ手数料（Managed Payments 込み）
    // [出品プラン][カテゴリキー] = 手数料率
    starter: {
      shoes_sneakers:   0.1500,
      handbags:         0.1500,
      jewelry_watches:  0.1500,
      electronics:      0.1325,
      motors:           0.1325,
      clothing:         0.1325,
      other:            0.1325,
    },
    basic: {
      shoes_sneakers:   0.1500,
      handbags:         0.1500,
      jewelry_watches:  0.1500,
      electronics:      0.1250,
      motors:           0.1250,
      clothing:         0.1250,
      other:            0.1250,
    },
    premium: {
      shoes_sneakers:   0.1500,
      handbags:         0.1500,
      jewelry_watches:  0.1500,
      electronics:      0.1200,
      motors:           0.1200,
      clothing:         0.1200,
      other:            0.1200,
    },
    anchor: {
      shoes_sneakers:   0.1500,
      handbags:         0.1500,
      jewelry_watches:  0.1500,
      electronics:      0.1200,
      motors:           0.1200,
      clothing:         0.1200,
      other:            0.1200,
    },
  };

  // カテゴリ表示名
  const CATEGORY_LABELS = {
    shoes_sneakers:  'シューズ・スニーカー',
    handbags:        'ハンドバッグ',
    jewelry_watches: 'ジュエリー・時計',
    electronics:     '電子機器',
    motors:          'モーターパーツ',
    clothing:        'アパレル',
    other:           'その他',
  };

  // プラン表示名
  const PLAN_LABELS = {
    starter: 'スタータープラン',
    basic:   'ベーシックプラン',
    premium: 'プレミアムプラン',
    anchor:  'アンカープラン',
  };

  // ─────────────────────────────────────
  // デフォルト値
  // ─────────────────────────────────────
  const DEFAULTS = {
    plan:              'basic',
    category:          'other',
    payoneerRate:      0.02,     // 2%
    authServiceJpy:    1500,     // ¥1,500（$500以上時）
    shippingFixed:     35,       // $35
    promotedRate:      0,        // 0%
    usdJpy:            150,      // フォールバック為替レート
    threshold500:      500,      // $500境界
  };

  // ─────────────────────────────────────
  // プライベート変数
  // ─────────────────────────────────────
  let _exchangeRate = DEFAULTS.usdJpy;
  let _rendered     = false;

  // ─────────────────────────────────────
  // 計算ロジック
  // ─────────────────────────────────────

  /**
   * 粗利益・粗利率を計算する
   * @param {Object} params
   * @returns {{ grossProfit: number, profitRate: number, breakdown: Object }}
   */
  function _calculate(params) {
    const {
      sellingPriceUsd,  // USD
      costJpy,          // JPY
      plan,
      category,
      promotedRate,     // 0〜1
      payoneerRate,     // 0〜1（デフォルト0.02）
      shippingMode,     // 'manual'|'fixed'|'buyer'
      shippingUsd,      // manual時のみ
      customsMode,      // 'manual'|'zero'
      customsUsd,       // manual時のみ
      authServiceJpy,   // $500以上時
      usdJpy,
    } = params;

    const selling = sellingPriceUsd;
    const above500 = selling >= DEFAULTS.threshold500;

    // ── eBay 手数料 ──
    const feeRate = EBAY_FEE[plan]?.[category] ?? EBAY_FEE.basic.other;
    const ebayFeeUsd = selling * feeRate;

    // ── Promoted Listings ──
    const promotedUsd = selling * (promotedRate || 0);

    // ── Payoneer ──
    const payoneerUsd = selling * (payoneerRate ?? DEFAULTS.payoneerRate);

    // ── 送料 ──
    let effectiveShippingUsd = 0;
    if (above500) {
      effectiveShippingUsd = 0; // バイヤー負担
    } else {
      if (shippingMode === 'manual')  effectiveShippingUsd = shippingUsd || 0;
      else if (shippingMode === 'fixed') effectiveShippingUsd = DEFAULTS.shippingFixed;
      else effectiveShippingUsd = 0; // buyer
    }

    // ── 関税 ──
    let effectiveCustomsUsd = 0;
    if (!above500) {
      if (customsMode === 'manual') effectiveCustomsUsd = customsUsd || 0;
      // zero → 0
    }

    // ── 真贋サービス送料 ──
    const authServiceUsd = above500
      ? (authServiceJpy ?? DEFAULTS.authServiceJpy) / usdJpy
      : 0;

    // ── 仕入れ原価（JPY → USD 換算） ──
    const costUsd = (costJpy || 0) / usdJpy;

    // ── 粗利益 ──
    const totalDeductions = ebayFeeUsd + promotedUsd + payoneerUsd
                          + effectiveShippingUsd + effectiveCustomsUsd
                          + authServiceUsd + costUsd;
    const grossProfitUsd = selling - totalDeductions;
    const grossProfitJpy = grossProfitUsd * usdJpy;
    const profitRate     = selling > 0 ? (grossProfitUsd / selling) * 100 : 0;

    return {
      grossProfitUsd,
      grossProfitJpy,
      profitRate,
      breakdown: {
        sellingUsd:         selling,
        ebayFeeUsd,
        promotedUsd,
        payoneerUsd,
        shippingUsd:        effectiveShippingUsd,
        customsUsd:         effectiveCustomsUsd,
        authServiceUsd,
        costUsd,
        feeRate,
        above500,
      },
    };
  }

  // ─────────────────────────────────────
  // UI 描画
  // ─────────────────────────────────────

  function _render(root) {
    root.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

        <!-- LEFT: 入力フォーム -->
        <div>

          <!-- 基本設定 -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">基本設定</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

              <div class="input-group">
                <label class="input-label" for="p-plan">出品プラン</label>
                <select class="select" id="p-plan">
                  ${Object.entries(PLAN_LABELS).map(([k,v]) =>
                    `<option value="${k}"${k === DEFAULTS.plan ? ' selected' : ''}>${v}</option>`
                  ).join('')}
                </select>
              </div>

              <div class="input-group">
                <label class="input-label" for="p-category">カテゴリ</label>
                <select class="select" id="p-category">
                  ${Object.entries(CATEGORY_LABELS).map(([k,v]) =>
                    `<option value="${k}"${k === DEFAULTS.category ? ' selected' : ''}>${v}</option>`
                  ).join('')}
                </select>
              </div>

            </div>
          </div>

          <!-- 価格・原価 -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">価格・原価</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

              <div class="input-group">
                <label class="input-label" for="p-price">販売価格</label>
                <div class="input-wrap">
                  <div class="input-prefix">$</div>
                  <input class="input" id="p-price" type="number" min="0" step="0.01" placeholder="0.00">
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="p-cost">仕入れ原価</label>
                <div class="input-wrap">
                  <div class="input-prefix">¥</div>
                  <input class="input" id="p-cost" type="number" min="0" step="1" placeholder="0">
                </div>
              </div>

            </div>
          </div>

          <!-- 手数料 -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">手数料</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

              <div class="input-group">
                <label class="input-label" for="p-promoted" data-tip="販売価格に対する割合">Promoted Listings</label>
                <div class="input-wrap">
                  <input class="input" id="p-promoted" type="number" min="0" max="100" step="0.1" value="0">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="p-payoneer">Payoneer 手数料</label>
                <div class="input-wrap">
                  <input class="input" id="p-payoneer" type="number" min="0" max="10" step="0.1" value="2">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>

            </div>
          </div>

          <!-- 送料・関税（$500境界で表示切替） -->
          <div class="card" style="margin-bottom:16px" id="p-shipping-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div class="card-title" style="margin:0">送料・関税</div>
              <span class="tag caution" id="p-boundary-tag">$500 未満</span>
            </div>

            <!-- $500未満: 送料3択 + 関税2択 -->
            <div id="p-below500">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">

                <div class="input-group">
                  <label class="input-label" for="p-ship-mode">送料</label>
                  <select class="select" id="p-ship-mode">
                    <option value="manual">手動入力</option>
                    <option value="fixed">固定 $35</option>
                    <option value="buyer">バイヤー負担</option>
                  </select>
                </div>

                <div class="input-group" id="p-ship-manual-wrap">
                  <label class="input-label" for="p-ship-val">送料（手動）</label>
                  <div class="input-wrap">
                    <div class="input-prefix">$</div>
                    <input class="input" id="p-ship-val" type="number" min="0" step="0.01" value="0">
                  </div>
                </div>

              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

                <div class="input-group">
                  <label class="input-label" for="p-customs-mode">関税</label>
                  <select class="select" id="p-customs-mode">
                    <option value="manual">手動入力</option>
                    <option value="zero">$0（バイヤー負担）</option>
                  </select>
                </div>

                <div class="input-group" id="p-customs-manual-wrap">
                  <label class="input-label" for="p-customs-val">関税（手動）</label>
                  <div class="input-wrap">
                    <div class="input-prefix">$</div>
                    <input class="input" id="p-customs-val" type="number" min="0" step="0.01" value="0">
                  </div>
                </div>

              </div>
            </div>

            <!-- $500以上: 自動表示 -->
            <div id="p-above500" style="display:none">
              <div style="background:var(--amber-glow);border:1px solid rgba(245,158,11,0.15);border-radius:4px;padding:10px 14px;font-size:12px;color:var(--text-secondary);line-height:1.8">
                💡 $500以上のため<strong style="color:var(--amber)">国際送料・関税はバイヤー負担（$0）</strong>で計算します。<br>
                真贋サービス国内送料のみセラー負担となります。
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
                <div class="input-group">
                  <label class="input-label">国際送料</label>
                  <div class="input-wrap">
                    <div class="input-prefix">$</div>
                    <input class="input" type="number" value="0" disabled style="opacity:0.4">
                  </div>
                </div>
                <div class="input-group">
                  <label class="input-label" for="p-auth-service">真贋サービス送料</label>
                  <div class="input-wrap">
                    <div class="input-prefix">¥</div>
                    <input class="input" id="p-auth-service" type="number" min="0" value="1500">
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- 為替レート -->
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div class="card-title" style="margin:0">為替レート</div>
              <button class="btn btn-ghost" id="p-refresh-rate" style="font-size:10px;padding:4px 8px">
                ↻ 更新
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <div class="input-group" style="flex:1">
                <label class="input-label" for="p-rate">1 USD =</label>
                <div class="input-wrap">
                  <input class="input" id="p-rate" type="number" min="1" step="0.01" value="150">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">JPY</div>
                </div>
              </div>
              <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);padding-top:20px" id="p-rate-updated">
                手動入力
              </div>
            </div>
          </div>

        </div>

        <!-- RIGHT: 計算結果 -->
        <div>

          <!-- 粗利益サマリー -->
          <div class="card" style="margin-bottom:16px;border-color:var(--border-active)">
            <div class="card-title">粗利益（シミュレーション）</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:4px">USD</div>
                <div class="card-value" id="p-result-usd">$0.00</div>
              </div>
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:4px">JPY</div>
                <div class="card-value" id="p-result-jpy">¥0</div>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">粗利率</div>
              <div class="card-value" style="font-size:20px" id="p-result-rate">0.0%</div>
            </div>

            <div class="meter">
              <div class="meter-fill green" id="p-profit-meter" style="width:0%"></div>
            </div>
          </div>

          <!-- 内訳 -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">費用内訳</div>
            <table class="data-table" id="p-breakdown-table">
              <tbody>
                <tr><td>—</td><td style="font-family:var(--font-mono);text-align:right">—</td></tr>
              </tbody>
            </table>
          </div>

          <!-- eBay 手数料率表示 -->
          <div class="card">
            <div class="card-title">適用手数料率</div>
            <div style="font-family:var(--font-mono);font-size:24px;color:var(--amber);text-align:center;padding:8px 0" id="p-fee-rate-display">
              —
            </div>
            <div style="font-size:11px;color:var(--text-muted);text-align:center" id="p-fee-rate-label">
              プランとカテゴリを選択してください
            </div>
          </div>

        </div>
      </div>
    `;

    _bindEvents(root);
    _update(root);
  }

  /** 入力値の変化を監視して計算を実行 */
  function _bindEvents(root) {
    const inputs = root.querySelectorAll('input, select');
    inputs.forEach(el => {
      el.addEventListener('input', () => _update(root));
      el.addEventListener('change', () => _update(root));
    });

    // $500境界: 送料モードで手動入力欄の表示切替
    root.querySelector('#p-ship-mode')?.addEventListener('change', e => {
      const wrap = root.querySelector('#p-ship-manual-wrap');
      if (wrap) wrap.style.visibility = e.target.value === 'manual' ? 'visible' : 'hidden';
    });

    root.querySelector('#p-customs-mode')?.addEventListener('change', e => {
      const wrap = root.querySelector('#p-customs-manual-wrap');
      if (wrap) wrap.style.visibility = e.target.value === 'manual' ? 'visible' : 'hidden';
    });

    // 為替レート更新ボタン
    root.querySelector('#p-refresh-rate')?.addEventListener('click', async () => {
      const btn = root.querySelector('#p-refresh-rate');
      if (btn) btn.textContent = '↻ 取得中...';
      try {
        _exchangeRate = await BA.api?.getExchangeRate?.() ?? DEFAULTS.usdJpy;
        const rateInput = root.querySelector('#p-rate');
        if (rateInput) rateInput.value = _exchangeRate.toFixed(2);
        const updEl = root.querySelector('#p-rate-updated');
        if (updEl) updEl.textContent = '最新レート';
        _update(root);
      } catch {
        BA.notify?.toast?.('為替レートの取得に失敗しました', 'error');
      } finally {
        if (btn) btn.textContent = '↻ 更新';
      }
    });
  }

  /** 計算実行 → 結果 UI 更新 */
  function _update(root) {
    const price  = parseFloat(root.querySelector('#p-price')?.value)    || 0;
    const cost   = parseFloat(root.querySelector('#p-cost')?.value)     || 0;
    const plan   = root.querySelector('#p-plan')?.value   || DEFAULTS.plan;
    const cat    = root.querySelector('#p-category')?.value || DEFAULTS.category;
    const promo  = (parseFloat(root.querySelector('#p-promoted')?.value) || 0) / 100;
    const payRate = (parseFloat(root.querySelector('#p-payoneer')?.value) || 2) / 100;
    const shipMode = root.querySelector('#p-ship-mode')?.value   || 'manual';
    const shipVal  = parseFloat(root.querySelector('#p-ship-val')?.value)    || 0;
    const custMode = root.querySelector('#p-customs-mode')?.value  || 'manual';
    const custVal  = parseFloat(root.querySelector('#p-customs-val')?.value) || 0;
    const authSvc  = parseFloat(root.querySelector('#p-auth-service')?.value) || DEFAULTS.authServiceJpy;
    const rate     = parseFloat(root.querySelector('#p-rate')?.value)   || DEFAULTS.usdJpy;
    const above500 = price >= DEFAULTS.threshold500;

    // $500 境界UI切替
    root.querySelector('#p-below500').style.display = above500 ? 'none' : 'block';
    root.querySelector('#p-above500').style.display = above500 ? 'block' : 'none';
    const tag = root.querySelector('#p-boundary-tag');
    if (tag) {
      tag.className = `tag ${above500 ? 'go' : 'caution'}`;
      tag.textContent = above500 ? '$500 以上（真贋サービス対象）' : '$500 未満';
    }

    const result = _calculate({
      sellingPriceUsd: price,
      costJpy:         cost,
      plan, category: cat,
      promotedRate: promo,
      payoneerRate: payRate,
      shippingMode: shipMode,
      shippingUsd:  shipVal,
      customsMode:  custMode,
      customsUsd:   custVal,
      authServiceJpy: authSvc,
      usdJpy: rate,
    });

    // 粗利益 表示
    const profitUsd = result.grossProfitUsd;
    const profitJpy = result.grossProfitJpy;
    const profitRate = result.profitRate;

    const color = profitUsd >= 0 ? 'var(--green)' : 'var(--red)';
    const usdEl = root.querySelector('#p-result-usd');
    const jpyEl = root.querySelector('#p-result-jpy');
    const rateEl = root.querySelector('#p-result-rate');

    if (usdEl) { usdEl.textContent = `$${profitUsd.toFixed(2)}`; usdEl.style.color = color; }
    if (jpyEl) { jpyEl.textContent = `¥${Math.round(profitJpy).toLocaleString()}`; jpyEl.style.color = color; }
    if (rateEl) { rateEl.textContent = `${profitRate.toFixed(1)}%`; rateEl.style.color = color; }

    // メーターバー
    const meterFill = root.querySelector('#p-profit-meter');
    if (meterFill) {
      const pct = Math.max(0, Math.min(100, profitRate));
      BA.charts?.meterBar?.(meterFill, pct, 100, profitRate >= 25 ? 'green' : profitRate >= 0 ? 'amber' : 'red');
    }

    // 内訳テーブル
    const tbody = root.querySelector('#p-breakdown-table tbody');
    if (tbody && price > 0) {
      const b = result.breakdown;
      const rows = [
        ['販売価格',                 `$${b.sellingUsd.toFixed(2)}`],
        ['eBay 手数料',              `-$${b.ebayFeeUsd.toFixed(2)}`],
        b.promotedUsd > 0 ? ['Promoted Listings', `-$${b.promotedUsd.toFixed(2)}`] : null,
        [`Payoneer 手数料`,          `-$${b.payoneerUsd.toFixed(2)}`],
        b.shippingUsd > 0 ? ['送料', `-$${b.shippingUsd.toFixed(2)}`] : null,
        b.customsUsd  > 0 ? ['関税', `-$${b.customsUsd.toFixed(2)}`]  : null,
        b.authServiceUsd > 0 ? ['真贋サービス送料', `-$${b.authServiceUsd.toFixed(2)}`] : null,
        b.costUsd > 0 ? ['仕入れ原価', `-$${b.costUsd.toFixed(2)}`] : null,
      ].filter(Boolean);

      tbody.innerHTML = rows.map(([label, val]) => `
        <tr>
          <td>${label}</td>
          <td style="font-family:var(--font-mono);text-align:right;color:${val.startsWith('-') ? 'var(--text-muted)' : 'var(--text-primary)'}">
            ${val}
          </td>
        </tr>
      `).join('') + `
        <tr style="border-top:1px solid var(--border-active)">
          <td style="color:var(--text-primary);font-weight:500">粗利益</td>
          <td style="font-family:var(--font-mono);text-align:right;color:${color};font-weight:500">
            $${profitUsd.toFixed(2)}
          </td>
        </tr>
      `;
    }

    // 手数料率表示
    const feeRate = result.breakdown.feeRate;
    const feeDisp = root.querySelector('#p-fee-rate-display');
    const feeLab  = root.querySelector('#p-fee-rate-label');
    if (feeDisp) feeDisp.textContent = `${(feeRate * 100).toFixed(2)}%`;
    if (feeLab)  feeLab.textContent  = `${PLAN_LABELS[plan] ?? plan} / ${CATEGORY_LABELS[cat] ?? cat}`;
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const profit = {
    async init() {
      // 起動時に為替レートを取得
      try {
        _exchangeRate = await BA.api?.getExchangeRate?.() ?? DEFAULTS.usdJpy;
      } catch {
        _exchangeRate = DEFAULTS.usdJpy;
      }

      // パネル表示時に初回レンダリング
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'profit') return;
        const root = document.getElementById('profit-root');
        if (!root || _rendered) return;
        _rendered = true;
        _render(root);

        // 取得済み為替レートをセット
        const rateInput = root.querySelector('#p-rate');
        if (rateInput) {
          rateInput.value = _exchangeRate.toFixed(2);
          root.querySelector('#p-rate-updated').textContent = '最新レート';
        }
      });

      // 利益計算機は FREE 機能なので初回から表示
      const root = document.getElementById('profit-root');
      if (root && !_rendered) {
        _rendered = true;
        _render(root);
        const rateInput = root.querySelector('#p-rate');
        if (rateInput) rateInput.value = _exchangeRate.toFixed(2);
      }
    },
  };

  window.BA.profit = profit;

})();
