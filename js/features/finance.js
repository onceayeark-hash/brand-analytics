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
      const totalFeesUsd     = totalEbayFeeUsd + totalPromoUsd + totalPayUsd;
      const netPayoutUsd     = totalSalesUsd - totalFeesUsd;
      const effectiveFeeRate = totalSalesUsd > 0 ? totalFeesUsd / totalSalesUsd : 0;

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
    const cards = [
      { label: '直近30日 売上',  sub: 'gross sales', val: _usd(kpi.totalSalesUsd),    color: 'var(--gold-400)' },
      { label: 'eBay手数料合計', sub: 'total fees',  val: _usd(kpi.totalFeesUsd),     color: 'var(--red)'      },
      { label: 'Payoneer入金額', sub: 'net payout',  val: _usd(kpi.netPayoutUsd),     color: 'var(--green)'    },
      { label: '実効手数料率',   sub: '実績平均',     val: _pct(kpi.effectiveFeeRate), color: 'var(--text-primary)' },
    ];

    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        ${cards.map(c => `
          <div class="card" style="position:relative;overflow:hidden;padding:20px 20px 24px">
            <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);
                        letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px">
              ${c.label}
            </div>
            <div style="font-family:var(--font-mono);font-size:1.7rem;font-weight:600;
                        color:${c.color};line-height:1;margin-bottom:6px;letter-spacing:-.01em">
              ${c.val}
            </div>
            <div style="font-size:10px;color:var(--text-muted)">${c.sub}</div>
            <div style="position:absolute;bottom:0;left:0;right:0;height:3px;
                        background:linear-gradient(90deg,${c.color},transparent);opacity:.4"></div>
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
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">月次売上 vs 手数料</div>
          <div style="height:120px;display:flex;flex-direction:column;align-items:center;
                      justify-content:center;gap:8px;margin-top:12px">
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">
              グラフ表示には2ヶ月以上のデータが必要です
            </div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);opacity:.6">
              現在: ${activeSlots.length}ヶ月分 / 最低: 2ヶ月分
            </div>
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
              stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
        <text x="${padL - 6}" y="${y + 3.5}" text-anchor="end"
              font-family="var(--font-mono,monospace)" font-size="8"
              fill="rgba(255,255,255,0.3)">${lbl}</text>`;
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
                fill="rgba(232,201,106,.7)">$${m.salesUsd.toFixed(0)}</text>`
        : '';

      return `
        <rect x="${cx - bW - gap}" y="${sY}" width="${bW}" height="${Math.max(sH, 2)}"
              fill="rgba(232,201,106,.85)" rx="2"/>
        <rect x="${cx + gap}"      y="${fY}" width="${bW}" height="${Math.max(fH, m.feesUsd > 0 ? 2 : 0)}"
              fill="rgba(229,62,62,.65)" rx="2"/>
        ${salesLabel}
        <text x="${cx}" y="${H - 10}" text-anchor="middle"
              font-family="var(--font-mono,monospace)" font-size="9"
              fill="rgba(255,255,255,.5)">${m.label}</text>`;
    }).join('');

    const legend = `
      <rect x="${padL}" y="4" width="8" height="8" rx="1" fill="rgba(232,201,106,.85)"/>
      <text x="${padL + 11}" y="11"
            font-family="var(--font-mono,monospace)" font-size="8"
            fill="rgba(255,255,255,.5)">売上</text>
      <rect x="${padL + 36}" y="4" width="8" height="8" rx="1" fill="rgba(229,62,62,.65)"/>
      <text x="${padL + 47}" y="11"
            font-family="var(--font-mono,monospace)" font-size="8"
            fill="rgba(255,255,255,.5)">手数料</text>`;

    return `
      <div class="card" style="margin-bottom:16px">
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
      { label: 'FVF（最終価格手数料）', rate: bd.fvfRate,      total: bd.fvfTotal,      color: 'rgba(232,201,106,.85)' },
      { label: 'Promoted Listings',    rate: bd.promotedRate,  total: bd.promotedTotal,  color: 'rgba(168,130,0,.8)'    },
      { label: 'Payoneer手数料',        rate: bd.payoneerRate,  total: bd.payoneerTotal,  color: 'rgba(78,206,138,.72)'  },
    ];

    const rows = items.map(it => {
      const barPct = (it.rate / maxRate) * 100;
      return `
        <div style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span style="font-size:12px;color:var(--text-secondary)">${it.label}</span>
            <div style="display:flex;align-items:baseline;gap:12px">
              <span style="font-family:var(--font-mono);font-size:13px;
                           font-weight:500;color:var(--text-primary)">${_pct(it.rate)}</span>
              <span style="font-family:var(--font-mono);font-size:11px;
                           color:var(--text-muted)">${_usd(it.total)}</span>
            </div>
          </div>
          <div style="height:5px;background:rgba(255,255,255,.06);
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
        <div style="margin-top:20px">${rows}</div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);
             border-top:1px solid var(--border);padding-top:16px;margin-top:8px;
             display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>全期間売上: ${_usd(bd.totalSales)}</span>
          <span>手数料合計: ${_usd(totalFees)}</span>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────
  // 2カラムレイアウト（グラフ + 内訳）
  // ─────────────────────────────────────
  function _renderChartRow(monthly, feeBreak) {
    return `
      <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;margin-bottom:16px;
                  align-items:start">
        ${_renderChart(monthly)}
        ${_renderBreakdown(feeBreak)}
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
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;font-weight:500">
          取引記録がありません
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:24px;
                    max-width:280px;margin-inline:auto;line-height:1.7">
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
      <div style="margin-top:24px;padding:16px 20px;
                  border:1px solid rgba(232,201,106,.15);border-radius:8px;
                  background:rgba(232,201,106,.04);
                  display:flex;align-items:center;justify-content:space-between;
                  gap:16px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-secondary)">
          eBayを連携すると売上・手数料データが自動取得されます
        </span>
        <button class="btn btn-secondary" style="font-size:12px;padding:8px 20px;white-space:nowrap"
                onclick="BA.nav.showPanel('connect')">eBay連携 →</button>
      </div>`;
  }

  // ─────────────────────────────────────
  // メインレンダー
  // ─────────────────────────────────────
  function _render(root) {
    const records = BA.transactions?.getRecords?.() ?? [];

    if (records.length === 0) {
      root.innerHTML = _renderEmpty() + (!_isConnected() ? _renderCTABanner() : '');
      return;
    }

    const kpi      = FinanceEngine.compute30Day(records);
    const monthly  = FinanceEngine.computeMonthly(records);
    const feeBreak = FinanceEngine.computeFeeBreakdown(records);

    root.innerHTML = `
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
           margin-bottom:20px;letter-spacing:.06em">
        全${records.length}件 · 直近30日: ${kpi.count}件
      </div>
      ${_renderKPI(kpi)}
      ${_renderChartRow(monthly, feeBreak)}
      <p style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
         text-align:center;margin-top:16px;padding:10px;
         border:1px solid rgba(255,255,255,.04);border-radius:6px">
        ※ シミュレーション値・実際の損益は取引記録による
      </p>
      ${!_isConnected() ? _renderCTABanner() : ''}
    `;
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
