/**
 * BRAND ANALYTICS — settings.js
 * 設定ページ（手数料・閾値 / eBay接続管理）
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const SETTINGS_KEY = 'ba_settings';

  const DEFAULTS = {
    targetMargin:    25,
    competitorLimit: 15,
    minSellRate:     30,
    payoneerRate:    2,
    authServiceJpy:  1500,
  };

  // ─────────────────────────────────────
  // ストレージ
  // ─────────────────────────────────────
  function _load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function _save(data) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
      document.dispatchEvent(new CustomEvent('ba:settings-changed', { detail: { ...data } }));
    } catch {}
  }

  // ─────────────────────────────────────
  // セクション1：手数料・閾値設定
  // ─────────────────────────────────────
  const _FIELDS = [
    { label: '目標粗利率',       key: 'targetMargin',    id: 's-target-margin',    unit: '%', before: false, step: '0.1'  },
    { label: '競合増加率上限',   key: 'competitorLimit', id: 's-competitor-limit', unit: '%', before: false, step: '0.1'  },
    { label: '最低成約率',       key: 'minSellRate',     id: 's-min-sell-rate',    unit: '%', before: false, step: '0.1'  },
    { label: 'Payoneer手数料率', key: 'payoneerRate',    id: 's-payoneer-rate',    unit: '%', before: false, step: '0.1'  },
    { label: '真贋サービス送料', key: 'authServiceJpy',  id: 's-auth-service',     unit: '¥', before: true,  step: '100'  },
  ];

  function _renderSection1(data) {
    const rows = _FIELDS.map(f => `
      <div class="input-group">
        <label class="input-label" for="${f.id}">${f.label}</label>
        <div style="display:flex;align-items:center;gap:6px">
          ${f.before ? `<span style="font-size:13px;color:var(--text-muted)">${f.unit}</span>` : ''}
          <input class="input" id="${f.id}" type="number" min="0" step="${f.step}"
            value="${data[f.key]}" style="text-align:right;width:100px">
          ${!f.before ? `<span style="font-size:13px;color:var(--text-muted)">${f.unit}</span>` : ''}
        </div>
      </div>`).join('');

    return `
      <div class="card" style="margin-bottom:24px">
        <div class="card-title">手数料・閾値設定</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${rows}
        </div>
        <div style="margin-top:12px;font-size:11px;color:var(--text-muted)">
          ⚠️ 暫定デフォルト値・実績に応じて変更推奨
        </div>
      </div>`;
  }

  // ─────────────────────────────────────
  // セクション3：eBay接続管理
  // ─────────────────────────────────────
  function _renderSection3() {
    const token     = BA.auth?.getEbayToken?.();
    const expiry    = BA.auth?.getEbayTokenExpiry?.();
    const connected = !!token;

    const statusDot = connected
      ? `<span style="color:#22c55e;font-size:16px;line-height:1">●</span>
         <span style="font-size:14px;color:var(--text-primary)">接続済み ✓</span>`
      : `<span style="color:#ef4444;font-size:16px;line-height:1">●</span>
         <span style="font-size:14px;color:var(--text-primary)">未接続</span>`;

    const expiryRow = connected && expiry
      ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
           トークン有効期限：${new Date(expiry).toLocaleString('ja-JP')}
         </div>`
      : '';

    const actionBtn = connected
      ? `<button class="btn btn-secondary" id="s-ebay-reconnect">再接続する</button>`
      : `<button class="btn btn-primary"   id="s-ebay-connect">eBayを連携する</button>`;

    return `
      <div class="card" style="margin-bottom:24px">
        <div class="card-title">eBay接続管理</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          ${statusDot}
        </div>
        ${expiryRow}
        ${actionBtn}
      </div>`;
  }

  // ─────────────────────────────────────
  // 描画
  // ─────────────────────────────────────
  function _render(root) {
    const data = _load();
    root.innerHTML =
      _renderSection1(data) +
      _renderSection3();
    _bindEvents(root);
  }

  // ─────────────────────────────────────
  // イベントバインド
  // ─────────────────────────────────────
  function _bindEvents(root) {
    // セクション1：各入力欄の即時保存
    _FIELDS.forEach(({ id, key }) => {
      root.querySelector(`#${id}`)?.addEventListener('input', e => {
        const data = _load();
        data[key]  = parseFloat(e.target.value) || 0;
        _save(data);
      });
    });

    // セクション3：eBay連携ボタン
    root.querySelector('#s-ebay-connect')?.addEventListener('click',   () => BA.auth?.connectEbay?.());
    root.querySelector('#s-ebay-reconnect')?.addEventListener('click', () => BA.auth?.connectEbay?.());
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  window.BA.settings = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'settings') return;
        const root = document.getElementById('settings-root');
        if (root) _render(root);
      });

      const root = document.getElementById('settings-root');
      if (root) _render(root);
    },

    /** 現在の設定値オブジェクトを返す（sourcing.js・profit.js 等から参照） */
    get() {
      return _load();
    },
  };

})();
