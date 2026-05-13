/**
 * BRAND ANALYTICS — sourcing.js
 * 仕入れメーター：Go / No-Go 判定（FREE 機能）
 *
 * 判定条件（UIで変更可）:
 *   条件① 粗利率    ≥ 25%（デフォルト）
 *   条件② 競合増加率 ≤ 15%（デフォルト）
 *   条件③ 成約率    > 30%（デフォルト・手動入力）
 *
 * Terapeak API 未取得のため成約率は手動入力
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

  function _verdict(params) {
    const { profitRate, competitorGrowth, sellRate, thresholds } = params;
    const t = thresholds;
    const pass1 = profitRate      >= t.profit;
    const pass2 = competitorGrowth <= t.competitor;
    const pass3 = sellRate        >  t.sellRate;
    const passed = [pass1, pass2, pass3].filter(Boolean).length;

    if (passed === 3) return 'go';
    if (passed === 0) return 'no_go';
    return 'caution';
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
          <div class="card" style="margin-bottom:16px;text-align:center">
            <div class="card-title" style="text-align:left">判定結果</div>
            <div style="font-family:var(--font-mono);font-size:40px;font-weight:600;padding:20px 0" id="s-verdict-label">
              —
            </div>
            <div style="font-size:12px;color:var(--text-secondary)" id="s-verdict-desc">
              データを入力してください
            </div>
          </div>

          <!-- 条件チェックリスト -->
          <div class="card">
            <div class="card-title">条件チェック</div>
            <div style="display:flex;flex-direction:column;gap:10px" id="s-conditions">
              ${_conditionRow('s-c1', '粗利率', '未入力')}
              ${_conditionRow('s-c2', '競合増加率', '未入力')}
              ${_conditionRow('s-c3', '成約率', '未入力')}
            </div>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll('input').forEach(el => el.addEventListener('input', () => _updateVerdict(root)));
  }

  function _conditionRow(id, label, status) {
    return `
      <div style="display:flex;align-items:center;gap:10px" id="${id}">
        <div style="width:16px;height:16px;border-radius:50%;background:var(--bg-elevated);border:1px solid var(--border);flex-shrink:0"></div>
        <div style="flex:1;font-size:12px;color:var(--text-secondary)">${label}</div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${status}</div>
      </div>
    `;
  }

  function _updateVerdict(root) {
    const profitRate       = parseFloat(root.querySelector('#s-profit')?.value)      || 0;
    const competitorGrowth = parseFloat(root.querySelector('#s-competitors')?.value) || 0;
    const sellRate         = parseFloat(root.querySelector('#s-sellrate')?.value)    || 0;
    const tProfit   = parseFloat(root.querySelector('#s-t-profit')?.value) || DEFAULTS.profitThreshold;
    const tComp     = parseFloat(root.querySelector('#s-t-comp')?.value)   || DEFAULTS.competitorThreshold;
    const tSell     = parseFloat(root.querySelector('#s-t-sell')?.value)   || DEFAULTS.sellRateThreshold;

    const v = _verdict({ profitRate, competitorGrowth, sellRate, thresholds: { profit: tProfit, competitor: tComp, sellRate: tSell } });

    const COLORS  = { go: 'var(--green)', no_go: 'var(--red)', caution: 'var(--yellow)' };
    const LABELS  = { go: 'GO', no_go: 'NO-GO', caution: '要検討' };
    const DESCS   = { go: '3条件すべて通過 — 仕入れ推奨です', no_go: '条件未達 — 見送りを推奨します', caution: '一部条件未達 — 慎重に判断してください' };

    const verdictEl = root.querySelector('#s-verdict-label');
    const descEl    = root.querySelector('#s-verdict-desc');
    if (verdictEl) { verdictEl.textContent = LABELS[v]; verdictEl.style.color = COLORS[v]; }
    if (descEl)    descEl.textContent = DESCS[v];

    // 条件ドット
    const checks = [
      [profitRate >= tProfit,       `${profitRate.toFixed(1)}% (≥${tProfit}%)`],
      [competitorGrowth <= tComp,   `${competitorGrowth.toFixed(1)}% (≤${tComp}%)`],
      [sellRate > tSell,            `${sellRate.toFixed(1)}% (>${tSell}%)`],
    ];
    ['s-c1', 's-c2', 's-c3'].forEach((id, i) => {
      const row = root.querySelector(`#${id}`);
      if (!row) return;
      const dot = row.querySelector('div');
      const val = row.querySelector('div:last-child');
      if (dot) dot.style.background = checks[i][0] ? 'var(--green)' : 'var(--red)';
      if (val) val.textContent = checks[i][1];
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
    },
  };

})();
