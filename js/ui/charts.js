/**
 * BRAND ANALYTICS — charts.js
 * グラフ描画モジュール
 *
 * STAGE1: SVG ネイティブで簡易グラフを描画（依存ゼロ）
 * STAGE2 以降: Chart.js / Recharts 等に差し替える予定
 *
 * 提供する描画関数:
 * ・BA.charts.scoreRing(el, score, rank) — 健全性スコアリング
 * ・BA.charts.meterBar(el, value, max, color) — プログレスバー
 * ・BA.charts.sparkline(el, data) — ミニ折れ線グラフ
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // カラーマップ
  // ─────────────────────────────────────
  const RANK_COLOR = {
    S: 'var(--green)',
    A: 'var(--green)',
    B: 'var(--amber)',
    C: 'var(--yellow)',
    D: 'var(--red)',
  };

  const RANK_STROKE = {
    S: 'green',
    A: 'green',
    B: '',      // デフォルト amber
    C: 'amber',
    D: 'red',
  };

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const charts = {

    /**
     * スコアリング（SVG 円グラフ）を描画する
     * .score-ring クラスの要素に対して使用
     *
     * @param {HTMLElement} el     - .score-ring 要素
     * @param {number}      score  - 0〜100 のスコア
     * @param {string}      rank   - 'S'|'A'|'B'|'C'|'D'
     */
    scoreRing(el, score, rank) {
      if (!el) return;

      const circumference = 330; // stroke-dasharray と合わせる
      const offset = circumference - (score / 100) * circumference;
      const color  = RANK_COLOR[rank] ?? 'var(--amber)';
      const strokeClass = RANK_STROKE[rank] ?? '';

      // SVG を生成または更新
      let svg = el.querySelector('svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 120 120');
        svg.setAttribute('width',   '120');
        svg.setAttribute('height',  '120');

        // トラック（背景）
        const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        track.setAttribute('class', 'score-ring-track');
        track.setAttribute('cx', '60');
        track.setAttribute('cy', '60');
        track.setAttribute('r',  '52');
        svg.appendChild(track);

        // フィル（スコア）
        const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        fill.setAttribute('class', `score-ring-fill${strokeClass ? ' ' + strokeClass : ''}`);
        fill.setAttribute('cx', '60');
        fill.setAttribute('cy', '60');
        fill.setAttribute('r',  '52');
        svg.appendChild(fill);

        el.appendChild(svg);
      }

      // ラベル（スコア・ランク）
      let label = el.querySelector('.score-ring-label');
      if (!label) {
        label = document.createElement('div');
        label.className = 'score-ring-label';
        el.appendChild(label);
      }
      label.innerHTML = `
        <span class="score-rank" style="color:${color}">${rank}</span>
        <span class="score-score">${score}</span>
      `;

      // アニメーション（遅延後にオフセット適用）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const fill = svg.querySelector('.score-ring-fill');
          if (fill) {
            fill.style.strokeDashoffset = offset;
            fill.style.stroke = color;
          }
        });
      });
    },

    /**
     * メーターバー（プログレスバー）を設定する
     * .meter-fill クラスの要素に対して使用
     *
     * @param {HTMLElement} fillEl  - .meter-fill 要素
     * @param {number}      value   - 現在値
     * @param {number}      max     - 最大値
     * @param {'green'|'amber'|'red'} [colorClass='green']
     */
    meterBar(fillEl, value, max, colorClass = 'green') {
      if (!fillEl) return;
      const pct = Math.min(100, Math.max(0, (value / max) * 100));
      fillEl.style.width = `${pct}%`;
      fillEl.className = `meter-fill ${colorClass}`;
    },

    /**
     * スパークライン（SVG ミニ折れ線グラフ）を描画する
     *
     * @param {HTMLElement} el     - コンテナ要素
     * @param {number[]}    data   - 数値配列
     * @param {Object}      [opts]
     * @param {string}      [opts.color='var(--amber)']
     * @param {number}      [opts.height=40]
     */
    sparkline(el, data, opts = {}) {
      if (!el || !data?.length) return;

      const color  = opts.color  ?? 'var(--amber)';
      const height = opts.height ?? 40;
      const width  = el.clientWidth || 200;

      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;

      const xStep = width / (data.length - 1);
      const points = data.map((v, i) => {
        const x = i * xStep;
        const y = height - ((v - min) / range) * (height - 8) - 4;
        return `${x},${y}`;
      }).join(' ');

      el.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <polyline
            points="${points}"
            fill="none"
            stroke="${color}"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      `;
    },

    /**
     * シンプルなバーチャートを描画する（将来 Chart.js に差し替え予定）
     *
     * @param {HTMLElement} el
     * @param {{ label: string, value: number, color?: string }[]} data
     * @param {Object} [opts]
     */
    barChart(el, data, opts = {}) {
      if (!el || !data?.length) return;

      const maxVal = Math.max(...data.map(d => d.value));
      const barH   = opts.barHeight ?? 20;
      const gap    = opts.gap       ?? 8;
      const labelW = opts.labelWidth ?? 100;
      const chartW = (el.clientWidth || 300) - labelW - 60;

      const rows = data.map(d => {
        const pct = (d.value / maxVal) * 100;
        const color = d.color ?? 'var(--amber)';
        return `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:${gap}px">
            <div style="width:${labelW}px;font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${d.label}
            </div>
            <div style="flex:1;background:var(--bg-elevated);border-radius:2px;height:${barH}px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;transition:width 0.6s var(--ease)"></div>
            </div>
            <div style="width:48px;font-family:var(--font-mono);font-size:11px;color:var(--text-primary);text-align:right">
              ${typeof d.value === 'number' ? d.value.toLocaleString() : d.value}
            </div>
          </div>
        `;
      }).join('');

      el.innerHTML = `<div style="padding:4px 0">${rows}</div>`;
    },
  };

  window.BA.charts = charts;

})();
