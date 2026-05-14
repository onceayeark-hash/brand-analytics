/**
 * BRAND ANALYTICS — finance.js
 * ファイナンス概況（STAGE1 NO DATA プレビュー）
 * eBay Sell Finances API 接続後に実データ表示に切り替え。
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  function _isConnected() {
    const tier = BA.auth?.getTier?.() ?? 'free';
    return tier === 'connected' || tier === 'premium';
  }

  function _nd() {
    return `<span style="font-family:var(--font-mono);color:var(--text-muted)">---</span>`;
  }

  function _ctaBanner() {
    return `
      <div style="margin-top:24px;padding:16px 20px;border:1px solid rgba(232,201,106,.15);border-radius:8px;
                  background:rgba(232,201,106,.04);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-secondary)">
          eBayを連携すると売上・手数料データが自動取得されます
        </span>
        <button class="btn btn-primary" style="font-size:12px;padding:8px 20px;white-space:nowrap"
                onclick="BA.nav.showPanel('connect')">eBay連携 →</button>
      </div>`;
  }

  function _render(root) {
    const c = _isConnected();
    const v = (val) => c ? val : _nd();

    root.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px">

        <div class="card" style="text-align:center">
          <div class="card-title">直近30日 売上</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--gold-400)">${v('$0.00')}</div>
          <div style="font-size:11px;color:var(--text-muted)">gross sales</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title">eBay手数料</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--red)">${v('$0.00')}</div>
          <div style="font-size:11px;color:var(--text-muted)">fees</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title">Payoneer入金</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--green)">${v('$0.00')}</div>
          <div style="font-size:11px;color:var(--text-muted)">net payout</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title">実効手数料率</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--text-primary)">${v('0%')}</div>
          <div style="font-size:11px;color:var(--text-muted)">実績平均</div>
        </div>

      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">

        <div class="card">
          <div class="card-title">月次売上 vs 手数料</div>
          <div style="height:100px;display:flex;align-items:center;justify-content:center;
                      color:var(--text-muted);font-size:12px;font-family:var(--font-mono);
                      border:1px dashed rgba(255,255,255,.08);border-radius:6px;margin-top:12px;letter-spacing:.08em">
            NO DATA
          </div>
        </div>

        <div class="card">
          <div class="card-title">手数料内訳</div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
            ${['FVF（最終価格手数料）', 'Promoted Listings', 'Payoneer手数料'].map(label => `
              <div style="display:flex;justify-content:space-between;font-size:12px">
                <span style="color:var(--text-secondary)">${label}</span>
                <span style="font-family:var(--font-mono);color:var(--text-muted)">${c ? '0.00%' : '---'}</span>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      ${_ctaBanner()}
    `;
  }

  window.BA.finance = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'finance') return;
        const root = document.getElementById('finance-root');
        if (root) _render(root);
      });
    },
  };

})();
