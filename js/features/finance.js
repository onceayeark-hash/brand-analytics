// @not-security-critical （grep確認済み・認証情報/トークン/APIキーを扱わない・2026-06-25判断）
/**
 * BRAND ANALYTICS — finance.js
 * ファイナンス概況（STAGE1）
 * transaction_logs を集計して売上・手数料・粗利を可視化する
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 集計エンジン
  // ─────────────────────────────────────
  const FinanceEngine = {

    compute30Day(records) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      cutoff.setHours(0, 0, 0, 0);

      const recent = records.filter(r => r.traded_at && new Date(r.traded_at) >= cutoff);

      const totalSalesUsd    = recent.reduce((s, r) => s + parseFloat(r.sale_price_usd   || 0), 0);
      const totalEbayFeeUsd  = recent.reduce((s, r) => s + parseFloat(r.ebay_fee_usd     || 0), 0);
      const totalPromoUsd    = recent.reduce((s, r) => s + parseFloat(r.promoted_fee_usd || 0), 0);
      const totalPayUsd      = recent.reduce((s, r) => s + parseFloat(r.payoneer_fee_usd || 0), 0);
      const totalFeesUsd = totalEbayFeeUsd + totalPromoUsd + totalPayUsd;
      const netPayoutUsd = totalSalesUsd - totalFeesUsd;

      // 実効手数料率: 真贋費用をUSD換算して加算（送料・関税は transaction_logs 未記録のため除外）
      let totalAuthUsd = 0;
      for (const r of recent) {
        if (!r.auth_service_incl) continue;
        const jpy  = r.auth_service_jpy ?? 0;
        const rate = r.exchange_rate    ?? 0;
        if (jpy > 0 && rate > 0) totalAuthUsd += jpy / rate;
      }
      const effectiveFeeRate = totalSalesUsd > 0 ? (totalFeesUsd + totalAuthUsd) / totalSalesUsd : 0;

      return { totalSalesUsd, totalFeesUsd, netPayoutUsd, effectiveFeeRate, count: recent.length };
    },

    computeMonthly(records, months = 6) {
      const now   = new Date();
      const slots = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        slots.push({
          month:    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label:    `${d.getMonth() + 1}月`,
          salesUsd: 0,
          feesUsd:  0,
          netUsd:   0,
          count:    0,
        });
      }

      for (const r of records) {
        const key  = r.traded_at?.slice(0, 7);
        const slot = slots.find(s => s.month === key);
        if (!slot) continue;
        const sales = parseFloat(r.sale_price_usd   || 0);
        const fees  = parseFloat(r.ebay_fee_usd     || 0)
                    + parseFloat(r.promoted_fee_usd || 0)
                    + parseFloat(r.payoneer_fee_usd || 0);
        slot.salesUsd += sales;
        slot.feesUsd  += fees;
        slot.netUsd   += (sales - fees);
        slot.count++;
      }

      return slots;
    },

    computeFeeBreakdown(records) {
      const totalSales    = records.reduce((s, r) => s + parseFloat(r.sale_price_usd   || 0), 0);
      const fvfTotal      = records.reduce((s, r) => s + parseFloat(r.ebay_fee_usd     || 0), 0);
      const promotedTotal = records.reduce((s, r) => s + parseFloat(r.promoted_fee_usd || 0), 0);
      const payoneerTotal = records.reduce((s, r) => s + parseFloat(r.payoneer_fee_usd || 0), 0);
      const safe = v => totalSales > 0 ? v / totalSales : 0;

      return {
        fvfRate: safe(fvfTotal), promotedRate: safe(promotedTotal), payoneerRate: safe(payoneerTotal),
        fvfTotal, promotedTotal, payoneerTotal, totalSales,
      };
    },
  };

  // ─────────────────────────────────────
  // フォーマット
  // ─────────────────────────────────────
  const _usd = v => `$${Number(v).toFixed(2)}`;
  const _pct = v => `${(Number(v) * 100).toFixed(2)}%`;

  function _isConnected() {
    const tier = BA.auth?.getTier?.() ?? 'free';
    return tier === 'connected' || tier === 'premium';
  }

  // ─────────────────────────────────────
  // KPI カード（アイコンなし・すっきり版）
  // ─────────────────────────────────────
  function _renderKPI(kpi) {
    // ㉑v2.0-B: 主要数値24px/600/tabular-nums・ラベル11px/500/muted
    const KPI_LABEL = 'font-family:var(--font-sans);font-size:11px;font-weight:500;letter-spacing:.04em;text-transform:none;color:var(--text-muted);white-space:nowrap';
    const KPI_VALUE = 'font-size:24px;font-weight:600;margin:var(--space-2) 0;font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap';

    const cards = [
      { label: '直近30日 売上',            note: 'gross sales', val: _usd(kpi.totalSalesUsd),    color: 'var(--gold-400)' },
      { label: 'eBay手数料合計',           note: 'total fees',  val: _usd(kpi.totalFeesUsd),     color: 'var(--red)'      },
      { label: '推定Payoneer入金額（概算）', note: '※実際の着金額とは異なる場合があります', val: _usd(kpi.netPayoutUsd), color: 'var(--green)' },
      { label: '実効手数料率',             note: '全費用 ÷ 売上',  val: _pct(kpi.effectiveFeeRate), color: 'var(--text-primary)' },
    ];

    return `
      <div class="grid-4" style="margin-bottom:var(--space-4)">
        ${cards.map(c => `
          <div class="card card--kpi" style="text-align:center">
            <div class="card-title" style="${KPI_LABEL}">${c.label}</div>
            <div style="${KPI_VALUE};color:${c.color}">${c.val}</div>
            <div class="note">${c.note}</div>
          </div>`).join('')}
      </div>`;
  }

  // ─────────────────────────────────────
  // SVG バーチャート（データあり月のみ表示）
  // ─────────────────────────────────────
  function _renderChart(monthly) {
    // データがある月だけ取り出す
    const activeSlots = monthly.filter(m => m.count > 0);

    // 2ヶ月未満は「データ不足」メッセージ
    if (activeSlots.length < 2) {
      return `
        <div class="card">
          <div class="card-title">月次売上 vs 手数料</div>
          <div style="height:120px;display:flex;flex-direction:column;align-items:center;
                      justify-content:center;gap:8px;margin-top:12px">
            <div style="font-size:13px;color:var(--text-muted)">
              グラフ表示には2ヶ月以上のデータが必要です
            </div>
            <div class="note">現在: ${activeSlots.length}ヶ月分 / 最低: 2ヶ月分</div>
          </div>
        </div>`;
    }

    // 表示するスロット: データがある月 + 前後1ヶ月のコンテキスト(最大8)
    const displaySlots = monthly.filter((m, i) => {
      if (m.count > 0) return true;
      // データあり月の隣を含める（見やすさのため）
      return monthly[i - 1]?.count > 0 || monthly[i + 1]?.count > 0;
    });

    const W = 560, H = 180;
    const padL = 52, padR = 12, padT = 20, padB = 32;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxSales = Math.max(...displaySlots.map(m => m.salesUsd), 1);
    const groupW   = chartW / displaySlots.length;
    const bW       = Math.min(groupW * 0.28, 22);
    const gap      = 4;

    const gridLines = [0, 0.5, 1].map(ratio => {
      const y   = padT + chartH * (1 - ratio);
      const val = maxSales * ratio;
      const lbl = val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`;
      return `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
              stroke="var(--border)" stroke-width="1"/>
        <text x="${padL - 6}" y="${y + 3.5}" text-anchor="end"
              font-family="var(--font-mono,monospace)" font-size="8"
              fill="var(--text-faint)">${lbl}</text>`;
    }).join('');

    const barGroups = displaySlots.map((m, i) => {
      const cx  = padL + i * groupW + groupW / 2;
      const sH  = m.salesUsd > 0 ? (m.salesUsd / maxSales) * chartH : 0;
      const fH  = m.feesUsd  > 0 ? (m.feesUsd  / maxSales) * chartH : 0;
      const sY  = padT + chartH - sH;
      const fY  = padT + chartH - fH;

      // 値ラベル（高さが十分あるときのみ）
      const salesLabel = sH > 16
        ? `<text x="${cx - bW / 2 - gap / 2}" y="${sY - 3}" text-anchor="middle"
                font-family="var(--font-mono,monospace)" font-size="7"
                fill="var(--gold-400)">$${m.salesUsd.toFixed(0)}</text>`
        : '';

      return `
        <rect x="${cx - bW - gap}" y="${sY}" width="${bW}" height="${Math.max(sH, 2)}"
              fill="var(--gold-400)" fill-opacity=".85" rx="2"/>
        <rect x="${cx + gap}"      y="${fY}" width="${bW}" height="${Math.max(fH, m.feesUsd > 0 ? 2 : 0)}"
              fill="var(--red)" fill-opacity=".65" rx="2"/>
        ${salesLabel}
        <text x="${cx}" y="${H - 10}" text-anchor="middle"
              font-family="var(--font-mono,monospace)" font-size="9"
              fill="var(--text-muted)">${m.label}</text>`;
    }).join('');

    const legend = `
      <rect x="${padL}" y="4" width="8" height="8" rx="1" fill="var(--gold-400)" fill-opacity=".85"/>
      <text x="${padL + 11}" y="11"
            font-family="var(--font-mono,monospace)" font-size="8"
            fill="var(--text-muted)">売上</text>
      <rect x="${padL + 36}" y="4" width="8" height="8" rx="1" fill="var(--red)" fill-opacity=".65"/>
      <text x="${padL + 47}" y="11"
            font-family="var(--font-mono,monospace)" font-size="8"
            fill="var(--text-muted)">手数料</text>`;

    return `
      <div class="card">
        <div class="card-title">月次売上 vs 手数料</div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;margin-top:8px"
             aria-label="月次売上と手数料の棒グラフ">
          ${gridLines}
          ${barGroups}
          ${legend}
        </svg>
      </div>`;
  }

  // ─────────────────────────────────────
  // 手数料内訳
  // ─────────────────────────────────────
  function _renderBreakdown(bd) {
    const maxRate = Math.max(bd.fvfRate, bd.promotedRate, bd.payoneerRate, 0.001);
    const items = [
      { label: 'FVF（最終価格手数料）', rate: bd.fvfRate,      total: bd.fvfTotal,      color: 'var(--gold-400)' },
      { label: 'Promoted Listings',    rate: bd.promotedRate,  total: bd.promotedTotal,  color: 'var(--gold-600)' },
      { label: 'Payoneer手数料',        rate: bd.payoneerRate,  total: bd.payoneerTotal,  color: 'var(--green)'    },
    ];

    const rows = items.map(it => {
      const barPct = (it.rate / maxRate) * 100;
      return `
        <div style="margin-bottom:var(--space-4)">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--space-2)">
            <span style="font-size:13px;color:var(--text-secondary);white-space:nowrap">${it.label}</span>
            <div style="display:flex;align-items:baseline;gap:12px">
              <span style="font-family:var(--font-mono);font-size:13px;font-weight:600;
                           font-variant-numeric:tabular-nums;color:var(--text-primary)">${_pct(it.rate)}</span>
              <span style="font-family:var(--font-mono);font-size:11px;
                           font-variant-numeric:tabular-nums;color:var(--text-muted)">${_usd(it.total)}</span>
            </div>
          </div>
          <div style="height:5px;background:var(--surface-2);
                      border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${barPct.toFixed(1)}%;
                        background:${it.color};border-radius:3px"></div>
          </div>
        </div>`;
    }).join('');

    const totalFees = bd.fvfTotal + bd.promotedTotal + bd.payoneerTotal;

    return `
      <div class="card">
        <div class="card-title">手数料内訳（全期間実績）</div>
        <div style="margin-top:var(--space-4)">${rows}</div>
        <div class="note" style="font-family:var(--font-mono);font-variant-numeric:tabular-nums;
             border-top:1px solid var(--border);padding-top:var(--space-4);margin-top:var(--space-2);
             display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span style="white-space:nowrap">全期間売上: ${_usd(bd.totalSales)}</span>
          <span style="white-space:nowrap">手数料合計: ${_usd(totalFees)}</span>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────
  // 2カラムレイアウト（グラフ + 内訳）
  // ─────────────────────────────────────
  function _renderChartRow(monthly, feeBreak) {
    // ㉑v2.0-A: 12カラムグリッド（チャート8span・内訳4span）
    return `
      <div class="grid-12" style="margin-bottom:var(--space-4)">
        <div class="col col-8">${_renderChart(monthly)}</div>
        <div class="col col-4">${_renderBreakdown(feeBreak)}</div>
      </div>`;
  }

  // ─────────────────────────────────────
  // 空データ状態
  // ─────────────────────────────────────
  function _renderEmpty() {
    return `
      <div class="card" style="text-align:center;padding:48px 20px">
        <svg viewBox="0 0 48 48" width="40" height="40"
             style="margin:0 auto 16px;display:block;opacity:.25"
             fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round">
          <rect x="6"  y="26" width="8"  height="14" rx="1"/>
          <rect x="20" y="18" width="8"  height="22" rx="1"/>
          <rect x="34" y="10" width="8"  height="30" rx="1"/>
          <line x1="4" y1="42" x2="44" y2="42"/>
        </svg>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;font-weight:600">
          取引記録がありません
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:var(--space-6);
                    max-width:280px;margin-inline:auto;line-height:1.7;text-wrap:balance">
          取引記録を追加すると、売上・手数料・粗利の推移が表示されます
        </div>
        <button class="btn btn-primary" onclick="BA.nav.showPanel('transactions')">
          取引記録を追加する →
        </button>
      </div>`;
  }

  // ─────────────────────────────────────
  // eBay未連携 CTA
  // ─────────────────────────────────────
  function _renderCTABanner() {
    return `
      <div style="margin-top:var(--space-6);padding:var(--space-4) var(--space-5);
                  border:1px solid var(--gold-line);border-radius:var(--radius-sm);
                  background:var(--gold-hover);
                  display:flex;align-items:center;justify-content:space-between;
                  gap:var(--space-4);flex-wrap:wrap;max-width:480px">
        <span style="font-size:13px;color:var(--text-secondary);white-space:nowrap">
          eBayを連携すると自動取得できます
        </span>
        <button class="btn btn-secondary" style="font-size:13px;padding:8px 20px;white-space:nowrap"
                onclick="BA.nav.showPanel('connect')">eBay連携 →</button>
      </div>`;
  }

  // ─────────────────────────────────────
  // メインレンダー
  // ─────────────────────────────────────
  async function _render(root) {
    root.innerHTML = `
      <div class="note" style="text-align:center;padding:var(--space-6) var(--space-5)">読み込み中...</div>`;

    let records = [];
    try {
      records = await BA.transactions?.list?.() ?? [];
    } catch {
      records = BA.transactions?.getRecords?.() ?? [];
    }

    const connected = _isConnected(); // レンダリング全体で状態を統一
    const syncBar = connected ? `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-secondary" id="finance-sync-btn"
          style="font-size:11px;padding:5px 12px">↓ eBayと同期</button>
      </div>` : '';

    if (records.length === 0) {
      root.innerHTML = syncBar + _renderEmpty() + (!connected ? _renderCTABanner() : '');
      _bindSyncBtn(root);
      return;
    }

    const kpi      = FinanceEngine.compute30Day(records);
    const monthly  = FinanceEngine.computeMonthly(records);
    const feeBreak = FinanceEngine.computeFeeBreakdown(records);

    root.innerHTML = `
      ${syncBar}
      <div class="note" style="font-family:var(--font-mono);font-variant-numeric:tabular-nums;
           margin-bottom:var(--space-4);white-space:nowrap">
        全${records.length}件 · 直近30日: ${kpi.count}件
      </div>
      ${_renderKPI(kpi)}
      ${_renderChartRow(monthly, feeBreak)}
      <p class="note" style="text-align:center;margin-top:var(--space-4);padding:var(--space-3);
         border:1px solid var(--border);border-radius:var(--radius-sm)">
        ※ シミュレーション値・実際の損益は取引記録による
      </p>
      ${!connected ? _renderCTABanner() : ''}
    `;
    _bindSyncBtn(root);
  }

  function _bindSyncBtn(root) {
    root.querySelector('#finance-sync-btn')?.addEventListener('click', async () => {
      const btn = root.querySelector('#finance-sync-btn');
      if (btn) { btn.textContent = '同期中...'; btn.disabled = true; }
      try {
        const result = await BA.transactions?.syncFromEbay?.();
        const added  = result?.added ?? 0;
        BA.notify?.toast?.(`eBay同期完了: ${added}件追加`, added > 0 ? 'success' : 'info');
      } catch {
        BA.notify?.toast?.('eBay同期に失敗しました', 'error');
      }
      await _render(root);
    });
  }

  // ─────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────
  window.BA.finance = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'finance') return;
        const root = document.getElementById('finance-root');
        if (root) _render(root);
      });

      document.addEventListener('ba:transaction-added', () => {
        const panel = document.getElementById('panel-finance');
        if (!panel?.classList.contains('active')) return;
        const root = document.getElementById('finance-root');
        if (root) _render(root);
      });
    },
  };

})();
