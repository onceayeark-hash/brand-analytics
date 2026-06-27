// @not-security-critical （grep確認済み・認証情報/トークン/APIキーを扱わない・2026-06-25判断）
/**
 * BRAND ANALYTICS — sourcing.js
 * 仕入れメーター：仕入れ可能価格帯の提示（FREE 機能）
 *
 * GO/NO-GO判定は廃止（CLAUDE.md確定）。判断は常にセラーが行う。
 * 想定販売価格・目標粗利率から、profit.jsと同じ手数料式で
 * 「仕入れ可能価格帯 ¥0〜¥Y」を逆算して提示する。
 *
 * 補助指標（UIで変更可）:
 *   競合増加率 ≤ 15%（デフォルト）
 *   成約率    > 30%（デフォルト・手動入力・Terapeak API 未取得のため手動）
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const DEFAULTS = {
    profitThreshold:      25,  // %
    competitorThreshold:  15,  // %
    sellRateThreshold:    30,  // %
  };

  let _rendered = false;

  // ─── 仕入れ可能価格帯（profit.js の手数料式で逆算） ──────
  function _calcPriceBand(sellingPriceUsd, targetMarginPct) {
    if (!(sellingPriceUsd > 0) || !window.BA.profit?.calculate) return null;

    const D      = window.BA.profit.DEFAULTS ?? {};
    const usdJpy = window.BA.profit.getExchangeRate?.() ?? D.usdJpy ?? 150;

    // 仕入れ原価0円時の粗利益 = 仕入れ原価以外の手数料を引いた残り
    const base = window.BA.profit.calculate({
      sellingPriceUsd,
      costJpy:        0,
      plan:           D.plan ?? 'basic',
      category:       D.category ?? 'handbags',
      promotedRate:   D.promotedRate ?? 0,
      payoneerRate:   D.payoneerRate ?? 0.02,
      shippingMode:   'manual',
      shippingUsd:    0,
      customsMode:    'zero',
      customsUsd:     0,
      customsPct:     0,
      authServiceJpy: D.authServiceJpy ?? 1500,
      usdJpy,
      holdingDays:    0,
    });

    const targetProfitUsd = sellingPriceUsd * (targetMarginPct / 100);
    const maxCostUsd       = base.grossProfitUsd - targetProfitUsd;

    return {
      achievable: maxCostUsd >= 0,
      maxCostJpy: Math.max(0, maxCostUsd * usdJpy),
    };
  }

  function _render(root) {
    root.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

        <!-- 左: 入力 -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">商品データ</div>
            <div style="display:flex;flex-direction:column;gap:12px">

              <div class="input-group">
                <label class="input-label" for="s-sell-price">想定販売価格（USD）</label>
                <div class="input-wrap">
                  <div class="input-prefix">$</div>
                  <input class="input" id="s-sell-price" type="number" min="0" step="0.01" value="0">
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="s-profit">粗利率（利益計算機から）</label>
                <div class="input-wrap">
                  <input class="input" id="s-profit" type="number" min="0" max="100" step="0.1" value="0">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="s-competitors">競合出品数増加率（30日比較）</label>
                <div class="input-wrap">
                  <input class="input" id="s-competitors" type="number" min="-100" max="500" step="1" value="0">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="s-sellrate">Terapeak 成約率（手動入力）</label>
                <div class="input-wrap">
                  <input class="input" id="s-sellrate" type="number" min="0" max="100" step="1" value="0">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:4px">
                  ※ Terapeak API 未取得のため手動入力
                </div>
              </div>

            </div>
          </div>

          <!-- 閾値設定 -->
          <div class="card">
            <div class="card-title">判定閾値（変更可）</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div class="input-group">
                <label class="input-label" for="s-t-profit">目標粗利率 ≥</label>
                <div class="input-wrap">
                  <input class="input" id="s-t-profit" type="number" min="1" max="100" step="1" value="25">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>
              <div class="input-group">
                <label class="input-label" for="s-t-comp">競合増加上限 ≤</label>
                <div class="input-wrap">
                  <input class="input" id="s-t-comp" type="number" min="1" max="500" step="1" value="15">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>
              <div class="input-group">
                <label class="input-label" for="s-t-sell">最低成約率 &gt;</label>
                <div class="input-wrap">
                  <input class="input" id="s-t-sell" type="number" min="1" max="100" step="1" value="30">
                  <div class="input-prefix" style="border-left:none;border-right:1px solid var(--border);border-radius:0 3px 3px 0">%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右: 判定結果 -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">仕入れ可能価格帯</div>
            <div id="s-verdict-guide" style="display:flex;flex-direction:column;align-items:center;
              justify-content:center;padding:24px 0;gap:10px;text-align:center">
              <div style="font-size:32px;line-height:1">⚡</div>
              <div style="font-size:12px;color:var(--text-muted);line-height:1.7">
                想定販売価格を入力すると<br>目標粗利率を満たす仕入れ可能価格帯が表示されます
              </div>
            </div>
            <div style="font-family:var(--font-mono);font-size:32px;font-weight:600;
              text-align:center;padding:20px 0;display:none" id="s-verdict-label"></div>
            <div style="font-size:12px;color:var(--text-secondary);text-align:center;
              padding-bottom:8px;display:none" id="s-verdict-desc"></div>
          </div>

          <!-- 条件チェックリスト -->
          <div class="card">
            <div class="card-title">条件チェック</div>
            <div style="display:flex;flex-direction:column;gap:10px" id="s-conditions">
              ${_conditionRow('s-c1', '粗利率')}
              ${_conditionRow('s-c2', '競合増加率')}
              ${_conditionRow('s-c3', '成約率')}
            </div>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll('input').forEach(el => el.addEventListener('input', () => {
      el.dataset.touched = '1';
      _updateVerdict(root);
    }));
  }

  function _conditionRow(id, label) {
    return `
      <div style="display:flex;align-items:center;gap:10px" id="${id}">
        <div class="s-dot" style="width:16px;height:16px;border-radius:50%;
          background:var(--bg-elevated);border:1.5px solid var(--border);
          flex-shrink:0;display:flex;align-items:center;justify-content:center;
          font-size:9px;color:transparent;transition:background-color .15s,border-color .15s"></div>
        <div style="flex:1;font-size:12px;color:var(--text-secondary)">${label}</div>
        <div class="s-val" style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">未入力</div>
      </div>
    `;
  }

  function _updateVerdict(root) {
    const sellPriceInput = root.querySelector('#s-sell-price');
    const profitInput    = root.querySelector('#s-profit');
    const compInput      = root.querySelector('#s-competitors');
    const sellInput      = root.querySelector('#s-sellrate');

    const sellingPriceUsd  = parseFloat(sellPriceInput?.value) ?? 0;
    const profitRate       = parseFloat(profitInput?.value)  ?? 0;
    const competitorGrowth = parseFloat(compInput?.value)    ?? 0;
    const sellRate         = parseFloat(sellInput?.value)    ?? 0;
    const tProfit   = parseFloat(root.querySelector('#s-t-profit')?.value) || DEFAULTS.profitThreshold;
    const tComp     = parseFloat(root.querySelector('#s-t-comp')?.value)   || DEFAULTS.competitorThreshold;
    const tSell     = parseFloat(root.querySelector('#s-t-sell')?.value)   || DEFAULTS.sellRateThreshold;

    // 入力済み判定（data-touched または値が 0 以外）
    const touched = [
      profitInput?.dataset.touched  === '1' || profitRate  !== 0,
      compInput?.dataset.touched    === '1' || competitorGrowth !== 0,
      sellInput?.dataset.touched    === '1' || sellRate    !== 0,
    ];

    // 仕入れ可能価格帯の表示切り替え（想定販売価格が入力されているかどうかで判定）
    const guideEl   = root.querySelector('#s-verdict-guide');
    const verdictEl = root.querySelector('#s-verdict-label');
    const descEl    = root.querySelector('#s-verdict-desc');
    const band       = _calcPriceBand(sellingPriceUsd, tProfit);

    if (band) {
      if (guideEl)   guideEl.style.display   = 'none';
      if (verdictEl) verdictEl.style.display = 'block';
      if (descEl)    descEl.style.display    = 'block';

      if (band.achievable) {
        if (verdictEl) {
          verdictEl.textContent = `¥0 〜 ¥${Math.floor(band.maxCostJpy).toLocaleString('ja-JP')}`;
          verdictEl.style.color = 'var(--text-primary)';
        }
        if (descEl) descEl.textContent = `目標粗利率 ${tProfit}% を満たす仕入れ原価の上限です（判断は常にセラー）`;
      } else {
        if (verdictEl) { verdictEl.textContent = 'この目標は達成不可'; verdictEl.style.color = 'var(--red)'; }
        if (descEl)    descEl.textContent = '想定販売価格では目標粗利率を満たせません（販売価格を上げるか目標を見直してください）';
      }
    } else {
      if (guideEl)   guideEl.style.display   = 'flex';
      if (verdictEl) verdictEl.style.display = 'none';
      if (descEl)    descEl.style.display    = 'none';
    }

    // 条件ドット（未入力=グレー、入力済み=オレンジ）
    const inputValues = [
      `${profitRate.toFixed(1)}% (≥${tProfit}%)`,
      `${competitorGrowth.toFixed(1)}% (≤${tComp}%)`,
      `${sellRate.toFixed(1)}% (>${tSell}%)`,
    ];
    ['s-c1', 's-c2', 's-c3'].forEach((id, i) => {
      const row = root.querySelector(`#${id}`);
      if (!row) return;
      const dot = row.querySelector('.s-dot');
      const val = row.querySelector('.s-val');
      if (touched[i]) {
        if (dot) {
          dot.style.background   = 'var(--gold-400)';
          dot.style.borderColor  = 'var(--gold-400)';
          dot.style.color        = '#fff';
          dot.textContent        = '✓';
        }
        if (val) { val.textContent = inputValues[i]; val.style.color = 'var(--text-secondary)'; }
      } else {
        if (dot) {
          dot.style.background  = 'var(--bg-elevated)';
          dot.style.borderColor = 'var(--border)';
          dot.style.color       = 'transparent';
          dot.textContent       = '';
        }
        if (val) { val.textContent = '未入力'; val.style.color = 'var(--text-muted)'; }
      }
    });
  }

  window.BA.sourcing = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'sourcing' || _rendered) return;
        _rendered = true;
        const root = document.getElementById('sourcing-root');
        if (root) _render(root);
      });

      document.addEventListener('ba:settings-changed', ({ detail }) => {
        const root = document.getElementById('sourcing-root');
        if (!root || !_rendered) return;
        const tProfit = root.querySelector('#s-t-profit');
        const tComp   = root.querySelector('#s-t-comp');
        const tSell   = root.querySelector('#s-t-sell');
        if (tProfit && detail.targetMargin    !== null) tProfit.value = detail.targetMargin;
        if (tComp   && detail.competitorLimit !== null) tComp.value   = detail.competitorLimit;
        if (tSell   && detail.minSellRate     !== null) tSell.value   = detail.minSellRate;
        _updateVerdict(root);
      });
    },
  };

})();
