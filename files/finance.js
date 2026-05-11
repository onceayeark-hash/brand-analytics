/**
 * BRAND ANALYTICS — finance.js
 * ② ファイナンス（CONNECTED 機能）
 * STAGE1 スタブ — eBay Sell Finances API 接続後に実装
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  function _render(root) {
    root.innerHTML = `
      <div style="background:var(--blue-dim);border:1px solid rgba(96,165,250,0.20);border-radius:6px;padding:20px;text-align:center;color:var(--text-secondary);font-size:12px;line-height:2">
        📊 <strong style="color:var(--blue)">eBay Sell Finances API 接続後に利用可能</strong><br>
        売上・手数料・Payoneer 精算レポートが表示されます。<br>
        <div style="margin-top:12px;font-size:10px;color:var(--text-muted)">
          実装予定: OAuth 認証完了後に eBay API から自動取得
        </div>
      </div>
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
