/**
 * BRAND ANALYTICS — protection.js
 * ③ アカウント保護（CONNECTED 機能）
 * STAGE1 スタブ — アラート受信・フィードバックテンプレート表示
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const _alerts = []; // 受信したアラートをキャッシュ

  // ba:alert イベントを受信してリストに追加
  document.addEventListener('ba:alert', ({ detail }) => {
    _alerts.unshift(detail);
    if (_alerts.length > 50) _alerts.pop();
    // 保護パネルが表示中なら再レンダリング
    if (BA.nav?.getCurrentPanel?.() === 'protection') {
      const root = document.getElementById('protection-root');
      if (root) _render(root);
    }
  });

  function _render(root) {
    const alertsHtml = _alerts.length
      ? _alerts.slice(0, 10).map(a => `
          <div class="alert-item ${a.severity === 'error' ? 'error' : 'warning'}">
            <div class="alert-dot"></div>
            <div class="alert-content">
              <div class="alert-title">${a.type}</div>
              <div class="alert-desc">${a.message}</div>
            </div>
            <div class="alert-time">${new Date(a.timestamp).toLocaleTimeString('ja-JP')}</div>
          </div>
        `).join('')
      : `<div style="color:var(--text-muted);font-size:12px;padding:16px 0;text-align:center">アラートはありません</div>`;

    root.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

        <!-- アラート一覧 -->
        <div class="card">
          <div class="card-title">アラート</div>
          <div id="protection-alert-list">${alertsHtml}</div>
        </div>

        <!-- フィードバックテンプレート -->
        <div class="card">
          <div class="card-title">フィードバックテンプレート</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${['ポジティブ返礼', 'INAD 対応', 'INR（未着）対応', 'ニュートラル改善宣言', '一般ネガティブ謝罪'].map((t, i) => `
              <button class="btn btn-secondary" style="justify-content:flex-start;text-align:left">
                <span style="font-family:var(--font-mono);color:var(--text-muted);margin-right:8px">0${i + 1}</span>
                ${t}
              </button>
            `).join('')}
          </div>
          <div style="margin-top:12px;font-size:10px;color:var(--text-muted)">
            ※ テンプレート詳細は schema_step7_5.sql に seed 済み
          </div>
        </div>

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
