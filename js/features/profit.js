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
  // シミュレーター：入力値読み取り
  // ─────────────────────────────────────

  function _readInputs(root) {
    return {
      price:          parseFloat(root.querySelector('#p-price')?.value) || 0,
      costJpy:        parseFloat(root.querySelector('#p-cost')?.value)  || 0,
      plan:           root.querySelector('#p-plan')?.value              || DEFAULTS.plan,
      category:       root.querySelector('#p-category')?.value          || DEFAULTS.category,
      promotedRate:   (parseFloat(root.querySelector('#p-promoted')?.value) || 0) / 100,
      payoneerRate:   (parseFloat(root.querySelector('#p-payoneer')?.value) || 2) / 100,
      shippingMode:   root.querySelector('#p-ship-mode')?.value         || 'manual',
      shippingUsd:    parseFloat(root.querySelector('#p-ship-val')?.value)    || 0,
      customsMode:    root.querySelector('#p-customs-mode')?.value      || 'manual',
      customsUsd:     parseFloat(root.querySelector('#p-customs-val')?.value) || 0,
      authServiceJpy: parseFloat(root.querySelector('#p-auth-service')?.value) || DEFAULTS.authServiceJpy,
      usdJpy:         parseFloat(root.querySelector('#p-rate')?.value)  || DEFAULTS.usdJpy,
    };
  }

  // ─────────────────────────────────────
  // シミュレーター：最低承認可能価格逆算
  // ─────────────────────────────────────

  /**
   * 目標を満たす最低オファー価格を3区間で逆算する
   * 区間1: P<$500（真贋なし）/ 区間2: $500≤P<Cap価格 / 区間3: P≥Cap価格（FVF=$750固定）
   * @returns {number|null} null=達成不可
   */
  function _calcMinPrice(inputs, mode, targetValue) {
    const FVF_CAP = 750;
    const feeRate = EBAY_FEE[inputs.plan]?.[inputs.category] ?? EBAY_FEE.basic.other;
    const promo   = inputs.promotedRate;
    const pay     = inputs.payoneerRate;
    const costUsd = inputs.costJpy / inputs.usdJpy;
    const authUsd = inputs.authServiceJpy / inputs.usdJpy;
    const fvfCapP = FVF_CAP / feeRate;

    const ship1 = inputs.shippingMode === 'fixed'  ? 35
                : inputs.shippingMode === 'manual' ? (inputs.shippingUsd || 0) : 0;
    const cust1 = inputs.customsMode === 'manual' ? (inputs.customsUsd || 0) : 0;

    const candidates = [];

    // 区間1: P < $500
    const fixed1 = ship1 + cust1 + costUsd;
    const varR1  = feeRate + promo + pay;
    {
      let p;
      if (mode === 'pct') {
        const denom = 1 - varR1 - (targetValue / 100);
        p = denom > 0 ? fixed1 / denom : (denom < 0 ? -1 : null);
      } else {
        const denom = 1 - varR1;
        p = denom > 0 ? (targetValue / inputs.usdJpy + fixed1) / denom : null;
      }
      if (p !== null) {
        if (p < 0) candidates.push(0.01);
        else if (p < 500) candidates.push(p);
      }
    }

    // 区間2: $500 ≤ P < fvfCapP
    const fixed2 = authUsd + costUsd;
    const varR2  = feeRate + promo + pay;
    {
      let p;
      if (mode === 'pct') {
        const denom = 1 - varR2 - (targetValue / 100);
        p = denom > 0 ? fixed2 / denom : null;
      } else {
        const denom = 1 - varR2;
        p = denom > 0 ? (targetValue / inputs.usdJpy + fixed2) / denom : null;
      }
      if (p !== null && p >= 500 && p < fvfCapP) candidates.push(p);
    }

    // 区間3: P ≥ fvfCapP（FVF=$750固定）
    const fixed3 = FVF_CAP + authUsd + costUsd;
    const varR3  = promo + pay;
    {
      let p;
      if (mode === 'pct') {
        const denom = 1 - varR3 - (targetValue / 100);
        p = denom > 0 ? fixed3 / denom : null;
      } else {
        const denom = 1 - varR3;
        p = denom > 0 ? (targetValue / inputs.usdJpy + fixed3) / denom : null;
      }
      if (p !== null && p >= fvfCapP) candidates.push(p);
    }

    return candidates.length > 0 ? Math.min(...candidates) : null;
  }

  // ─────────────────────────────────────
  // シミュレーター：UI更新
  // ─────────────────────────────────────

  function _updateSimulator(root) {
    const body = root.querySelector('#p-sim-body');
    if (!body || body.style.display === 'none') return;

    const inputs = _readInputs(root);
    const hasData = inputs.price > 0 || inputs.costJpy > 0;
    const guide   = root.querySelector('#p-sim-guide');
    const content = root.querySelector('#p-sim-content');
    if (guide)   guide.style.display   = hasData ? 'none'  : 'block';
    if (content) content.style.display = hasData ? 'block' : 'none';
    if (!hasData) return;

    const set = (id, txt, color) => {
      const el = root.querySelector(id);
      if (!el) return;
      el.textContent = txt;
      el.style.color = color || '';
    };

    // 差額
    const offerRaw = root.querySelector('#p-sim-offer')?.value ?? '';
    const offer    = parseFloat(offerRaw);
    const hasOffer = offerRaw !== '' && !isNaN(offer) && offer >= 0;

    if (hasOffer && inputs.price > 0) {
      const diff = offer - inputs.price;
      const pct  = (diff / inputs.price) * 100;
      const sign = diff >= 0 ? '▲' : '▼';
      set('#p-sim-diff',
        `${sign}$${Math.abs(diff).toFixed(2)}（${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`,
        diff >= 0 ? 'var(--green)' : 'var(--red)');
    } else {
      set('#p-sim-diff', '—', '');
    }

    // オファー価格での粗利計算
    if (hasOffer) {
      const r = _calculate({
        sellingPriceUsd: offer,
        costJpy:         inputs.costJpy,
        plan:            inputs.plan,
        category:        inputs.category,
        promotedRate:    inputs.promotedRate,
        payoneerRate:    inputs.payoneerRate,
        shippingMode:    inputs.shippingMode,
        shippingUsd:     inputs.shippingUsd,
        customsMode:     inputs.customsMode,
        customsUsd:      inputs.customsUsd,
        authServiceJpy:  inputs.authServiceJpy,
        usdJpy:          inputs.usdJpy,
        holdingDays:     0,
      });
      const c = r.grossProfitUsd >= 0 ? 'var(--green)' : 'var(--red)';
      set('#p-sim-profit-usd', `$${r.grossProfitUsd.toFixed(2)}`, c);
      set('#p-sim-profit-jpy', `¥${Math.round(r.grossProfitJpy).toLocaleString()}`, c);
      set('#p-sim-rate', `${r.profitRate.toFixed(1)}%`, c);
      if (inputs.costJpy > 0) {
        const roi = (r.grossProfitJpy / inputs.costJpy) * 100;
        set('#p-sim-roi', `${roi.toFixed(2)}%`, roi >= 0 ? 'var(--green)' : 'var(--red)');
      } else {
        set('#p-sim-roi', '—', '');
      }
    } else {
      ['#p-sim-profit-usd','#p-sim-profit-jpy','#p-sim-rate','#p-sim-roi']
        .forEach(id => set(id, '—', ''));
    }

    // 最低承認可能価格
    const mode = root.querySelector('#p-sim-tab-pct')?.classList.contains('sim-tab-active') ? 'pct' : 'jpy';
    const targetVal = mode === 'pct'
      ? parseFloat(root.querySelector('#p-sim-target-pct')?.value) || 0
      : parseFloat(root.querySelector('#p-sim-target-jpy')?.value) || 0;

    const minP = _calcMinPrice(inputs, mode, targetVal);
    if (minP === null) {
      set('#p-sim-min-price', 'この目標は達成不可', 'var(--red)');
    } else {
      set('#p-sim-min-price', `$${minP.toFixed(2)}`, 'var(--text-primary)');
    }
  }

  // ─────────────────────────────────────
  // シミュレーター：イベントバインド
  // ─────────────────────────────────────

  function _bindSimulatorEvents(root) {
    root.querySelector('#p-sim-toggle')?.addEventListener('click', () => {
      const body = root.querySelector('#p-sim-body');
      const icon = root.querySelector('#p-sim-icon');
      if (!body) return;
      const open = body.style.display === 'none';
      body.style.display = open ? 'block' : 'none';
      if (icon) icon.textContent = open ? '▼' : '▶';
      if (open) _updateSimulator(root);
    });

    const setTab = (active) => {
      const pBtn = root.querySelector('#p-sim-tab-pct');
      const jBtn = root.querySelector('#p-sim-tab-jpy');
      const pW   = root.querySelector('#p-sim-target-pct-wrap');
      const jW   = root.querySelector('#p-sim-target-jpy-wrap');
      if (!pBtn) return;
      if (active === 'pct') {
        pBtn.classList.add('sim-tab-active');    jBtn.classList.remove('sim-tab-active');
        pBtn.style.background = 'var(--brand)';  pBtn.style.color = '#fff';
        jBtn.style.background = 'var(--card-bg)'; jBtn.style.color = 'var(--text-secondary)';
        if (pW) pW.style.display = 'flex'; if (jW) jW.style.display = 'none';
      } else {
        jBtn.classList.add('sim-tab-active');    pBtn.classList.remove('sim-tab-active');
        jBtn.style.background = 'var(--brand)';  jBtn.style.color = '#fff';
        pBtn.style.background = 'var(--card-bg)'; pBtn.style.color = 'var(--text-secondary)';
        if (jW) jW.style.display = 'flex'; if (pW) pW.style.display = 'none';
      }
      _updateSimulator(root);
    };
    root.querySelector('#p-sim-tab-pct')?.addEventListener('click', () => setTab('pct'));
    root.querySelector('#p-sim-tab-jpy')?.addEventListener('click', () => setTab('jpy'));

    let _simTimer;
    const debounced = () => {
      clearTimeout(_simTimer);
      _simTimer = setTimeout(() => _updateSimulator(root), 150);
    };
    ['#p-sim-offer','#p-sim-target-pct','#p-sim-target-jpy']
      .forEach(id => root.querySelector(id)?.addEventListener('input', debounced));
  }

  // ─────────────────────────────────────
  // シミュレーター：HTML生成
  // ─────────────────────────────────────

  function _renderSimulator() {
    const s      = BA.settings?.get?.() ?? {};
    const defPct = s.targetMargin    ?? 25;
    const defJpy = s.targetProfitJpy ?? 0;

    return `
      <div id="p-sim-wrap" style="margin-top:20px">
        <button id="p-sim-toggle" style="
          width:100%;display:flex;align-items:center;justify-content:space-between;
          padding:14px 20px;background:var(--card-bg);border:1px solid var(--border);
          border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;
          color:var(--text-primary);text-align:left">
          <span style="display:flex;align-items:center;gap:8px">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--brand);flex-shrink:0"><path d="M2 8h12M10 5l4 3-4 3M6 11l-4-3 4-3"/></svg>
            ベストオファーシミュレーター
          </span>
          <span id="p-sim-icon" style="font-size:11px;color:var(--text-muted)">▶</span>
        </button>

        <div id="p-sim-body" style="display:none;border:1px solid var(--border);border-top:none;
          border-radius:0 0 8px 8px;padding:20px;background:var(--card-bg)">

          <div id="p-sim-guide" style="font-size:13px;color:var(--text-muted);padding:4px 0">
            先に利益計算機で販売価格または仕入れ原価を入力してください。
          </div>

          <div id="p-sim-content" style="display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

              <!-- 左：入力 -->
              <div>
                <div class="input-group" style="margin-bottom:16px">
                  <label class="input-label">オファー金額</label>
                  <div class="input-wrap">
                    <div class="input-prefix">$</div>
                    <input class="input" id="p-sim-offer" type="number" min="0" step="0.01"
                      placeholder="バイヤーの提示価格">
                  </div>
                  <div id="p-sim-diff" style="font-size:12px;margin-top:6px;
                    font-family:var(--font-mono);color:var(--text-muted)">—</div>
                </div>

                <div class="input-group">
                  <label class="input-label">最低承認価格の目標</label>
                  <div style="display:flex;border:1px solid var(--border);
                    border-radius:6px;overflow:hidden;margin-bottom:10px">
                    <button id="p-sim-tab-pct" class="sim-tab-active" style="
                      flex:1;padding:7px 0;font-size:12px;border:none;cursor:pointer;
                      background:var(--brand);color:#fff;font-weight:500">粗利率 %</button>
                    <button id="p-sim-tab-jpy" style="
                      flex:1;padding:7px 0;font-size:12px;border:none;cursor:pointer;
                      background:var(--card-bg);color:var(--text-secondary)">粗利額 ¥</button>
                  </div>
                  <div id="p-sim-target-pct-wrap" style="display:flex;align-items:center;gap:6px">
                    <input class="input" id="p-sim-target-pct" type="number" min="0" max="100" step="0.1"
                      value="${defPct}" style="text-align:right;width:90px">
                    <span style="font-size:13px;color:var(--text-muted)">%</span>
                  </div>
                  <div id="p-sim-target-jpy-wrap" style="display:none;align-items:center;gap:6px">
                    <span style="font-size:13px;color:var(--text-muted)">¥</span>
                    <input class="input" id="p-sim-target-jpy" type="number" min="0" step="100"
                      value="${defJpy}" style="text-align:right;width:120px">
                  </div>
                </div>
              </div>

              <!-- 右：結果 -->
              <div class="card" style="margin-bottom:0">
                <div class="card-title" style="margin-bottom:12px">承認後の試算</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                  <div>
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">粗利益 USD</div>
                    <div style="font-size:20px;font-weight:700;font-family:var(--font-mono)" id="p-sim-profit-usd">—</div>
                  </div>
                  <div>
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">粗利益 JPY</div>
                    <div style="font-size:20px;font-weight:700;font-family:var(--font-mono)" id="p-sim-profit-jpy">—</div>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
                  <div>
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">粗利率</div>
                    <div style="font-size:18px;font-weight:600;font-family:var(--font-mono)" id="p-sim-rate">—</div>
                  </div>
                  <div>
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">ROI</div>
                    <div style="font-size:18px;font-weight:600;font-family:var(--font-mono)" id="p-sim-roi">—</div>
                  </div>
                </div>
                <div style="border-top:1px solid var(--border);padding-top:12px">
                  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">最低承認可能価格</div>
                  <div style="font-size:22px;font-weight:700;font-family:var(--font-mono)" id="p-sim-min-price">—</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px">目標を満たす最小オファー価格</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────
  // 計算ロジック
  // ─────────────────────────────────────

  /**
   * 粗利益・粗利率・PPDを計算する
   * @param {Object} params
   * @returns {{ grossProfitUsd: number, grossProfitJpy: number, profitRate: number, ppd: Object, breakdown: Object }}
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
      holdingDays,      // 在庫保有日数（PPD計算用）
    } = params;

    const selling = sellingPriceUsd;
    const above500 = selling >= DEFAULTS.threshold500;

    // ── eBay 手数料（FVF Cap: $750）──
    const FVF_CAP_USD = 750;
    const feeRate    = EBAY_FEE[plan]?.[category] ?? EBAY_FEE.basic.other;
    const ebayFeeUsd = Math.min(selling * feeRate, FVF_CAP_USD);

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

    // ── PPD（1日あたり粗利益） ──
    const days = holdingDays && holdingDays > 0 ? holdingDays : null;
    const ppd = {
      usd: days ? grossProfitUsd / days : null,
      jpy: days ? grossProfitJpy / days : null,
    };

    return {
      grossProfitUsd,
      grossProfitJpy,
      profitRate,
      ppd,
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

  const _HINT_KEY_PROFIT = 'ba_hint_profit';

  function _tutorialBanner() {
    try { if (localStorage.getItem(_HINT_KEY_PROFIT)) return ''; } catch {}
    return `
      <div id="profit-tut-banner" style="display:flex;align-items:flex-start;gap:12px;
        padding:12px 16px;background:rgba(232,140,60,.08);
        border:1px solid rgba(232,140,60,.2);border-radius:8px;margin-bottom:16px">
        <span style="font-size:16px;color:var(--brand);flex-shrink:0;line-height:1.5">＋</span>
        <div style="flex:1;font-size:13px;color:var(--text-secondary);line-height:1.7">
          <strong style="color:var(--text-primary)">利益計算機の使い方</strong><br>
          販売価格・手数料・送料・仕入原価を入力すると粗利益を自動計算します。
          取引記録を5件入力すると、手数料率が実績値に自動更新されます。
        </div>
        <button id="profit-tut-close" aria-label="閉じる"
          style="background:none;border:none;cursor:pointer;color:var(--text-muted);
            font-size:18px;padding:0 0 0 8px;line-height:1;flex-shrink:0">×</button>
      </div>`;
  }

  /** 費用内訳カード：未入力時の空状態HTML */
  function _emptyBreakdown() {
    const items = [
      'eBay手数料',
      'Promoted',
      'Payoneer',
      '送料',
      '関税',
      '真贋サービス',
      '仕入れ原価',
    ];
    return items.map(label => `
      <tr>
        <td style="color:#999999;font-size:14px;padding:8px 0">${label}</td>
        <td style="color:#999999;font-size:14px;text-align:right;padding:8px 0">—</td>
      </tr>
    `).join('');
  }

  function _render(root) {
    root.innerHTML = `
      ${_tutorialBanner()}
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

          <!-- PPD: 在庫保有日数 -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">PPD（1日あたり粗利益）</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end">
              <div class="input-group">
                <label class="input-label" for="p-holding-days">在庫保有日数</label>
                <div class="input-wrap">
                  <input class="input" id="p-holding-days" type="number" min="1" step="1" placeholder="例: 30">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">日</div>
                </div>
              </div>
              <div style="font-size:10px;color:var(--text-muted);padding-bottom:4px;line-height:1.8">
                仕入れから販売までの<br>平均日数を入力
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

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">ROI</div>
              <div class="card-value" style="font-size:20px" id="p-result-roi">—</div>
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
                ${_emptyBreakdown()}
              </tbody>
            </table>
          </div>

          <!-- PPD 結果 -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">PPD（1日あたり粗利益）</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:4px">USD / 日</div>
                <div class="card-value" style="font-size:20px" id="p-ppd-usd">—</div>
              </div>
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:4px">JPY / 日</div>
                <div class="card-value" style="font-size:20px" id="p-ppd-jpy">—</div>
              </div>
            </div>
            <div style="font-size:10px;color:var(--text-muted)">
              ※ 在庫保有日数を入力すると計算されます
            </div>
          </div>

          <!-- eBay 手数料率表示 -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">適用手数料率</div>
            <div style="font-family:var(--font-mono);font-size:24px;color:var(--amber);text-align:center;padding:8px 0" id="p-fee-rate-display">
              —
            </div>
            <div style="font-size:11px;color:var(--text-muted);text-align:center" id="p-fee-rate-label">
              プランとカテゴリを選択してください
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

          ${_renderSimulator()}

        </div>
      </div>
    `;

    root.querySelector('#profit-tut-close')?.addEventListener('click', () => {
      try { localStorage.setItem(_HINT_KEY_PROFIT, '1'); } catch {}
      root.querySelector('#profit-tut-banner')?.remove();
    });

    _bindEvents(root);
    _bindSimulatorEvents(root);
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
    const authSvc     = parseFloat(root.querySelector('#p-auth-service')?.value) || DEFAULTS.authServiceJpy;
    const rate        = parseFloat(root.querySelector('#p-rate')?.value)   || DEFAULTS.usdJpy;
    const holdingDays = parseFloat(root.querySelector('#p-holding-days')?.value) || 0;
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
      holdingDays,
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

    // ROI 表示（仕入れ原価 > 0 の場合のみ計算）
    const roiEl = root.querySelector('#p-result-roi');
    if (roiEl) {
      if (cost > 0) {
        const roi = (profitJpy / cost) * 100;
        roiEl.textContent = `${roi.toFixed(2)}%`;
        roiEl.style.color = roi >= 0 ? 'var(--green)' : 'var(--red)';
      } else {
        roiEl.textContent = '—';
        roiEl.style.color = '';
      }
    }

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
    } else if (tbody) {
      tbody.innerHTML = _emptyBreakdown();
    }

    // PPD 表示
    const ppdUsdEl = root.querySelector('#p-ppd-usd');
    const ppdJpyEl = root.querySelector('#p-ppd-jpy');
    if (ppdUsdEl && ppdJpyEl) {
      if (result.ppd.usd !== null) {
        ppdUsdEl.textContent = `$${result.ppd.usd.toFixed(2)}`;
        ppdUsdEl.style.color = result.ppd.usd >= 0 ? 'var(--green)' : 'var(--red)';
        ppdJpyEl.textContent = `¥${Math.round(result.ppd.jpy).toLocaleString()}`;
        ppdJpyEl.style.color = result.ppd.jpy >= 0 ? 'var(--green)' : 'var(--red)';
      } else {
        ppdUsdEl.textContent = '—';
        ppdUsdEl.style.color = '';
        ppdJpyEl.textContent = '—';
        ppdJpyEl.style.color = '';
      }
    }

    // 手数料率表示
    const feeRate = result.breakdown.feeRate;
    const feeDisp = root.querySelector('#p-fee-rate-display');
    const feeLab  = root.querySelector('#p-fee-rate-label');
    if (feeDisp) feeDisp.textContent = `${(feeRate * 100).toFixed(2)}%`;
    if (feeLab)  feeLab.textContent  = `${PLAN_LABELS[plan] ?? plan} / ${CATEGORY_LABELS[cat] ?? cat}`;

    // シミュレーターも再計算（メイン入力が変わったとき）
    _updateSimulator(root);
  }

  // ─────────────────────────────────────
  // 学習値をフォームに反映
  // ─────────────────────────────────────

  /**
   * BA.transactions.getLearned() の結果をデフォルト値としてフォームに適用する。
   * 学習済み（isFallback=false）の場合のみ反映し、フォールバック時は変更しない。
   */
  function _applyLearnedRates(root) {
    const learned = BA.transactions?.getLearned?.();
    if (!learned || learned.isFallback) return;

    const promoInput   = root.querySelector('#p-promoted');
    const payeerInput  = root.querySelector('#p-payoneer');
    const authInput    = root.querySelector('#p-auth-service');

    if (promoInput)  promoInput.value  = (learned.promotedRate  * 100).toFixed(2);
    if (payeerInput) payeerInput.value = (learned.payoneerRate  * 100).toFixed(2);
    if (authInput)   authInput.value   = learned.authServiceJpy;

    _update(root);
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

      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'profit') return;
        const root = document.getElementById('profit-root');
        if (!root || _rendered) return;
        _rendered = true;
        _render(root);
        _applyLearnedRates(root);
        const rateInput = root.querySelector('#p-rate');
        if (rateInput) {
          rateInput.value = _exchangeRate.toFixed(2);
          root.querySelector('#p-rate-updated').textContent = '最新レート';
        }
      });

      document.addEventListener('ba:settings-changed', ({ detail }) => {
        const root = document.getElementById('profit-root');
        if (!root || !_rendered) return;
        const payoneerEl = root.querySelector('#p-payoneer');
        const authSvcEl  = root.querySelector('#p-auth-service');
        if (payoneerEl && detail.payoneerRate   != null) payoneerEl.value = detail.payoneerRate;
        if (authSvcEl  && detail.authServiceJpy != null) authSvcEl.value  = detail.authServiceJpy;
        _update(root);
      });

      const root = document.getElementById('profit-root');
      if (root && !_rendered) {
        _rendered = true;
        _render(root);
        _applyLearnedRates(root);
        const rateInput = root.querySelector('#p-rate');
        if (rateInput) rateInput.value = _exchangeRate.toFixed(2);
      }
    },
  };

  window.BA.profit = profit;

})();
