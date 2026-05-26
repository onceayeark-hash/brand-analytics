/**
 * BRAND ANALYTICS — tutorial.js
 * 初回ログイン時の初期設定チュートリアル（4ステップモーダル）
 *
 * - localStorage 'ba_tutorial_done' が未設定のログイン済みユーザーにのみ表示
 * - スキップ可能
 * - 各ステップから該当パネルへ直接ジャンプできる
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const DONE_KEY = 'ba_tutorial_done';

  // ─────────────────────────────────────
  // ステップ定義
  // ─────────────────────────────────────
  function _stepItem(num, title, desc) {
    return `
      <div style="display:flex;align-items:flex-start;gap:12px">
        <span style="width:24px;height:24px;border-radius:50%;background:rgba(232,201,106,.12);
          border:1px solid rgba(232,201,106,.3);display:flex;align-items:center;justify-content:center;
          font-size:11px;font-family:var(--font-mono);color:var(--gold-400);flex-shrink:0;
          line-height:1">${num}</span>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${title}</div>
          <div style="font-size:12px;color:var(--text-muted)">${desc}</div>
        </div>
      </div>`;
  }

  const STEPS = [
    {
      icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
               <rect x="3" y="3" width="18" height="18" rx="2"/>
               <path d="M3 9h18M9 21V9"/>
             </svg>`,
      title: 'BRAND ANALYTICS へようこそ',
      body: `
        <p style="margin:0 0 16px;line-height:1.7">
          eBay Seller Hub には表示されない数字を主役にした、セラー向け収益管理ツールです。
        </p>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${_stepItem('①', 'eBay 連携', '実績データをリアルタイム取得')}
          ${_stepItem('②', '取引記録を入力', '手数料率を自動で推定')}
          ${_stepItem('③', 'アカウント指標を設定', '不合格まで何件かを逆算')}
        </div>
        <p style="margin:16px 0 0;font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">
          各ステップは後からでも完了できます
        </p>`,
      action: null,
    },
    {
      icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
               <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
               <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
             </svg>`,
      title: 'eBay アカウントを連携する',
      body: `
        <p style="margin:0 0 16px;line-height:1.7">
          連携すると、eBay の実績データ（アカウント指標・出品情報）をリアルタイムで取得できます。
          取得したデータはダッシュボードに自動反映されます。
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;padding:12px 16px;
          background:rgba(232,201,106,.04);border:1px solid rgba(232,201,106,.15);border-radius:8px;
          font-size:12px;color:var(--text-secondary);line-height:1.7">
          <div>✓ アカウントパフォーマンス指標の自動取得</div>
          <div>✓ 出品データ連携（STAGE2 自動出品機能の前提）</div>
          <div>✓ 認証は eBay の公式画面で完結</div>
        </div>`,
      action: { label: 'eBay 連携画面を開く', panel: 'connect' },
    },
    {
      icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
               <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
               <polyline points="14 2 14 8 20 8"/>
               <line x1="16" y1="13" x2="8" y2="13"/>
               <line x1="16" y1="17" x2="8" y2="17"/>
               <polyline points="10 9 9 9 8 9"/>
             </svg>`,
      title: '取引記録を入力する',
      body: `
        <p style="margin:0 0 16px;line-height:1.7">
          販売ごとの手数料・仕入原価・実受取額を記録すると、
          <strong style="color:var(--gold-400)">eBay 手数料率が自動で推定</strong>されます。
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;padding:12px 16px;
          background:rgba(232,201,106,.04);border:1px solid rgba(232,201,106,.15);border-radius:8px;
          font-size:12px;color:var(--text-secondary);line-height:1.7">
          <div>✓ <strong>5件</strong> 入力でフォールバック解除・実績手数料率が確定</div>
          <div>✓ 粗利益・PPD がダッシュボードに自動表示</div>
          <div>✓ 仕入れ計算機の精度が上がる</div>
        </div>
        <p style="margin:12px 0 0;font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">
          入力目安：1件 約30秒
        </p>`,
      action: { label: '取引記録画面を開く', panel: 'transactions' },
    },
    {
      icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
               <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
             </svg>`,
      title: 'アカウント指標を設定する',
      body: `
        <p style="margin:0 0 16px;line-height:1.7">
          eBay 管理画面の「セラーパフォーマンス」から取引件数と問題件数を入力すると、
          <strong style="color:var(--gold-400)">不合格まで残り何件か</strong>を逆算して表示します。
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;padding:12px 16px;
          background:rgba(232,201,106,.04);border:1px solid rgba(232,201,106,.15);border-radius:8px;
          font-size:12px;color:var(--text-secondary);line-height:1.7">
          <div>✓ 取引不良率 / 遅延発送率 / INAD 率などを監視</div>
          <div>✓「あと XX 件で警告」をリアルタイム計算</div>
          <div>✓ 入力値は次回も自動復元</div>
        </div>`,
      action: { label: 'アカウントパフォーマンス画面を開く', panel: 'health' },
    },
  ];

  // ─────────────────────────────────────
  // モーダル描画
  // ─────────────────────────────────────
  let _currentStep = 0;
  let _overlay     = null;

  function _render() {
    const step  = STEPS[_currentStep];
    const total = STEPS.length;
    const isLast = _currentStep === total - 1;

    const dots = Array.from({ length: total }, (_, i) => `
      <span style="width:6px;height:6px;border-radius:50%;
        background:${i === _currentStep ? 'var(--gold-400)' : 'rgba(255,255,255,.15)'}"></span>
    `).join('');

    _overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-label="${step.title}"
        style="position:relative;width:100%;max-width:480px;
          background:var(--surface);border:1px solid rgba(232,201,106,.18);border-radius:16px;
          padding:40px 36px 32px;box-shadow:0 32px 80px rgba(0,0,0,.5);animation:tut-in .25s ease">
        <button id="tutorial-skip"
          style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;
            font-size:12px;color:var(--text-muted);padding:6px 10px;border-radius:6px;"
          aria-label="チュートリアルをスキップ">スキップ</button>

        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:28px">
          ${step.icon}
          <h2 style="margin:16px 0 0;font-size:1.2rem;font-weight:600;color:var(--text-primary)">${step.title}</h2>
        </div>

        <div style="text-align:left;color:var(--text-secondary)">${step.body}</div>

        <div style="margin-top:28px;display:flex;flex-direction:column;gap:10px">
          ${step.action ? `
            <button class="btn btn-primary" style="width:100%;justify-content:center"
              id="tutorial-action">${step.action.label}</button>
          ` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <button class="btn" id="tutorial-prev"
              style="font-size:12px;padding:8px 16px;${_currentStep === 0 ? 'opacity:0;pointer-events:none' : ''}">
              ← 戻る
            </button>
            <div style="display:flex;gap:6px;align-items:center">${dots}</div>
            <button class="btn btn-primary" id="tutorial-next"
              style="font-size:12px;padding:8px 20px">
              ${isLast ? '完了 ✓' : '次へ →'}
            </button>
          </div>
        </div>

        <div style="margin-top:20px;text-align:center;font-size:10px;color:var(--text-muted);
          font-family:var(--font-mono);letter-spacing:.06em">
          ${_currentStep + 1} / ${total}
        </div>
      </div>

      <style>
        @keyframes tut-in {
          from { opacity: 0; transform: translateY(16px) scale(.97); }
          to   { opacity: 1; transform: none; }
        }
      </style>
    `;

    _overlay.querySelector('#tutorial-skip')?.addEventListener('click', _done);
    _overlay.querySelector('#tutorial-prev')?.addEventListener('click', _prev);
    _overlay.querySelector('#tutorial-next')?.addEventListener('click', isLast ? _done : _next);

    const actionBtn = _overlay.querySelector('#tutorial-action');
    if (actionBtn && step.action) {
      actionBtn.addEventListener('click', () => {
        BA.nav?.showPanel?.(step.action.panel);
        _done();
      });
    }
  }

  function _next() {
    if (_currentStep < STEPS.length - 1) {
      _currentStep++;
      _render();
    }
  }

  function _prev() {
    if (_currentStep > 0) {
      _currentStep--;
      _render();
    }
  }

  function _done() {
    try { localStorage.setItem(DONE_KEY, '1'); } catch {}
    if (_overlay) {
      _overlay.style.opacity    = '0';
      _overlay.style.transition = 'opacity .2s ease';
      setTimeout(() => _overlay?.remove(), 200);
      _overlay = null;
    }
  }

  function _show() {
    // オーバーレイ廃止：各ページのインラインバナーに移行
    return;
    const isDone = localStorage.getItem(DONE_KEY); // eslint-disable-line no-unreachable
    const user   = BA.auth?.getUser?.();
    if (isDone || !user) return;

    _currentStep = 0;

    _overlay = document.createElement('div');
    _overlay.id = 'tutorial-overlay';
    Object.assign(_overlay.style, {
      position:       'fixed',
      inset:          '0',
      background:     'rgba(0,0,0,.72)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         'var(--z-overlay)',
      padding:        '20px',
      backdropFilter: 'blur(4px)',
    });

    document.body.appendChild(_overlay);
    _render();
  }

  // ─────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────
  window.BA.tutorial = {
    // index.html の DOMContentLoaded 内で BA.auth.init() 完了後に呼ばれる
    init() {
      _show();
    },

    // デバッグ用（コンソールから BA.tutorial.reset() を実行するとチュートリアルをリセット）
    reset() {
      try { localStorage.removeItem(DONE_KEY); } catch {}
    },
  };

})();
