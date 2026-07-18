// @not-security-critical （grep確認済み・認証情報/トークン/APIキーを扱わない・2026-06-25判断）
/**
 * BRAND ANALYTICS — dashboard.js
 * eBay Seller Hub では見えないものを主役にする
 *
 * panel-dashboard : 今月の粗利益・PPD・実績手数料進捗・健全性(コンパクト)・アラート
 * panel-health    : アカウントパフォーマンス詳細 + 健全性シミュレーター（手動入力）
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 指標定義（specs.md 準拠）
  // ─────────────────────────────────────
  const METRICS = [
    { key: 'defect',   label: '取引不良率',    warnPct: null, failPct: 2.0  },
    { key: 'cases',    label: '未解決ケース率', warnPct: null, failPct: 0.3  },
    { key: 'lateship', label: '遅延発送率',     warnPct: 5.0,  failPct: 10.0 },
    { key: 'tracking', label: '追跡情報なし率', warnPct: null, failPct: 5.0  },
    { key: 'inad',     label: 'INAD率',         warnPct: null, failPct: 0.5  },
  ];

  const HEALTH_KEY = 'ba_health_data';

  // ─────────────────────────────────────
  // ストレージ（健全性指標・手動入力）
  // ─────────────────────────────────────
  function _loadHealth() {
    try {
      return JSON.parse(localStorage.getItem(HEALTH_KEY) ?? 'null') || { total: '', metrics: {} };
    } catch {
      return { total: '', metrics: {} };
    }
  }

  function _saveHealth(data) {
    try { localStorage.setItem(HEALTH_KEY, JSON.stringify(data)); } catch {}
  }

  // ─────────────────────────────────────
  // 今月の集計（transaction_logs から）
  // ─────────────────────────────────────
  function _calcMonthStats(records) {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    const thisMonth = (records ?? []).filter(r => {
      const d = new Date(r.traded_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    let grossJpy = 0;
    for (const r of thisMonth) {
      const saleUsd     = r.sale_price_usd   ?? 0;
      const ebayUsd     = r.ebay_fee_usd     ?? 0;
      const promotedUsd = r.promoted_fee_usd ?? 0;
      const payoneerUsd = r.payoneer_fee_usd ?? 0;
      const authJpy     = r.auth_service_incl ? (r.auth_service_jpy ?? 0) : 0;
      const costJpy     = r.cost_price_jpy   ?? 0;
      const rate        = r.exchange_rate    ?? 0;
      const receivedJpy = r.received_jpy     ?? 0;

      // USD→JPY: exchange_rateがあれば手数料を個別差引・なければreceived_jpy（実受取額）使用
      let netJpy;
      if (rate > 0) {
        netJpy = (saleUsd - ebayUsd - promotedUsd - payoneerUsd) * rate;
      } else if (receivedJpy > 0) {
        netJpy = receivedJpy;
      } else {
        netJpy = 0;
      }

      grossJpy += netJpy - authJpy - costJpy;
    }

    const daysPassed = Math.max(1, now.getDate());
    const ppd        = thisMonth.length > 0 ? Math.round(grossJpy / daysPassed) : null;

    return {
      grossJpy,
      ppd,
      count: thisMonth.length,
      all:   records?.length ?? 0,
    };
  }

  // ─────────────────────────────────────
  // 計算ロジック（健全性）
  // ─────────────────────────────────────
  function _calcRemaining(problems, total, thresholdPct) {
    if (!total || total <= 0) return null;
    const T = thresholdPct / 100;
    return Math.floor((T * total - problems) / (1 - T));
  }

  function _getStatus(rate, metric) {
    if (metric.failPct !== null && rate >= metric.failPct) return 'fail';
    if (metric.warnPct !== null && rate >= metric.warnPct) return 'warn';
    return 'ok';
  }

  // ─────────────────────────────────────
  // フォーマット
  // ─────────────────────────────────────
  function _jpy(n) {
    if (n === null || n === undefined) return '—';
    const abs = Math.abs(n);
    const fmt = abs.toLocaleString('ja-JP');
    return n < 0 ? `-¥${fmt}` : `¥${fmt}`;
  }

  function _pct(r) {
    return `${(r * 100).toFixed(2)}%`;
  }

  // ─────────────────────────────────────
  // UI パーツ
  // ─────────────────────────────────────
  function _meterColor(status) {
    if (status === 'fail') return 'red';
    if (status === 'warn') return 'amber';
    return 'green';
  }

  function _rateColor(status) {
    if (status === 'fail') return 'var(--red)';
    if (status === 'warn') return 'var(--yellow)';
    return 'var(--green)';
  }

  function _statusTag(status) {
    if (status === 'fail') return `<span class="tag no-go">不合格</span>`;
    if (status === 'warn') return `<span class="tag caution">警告</span>`;
    return `<span class="tag go">良好</span>`;
  }

  // ─────────────────────────────────────
  // サマリーカード 4枚
  // ─────────────────────────────────────
  function _summaryCards(stats, learned) {
    const month  = new Date().toLocaleDateString('ja-JP', { month: 'long' });
    const feeRate = learned?.isFallback
      ? `<span style="color:var(--text-muted)">推定中</span>`
      : `<span style="color:var(--gold-400);font-size:1.6rem;font-weight:600;font-variant-numeric:tabular-nums">${_pct(learned.ebayFeeRate)}</span>`;
    const feeNote = learned?.isFallback
      ? `<div style="font-size:11px;color:var(--text-muted)">実績 ${learned.recordCount}件（5件で確定）</div>`
      : `<div style="font-size:11px;color:var(--text-muted)">実績 ${learned.recordCount}件の平均</div>`;

    const grossColor = stats.grossJpy > 0 ? 'var(--green)' : stats.grossJpy < 0 ? 'var(--red)' : 'var(--text-primary)';
    const ppdColor   = stats.ppd !== null && stats.ppd > 0 ? 'var(--green)' : stats.ppd !== null && stats.ppd < 0 ? 'var(--red)' : 'var(--text-primary)';

    return `
      <div class="grid-4">

        <div class="card" style="text-align:center">
          <div class="card-title" style="font-size:10px;text-transform:uppercase;letter-spacing:.08em">${month}の粗利益</div>
          <div style="font-size:1.7rem;font-weight:600;margin:var(--space-2) 0;font-family:var(--font-mono);
            color:${grossColor};font-variant-numeric:tabular-nums">
            ${stats.count > 0 ? _jpy(stats.grossJpy) : '<span style="color:var(--text-muted)">—</span>'}
          </div>
          <div style="font-size:11px;color:var(--text-muted)">eBay/Promoted/Payoneer・認証費・仕入差引後</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title" style="font-size:10px;text-transform:uppercase;letter-spacing:.08em">PPD（1日あたり）</div>
          <div style="font-size:1.7rem;font-weight:600;margin:var(--space-2) 0;font-family:var(--font-mono);
            color:${ppdColor};font-variant-numeric:tabular-nums">
            ${stats.ppd !== null ? _jpy(stats.ppd) : '<span style="color:var(--text-muted)">—</span>'}
          </div>
          <div style="font-size:11px;color:var(--text-muted)">粗利益 ÷ 経過日数</div>
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title" style="font-size:10px;text-transform:uppercase;letter-spacing:.08em">実績 eBay 手数料率</div>
          <div style="margin:var(--space-2) 0">${feeRate}</div>
          ${feeNote}
        </div>

        <div class="card" style="text-align:center">
          <div class="card-title" style="font-size:10px;text-transform:uppercase;letter-spacing:.08em">${month}の取引件数</div>
          <div style="font-size:1.7rem;font-weight:600;margin:var(--space-2) 0;font-family:var(--font-mono);
            color:var(--text-primary);font-variant-numeric:tabular-nums">
            ${stats.count}<span style="font-size:1rem;font-weight:400;color:var(--text-muted)"> 件</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">累計 ${stats.all}件</div>
        </div>

      </div>`;
  }

  // ─────────────────────────────────────
  // 健全性シミュレーター（コンパクト版）
  // ─────────────────────────────────────
  function _compactSimulator(health, noBottomMargin) {
    const total    = parseInt(health.total) || 0;
    const featured = [METRICS[0], METRICS[2], METRICS[4]]; // 取引不良率・遅延発送率・INAD率
    const mb       = noBottomMargin ? '' : 'margin-bottom:20px';

    if (!total) {
      return `
        <div class="card" style="${mb}">
          <div class="card-title">健全性シミュレーター</div>
          <div style="margin-top:12px;padding:12px;border:1px dashed rgba(255,255,255,.08);
            border-radius:6px;font-size:12px;color:var(--text-muted);font-family:var(--font-mono)">
            「アカウントパフォーマンス」タブで総取引件数を入力すると逆算が表示されます
          </div>
        </div>`;
    }

    const rows = featured.map(m => {
      const problems = parseInt(health.metrics?.[m.key]) || 0;
      const rate     = total > 0 ? (problems / total) * 100 : 0;
      const status   = _getStatus(rate, m);
      const meterPct = m.failPct ? Math.min(100, (rate / m.failPct) * 100) : 0;

      let simText = '';
      if (status === 'fail') {
        simText = `<span style="color:var(--red)">不合格超過中 ⚠</span>`;
      } else {
        if (m.warnPct !== null) {
          const rem = _calcRemaining(problems, total, m.warnPct);
          if (rem !== null && rem >= 0) simText = `あと <strong style="color:var(--yellow)">${rem}件</strong> で警告`;
        }
        if (!simText && m.failPct !== null) {
          const rem = _calcRemaining(problems, total, m.failPct);
          if (rem !== null && rem >= 0) simText = `あと <strong style="color:var(--red)">${rem}件</strong> で不合格`;
        }
        if (!simText) simText = `<span style="color:var(--green)">余裕あり</span>`;
      }

      return `
        <div style="display:grid;grid-template-columns:100px 1fr auto;gap:10px;align-items:center;
          padding:10px 14px;border-radius:6px;background:rgba(255,255,255,.02)">
          <div style="font-size:12px;color:var(--text-secondary)">${m.label}</div>
          <div>
            <div class="meter" style="margin-bottom:3px">
              <div class="meter-fill ${_meterColor(status)}" style="width:${meterPct}%"></div>
            </div>
            <div style="font-size:11px;color:var(--text-muted)">${simText}</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:12px;font-weight:600;
            color:${_rateColor(status)};font-variant-numeric:tabular-nums;white-space:nowrap">
            ${total > 0 ? rate.toFixed(2) + '%' : '—'}
          </div>
        </div>`;
    });

    return `
      <div class="card" style="${mb}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title">健全性シミュレーター</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:5px 14px"
            onclick="BA.nav?.showPanel?.('health')">詳細 →</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${rows.join('')}
        </div>
      </div>`;
  }

  // ─────────────────────────────────────
  // アラートボックス
  // ─────────────────────────────────────
  function _alertsBox(health, learned) {
    const alerts = [];

    // 実績ベース手数料が未確定
    if (learned?.isFallback) {
      const rem = 5 - (learned.recordCount ?? 0);
      alerts.push({ level: 'info', text: `実績手数料率：あと${rem}件の取引記録で確定します` });
    }

    // 健全性チェック
    const total = parseInt(health.total) || 0;
    if (total > 0) {
      for (const m of METRICS) {
        const problems = parseInt(health.metrics?.[m.key]) || 0;
        const rate     = (problems / total) * 100;
        if (m.failPct !== null && rate >= m.failPct) {
          alerts.push({ level: 'error', text: `${m.label} が不合格水準（${rate.toFixed(2)}%）に達しています` });
        } else if (m.warnPct !== null && rate >= m.warnPct) {
          alerts.push({ level: 'warn', text: `${m.label} が警告水準（${rate.toFixed(2)}%）に達しています` });
        }
      }
    }

    if (alerts.length === 0) {
      alerts.push({ level: 'ok', text: 'アカウント状態は正常です' });
    }

    const colors = {
      error: { bg: 'var(--red-dim)',    border: 'rgba(232,84,84,.22)',    icon: '⚠', col: 'var(--red)'    },
      warn:  { bg: 'var(--yellow-dim)', border: 'rgba(245,200,66,.22)',   icon: '⚠', col: 'var(--yellow)' },
      info:  { bg: 'rgba(255,255,255,.02)', border: 'rgba(255,255,255,.08)', icon: 'ℹ', col: 'var(--text-muted)' },
      ok:    { bg: 'var(--green-dim)',  border: 'rgba(78,206,138,.22)',   icon: '✓', col: 'var(--green)'  },
    };

    const items = alerts.map(a => {
      const c = colors[a.level];
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;
          background:${c.bg};border:1px solid ${c.border};border-radius:6px">
          <span style="color:${c.col};font-size:14px;line-height:1.2">${c.icon}</span>
          <span style="font-size:12px;color:var(--text-secondary)">${a.text}</span>
        </div>`;
    }).join('');

    return `
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">アラート</div>
        <div style="display:flex;flex-direction:column;gap:8px">${items}</div>
      </div>`;
  }

  // ─────────────────────────────────────
  // ダッシュボードメインパネル
  // ─────────────────────────────────────
  async function _renderDashboard(root) {
    root.innerHTML = `
      <div style="text-align:center;padding:32px 20px;color:var(--text-muted);
        font-family:var(--font-mono);font-size:11px">読み込み中...</div>`;

    let records = [];
    try {
      records = await BA.transactions?.list?.() ?? [];
    } catch {
      records = [];
    }

    const learned = BA.transactions?.getLearned?.() ?? { isFallback: true, recordCount: 0 };
    const stats   = _calcMonthStats(records);
    const health  = _loadHealth();

    root.innerHTML =
      _summaryCards(stats, learned) +
      `<div style="display:grid;grid-template-columns:1fr 360px;gap:14px;align-items:start">
        <div>${_compactSimulator(health, true)}</div>
        <div>${_alertsBox(health, learned)}</div>
      </div>`;
  }

  // ─────────────────────────────────────
  // 詳細パフォーマンスパネル（手動入力）
  // ─────────────────────────────────────
  function _simLines(problems, total, metric) {
    if (!total || total <= 0) {
      return `<span style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono)">総件数を入力すると逆算されます</span>`;
    }
    const lines = [];
    if (metric.warnPct !== null) {
      const rem = _calcRemaining(problems, total, metric.warnPct);
      lines.push(rem < 0
        ? `<span style="color:var(--yellow)">警告閾値(${metric.warnPct}%)超過中</span>`
        : `あと <strong style="color:var(--yellow)">${rem}件</strong> で警告閾値(${metric.warnPct}%)`
      );
    }
    if (metric.failPct !== null) {
      const rem = _calcRemaining(problems, total, metric.failPct);
      lines.push(rem < 0
        ? `<span style="color:var(--red)">不合格閾値(${metric.failPct}%)超過中 ⚠</span>`
        : `あと <strong style="color:var(--red)">${rem}件</strong> で不合格閾値(${metric.failPct}%)`
      );
    }
    return lines.map(l => `<div style="font-size:12px;color:var(--text-secondary);line-height:1.8">${l}</div>`).join('');
  }

  function _metricCard(metric, data, total) {
    const problems = parseInt(data.metrics?.[metric.key]) || 0;
    const rate     = total > 0 ? (problems / total) * 100 : 0;
    const status   = _getStatus(rate, metric);
    const meterPct = metric.failPct ? Math.min(100, (rate / metric.failPct) * 100) : 0;

    return `
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <span style="font-size:13px;font-weight:500;color:var(--text-primary)">${metric.label}</span>
              <span id="h-tag-${metric.key}">${_statusTag(status)}</span>
              <span style="margin-left:auto;font-family:var(--font-mono);font-size:1.1rem;font-weight:600;
                color:${_rateColor(status)};font-variant-numeric:tabular-nums" id="h-rate-${metric.key}">
                ${total > 0 ? rate.toFixed(2) + '%' : '—'}
              </span>
            </div>
            <div class="meter" style="margin-bottom:6px">
              <div class="meter-fill ${_meterColor(status)}" id="h-meter-${metric.key}"
                style="width:${meterPct}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;
              font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-bottom:8px">
              <span>0%</span>
              ${metric.warnPct ? `<span style="color:var(--yellow)">警告 ${metric.warnPct}%</span>` : ''}
              <span style="color:var(--red)">不合格 ${metric.failPct}%</span>
            </div>
            <div id="h-sim-${metric.key}">${_simLines(problems, total, metric)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <label style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);
              letter-spacing:.08em;text-transform:uppercase">問題件数</label>
            <div style="display:flex;align-items:center;gap:6px">
              <input class="input h-metric" id="h-${metric.key}" type="text" inputmode="numeric" pattern="[0-9]*"
                data-key="${metric.key}" placeholder="0"
                value="${data.metrics?.[metric.key] ?? ''}" style="text-align:right;width:80px">
              <span style="font-size:13px;color:var(--text-muted)">件</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function _healthSummary(data, total) {
    if (!total) {
      return `
        <div class="card-title">シミュレーターまとめ</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px;font-family:var(--font-mono)">
          総取引件数を入力すると逆算が表示されます
        </div>`;
    }
    const rows = METRICS.map(m => {
      const problems = parseInt(data.metrics?.[m.key]) || 0;
      const rate     = total > 0 ? (problems / total) * 100 : 0;
      const status   = _getStatus(rate, m);

      if (status === 'fail') {
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;
            padding:8px 12px;background:var(--red-dim);border:1px solid rgba(232,84,84,.22);
            border-radius:6px;font-size:12px">
            <span style="color:var(--text-primary)">${m.label}</span>
            <span style="font-family:var(--font-mono);color:var(--red)">不合格超過中 ⚠</span>
          </div>`;
      }

      const parts = [];
      if (m.warnPct !== null) {
        const rem = _calcRemaining(problems, total, m.warnPct);
        if (rem !== null && rem >= 0) parts.push(`警告まで <strong>${rem}件</strong>`);
      }
      if (m.failPct !== null) {
        const rem = _calcRemaining(problems, total, m.failPct);
        if (rem !== null && rem >= 0) parts.push(`不合格まで <strong style="color:var(--red)">${rem}件</strong>`);
      }

      const bg = status === 'warn' ? 'var(--yellow-dim)' : 'rgba(255,255,255,.02)';
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:8px 12px;background:${bg};border-radius:6px;font-size:12px;gap:12px">
          <span style="color:var(--text-secondary)">${m.label}</span>
          <span style="font-family:var(--font-mono);color:var(--text-muted);text-align:right">
            ${parts.join(' / ') || '余裕あり'}
          </span>
        </div>`;
    });

    return `
      <div class="card-title">シミュレーターまとめ</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px">
        ${rows.join('')}
      </div>`;
  }

  // eBay seller_standards_profile レスポンスを内部形式にマッピング
  function _mapApiProfile(profile) {
    const program = Array.isArray(profile?.programs) ? profile.programs[0]
                  : Array.isArray(profile?.program)  ? profile.program[0]
                  : null;
    if (!program) return null;

    const totalTx = parseInt(
      program.evaluationCycle?.evaluatedTransactionCount
      ?? program.cycleSummary?.evaluatedTransactionCount
      ?? 0
    );
    if (!totalTx) return null;

    const KEY_MAP = {
      'TRANSACTION_DEFECT_RATE':         'defect',
      'CASES_WITHOUT_SELLER_RESOLUTION': 'cases',
      'LATE_SHIPMENT_RATE':              'lateship',
      'TRACKING_NOT_UPLOADED':           'tracking',
      'ITEM_NOT_AS_DESCRIBED_RATE':      'inad',
    };

    const metrics = {};
    for (const m of (program.metrics ?? [])) {
      const key = KEY_MAP[m.metricKey];
      if (!key) continue;
      const rate = parseFloat(m.value ?? 0); // % 値（例: 0.82 = 0.82%）
      metrics[key] = String(Math.round(rate * totalTx / 100));
    }

    return { total: String(totalTx), metrics };
  }

  async function _renderHealth(root) {
    root.innerHTML = `
      <div style="text-align:center;padding:32px 20px;color:var(--text-muted);
        font-family:var(--font-mono);font-size:11px">読み込み中...</div>`;

    const tier        = BA.auth?.getTier?.() ?? 'free';
    const isConnected = tier === 'connected' || tier === 'premium';
    const data        = _loadHealth();
    let fromApi       = false;

    // eBay未連携の場合はAPIを呼ばず即座に手動フォームを表示
    if (isConnected) {
      try {
        const profile = await BA.api.getSellerStandardsProfile();
        const mapped  = _mapApiProfile(profile);
        if (mapped) {
          if (mapped.total) data.total = mapped.total;
          Object.assign(data.metrics, mapped.metrics);
          _saveHealth(data);
          fromApi = true;
        }
      } catch {
        // API失敗 → 手動入力フォールバック（エラーログ出力しない）
      }
    }

    const total         = parseInt(data.total) || 0;
    const apiSourceNote = fromApi ? `
      <div style="font-size:11px;color:var(--green);font-family:var(--font-mono);
           margin-bottom:12px;padding:8px 12px;
           background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);
           border-radius:6px">✓ eBay APIから自動取得しました</div>` : '';

    root.innerHTML = `
      ${apiSourceNote}
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div class="card-title" style="margin:0;white-space:nowrap">評価期間の総取引件数</div>
          <div class="input-wrap" style="width:160px">
            <input class="input" id="h-total" type="number" min="0" step="1"
              placeholder="例: 100" value="${data.total ?? ''}" style="text-align:right">
            <div class="input-prefix"
              style="border-left:none;border-right:1px solid var(--border);border-radius:0 6px 6px 0">件</div>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">eBay管理画面「セラーパフォーマンス」の評価期間取引数</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
        ${METRICS.map(m => _metricCard(m, data, total)).join('')}
      </div>

      <div class="card" id="h-summary">
        ${_healthSummary(data, total)}
      </div>
    `;

    _bindHealthEvents(root);
  }

  // ─────────────────────────────────────
  // アラート発火
  // ─────────────────────────────────────
  function _checkAlerts(data, total) {
    if (!total) return;
    METRICS.forEach(m => {
      const problems = parseInt(data.metrics?.[m.key]) || 0;
      const rate     = (problems / total) * 100;
      if (m.failPct !== null && rate >= m.failPct) {
        BA.notify?.alert?.(`${m.key.toUpperCase()}_FAIL`, { label: m.label, rate: rate.toFixed(2) });
      } else if (m.warnPct !== null && rate >= m.warnPct) {
        BA.notify?.alert?.(`${m.key.toUpperCase()}_WARNING`, { label: m.label, rate: rate.toFixed(2) });
      }
    });
  }

  // ─────────────────────────────────────
  // イベントバインド（部分更新でフォーカス維持）
  // ─────────────────────────────────────
  function _bindHealthEvents(root) {
    const totalInput   = root.querySelector('#h-total');
    const metricInputs = root.querySelectorAll('.h-metric');
    let timer = null;

    function _onInput() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const data  = _loadHealth();
        const total = parseInt(totalInput?.value) || 0;
        data.total  = totalInput?.value ?? '';

        metricInputs.forEach(el => {
          data.metrics[el.dataset.key] = el.value;
        });

        _saveHealth(data);
        _checkAlerts(data, total);

        METRICS.forEach(m => {
          const problems = parseInt(data.metrics?.[m.key]) || 0;
          const rate     = total > 0 ? (problems / total) * 100 : 0;
          const status   = _getStatus(rate, m);
          const meterPct = m.failPct ? Math.min(100, (rate / m.failPct) * 100) : 0;

          const rateEl  = root.querySelector(`#h-rate-${m.key}`);
          const tagEl   = root.querySelector(`#h-tag-${m.key}`);
          const meterEl = root.querySelector(`#h-meter-${m.key}`);
          const simEl   = root.querySelector(`#h-sim-${m.key}`);

          if (rateEl)  { rateEl.textContent = total > 0 ? rate.toFixed(2) + '%' : '—'; rateEl.style.color = _rateColor(status); }
          if (tagEl)   { tagEl.innerHTML = _statusTag(status); }
          if (meterEl) { meterEl.style.width = meterPct + '%'; meterEl.className = `meter-fill ${_meterColor(status)}`; }
          if (simEl)   { simEl.innerHTML = _simLines(problems, total, m); }
        });

        const summaryEl = root.querySelector('#h-summary');
        if (summaryEl) summaryEl.innerHTML = _healthSummary(data, total);
      }, 300);
    }

    totalInput?.addEventListener('input', _onInput);
    metricInputs.forEach(el => el.addEventListener('input', _onInput));
  }

  // ─────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────
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

    refresh() {
      const root = document.getElementById('dashboard-root');
      if (root) _renderDashboard(root);
    },
  };

})();
