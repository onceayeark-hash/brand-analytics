// @not-security-critical （grep確認済み・認証情報/トークン/APIキーを扱わない。「保護」はeBayアカウントの規約違反アラート監視を指し、認証処理ではない・2026-06-25判断）
/**
 * BRAND ANALYTICS — protection.js
 * アカウント保護：アラートログ + フィードバックテンプレート（日英）
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // アラートログ（最大50件・インメモリ）
  // ─────────────────────────────────────
  const _log = [];

  document.addEventListener('ba:alert', ({ detail }) => {
    _log.unshift({ ...detail, ts: detail.ts ?? Date.now() });
    if (_log.length > 50) _log.pop();
    _patchAlertList();
  });

  function _patchAlertList() {
    const el = document.getElementById('prot-alert-list');
    if (el) el.innerHTML = _alertListHtml();
  }

  // ─────────────────────────────────────
  // フィードバックテンプレート（ハードコード fallback）
  // Supabase の feedback_templates に同内容がある想定
  // ─────────────────────────────────────
  const TEMPLATES = [
    {
      no: '01', label: 'ポジティブ返礼',
      ja: 'この度はご購入いただきありがとうございました。商品はご満足いただけましたでしょうか。またのご利用をお待ちしております。',
      en: 'Thank you for your purchase! We hope you are completely satisfied with your item. We look forward to serving you again.',
    },
    {
      no: '02', label: 'INAD（商品説明相違）対応',
      ja: 'ご不便をおかけして誠に申し訳ございません。商品状態の説明が不十分でした。返品・全額返金の対応をいたします。',
      en: 'We sincerely apologize for the inconvenience. The item description was not accurate enough. We will arrange a return and a full refund.',
    },
    {
      no: '03', label: 'INR（未着）対応',
      ja: 'ご連絡ありがとうございます。追跡番号をご確認の上、配送状況をご確認ください。解決されない場合は返金対応いたします。',
      en: 'Thank you for contacting us. Please check the tracking number for the latest delivery status. If the issue is not resolved, we will issue a full refund.',
    },
    {
      no: '04', label: 'ニュートラル・改善宣言',
      ja: 'ご意見をいただきありがとうございます。今後のサービス向上に役立ててまいります。またのご利用を心よりお待ちしております。',
      en: 'Thank you for your valuable feedback. We will use your comments to improve our service. We hope to serve you better in the future.',
    },
    {
      no: '05', label: '一般ネガティブ謝罪',
      ja: 'この度はご不満をおかけして大変申し訳ございませんでした。ご指摘の点を真摯に受け止め、改善に取り組んでまいります。',
      en: 'We sincerely apologize for not meeting your expectations. We take your feedback very seriously and are committed to continuous improvement.',
    },
  ];

  // ─────────────────────────────────────
  // アラートリスト HTML
  // ─────────────────────────────────────
  const SEV = {
    error:   { dot: 'var(--red)',      bg: 'var(--red-dim)'    },
    warning: { dot: 'var(--yellow)',   bg: 'var(--yellow-dim)' },
    info:    { dot: 'var(--gold-400)', bg: 'transparent'       },
    ok:      { dot: 'var(--green)',    bg: 'var(--green-dim)'  },
  };

  function _alertListHtml() {
    if (!_log.length) {
      return `<div style="padding:var(--space-4) 0;text-align:center;font-size:13px;
        color:var(--text-muted)">アラートなし</div>`;
    }
    return _log.slice(0, 15).map(a => {
      const s    = SEV[a.severity] ?? SEV.info;
      const time = new Date(a.ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      return `
        <div style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-2) var(--space-3);
          background:${s.bg};border-radius:6px">
          <div style="width:6px;height:6px;border-radius:50%;background:${s.dot};
            flex-shrink:0;margin-top:6px"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--text-primary);font-weight:500">${a.type ?? '—'}</div>
            ${a.message ? `<div class="note" style="margin-top:2px">${a.message}</div>` : ''}
          </div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);
            font-variant-numeric:tabular-nums;white-space:nowrap;flex-shrink:0;padding-top:1px">${time}</div>
        </div>`;
    }).join('');
  }

  // ─────────────────────────────────────
  // システム状態 HTML
  // ─────────────────────────────────────
  const _STATUS_LABEL = { ok: '正常', degraded: '低下', unreachable: '障害中', unknown: '未確認' };
  // ㉑v2.0-D: ステータスはテキスト色でなくピル型チップ（.tag）で表現
  const _STATUS_TAG = { ok: 'go', degraded: 'caution', unreachable: 'no-go', unknown: 'neutral' };

  function _statusRowHtml(label, status) {
    return `
      <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);
        background:var(--surface-2);border-radius:6px" data-status-label="${label}">
        <span style="font-size:13px;color:var(--text-secondary);flex:1">${label}</span>
        <span class="tag ${_STATUS_TAG[status]} prot-status-tag">${_STATUS_LABEL[status]}</span>
      </div>`;
  }

  function _systemStatusHtml() {
    const tier      = BA.auth?.getTier?.() ?? 'free';
    const connected = tier === 'connected' || tier === 'premium';

    // eBay OAuth行：状態により動的スタイル
    const oauthAction = connected
      ? `<span class="tag go">接続済み ✓</span>`
      : `<button class="btn btn-primary" style="font-size:11px;padding:4px 12px;min-height:28px"
           onclick="BA.nav?.showPanel?.('connect')">接続する</button>`;

    return `<div id="prot-system-status" style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);
        background:var(--surface-2);border-radius:6px">
        <span style="font-size:13px;color:var(--text-secondary);flex:1">eBay OAuth</span>
        ${oauthAction}
      </div>
      ${_statusRowHtml('Supabase DB', 'unknown')}
      ${_statusRowHtml('eBay API', 'unknown')}
    </div>`;
  }

  // 実際の死活確認結果で「未確認」プレースホルダーを置き換える
  async function _updateSystemStatus(root) {
    const results = await BA.monitor?.checkAllServices?.() ?? [];
    const byLabel = { 'Supabase DB': 'supabase', 'eBay API': 'ebay_api' };

    Object.entries(byLabel).forEach(([label, key]) => {
      const row = root.querySelector(`[data-status-label="${label}"]`);
      if (!row) return;
      const res = results.find(r => r.key === key);
      const status = res?.status ?? 'unknown';
      const tag = row.querySelector('.prot-status-tag');
      if (tag) {
        tag.className = `tag ${_STATUS_TAG[status]} prot-status-tag`;
        tag.textContent = _STATUS_LABEL[status];
      }
    });
  }

  // ─────────────────────────────────────
  // テンプレートカード HTML
  // ─────────────────────────────────────
  function _templateCard(t) {
    return `
      <div class="card" style="display:flex;flex-direction:column;gap:var(--space-2)">
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span class="tag neutral" style="font-family:var(--font-mono);flex-shrink:0;
            font-variant-numeric:tabular-nums">${t.no}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap">${t.label}</span>
        </div>

        <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden">
          <div style="padding:6px 12px;border-bottom:1px solid var(--border);
            font-size:13px;font-weight:500;color:var(--text-secondary);
            background:var(--surface-2)">日本語</div>
          <div style="padding:var(--space-2) var(--space-3);font-size:13px;color:var(--text-secondary);
            line-height:1.8">${t.ja}</div>
        </div>

        <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden">
          <div style="padding:6px 12px;border-bottom:1px solid var(--border);
            font-size:13px;font-weight:500;color:var(--text-secondary);
            background:var(--surface-2)">English</div>
          <div style="padding:var(--space-2) var(--space-3);font-size:13px;color:var(--text-secondary);
            line-height:1.8">${t.en}</div>
        </div>

        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-primary prot-save" data-no="${t.no}"
            style="flex:1;font-size:13px;white-space:nowrap">定型文を保存</button>
          <button class="btn btn-secondary prot-copy" data-lang="en" data-no="${t.no}"
            style="flex:1;font-size:13px;white-space:nowrap">English をコピー</button>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────
  // メインレンダー
  // ─────────────────────────────────────
  function _render(root) {
    // ㉑v2.0-A: 12カラムグリッド（左 col-4: アラート+システム状態 / 右 col-8: テンプレート）
    root.innerHTML = `
      <div class="grid-12">

        <div class="col col-4">

          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;
              margin-bottom:var(--space-3)">
              <div class="card-title" style="margin:0">アラートログ</div>
              <button class="btn btn-ghost" id="prot-clear-btn"
                style="font-size:11px;padding:4px 10px;min-height:28px">クリア</button>
            </div>
            <div id="prot-alert-list" style="display:flex;flex-direction:column;gap:6px">
              ${_alertListHtml()}
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:var(--space-3)">システム状態</div>
            ${_systemStatusHtml()}
          </div>

        </div>

        <div class="col col-8">
          <div class="card-title" style="padding:0 4px;margin:0">フィードバックテンプレート</div>
          ${TEMPLATES.map(_templateCard).join('')}
          <p class="note" style="text-align:center;margin-top:0">
            ※ eBay 返信時にコピーしてご利用ください
          </p>
        </div>

      </div>`;

    root.querySelectorAll('.prot-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = TEMPLATES.find(t => t.no === btn.dataset.no);
        if (!t) return;
        const text = btn.dataset.lang === 'ja' ? t.ja : t.en;
        navigator.clipboard?.writeText(text).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓ コピー完了';
          btn.disabled = true;
          setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1800);
        }).catch(() => {
          BA.notify?.toast?.('クリップボードへのアクセスが拒否されました', 'error');
        });
      });
    });

    root.querySelectorAll('.prot-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = TEMPLATES.find(t => t.no === btn.dataset.no);
        if (!t) return;
        try {
          const saved = JSON.parse(localStorage.getItem('ba_saved_templates') ?? '[]');
          if (!saved.find(s => s.no === t.no)) {
            saved.push({ no: t.no, label: t.label, ja: t.ja, en: t.en, savedAt: Date.now() });
            localStorage.setItem('ba_saved_templates', JSON.stringify(saved));
          }
          const orig = btn.textContent;
          btn.textContent = '✓ 保存しました';
          btn.disabled = true;
          setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1800);
        } catch {
          BA.notify?.toast?.('保存に失敗しました', 'error');
        }
      });
    });

    root.querySelector('#prot-clear-btn')?.addEventListener('click', () => {
      _log.length = 0;
      _patchAlertList();
    });
  }

  // ─────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────
  window.BA.protection = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'protection') return;
        const root = document.getElementById('protection-root');
        if (!root) return;
        _render(root);
        _updateSystemStatus(root);
      });
    },
  };

})();
