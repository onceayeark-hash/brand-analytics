/**
 * BRAND ANALYTICS — protection.js
 * アカウント保護（アラート + フィードバックテンプレート）
 * 未接続時はアラート部分を NO DATA 表示。
 * フィードバックテンプレートは常時表示（静的データ）。
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const _alerts = [];

  function _isConnected() {
    const tier = BA.auth?.getTier?.() ?? 'free';
    return tier === 'connected' || tier === 'premium';
  }

  document.addEventListener('ba:alert', ({ detail }) => {
    _alerts.unshift(detail);
    if (_alerts.length > 50) _alerts.pop();
    if (BA.nav?.getCurrentPanel?.() === 'protection') {
      const root = document.getElementById('protection-root');
      if (root) _render(root);
    }
  });

  function _alertsSection() {
    if (!_isConnected()) {
      return `
        <div class="card">
          <div class="card-title">アラート</div>
          <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
            ${['取引不良率', '遅延発送率', 'ケース開設', 'OAuth期限', 'API障害'].map(label => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;
                          background:rgba(255,255,255,.03);border-radius:6px">
                <div style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.12);flex-shrink:0"></div>
                <span style="font-size:12px;color:var(--text-muted)">${label}</span>
                <span style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">---</span>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:16px;padding:12px;border:1px solid rgba(232,201,106,.12);border-radius:6px;
                      background:rgba(232,201,106,.04)">
            <p style="font-size:11px;color:var(--text-secondary);text-align:center">
              eBayを連携するとリアルタイムアラートが届きます
            </p>
            <div style="text-align:center;margin-top:10px">
              <button class="btn btn-primary" style="font-size:12px;padding:8px 20px"
                      onclick="BA.nav.showPanel('connect')">eBay連携 →</button>
            </div>
          </div>
        </div>`;
    }

    const alertsHtml = _alerts.length
      ? _alerts.slice(0, 10).map(a => `
          <div class="alert-item ${a.severity === 'error' ? 'error' : 'warning'}">
            <div class="alert-dot"></div>
            <div class="alert-content">
              <div class="alert-title">${a.type}</div>
              <div class="alert-desc">${a.message ?? ''}</div>
            </div>
            <div class="alert-time">${new Date(a.timestamp).toLocaleTimeString('ja-JP')}</div>
          </div>
        `).join('')
      : `<div style="color:var(--text-muted);font-size:12px;padding:16px 0;text-align:center">アラートはありません</div>`;

    return `
      <div class="card">
        <div class="card-title">アラート</div>
        <div id="protection-alert-list" style="margin-top:12px">${alertsHtml}</div>
      </div>`;
  }

  function _templatesSection() {
    const templates = [
      { no: '01', label: 'ポジティブ返礼' },
      { no: '02', label: 'INAD（商品説明相違）対応' },
      { no: '03', label: 'INR（未着）対応' },
      { no: '04', label: 'ニュートラル・改善宣言' },
      { no: '05', label: '一般ネガティブ謝罪' },
    ];

    return `
      <div class="card">
        <div class="card-title">フィードバックテンプレート</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
          ${templates.map(t => `
            <button class="btn btn-secondary" style="justify-content:flex-start;text-align:left">
              <span style="font-family:var(--font-mono);color:var(--text-muted);margin-right:8px">${t.no}</span>
              ${t.label}
            </button>
          `).join('')}
        </div>
        <p style="margin-top:12px;font-size:10px;color:var(--text-muted)">
          ※ 日英テンプレートはeBay返信時にご利用ください
        </p>
      </div>`;
  }

  function _render(root) {
    root.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${_alertsSection()}
        ${_templatesSection()}
      </div>
    `;
    BA.notify?.clearBadge?.('protection-alert-count');
  }

  window.BA.protection = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'protection') return;
        const root = document.getElementById('protection-root');
        if (root) _render(root);
      });
    },
  };

})();
