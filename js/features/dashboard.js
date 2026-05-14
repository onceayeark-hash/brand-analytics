/**
 * BRAND ANALYTICS — dashboard.js
 * ダッシュボード概況 + アカウントパフォーマンス指標
 *
 * 健全性スコア（重み付き計算・ランク）は廃止。
 * 各指標の実数値を表示し、閾値超えをアラートで通知する。
 * 未接続時は NO DATA 状態（"---"）でUIをプレビュー表示する。
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  function _isConnected() {
    const tier = BA.auth?.getTier?.() ?? 'free';
    return tier === 'connected' || tier === 'premium';
  }

  function _meterBar(pct, color) {
    if (!_isConnected()) {
      return `<div class="meter"><div style="height:100%;border-radius:inherit;background:rgba(255,255,255,.06);width:100%"></div></div>`;
    }
    return `<div class="meter"><div class="meter-fill ${color}" style="width:${Math.min(100,pct)}%"></div></div>`;
  }

  function _ctaBanner() {
    return `
      <div style="margin-top:24px;padding:16px 20px;border:1px solid rgba(232,201,106,.15);border-radius:8px;
                  background:rgba(232,201,106,.04);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-secondary)">
          eBayを連携するとリアルタイムデータが表示されます
        </span>
        <button class="btn btn-primary" style="font-size:12px;padding:8px 20px;white-space:nowrap"
                onclick="BA.nav.showPanel('connect')">eBay連携 →</button>
      </div>`;
  }

  // ─── ダッシュボード概況 ──────────────────────────
  function _renderDashboard(root) {
    const c = _isConnected();
    const nd = `<span style="font-family:var(--font-mono);color:var(--text-muted)">---</span>`;

    root.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px">

        <div class="card" style="text-align:center">
          <div class="card-title">直近30日 売上</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--gold-400)">${c ? '$0.00' : nd}</div>
          <div style="font-size:11px;color:var(--text-muted)">USD</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title">取引件数</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--text-primary)">${c ? '0' : nd}</div>
          <div style="font-size:11px;color:var(--text-muted)">件</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title">平均粗利率</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--green)">${c ? '0%' : nd}</div>
          <div style="font-size:11px;color:var(--text-muted)">目標 25%</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title">アクティブ出品</div>
          <div style="font-size:1.8rem;font-weight:500;margin:12px 0;color:var(--text-primary)">${c ? '0' : nd}</div>
          <div style="font-size:11px;color:var(--text-muted)">件</div>
        </div>

      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-title">月次売上推移</div>
        <div style="height:120px;display:flex;align-items:center;justify-content:center;
                    color:var(--text-muted);font-size:12px;font-family:var(--font-mono);
                    border:1px dashed rgba(255,255,255,.08);border-radius:6px;margin-top:12px;
                    letter-spacing:.08em">
          NO DATA
        </div>
      </div>

      ${_ctaBanner()}
    `;
  }

  // ─── アカウントパフォーマンス指標 ───────────────
  const METRICS = [
    { label: '取引不良率',     threshold: 2,   unit: '%' },
    { label: '未解決ケース率', threshold: 0.3, unit: '%' },
    { label: '遅延発送率',     threshold: 5,   unit: '%' },
    { label: '追跡情報なし率', threshold: 5,   unit: '%' },
    { label: 'INADクレーム率', threshold: 0.5, unit: '%' },
  ];

  function _metricRow(metric) {
    const c = _isConnected();
    return `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:var(--text-secondary)">${metric.label}</span>
          <span style="font-family:var(--font-mono);font-size:13px;color:var(--text-muted)">
            ${c ? '0.00%' : '---'}
          </span>
        </div>
        ${_meterBar(0, 'green')}
        <div style="display:flex;justify-content:flex-end;font-family:var(--font-mono);font-size:9px;color:var(--text-muted)">
          不合格閾値 ${metric.threshold}%
        </div>
      </div>`;
  }

  function _renderHealth(root) {
    root.innerHTML = `
      <div class="card">
        <div class="card-title">パフォーマンス指標（直近30日）</div>
        <div style="display:flex;flex-direction:column;gap:20px;margin-top:16px">
          ${METRICS.map(m => _metricRow(m)).join('')}
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-title">健全性シミュレーター</div>
        <p style="font-size:11px;color:var(--text-muted);margin:8px 0 12px;line-height:1.8">
          各指標があと何件の取引で警告閾値を超えるか逆算します。
        </p>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${METRICS.map(m => `
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:8px 12px;background:rgba(255,255,255,.03);border-radius:6px;font-size:12px">
              <span style="color:var(--text-secondary)">${m.label}</span>
              <span style="font-family:var(--font-mono);color:var(--text-muted)">---</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${_ctaBanner()}
    `;
  }

  window.BA.dashboard = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey === 'dashboard') {
          const root = document.getElementById('dashboard-root');
          if (root) _renderDashboard(root);
        }
        if (detail.panelKey === 'health') {
          const root = document.getElementById('health-root');
          if (root) _renderHealth(root);
        }
      });
    },
  };

})();
