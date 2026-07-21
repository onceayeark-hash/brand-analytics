// @not-security-critical （grep確認済み・認証情報/トークン/APIキーを扱わない・2026-06-25判断）
/**
 * BRAND ANALYTICS — admin.js
 * 作成者専用管理者パネル
 * ・外部サービス死活監視
 * ・エラーログ一覧
 * ・エラー件数集計
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const STATUS_LABEL = { ok: '正常', degraded: '低下', down: '障害', unknown: '未確認' };
  const STATUS_COLOR = { ok: 'var(--green)', degraded: 'var(--yellow)', down: 'var(--red)', unknown: 'var(--text-muted)' };
  const STATUS_DOT   = STATUS_COLOR;
  // ㉑-D: ステータスはピル型チップで表現
  const STATUS_TAG   = { ok: 'go', degraded: 'caution', down: 'no-go', unknown: 'neutral' };

  // ─── サービス死活カード ──────────────────────────

  async function _renderServices(container) {
    container.innerHTML = `<div class="note">確認中…</div>`;
    const results = await BA.monitor?.checkAllServices?.() ?? [];

    container.innerHTML = results.map(svc => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-3) var(--space-4)">
        <span style="font-size:13px">${svc.label ?? svc.key}</span>
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <span class="tag ${STATUS_TAG[svc.status] ?? 'neutral'}">${STATUS_LABEL[svc.status] ?? '不明'}</span>
          ${svc.statusUrl ? `<a href="${svc.statusUrl}" target="_blank" rel="noopener"
              style="font-size:11px;color:var(--text-muted);white-space:nowrap">ステータスページ →</a>` : ''}
        </div>
      </div>
    `).join('') || `<div class="note">サービス情報なし</div>`;
  }

  // ─── エラーログ一覧 ─────────────────────────────

  async function _renderLogs(container) {
    container.innerHTML = `<div class="note">読み込み中…</div>`;

    try {
      const sb = window._supabaseClient;
      if (!sb) {
        container.innerHTML = `<div class="note">Supabase未接続</div>`;
        return;
      }

      const { data, error } = await sb
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      if (!data?.length) {
        container.innerHTML = `<div class="note" style="padding:var(--space-4) 0;text-align:center">エラーログはありません ✓</div>`;
        return;
      }

      container.innerHTML = `
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;color:var(--text-muted)">時刻</th>
              <th style="text-align:left;padding:8px 12px;color:var(--text-muted)">サービス</th>
              <th style="text-align:left;padding:8px 12px;color:var(--text-muted)">コード</th>
              <th style="text-align:left;padding:8px 12px;color:var(--text-muted)">メッセージ</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(log => {
              const isErr = log.error_code?.includes('ERROR') || log.error_code?.includes('DOWN') || log.error_code?.includes('FAIL');
              return `
                <tr style="border-top:1px solid var(--border)">
                  <td style="padding:8px 12px;font-family:var(--font-mono);white-space:nowrap;color:var(--text-muted)">
                    ${new Date(log.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td style="padding:8px 12px;font-family:var(--font-mono)">${log.service ?? ''}</td>
                  <td style="padding:8px 12px;font-family:var(--font-mono);color:${isErr ? 'var(--red)' : 'var(--yellow)'}">
                    ${log.error_code ?? ''}
                  </td>
                  <td style="padding:8px 12px;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    ${log.message ?? ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:var(--red);font-size:13px">ログ取得エラー: ${err.message}</div>`;
    }
  }

  // ─── エラー集計 ──────────────────────────────────

  async function _renderStats(container) {
    try {
      const sb = window._supabaseClient;
      if (!sb) { container.innerHTML = `<span class="note">—</span>`; return; }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await sb
        .from('error_logs')
        .select('error_code')
        .gte('created_at', since);

      const counts = {};
      (data ?? []).forEach(r => { counts[r.error_code] = (counts[r.error_code] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

      if (!sorted.length) {
        container.innerHTML = `<div class="note" style="text-align:center;padding:var(--space-2) 0">過去24時間エラーなし ✓</div>`;
        return;
      }

      container.innerHTML = sorted.map(([code, cnt]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);
                    padding:var(--space-2) 0;border-bottom:1px solid var(--border);font-size:13px">
          <span style="color:var(--text-secondary)">${code}</span>
          <span style="color:${cnt >= 5 ? 'var(--red)' : 'var(--yellow)'};font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap">
            ${cnt}件
          </span>
        </div>
      `).join('');
    } catch {
      container.innerHTML = `<span class="note">—</span>`;
    }
  }

  // ─── アナウンス管理 ─────────────────────────────

  function _renderAnnouncement(container) {
    const sb     = window.BA?.statusBanner;
    const active = sb?.getActive?.() ?? null;
    const locked = sb?.isManualLock?.() ?? false;
    const BANNERS = sb?.BANNERS ?? {};

    const statusText = active
      ? `<span class="tag caution">表示中: ${active}</span>`
      : `<span class="tag go">非表示</span>`;

    const lockBadge = locked
      ? `<span class="tag no-go" style="margin-left:var(--space-2)">手動設定中</span>`
      : '';

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:6px">${statusText}${lockBadge}</div>
        ${locked ? `<button class="btn btn-ghost" id="admin-banner-clear"
            style="font-size:11px;padding:4px 10px;color:var(--text-muted)">手動設定を解除</button>` : ''}
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">
        ${Object.entries(BANNERS).map(([key, def]) => `
          <button class="btn btn-secondary admin-banner-btn" data-type="${key}"
            style="font-size:11px;padding:5px 12px;${active === key ? 'border-color:var(--yellow);color:var(--yellow)' : ''}">
            ${key}
          </button>
        `).join('')}
        <button class="btn btn-secondary admin-banner-btn" data-type=""
          style="font-size:11px;padding:5px 12px;${!active ? 'border-color:var(--green);color:var(--green)' : ''}">
          非表示
        </button>
      </div>
      <p class="note" style="margin-top:var(--space-2)">
        ボタンを押すとセラー画面のバナーを手動設定します。
        「手動設定を解除」すると自動検知に戻ります。
      </p>
    `;

    container.querySelectorAll('.admin-banner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type || null;
        window.BA.statusBanner?.setManual?.(type);
        _renderAnnouncement(container);
      });
    });

    container.querySelector('#admin-banner-clear')?.addEventListener('click', () => {
      window.BA.statusBanner?.clearManual?.();
      _renderAnnouncement(container);
    });
  }

  // ─── メイン描画 ──────────────────────────────────

  async function _render(root) {
    root.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-5)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:var(--space-3)">
          <div class="card-title" style="margin:0">セラー向けバナー管理</div>
          <span class="tag neutral">管理者専用</span>
        </div>
        <div id="admin-announcement"></div>
      </div>

      <div style="margin-bottom:var(--space-5)">
        <div class="card-title" style="margin-bottom:var(--space-3)">サービス死活状態</div>
        <div id="admin-services" style="display:flex;flex-direction:column;gap:var(--space-2)"><div class="note">確認中…</div></div>
      </div>

      <div class="grid-12" style="margin-bottom:var(--space-5)">

        <div class="col col-6">
        <div class="card">
          <div class="card-title">過去24時間 エラー集計</div>
          <div id="admin-stats" style="margin-top:var(--space-3)"></div>
        </div>
        </div>

        <div class="col col-6">
        <div class="card">
          <div class="card-title">クイックリンク</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)">
            ${[
              ['Supabase Dashboard',      'https://supabase.com/dashboard/project/pvleyieegzqkwpqbpiax'],
              ['Supabase ステータス',      'https://status.supabase.com'],
              ['Google Cloud ステータス',  'https://status.cloud.google.com'],
              ['eBay Developer サポート',  'https://developer.ebay.com/support'],
            ].map(([label, url]) => `
              <a href="${url}" target="_blank" rel="noopener"
                 style="font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:var(--space-2);
                        padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);background:var(--surface-2);
                        text-decoration:none;transition:background .15s">
                <span style="opacity:.5">↗</span>${label}
              </a>
            `).join('')}
          </div>
        </div>
        </div>

      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:var(--space-3)">
          <div class="card-title" style="margin:0">最新エラーログ（直近30件）</div>
          <button class="btn btn-ghost" id="admin-refresh" style="font-size:11px;padding:4px 10px;white-space:nowrap">↻ 更新</button>
        </div>
        <div id="admin-logs"></div>
      </div>
    `;

    const annEl   = root.querySelector('#admin-announcement');
    const svcEl   = root.querySelector('#admin-services');
    const statsEl = root.querySelector('#admin-stats');
    const logsEl  = root.querySelector('#admin-logs');

    _renderAnnouncement(annEl);

    await Promise.allSettled([
      _renderServices(svcEl),
      _renderStats(statsEl),
      _renderLogs(logsEl),
    ]);

    // バナー変更イベントでアナウンスセクションを自動更新
    document.addEventListener('ba:banner-change', () => _renderAnnouncement(annEl));

    root.querySelector('#admin-refresh')?.addEventListener('click', async () => {
      _renderAnnouncement(annEl);
      await Promise.allSettled([
        _renderServices(svcEl),
        _renderStats(statsEl),
        _renderLogs(logsEl),
      ]);
    });
  }

  const ADMIN_EMAIL = 'onceayear.k@gmail.com';

  function _isAdmin() {
    const email = BA.auth?.getUser?.()?.email ?? '';
    return email === ADMIN_EMAIL;
  }

  function _updateNavVisibility() {
    const navItem = document.getElementById('nav-admin');
    if (navItem) navItem.style.display = _isAdmin() ? '' : 'none';
  }

  window.BA.admin = {
    init() {
      // ナビ項目をデフォルト非表示にしておく
      const navItem = document.getElementById('nav-admin');
      if (navItem) navItem.style.display = 'none';

      // 認証状態が変わるたびに表示/非表示を切り替える
      document.addEventListener('ba:auth-state-change', _updateNavVisibility);
      document.addEventListener('ba:panel-show', ({ detail }) => {
        // 管理者以外がURLや直接操作でアクセスしようとしても弾く
        if (detail.panelKey !== 'admin') return;
        if (!_isAdmin()) {
          BA.nav?.showPanel?.('profit');
          BA.notify?.toast?.('アクセス権限がありません', 'error');
          return;
        }
        const root = document.getElementById('admin-root');
        if (root) _render(root);
      });

      // 既存セッションで直接ツールに入った場合も反映（auth初期化完了後に確認）
      setTimeout(_updateNavVisibility, 500);
    },
  };

})();
