/**
 * BRAND ANALYTICS — profit.js
 * ④ 為替・仕入シミュレーター（FREE 機能）
 *
 * 利益計算式（確定）:
 *   粗利益 = 販売価格
 *            - eBay手数料（プラン×カテゴリ）
 *            - Promoted Listings費用
 *            - Payoneer手数料（デフォルト2%）
 *            - 送料（$500以下：manual/buyer / $500以上：$0自動）
 *            - 関税（$500以下：manual/zero/pct / $500以上：$0自動）
 *            - 真贋サービス送料（$500以上のみ・デフォルト¥1,500）
 *            - 仕入れ原価（円入力メイン）
 *
 * $500境界ルール:
 *   $500以上 → 国際送料・関税 = $0 自動（バイヤー負担）、真贋サービス国内送料はセラー負担
 *   $500未満 → 送料: manual/buyer / 関税: manual/zero/pct
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // eBay 手数料テーブル（確定値）
  // ─────────────────────────────────────
  const EBAY_FEE = {
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

  const CATEGORY_LABELS = {
    handbags:        'ブランドバッグ',
    shoes_sneakers:  'シューズ・スニーカー',
    jewelry_watches: 'ジュエリー・時計',
    electronics:     '電子機器',
    motors:          'モーターパーツ',
    clothing:        'アパレル',
    other:           'その他',
  };

  const PLAN_LABELS = {
    starter: 'スタータープラン',
    basic:   'ベーシックプラン',
    premium: 'プレミアムプラン',
    anchor:  'アンカープラン',
  };

  // ─────────────────────────────────────
  // デフォルト値（P-18: shippingFixed 削除）
  // ─────────────────────────────────────
  const DEFAULTS = {
    plan:           'basic',
    category:       'handbags',
    payoneerRate:   0.02,
    authServiceJpy: 1500,
    promotedRate:   0,
    usdJpy:         150,
    threshold500:   500,
  };

  let _exchangeRate = DEFAULTS.usdJpy;
  let _rendered     = false;

  // ─────────────────────────────────────
  // カンマ表示ヘルパー（P-12）
  // ─────────────────────────────────────

  function _parseNum(str) {
    if (typeof str !== 'string') str = String(str ?? '');
    return parseFloat(str.replace(/,/g, '')) || 0;
  }

  function _attachCommaFormat(el, isDecimal) {
    if (!el) return;
    el.addEventListener('blur', () => {
      const raw = (el.value || '').replace(/,/g, '');
      const v = parseFloat(raw);
      if (!isNaN(v) && raw !== '') {
        el.value = isDecimal
          ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : Math.round(v).toLocaleString('en-US');
      }
    });
    el.addEventListener('focus', () => {
      const raw = (el.value || '').replace(/,/g, '');
      const v = parseFloat(raw);
      if (!isNaN(v) && raw !== '') {
        el.value = isDecimal ? String(v) : String(Math.round(v));
      }
    });
  }

  function _attachPctFormat(el) {
    if (!el) return;
    el.addEventListener('blur', () => {
      const v = parseFloat(el.value);
      if (!isNaN(v) && el.value !== '') el.value = v.toFixed(2);
    });
  }

  // ─────────────────────────────────────
  // 為替時刻フォーマット（P-18 【5】）
  // ─────────────────────────────────────

  function _fmtNow() {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mn = String(now.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mn} 時点`;
  }

  // ─────────────────────────────────────
  // 入力値読み取り
  // ─────────────────────────────────────

  function _readInputs(root) {
    return {
      price:          _parseNum(root.querySelector('#p-price')?.value  || ''),
      costJpy:        _parseNum(root.querySelector('#p-cost')?.value   || ''),
      plan:           root.querySelector('#p-plan')?.value             || DEFAULTS.plan,
      category:       root.querySelector('#p-category')?.value         || DEFAULTS.category,
      promotedRate:   (parseFloat(root.querySelector('#p-promoted')?.value) || 0) / 100,
      payoneerRate:   (parseFloat(root.querySelector('#p-payoneer')?.value) || 2) / 100,
      shippingMode:   root.querySelector('#p-ship-mode')?.value        || 'manual',
      shippingUsd:    _parseNum(root.querySelector('#p-ship-val')?.value    || ''),
      customsMode:    root.querySelector('#p-customs-mode')?.value     || 'manual',
      customsUsd:     _parseNum(root.querySelector('#p-customs-val')?.value || ''),
      customsPct:     parseFloat(root.querySelector('#p-customs-pct')?.value) || 0,
      authServiceJpy: _parseNum(root.querySelector('#p-auth-service')?.value || ''),
      usdJpy:         _parseNum(root.querySelector('#p-rate')?.value   || '') || DEFAULTS.usdJpy,
    };
  }

  // ─────────────────────────────────────
  // 最低承認可能価格逆算（P-18 【2】: 固定$35削除）
  // ─────────────────────────────────────

  function _calcMinPrice(inputs, mode, targetValue) {
    const FVF_CAP = 750;
    const feeRate = EBAY_FEE[inputs.plan]?.[inputs.category] ?? EBAY_FEE.basic.other;
    const promo   = inputs.promotedRate;
    const pay     = inputs.payoneerRate;
    const costUsd = inputs.costJpy / inputs.usdJpy;
    const authUsd = inputs.authServiceJpy / inputs.usdJpy;
    const fvfCapP = FVF_CAP / feeRate;

    // 送料: manual / buyer のみ（固定$35削除）
    const ship1 = inputs.shippingMode === 'manual' ? (inputs.shippingUsd || 0) : 0;
    const cust1 = inputs.customsMode === 'manual' ? (inputs.customsUsd || 0) : 0;
    const custPctRate = inputs.customsMode === 'pct' ? (inputs.customsPct || 0) / 100 : 0;

    const candidates = [];

    // 区間1: P < $500
    const fixed1 = ship1 + cust1 + costUsd;
    const varR1  = feeRate + promo + pay + custPctRate;
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

    // 区間3: P ≥ fvfCapP
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
  // タブ①: 販売価格逆算（循環なし設計）
  // ─────────────────────────────────────

  function _refreshCalcPrice(root) {
    const isPctActive = root.querySelector('#p-calc-target-pct-wrap')?.style.display !== 'none';
    const mode = isPctActive ? 'pct' : 'jpy';
    const targetVal = isPctActive
      ? parseFloat(root.querySelector('#p-calc-target-pct')?.value) || 0
      : _parseNum(root.querySelector('#p-calc-target-jpy')?.value || '');

    const inputs = _readInputs(root);
    const calcedPrice = _calcMinPrice(inputs, mode, targetVal);
    const resultEl    = root.querySelector('#p-calc-price-result');
    const priceInput  = root.querySelector('#p-price');

    if (targetVal === 0 || calcedPrice === null) {
      if (resultEl) {
        resultEl.textContent = targetVal === 0 ? '—' : '達成不可';
        resultEl.style.color = targetVal === 0 ? '' : 'var(--red)';
      }
      if (priceInput) priceInput.value = '';
      return;
    }
    if (resultEl) {
      resultEl.textContent = `$${calcedPrice.toFixed(2)}`;
      resultEl.style.color = 'var(--text-primary)';
    }
    // 程式的代入は input イベントを発火しないため循環なし
    if (priceInput) priceInput.value = calcedPrice.toFixed(2);
  }

  // ─────────────────────────────────────
  // ベストオファーシミュレーター: UI更新
  // ─────────────────────────────────────

  function _updateSimulator(root) {
    if (!root.querySelector('#p-sim-guide')) return;

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

    const offerRaw = root.querySelector('#p-sim-offer')?.value ?? '';
    const offer    = _parseNum(offerRaw);
    const hasOffer = offerRaw !== '' && offer >= 0;

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

    const mode = root.querySelector('#p-sim-tab-pct')?.classList.contains('sim-tab-active') ? 'pct' : 'jpy';
    const targetVal = mode === 'pct'
      ? parseFloat(root.querySelector('#p-sim-target-pct')?.value) || 0
      : _parseNum(root.querySelector('#p-sim-target-jpy')?.value || '');

    const minP = _calcMinPrice(inputs, mode, targetVal);
    if (minP === null) {
      set('#p-sim-min-price', 'この目標は達成不可', 'var(--red)');
    } else {
      set('#p-sim-min-price', `$${minP.toFixed(2)}`, 'var(--text-primary)');
    }
  }

  // ─────────────────────────────────────
  // ベストオファーシミュレーター: イベントバインド
  // ─────────────────────────────────────

  function _bindSimulatorEvents(root) {
    const setTab = (active) => {
      const pBtn = root.querySelector('#p-sim-tab-pct');
      const jBtn = root.querySelector('#p-sim-tab-jpy');
      const pW   = root.querySelector('#p-sim-target-pct-wrap');
      const jW   = root.querySelector('#p-sim-target-jpy-wrap');
      if (!pBtn) return;
      if (active === 'pct') {
        pBtn.classList.add('sim-tab-active');     jBtn.classList.remove('sim-tab-active');
        pBtn.style.background = 'var(--brand)';   pBtn.style.color = '#fff';
        jBtn.style.background = 'var(--card-bg)'; jBtn.style.color = 'var(--text-secondary)';
        if (pW) pW.style.display = 'flex'; if (jW) jW.style.display = 'none';
      } else {
        jBtn.classList.add('sim-tab-active');     pBtn.classList.remove('sim-tab-active');
        jBtn.style.background = 'var(--brand)';   jBtn.style.color = '#fff';
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

    _attachCommaFormat(root.querySelector('#p-sim-offer'),      true);
    _attachCommaFormat(root.querySelector('#p-sim-target-jpy'), false);
  }

  // ─────────────────────────────────────
  // 粗利率 ⇔ 粗利額 トグル（タブ②）: 換算計算
  // ─────────────────────────────────────

  function _updateRateAmountToggle(root) {
    const rateInput    = root.querySelector('#p-toggle-rate-input');
    const amountInput  = root.querySelector('#p-toggle-amount-input');
    const rateResult   = root.querySelector('#p-toggle-rate-result');
    const amountResult = root.querySelector('#p-toggle-amount-result');
    if (!rateInput) return;

    const price  = _parseNum(root.querySelector('#p-price')?.value  || '');
    const usdJpy = _parseNum(root.querySelector('#p-rate')?.value   || '') || DEFAULTS.usdJpy;
    const revJpy = price * usdJpy;

    if (rateResult) {
      const rv = parseFloat(rateInput.value);
      if (revJpy > 0 && !isNaN(rv) && rateInput.value !== '') {
        const profitJpy = Math.round(rv / 100 * revJpy);
        rateResult.textContent = `¥${profitJpy.toLocaleString()}`;
        rateResult.style.color = profitJpy >= 0 ? 'var(--text-primary)' : 'var(--red)';
      } else {
        rateResult.textContent = '—';
        rateResult.style.color = '';
      }
    }

    if (amountResult) {
      const av = _parseNum(amountInput.value);
      if (revJpy > 0 && av >= 0 && amountInput.value !== '') {
        amountResult.textContent = `${((av / revJpy) * 100).toFixed(2)}%`;
        amountResult.style.color = 'var(--text-primary)';
      } else {
        amountResult.textContent = '—';
        amountResult.style.color = '';
      }
    }
  }

  // ─────────────────────────────────────
  // 統合カード: イベントバインド（P-18 【1】）
  // ─────────────────────────────────────

  function _bindPriceCalcEvents(root) {
    const profitTabBtn = root.querySelector('#p-calc-tab-profit-btn');
    const priceTabBtn  = root.querySelector('#p-calc-tab-price-btn');
    const profitWrap   = root.querySelector('#p-calc-tab-profit-wrap');
    const priceWrap    = root.querySelector('#p-calc-tab-price-wrap');
    if (!profitTabBtn) return;

    const activateTab = (tab) => {
      const priceCol  = root.querySelector('#p-price-col');
      const targetCol = root.querySelector('#p-calc-target-col');
      if (tab === 'profit') {
        profitTabBtn.style.background = 'var(--brand)'; profitTabBtn.style.color = '#fff';
        priceTabBtn.style.background  = 'transparent';  priceTabBtn.style.color  = 'var(--text-secondary)';
        if (priceCol)   priceCol.style.display  = '';
        if (targetCol)  targetCol.style.display = 'none';
        if (profitWrap) profitWrap.style.display = 'block';
        if (priceWrap)  priceWrap.style.display  = 'none';
        const pi = root.querySelector('#p-price');
        if (pi) pi.value = '';
        _update(root);
      } else {
        priceTabBtn.style.background  = 'var(--brand)'; priceTabBtn.style.color  = '#fff';
        profitTabBtn.style.background = 'transparent';  profitTabBtn.style.color = 'var(--text-secondary)';
        if (priceCol)   priceCol.style.display  = 'none';
        if (targetCol)  targetCol.style.display = '';
        if (priceWrap)  priceWrap.style.display  = 'block';
        if (profitWrap) profitWrap.style.display = 'none';
        _refreshCalcPrice(root);
        _update(root);
      }
    };
    profitTabBtn.addEventListener('click', () => activateTab('profit'));
    priceTabBtn.addEventListener('click',  () => activateTab('price'));

    // ── タブ②: 粗利率⇔粗利額トグル ──
    const rateBtn    = root.querySelector('#p-toggle-rate-btn');
    const amountBtn  = root.querySelector('#p-toggle-amount-btn');
    const rateWrap   = root.querySelector('#p-toggle-rate-wrap');
    const amountWrap = root.querySelector('#p-toggle-amount-wrap');
    const rateInput  = root.querySelector('#p-toggle-rate-input');
    const amtInput   = root.querySelector('#p-toggle-amount-input');
    if (rateBtn) {
      const getRevJpy = () => {
        const p = _parseNum(root.querySelector('#p-price')?.value || '');
        const r = _parseNum(root.querySelector('#p-rate')?.value  || '') || DEFAULTS.usdJpy;
        return p * r;
      };
      rateBtn.addEventListener('click', () => {
        const av = _parseNum(amtInput?.value || '');
        const rev = getRevJpy();
        if (av >= 0 && rev > 0 && rateInput && amtInput.value !== '')
          rateInput.value = ((av / rev) * 100).toFixed(2);
        rateBtn.style.background   = 'var(--brand)'; rateBtn.style.color   = '#fff';
        amountBtn.style.background = 'transparent';  amountBtn.style.color = 'var(--text-secondary)';
        if (rateWrap)   rateWrap.style.display   = 'block';
        if (amountWrap) amountWrap.style.display = 'none';
        _updateRateAmountToggle(root);
      });
      amountBtn.addEventListener('click', () => {
        const rv = parseFloat(rateInput?.value);
        const rev = getRevJpy();
        if (!isNaN(rv) && rv >= 0 && rev > 0 && amtInput && rateInput.value !== '')
          amtInput.value = Math.round((rv / 100) * rev).toLocaleString('en-US');
        amountBtn.style.background = 'var(--brand)'; amountBtn.style.color = '#fff';
        rateBtn.style.background   = 'transparent';  rateBtn.style.color   = 'var(--text-secondary)';
        if (amountWrap) amountWrap.style.display = 'block';
        if (rateWrap)   rateWrap.style.display   = 'none';
        _updateRateAmountToggle(root);
      });
      let _toggleTimer;
      const debouncedToggle = () => {
        clearTimeout(_toggleTimer);
        _toggleTimer = setTimeout(() => _updateRateAmountToggle(root), 150);
      };
      rateInput?.addEventListener('input', debouncedToggle);
      amtInput?.addEventListener('input',  debouncedToggle);
      _attachCommaFormat(amtInput, false);
    }

    // ── タブ①: 目標トグル + 逆算 ──
    const calcPctBtn  = root.querySelector('#p-calc-toggle-pct-btn');
    const calcJpyBtn  = root.querySelector('#p-calc-toggle-jpy-btn');
    const calcPctWrap = root.querySelector('#p-calc-target-pct-wrap');
    const calcJpyWrap = root.querySelector('#p-calc-target-jpy-wrap');
    if (calcPctBtn) {
      calcPctBtn.addEventListener('click', () => {
        calcPctBtn.style.background = 'var(--brand)'; calcPctBtn.style.color = '#fff';
        calcJpyBtn.style.background = 'transparent';  calcJpyBtn.style.color = 'var(--text-secondary)';
        if (calcPctWrap) calcPctWrap.style.display = 'block';
        if (calcJpyWrap) calcJpyWrap.style.display = 'none';
        _refreshCalcPrice(root); _update(root);
      });
      calcJpyBtn.addEventListener('click', () => {
        calcJpyBtn.style.background = 'var(--brand)'; calcJpyBtn.style.color = '#fff';
        calcPctBtn.style.background = 'transparent';  calcPctBtn.style.color = 'var(--text-secondary)';
        if (calcJpyWrap) calcJpyWrap.style.display = 'block';
        if (calcPctWrap) calcPctWrap.style.display = 'none';
        _refreshCalcPrice(root); _update(root);
      });
      let _calcTimer;
      const debouncedCalc = () => {
        clearTimeout(_calcTimer);
        _calcTimer = setTimeout(() => { _refreshCalcPrice(root); _update(root); }, 150);
      };
      root.querySelector('#p-calc-target-pct')?.addEventListener('input', debouncedCalc);
      root.querySelector('#p-calc-target-jpy')?.addEventListener('input', debouncedCalc);
      _attachCommaFormat(root.querySelector('#p-calc-target-jpy'), false);
      _attachPctFormat(root.querySelector('#p-calc-target-pct'));
    }
  }

  // ─────────────────────────────────────
  // 統合カード HTML生成（P-18 【1】【3】）
  // ─────────────────────────────────────

  function _renderPriceCalcCard() {
    return `
      <div class="card" style="margin-bottom:12px" id="p-calc-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div class="card-title" style="margin:0">価格・原価・粗利</div>
          <div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden">
            <button id="p-calc-tab-profit-btn" style="padding:5px 12px;font-size:11px;border:none;cursor:pointer;background:var(--brand);color:#fff;font-weight:500">粗利を求める</button>
            <button id="p-calc-tab-price-btn"  style="padding:5px 12px;font-size:11px;border:none;cursor:pointer;background:transparent;color:var(--text-secondary)">販売価格を求める</button>
          </div>
        </div>

        <!-- 仕入原価 + 右セル(タブ依存) 横並び1行 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="input-group">
            <label class="input-label" for="p-cost">仕入れ原価</label>
            <div class="input-wrap">
              <input class="input" id="p-cost" type="text" inputmode="numeric" placeholder="0" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
              <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">¥</div>
            </div>
          </div>

          <!-- タブ②: 販売価格 -->
          <div id="p-price-col" class="input-group">
            <label class="input-label" for="p-price">販売価格</label>
            <div class="input-wrap">
              <input class="input" id="p-price" type="text" inputmode="decimal" placeholder="0.00" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
              <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">$</div>
            </div>
          </div>

          <!-- タブ①: 目標トグル -->
          <div id="p-calc-target-col" style="display:none">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <label class="input-label" style="margin:0">目標</label>
              <div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden">
                <button id="p-calc-toggle-pct-btn" style="padding:3px 9px;font-size:11px;border:none;cursor:pointer;background:var(--brand);color:#fff;font-weight:500">%</button>
                <button id="p-calc-toggle-jpy-btn" style="padding:3px 9px;font-size:11px;border:none;cursor:pointer;background:transparent;color:var(--text-secondary)">¥</button>
              </div>
            </div>
            <div id="p-calc-target-pct-wrap">
              <div class="input-wrap" style="max-width:130px">
                <input class="input" id="p-calc-target-pct" type="number" min="0" max="100" step="0.01" placeholder="25.00" style="text-align:right">
                <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
              </div>
            </div>
            <div id="p-calc-target-jpy-wrap" style="display:none">
              <div class="input-wrap" style="max-width:130px">
                <input class="input" id="p-calc-target-jpy" type="text" inputmode="numeric" placeholder="20000" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
                <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">¥</div>
              </div>
            </div>
          </div>
        </div>

        <!-- タブ②: 粗利率⇔粗利額トグルセクション -->
        <div id="p-calc-tab-profit-wrap">
          <div style="border-top:1px solid var(--border);padding-top:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <div style="font-size:11px;color:var(--text-muted)">粗利率 ⇔ 粗利額</div>
              <div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden">
                <button id="p-toggle-rate-btn"   style="padding:4px 10px;font-size:11px;border:none;cursor:pointer;background:var(--brand);color:#fff;font-weight:500">粗利率 %</button>
                <button id="p-toggle-amount-btn" style="padding:4px 10px;font-size:11px;border:none;cursor:pointer;background:transparent;color:var(--text-secondary)">粗利額 ¥</button>
              </div>
            </div>

            <!-- 粗利率トグル -->
            <div id="p-toggle-rate-wrap">
              <div class="input-group" style="margin-bottom:8px">
                <label class="input-label">粗利率（目標）</label>
                <div class="input-wrap" style="max-width:130px">
                  <input class="input" id="p-toggle-rate-input" type="number" min="0" max="100" step="0.01" placeholder="25.00" style="text-align:right">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">対応粗利額</span>
                <span id="p-toggle-rate-result" style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--text-primary)">—</span>
              </div>
            </div>

            <!-- 粗利額トグル -->
            <div id="p-toggle-amount-wrap" style="display:none">
              <div class="input-group" style="margin-bottom:8px">
                <label class="input-label">粗利額（目標）</label>
                <div class="input-wrap" style="max-width:130px">
                  <input class="input" id="p-toggle-amount-input" type="text" inputmode="numeric" placeholder="20000" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
                  <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">¥</div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">対応粗利率</span>
                <span id="p-toggle-amount-result" style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--text-primary)">—</span>
              </div>
            </div>
          </div>
        </div>

        <!-- タブ①: 逆算結果 -->
        <div id="p-calc-tab-price-wrap" style="display:none">
          <div style="border-top:1px solid var(--border);padding-top:12px">
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:4px">販売価格（逆算）</div>
            <div id="p-calc-price-result" style="font-family:var(--font-mono);font-size:24px;font-weight:700;color:var(--text-primary)">—</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">手数料・送料・原価を考慮した逆算価格</div>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────
  // ベストオファーシミュレーター HTML生成
  // ─────────────────────────────────────

  function _renderSimulator() {
    const s      = BA.settings?.get?.() ?? {};
    const defPct = Number(s.targetMargin    ?? 25) || 25;
    const defJpy = Number(s.targetProfitJpy ?? 0)  || 0;

    return `
      <div class="card" style="margin-bottom:16px" id="p-sim-wrap">
        <div class="card-title">ベストオファーシミュレーター</div>

        <div id="p-sim-guide" style="font-size:13px;color:var(--text-muted);line-height:1.8">
          先に利益計算機で販売価格または<br>仕入れ原価を入力してください。
        </div>

        <div id="p-sim-content" style="display:none">
          <div class="input-group" style="margin-bottom:12px">
            <label class="input-label">オファー金額</label>
            <div class="input-wrap">
              <input class="input" id="p-sim-offer" type="text" inputmode="decimal"
                placeholder="バイヤーの提示価格" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
              <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">$</div>
            </div>
            <div id="p-sim-diff" style="font-size:12px;margin-top:6px;
              font-family:var(--font-mono);color:var(--text-muted)">—</div>
          </div>

          <div class="input-group" style="margin-bottom:14px">
            <label class="input-label">目標</label>
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
              <input class="input" id="p-sim-target-pct" type="number" min="0" max="100"
                step="0.1" value="${defPct}" style="text-align:right">
              <span style="font-size:13px;color:var(--text-muted)">%</span>
            </div>
            <div id="p-sim-target-jpy-wrap" style="display:none;align-items:center;gap:6px">
              <span style="font-size:13px;color:var(--text-muted)">¥</span>
              <input class="input" id="p-sim-target-jpy" type="text" inputmode="numeric"
                value="${defJpy}" style="text-align:right">
            </div>
          </div>

          <div style="border-top:1px solid var(--border);padding-top:12px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:2px">粗利益 USD</div>
                <div style="font-size:20px;font-weight:700;font-family:var(--font-mono)" id="p-sim-profit-usd">—</div>
              </div>
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:2px">粗利益 JPY</div>
                <div style="font-size:20px;font-weight:700;font-family:var(--font-mono)" id="p-sim-profit-jpy">—</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:2px">粗利率</div>
                <div style="font-size:18px;font-weight:600;font-family:var(--font-mono)" id="p-sim-rate">—</div>
              </div>
              <div>
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:2px">ROI</div>
                <div style="font-size:18px;font-weight:600;font-family:var(--font-mono)" id="p-sim-roi">—</div>
              </div>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:10px">
              <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:4px">最低承認可能価格</div>
              <div style="font-size:22px;font-weight:700;font-family:var(--font-mono)" id="p-sim-min-price">—</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px">目標を満たす最小オファー価格</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────
  // 計算ロジック（P-18 【2】: 固定$35削除）
  // ─────────────────────────────────────

  function _calculate(params) {
    const {
      sellingPriceUsd,
      costJpy,
      plan,
      category,
      promotedRate,
      payoneerRate,
      shippingMode,
      shippingUsd,
      customsMode,
      customsUsd,
      customsPct,
      authServiceJpy,
      usdJpy,
      holdingDays,
    } = params;

    const selling  = sellingPriceUsd;
    const above500 = selling >= DEFAULTS.threshold500;

    const FVF_CAP_USD = 750;
    const feeRate    = EBAY_FEE[plan]?.[category] ?? EBAY_FEE.basic.other;
    const ebayFeeUsd = Math.min(selling * feeRate, FVF_CAP_USD);

    const promotedUsd = selling * (promotedRate || 0);
    const payoneerUsd = selling * (payoneerRate ?? DEFAULTS.payoneerRate);

    // 送料: manual / buyer のみ（固定$35削除）
    let effectiveShippingUsd = 0;
    if (!above500) {
      if (shippingMode === 'manual') effectiveShippingUsd = shippingUsd || 0;
    }

    let effectiveCustomsUsd = 0;
    if (!above500) {
      if (customsMode === 'manual')   effectiveCustomsUsd = customsUsd || 0;
      else if (customsMode === 'pct') effectiveCustomsUsd = selling * ((customsPct || 0) / 100);
    }

    const authServiceUsd = above500
      ? (authServiceJpy ?? DEFAULTS.authServiceJpy) / usdJpy
      : 0;

    const costUsd = (costJpy || 0) / usdJpy;

    const totalDeductions = ebayFeeUsd + promotedUsd + payoneerUsd
                          + effectiveShippingUsd + effectiveCustomsUsd
                          + authServiceUsd + costUsd;
    const grossProfitUsd = selling - totalDeductions;
    const grossProfitJpy = grossProfitUsd * usdJpy;
    const profitRate     = selling > 0 ? (grossProfitUsd / selling) * 100 : 0;

    const days = holdingDays && holdingDays > 0 ? holdingDays : null;
    const ppd  = {
      usd: days ? grossProfitUsd / days : null,
      jpy: days ? grossProfitJpy / days : null,
    };

    return {
      grossProfitUsd,
      grossProfitJpy,
      profitRate,
      ppd,
      breakdown: {
        sellingUsd:      selling,
        ebayFeeUsd,
        promotedUsd,
        payoneerUsd,
        shippingUsd:     effectiveShippingUsd,
        customsUsd:      effectiveCustomsUsd,
        authServiceUsd,
        costUsd,
        feeRate,
        above500,
      },
    };
  }

  // ─────────────────────────────────────
  // 空状態内訳プレースホルダー
  // ─────────────────────────────────────

  function _emptyBreakdown() {
    const items = ['eBay手数料','Promoted','Payoneer','送料','関税','真贋サービス','仕入れ原価'];
    return items.map(label => `
      <tr>
        <td style="color:#999999;font-size:14px;padding:8px 0">${label}</td>
        <td style="color:#999999;font-size:14px;text-align:right;padding:8px 0">—</td>
      </tr>
    `).join('');
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

  function _render(root) {
    root.innerHTML = `
      ${_tutorialBanner()}
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:16px 36px">
        <div class="profit-3col" style="display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:40px;align-items:start">

        <!-- LEFT: 入力フォーム -->
        <div>

          <!-- 基本設定 + 適用手数料率 一体化（P-18 【3】） -->
          <div class="card" style="margin-bottom:12px">
            <div class="card-title">基本設定</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">
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
            <!-- インライン手数料率表示（P-18 【3】） -->
            <div style="border-top:1px solid var(--border);padding-top:10px">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="font-size:11px;color:var(--text-muted)">適用手数料率</div>
                <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--amber)" id="p-fee-rate-display">—</div>
              </div>
              <div style="font-size:11px;color:var(--text-muted);text-align:right;margin-top:2px" id="p-fee-rate-label">
                プランとカテゴリを選択してください
              </div>
            </div>
          </div>

          <!-- 価格・原価・粗利 統合カード（P-18 【1】） -->
          ${_renderPriceCalcCard()}

          <!-- PPD: 在庫保有日数 -->
          <div class="card" style="margin-bottom:12px">
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
          <div class="card" style="margin-bottom:12px">
            <div class="card-title">手数料</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="input-group">
                <label class="input-label" for="p-promoted">Promoted Listings</label>
                <div class="input-wrap">
                  <input class="input" id="p-promoted" type="text" inputmode="decimal" value="0.00">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>
              <div class="input-group">
                <label class="input-label" for="p-payoneer">Payoneer 手数料</label>
                <div class="input-wrap">
                  <input class="input" id="p-payoneer" type="text" inputmode="decimal" value="2.00">
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

            <!-- $500未満: 送料2択 + 関税3択（固定$35削除） -->
            <div id="p-below500">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                <div class="input-group">
                  <label class="input-label" for="p-ship-mode">送料</label>
                  <select class="select" id="p-ship-mode">
                    <option value="manual">手動入力</option>
                    <option value="buyer">バイヤー負担</option>
                  </select>
                </div>
                <div class="input-group" id="p-ship-manual-wrap">
                  <label class="input-label" for="p-ship-val">送料（手動）</label>
                  <div class="input-wrap">
                    <input class="input" id="p-ship-val" type="text" inputmode="decimal" value="0" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
                    <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">$</div>
                  </div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="input-group">
                  <label class="input-label" for="p-customs-mode">関税</label>
                  <select class="select" id="p-customs-mode">
                    <option value="manual">手動入力</option>
                    <option value="zero">$0（バイヤー負担）</option>
                    <option value="pct">販売額の %</option>
                  </select>
                </div>
                <div id="p-customs-input-cell">
                  <div class="input-group" id="p-customs-manual-wrap">
                    <label class="input-label" for="p-customs-val">関税（手動）</label>
                    <div class="input-wrap">
                      <input class="input" id="p-customs-val" type="text" inputmode="decimal" value="0" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
                      <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">$</div>
                    </div>
                  </div>
                  <div class="input-group" id="p-customs-pct-wrap" style="display:none">
                    <label class="input-label" for="p-customs-pct">関税率</label>
                    <div class="input-wrap">
                      <input class="input" id="p-customs-pct" type="number" min="0" max="100" step="0.01" value="0" style="text-align:right">
                      <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- $500以上: 自動表示 -->
            <div id="p-above500" style="display:none">
              <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:4px;padding:10px 14px;font-size:12px;color:var(--text-secondary);line-height:1.8">
                💡 $500以上のため<strong style="color:var(--amber)">国際送料・関税はバイヤー負担（$0）</strong>で計算します。<br>
                真贋サービス国内送料のみセラー負担となります。
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
                <div class="input-group">
                  <label class="input-label">国際送料</label>
                  <div class="input-wrap">
                    <input class="input" type="number" value="0" disabled style="opacity:0.4;border-right:none;border-radius:6px 0 0 6px">
                    <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0;opacity:0.4">$</div>
                  </div>
                </div>
                <div class="input-group">
                  <label class="input-label" for="p-auth-service">真贋サービス送料</label>
                  <div class="input-wrap">
                    <input class="input" id="p-auth-service" type="text" inputmode="numeric" value="1500" style="text-align:right;border-right:none;border-radius:6px 0 0 6px">
                    <div class="input-prefix" style="border-right:1px solid var(--border);border-radius:0 8px 8px 0">¥</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- CENTER: シミュレーター・為替 -->
        <div>

          ${_renderSimulator()}

          <!-- 為替レート（P-18 【4】【5】） -->
          <div class="card" style="margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div class="card-title" style="margin:0">為替レート</div>
              <button class="btn btn-ghost" id="p-refresh-rate" style="font-size:10px;padding:4px 8px">
                ↻ 更新
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <!-- P-18 【4】: 為替入力欄幅 160px -->
              <div class="input-group" style="flex:none;width:160px">
                <label class="input-label" for="p-rate">1 USD =</label>
                <div class="input-wrap">
                  <input class="input" id="p-rate" type="text" inputmode="decimal" value="150" style="text-align:right">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">JPY</div>
                </div>
              </div>
              <!-- P-18 【5】: デフォルト時刻表示 -->
              <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);padding-top:20px;flex:1" id="p-rate-updated">
                —
              </div>
            </div>
          </div>

        </div>

        <!-- RIGHT: 結果系（P-18 【6】: 外枠一体化） -->
        <div>
          <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:16px">

            <!-- 粗利益サマリー -->
            <div class="card" style="margin-bottom:16px;border-color:var(--border-active)">
              <div class="card-title">粗利益（シミュレーション）</div>
              <div style="margin-bottom:10px">
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:4px">JPY</div>
                <div class="card-value" id="p-result-jpy" style="font-size:2.2rem">¥0</div>
              </div>
              <div style="margin-bottom:16px">
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:2px">USD</div>
                <div class="card-value" id="p-result-usd" style="font-size:1.4rem">$0.00</div>
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

            <!-- 費用内訳 -->
            <div class="card">
              <div class="card-title">費用内訳</div>
              <table class="data-table" id="p-breakdown-table">
                <tbody>${_emptyBreakdown()}</tbody>
              </table>
            </div>

          </div>
        </div>

        </div>
      </div>
    `;

    root.querySelector('#profit-tut-close')?.addEventListener('click', () => {
      try { localStorage.setItem(_HINT_KEY_PROFIT, '1'); } catch {}
      root.querySelector('#profit-tut-banner')?.remove();
    });

    _bindEvents(root);
    _bindPriceCalcEvents(root);
    _bindSimulatorEvents(root);
    _update(root);
  }

  // ─────────────────────────────────────
  // イベントバインド（共通入力変化監視）
  // ─────────────────────────────────────

  function _bindEvents(root) {
    root.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input',  () => _update(root));
      el.addEventListener('change', () => _update(root));
    });

    root.querySelector('#p-ship-mode')?.addEventListener('change', e => {
      const wrap = root.querySelector('#p-ship-manual-wrap');
      if (wrap) wrap.style.visibility = e.target.value === 'manual' ? 'visible' : 'hidden';
    });

    root.querySelector('#p-customs-mode')?.addEventListener('change', e => {
      const manualWrap = root.querySelector('#p-customs-manual-wrap');
      const pctWrap    = root.querySelector('#p-customs-pct-wrap');
      const mode = e.target.value;
      if (manualWrap) manualWrap.style.display = mode === 'manual' ? '' : 'none';
      if (pctWrap)    pctWrap.style.display    = mode === 'pct'    ? '' : 'none';
    });

    _attachCommaFormat(root.querySelector('#p-price'),        true);
    _attachCommaFormat(root.querySelector('#p-cost'),         false);
    _attachCommaFormat(root.querySelector('#p-ship-val'),     true);
    _attachCommaFormat(root.querySelector('#p-customs-val'),  true);
    _attachCommaFormat(root.querySelector('#p-auth-service'), false);
    _attachCommaFormat(root.querySelector('#p-rate'),         true);

    _attachPctFormat(root.querySelector('#p-promoted'));
    _attachPctFormat(root.querySelector('#p-payoneer'));
    _attachPctFormat(root.querySelector('#p-customs-pct'));

    root.querySelector('#p-refresh-rate')?.addEventListener('click', async () => {
      const btn = root.querySelector('#p-refresh-rate');
      if (btn) btn.textContent = '↻ 取得中...';
      try {
        _exchangeRate = await BA.api?.getExchangeRate?.() ?? DEFAULTS.usdJpy;
        const rateInput = root.querySelector('#p-rate');
        if (rateInput) rateInput.value = _exchangeRate.toFixed(2);
        const updEl = root.querySelector('#p-rate-updated');
        if (updEl) updEl.textContent = _fmtNow();
        _update(root);
      } catch {
        BA.notify?.toast?.('為替レートの取得に失敗しました', 'error');
      } finally {
        if (btn) btn.textContent = '↻ 更新';
      }
    });
  }

  // ─────────────────────────────────────
  // 計算実行 → 結果 UI 更新
  // ─────────────────────────────────────

  function _update(root) {
    // タブ①（販売価格を求める）がアクティブなら先に逆算更新
    const isCalcPriceTab = root.querySelector('#p-calc-tab-price-wrap')?.style.display !== 'none';
    if (isCalcPriceTab) _refreshCalcPrice(root);

    const price      = _parseNum(root.querySelector('#p-price')?.value  || '');
    const cost       = _parseNum(root.querySelector('#p-cost')?.value   || '');
    const plan       = root.querySelector('#p-plan')?.value   || DEFAULTS.plan;
    const cat        = root.querySelector('#p-category')?.value || DEFAULTS.category;
    const promo      = (parseFloat(root.querySelector('#p-promoted')?.value) || 0) / 100;
    const payRate    = (parseFloat(root.querySelector('#p-payoneer')?.value) || 2) / 100;
    const shipMode   = root.querySelector('#p-ship-mode')?.value   || 'manual';
    const shipVal    = _parseNum(root.querySelector('#p-ship-val')?.value    || '');
    const custMode   = root.querySelector('#p-customs-mode')?.value  || 'manual';
    const custVal    = _parseNum(root.querySelector('#p-customs-val')?.value || '');
    const custPct    = parseFloat(root.querySelector('#p-customs-pct')?.value) || 0;
    const authSvc    = _parseNum(root.querySelector('#p-auth-service')?.value || '') || DEFAULTS.authServiceJpy;
    const rate       = _parseNum(root.querySelector('#p-rate')?.value   || '') || DEFAULTS.usdJpy;
    const holdingDays = parseFloat(root.querySelector('#p-holding-days')?.value) || 0;
    const above500   = price >= DEFAULTS.threshold500;

    const below = root.querySelector('#p-below500');
    const above = root.querySelector('#p-above500');
    if (below) below.style.display = above500 ? 'none' : 'block';
    if (above) above.style.display = above500 ? 'block' : 'none';
    const tag = root.querySelector('#p-boundary-tag');
    if (tag) {
      tag.className   = `tag ${above500 ? 'go' : 'caution'}`;
      tag.textContent = above500 ? '$500 以上（真贋サービス対象）' : '$500 未満';
    }

    const result = _calculate({
      sellingPriceUsd: price,
      costJpy: cost,
      plan, category: cat,
      promotedRate: promo,
      payoneerRate: payRate,
      shippingMode: shipMode,
      shippingUsd:  shipVal,
      customsMode:  custMode,
      customsUsd:   custVal,
      customsPct:   custPct,
      authServiceJpy: authSvc,
      usdJpy: rate,
      holdingDays,
    });

    const profitUsd  = result.grossProfitUsd;
    const profitJpy  = result.grossProfitJpy;
    const profitRate = result.profitRate;
    const color = profitUsd >= 0 ? 'var(--green)' : 'var(--red)';

    const usdEl  = root.querySelector('#p-result-usd');
    const jpyEl  = root.querySelector('#p-result-jpy');
    const rateEl = root.querySelector('#p-result-rate');
    if (usdEl)  { usdEl.textContent  = `$${profitUsd.toFixed(2)}`;                   usdEl.style.color  = color; }
    if (jpyEl)  { jpyEl.textContent  = `¥${Math.round(profitJpy).toLocaleString()}`; jpyEl.style.color  = color; }
    if (rateEl) { rateEl.textContent = `${profitRate.toFixed(1)}%`;                  rateEl.style.color = color; }

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

    const meterFill = root.querySelector('#p-profit-meter');
    if (meterFill) {
      const pct = Math.max(0, Math.min(100, profitRate));
      if (BA.charts?.meterBar) {
        BA.charts.meterBar(meterFill, pct, 100, profitRate >= 25 ? 'green' : profitRate >= 0 ? 'amber' : 'red');
      } else {
        meterFill.style.width = `${pct}%`;
      }
    }

    const tbody = root.querySelector('#p-breakdown-table tbody');
    if (tbody && price > 0) {
      const b = result.breakdown;
      const rows = [
        ['販売価格',        `$${b.sellingUsd.toFixed(2)}`],
        ['eBay 手数料',     `-$${b.ebayFeeUsd.toFixed(2)}`],
        b.promotedUsd    > 0 ? ['Promoted Listings', `-$${b.promotedUsd.toFixed(2)}`]    : null,
        [`Payoneer 手数料`, `-$${b.payoneerUsd.toFixed(2)}`],
        b.shippingUsd    > 0 ? ['送料',               `-$${b.shippingUsd.toFixed(2)}`]   : null,
        b.customsUsd     > 0 ? ['関税',               `-$${b.customsUsd.toFixed(2)}`]    : null,
        b.authServiceUsd > 0 ? ['真贋サービス送料',   `-$${b.authServiceUsd.toFixed(2)}`]: null,
        b.costUsd        > 0 ? ['仕入れ原価',         `-$${b.costUsd.toFixed(2)}`]       : null,
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

    const ppdUsdEl = root.querySelector('#p-ppd-usd');
    const ppdJpyEl = root.querySelector('#p-ppd-jpy');
    if (ppdUsdEl && ppdJpyEl) {
      if (result.ppd.usd !== null) {
        ppdUsdEl.textContent = `$${result.ppd.usd.toFixed(2)}`;
        ppdUsdEl.style.color = result.ppd.usd >= 0 ? 'var(--green)' : 'var(--red)';
        ppdJpyEl.textContent = `¥${Math.round(result.ppd.jpy).toLocaleString()}`;
        ppdJpyEl.style.color = result.ppd.jpy >= 0 ? 'var(--green)' : 'var(--red)';
      } else {
        ppdUsdEl.textContent = '—'; ppdUsdEl.style.color = '';
        ppdJpyEl.textContent = '—'; ppdJpyEl.style.color = '';
      }
    }

    const feeRate = result.breakdown.feeRate;
    const feeDisp = root.querySelector('#p-fee-rate-display');
    const feeLab  = root.querySelector('#p-fee-rate-label');
    if (feeDisp) feeDisp.textContent = `${(feeRate * 100).toFixed(2)}%`;
    if (feeLab)  feeLab.textContent  = `${PLAN_LABELS[plan] ?? plan} / ${CATEGORY_LABELS[cat] ?? cat}`;

    _updateRateAmountToggle(root);
    _updateSimulator(root);
  }

  // ─────────────────────────────────────
  // 学習値をフォームに反映
  // ─────────────────────────────────────

  function _applyLearnedRates(root) {
    const learned = BA.transactions?.getLearned?.();
    if (!learned || learned.isFallback) return;
    const promoInput = root.querySelector('#p-promoted');
    const payerInput = root.querySelector('#p-payoneer');
    const authInput  = root.querySelector('#p-auth-service');
    if (promoInput) promoInput.value = (learned.promotedRate  * 100).toFixed(2);
    if (payerInput) payerInput.value = (learned.payoneerRate  * 100).toFixed(2);
    if (authInput)  authInput.value  = learned.authServiceJpy;
    _update(root);
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────

  const profit = {
    async init() {
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
          const updEl = root.querySelector('#p-rate-updated');
          // P-18 【5】: 初期表示時刻をデフォルト表示
          if (updEl) updEl.textContent = _fmtNow();
        }
      });

      document.addEventListener('ba:settings-changed', ({ detail }) => {
        const root = document.getElementById('profit-root');
        if (!root || !_rendered) return;
        const payoneerEl = root.querySelector('#p-payoneer');
        const authSvcEl  = root.querySelector('#p-auth-service');
        if (payoneerEl && detail.payoneerRate   != null) payoneerEl.value = Number(detail.payoneerRate).toFixed(2);
        if (authSvcEl  && detail.authServiceJpy != null) authSvcEl.value  = detail.authServiceJpy;
        _update(root);
      });

      const root = document.getElementById('profit-root');
      if (root && !_rendered) {
        _rendered = true;
        _render(root);
        _applyLearnedRates(root);
        const rateInput = root.querySelector('#p-rate');
        if (rateInput) {
          rateInput.value = _exchangeRate.toFixed(2);
          const updEl = root.querySelector('#p-rate-updated');
          if (updEl) updEl.textContent = _fmtNow();
        }
      }
    },
  };

  window.BA.profit = profit;

})();
