/**
 * BRAND ANALYTICS — dashboard.js
 * ① 健全性スコア + ダッシュボード概況（CONNECTED 機能）
 *
 * 健全性スコア計算式:
 *   score = Defect × 0.35 + Cases × 0.25 + LateShip × 0.20
 *         + Tracking × 0.15 + INAD × 0.05
 *   ランク: S=90↑ / A=75↑ / B=60↑ / C=45↑ / D=44↓
 *
 * STAGE1 実装: スタブ（API接続後に実装）
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  function _calcScore({ defect, cases, lateShip, tracking, inad }) {
    // 各指標: 0=最悪, 100=最良 に正規化して加重平均
    // defect, cases, lateShip, inad は低いほど良い → 100 - rate*100
    // tracking は高いほど良い → rate*100
    const s = (100 - defect  * 100) * 0.35
            + (100 - cases   * 100) * 0.25
            + (100 - lateShip* 100) * 0.20
            +       tracking * 100  * 0.15
            + (100 - inad    * 100) * 0.05;
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  function _scoreToRank(score) {
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 45) return 'C';
    return 'D';
  }

  function _renderDashboard(root) {
    root.innerHTML = `
      <div style="background:var(--amber-dim);border:1px solid rgba(245,158,11,0.20);border-radius:6px;padding:20px;text-align:center;color:var(--text-secondary);font-size:12px;line-height:2">
        🔗 <strong style="color:var(--amber)">eBay 連携後に利用可能</strong><br>
        eBay OAuth 認証を行うとダッシュボードが有効になります。<br>
        <button class="btn btn-primary" style="margin-top:12px" onclick="BA.nav.showPanel('connect')">eBay を連携する</button>
      </div>
    `;
  }

  function _renderHealth(root) {
    // STAGE1: デモデータで描画（API 接続後にリアルデータに差し替え）
    const demo = { defect: 0.008, cases: 0.005, lateShip: 0.03, tracking: 0.96, inad: 0.012 };
    const score = _calcScore(demo);
    const rank  = _scoreToRank(score);

    root.innerHTML = `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start">

        <!-- スコアリング -->
        <div class="card" style="min-width:200px;text-align:center">
          <div class="card-title">総合スコア</div>
          <div class="score-ring" id="health-ring" style="margin:12px auto"></div>
          <div class="disclaimer" style="margin-top:12px">eBay 公式基準を参考にした独自計算</div>
        </div>

        <!-- 指標詳細 -->
        <div class="card">
          <div class="card-title">各指標（直近30日）</div>
          <div style="display:flex;flex-direction:column;gap:14px" id="health-metrics">
            ${_metricRow('取引不良率',     demo.defect  * 100, 2,   false, '35%重み')}
            ${_metricRow('未解決ケース率', demo.cases   * 100, 0.5, false, '25%重み')}
            ${_metricRow('遅延発送率',     demo.lateShip* 100, 5,   false, '20%重み')}
            ${_metricRow('追跡情報提供率', demo.tracking* 100, 95,  true,  '15%重み')}
            ${_metricRow('INADクレーム率', demo.inad    * 100, 1,   false, '5%重み')}
          </div>
        </div>

      </div>
    `;

    // スコアリングをレンダリング
    requestAnimationFrame(() => {
      const ringEl = root.querySelector('#health-ring');
      BA.charts?.scoreRing?.(ringEl, score, rank);
    });
  }

  function _metricRow(label, value, threshold, higherIsBetter, weight) {
    const isGood = higherIsBetter ? value >= threshold : value <= threshold;
    const color  = isGood ? 'var(--green)' : value <= threshold * 1.5 ? 'var(--yellow)' : 'var(--red)';
    const meterPct = higherIsBetter ? value : Math.max(0, 100 - (value / threshold) * 50);
    const meterColor = isGood ? 'green' : 'amber';

    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <div style="font-size:12px;color:var(--text-secondary)">${label}
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-left:6px">${weight}</span>
          </div>
          <div style="font-family:var(--font-mono);font-size:13px;color:${color}">${value.toFixed(2)}%</div>
        </div>
        <div class="meter">
          <div class="meter-fill ${meterColor}" style="width:${Math.min(100, meterPct)}%"></div>
        </div>
      </div>
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
