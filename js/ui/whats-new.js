/**
 * BRAND ANALYTICS — whats-new.js
 *
 * 2つのUXパターンを提供:
 *
 * [A] スポットライト（更新通知）
 *     - ログイン後、未閲覧の新機能があると画面全体が暗くなり
 *       対象ナビアイテムだけが浮かび上がる
 *     - バルーンで機能説明 → 「わかった」or 画面クリックで次へ
 *
 * [B] パネルイントロ（初回訪問案内）
 *     - 各パネルを初めて開いたときだけ、パネル内上部に
 *       ワンポイント説明バナーが表示される
 *     - × で閉じると二度と出ない
 *
 * 新機能を追加するときは FEATURES 配列に1エントリ追記するだけ。
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const SEEN_KEY  = 'ba_seen_features';
  const PANEL_KEY = 'ba_seen_panels';

  // ─────────────────────────────────────
  // 機能定義
  // ─────────────────────────────────────
  const FEATURES = [
    {
      key:      'transactions-v1',
      panelKey: 'transactions',
      label:    '取引記録',
      spotDesc: '販売ごとに手数料・仕入原価を記録すると、手数料率を自動で推定します。まず5件入力してみましょう。',
      intro: {
        title:  '取引記録の使い方',
        points: [
          '販売1件につき1〜2分で入力完了',
          '5件入力で手数料率が実績ベースに切り替わる',
          '入力データはダッシュボードの粗利益・PPDに自動反映',
        ],
      },
    },
    {
      key:      'dashboard-v2',
      panelKey: 'dashboard',
      label:    'ダッシュボード（新版）',
      spotDesc: 'eBay Seller Hub には表示されない「粗利益・PPD・実績手数料率」を主役にしたダッシュボードに刷新しました。',
      intro: {
        title:  'ダッシュボードの見方',
        points: [
          '今月の粗利益 = 実受取額 − 仕入原価 − 認証費',
          'PPD（1日あたり粗利益）で稼働効率を把握',
          '取引記録が増えるほど表示精度が上がる',
        ],
      },
    },
    {
      key:      'health-simulator-v1',
      panelKey: 'health',
      label:    '健全性シミュレーター',
      spotDesc: '「あと何件で不合格」を逆算表示。eBay 管理画面の数値を転記するだけで使えます。',
      intro: {
        title:  '健全性シミュレーターの使い方',
        points: [
          'eBay 管理画面「セラーパフォーマンス」の総取引件数を入力',
          '各指標の問題件数を入力すると逆算が即座に表示される',
          '入力値は次回ログイン後も自動復元される',
        ],
      },
    },
  ];

  // ─────────────────────────────────────
  // ストレージ
  // ─────────────────────────────────────
  function _loadSeen() {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')); } catch { return new Set(); }
  }

  function _markSeen(key) {
    try {
      const s = _loadSeen(); s.add(key);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
    } catch {}
  }

  function _loadSeenPanels() {
    try { return new Set(JSON.parse(localStorage.getItem(PANEL_KEY) ?? '[]')); } catch { return new Set(); }
  }

  function _markPanelSeen(panelKey) {
    try {
      const s = _loadSeenPanels(); s.add(panelKey);
      localStorage.setItem(PANEL_KEY, JSON.stringify([...s]));
    } catch {}
  }

  // ─────────────────────────────────────
  // [A] スポットライト
  // ─────────────────────────────────────
  let _spotQueue  = [];
  let _spotActive = false;

  function _showSpotlight(feature) {
    const navEl = document.querySelector(`[data-panel="${feature.panelKey}"]`);
    if (!navEl) { _nextSpot(); return; }

    const rect    = navEl.getBoundingClientRect();
    const pad     = 10;
    const rx      = rect.left - pad;
    const ry      = rect.top  - pad;
    const rw      = rect.width  + pad * 2;
    const rh      = rect.height + pad * 2;

    // キャリアウト方向（ナビは左サイドバーなので右側に表示）
    const calloutLeft = rect.right + 20;
    const calloutTop  = Math.max(16, rect.top - 20);

    const overlay = document.createElement('div');
    overlay.id = 'ba-spotlight';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `新機能: ${feature.label}`);
    overlay.style.cssText = 'position:fixed;inset:0;z-index:var(--z-overlay)';

    overlay.innerHTML = `
      <!-- SVG ダーク層（対象要素だけ切り抜く） -->
      <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"
           aria-hidden="true">
        <defs>
          <mask id="ba-spot-mask">
            <rect width="100%" height="100%" fill="white"/>
            <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="10" fill="black"/>
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.82)" mask="url(#ba-spot-mask)"/>
      </svg>

      <!-- ハイライト枠（点滅ボーダー） -->
      <div style="position:absolute;
        left:${rx}px;top:${ry}px;width:${rw}px;height:${rh}px;
        border-radius:10px;border:2px solid var(--gold-400);pointer-events:none;
        box-shadow:0 0 20px rgba(232,201,106,.4);animation:spot-pulse 1.6s ease-in-out infinite">
      </div>

      <!-- 吹き出し -->
      <div style="position:absolute;left:${calloutLeft}px;top:${calloutTop}px;
        width:280px;background:var(--surface);border:1px solid var(--gold-400);
        border-radius:12px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.6);
        animation:tut-in .3s ease">
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--gold-400);
          letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">NEW</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">
          ${feature.label}
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.7;margin-bottom:16px">
          ${feature.spotDesc}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" id="ba-spot-go"
            style="flex:1;justify-content:center;font-size:12px;padding:8px">
            開いてみる →
          </button>
          <button class="btn btn-ghost" id="ba-spot-skip"
            style="font-size:12px;padding:8px 14px">
            後で
          </button>
        </div>
      </div>

      <style>
        @keyframes spot-pulse {
          0%,100%{ box-shadow:0 0 16px rgba(232,201,106,.35); }
          50%    { box-shadow:0 0 32px rgba(232,201,106,.7);  }
        }
      </style>
    `;

    document.body.appendChild(overlay);

    function _dismiss(navigate) {
      _markSeen(feature.key);
      overlay.style.transition = 'opacity .2s ease';
      overlay.style.opacity    = '0';
      setTimeout(() => {
        overlay.remove();
        _spotActive = false;
        if (navigate) BA.nav?.showPanel?.(feature.panelKey);
        else _nextSpot();
      }, 200);
    }

    overlay.querySelector('#ba-spot-go')?.addEventListener('click',   () => _dismiss(true));
    overlay.querySelector('#ba-spot-skip')?.addEventListener('click',  () => _dismiss(false));
    // 背景クリックで「後で」
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _dismiss(false);
    });
  }

  function _nextSpot() {
    if (_spotQueue.length === 0) { _spotActive = false; return; }
    _spotActive = true;
    const next = _spotQueue.shift();
    _showSpotlight(next);
  }

  function _queueSpotlights() {
    const seen = _loadSeen();
    _spotQueue = FEATURES.filter(f => !seen.has(f.key));
    if (_spotQueue.length > 0) _nextSpot();
  }

  // ─────────────────────────────────────
  // [B] パネルイントロバナー
  // ─────────────────────────────────────
  function _showPanelIntro(feature, panelEl) {
    if (!feature.intro) return;

    const banner = document.createElement('div');
    banner.className = 'ba-panel-intro';
    banner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:14px;padding:16px 20px;
        background:rgba(232,201,106,.05);border:1px solid rgba(232,201,106,.2);
        border-radius:10px;margin-bottom:20px;position:relative">
        <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;
          background:rgba(232,201,106,.12);border:1px solid rgba(232,201,106,.3);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-family:var(--font-mono);color:var(--gold-400)">✦</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">
            ${feature.intro.title}
          </div>
          <ul style="margin:0;padding:0 0 0 16px;display:flex;flex-direction:column;gap:4px">
            ${feature.intro.points.map(p =>
              `<li style="font-size:12px;color:var(--text-secondary);line-height:1.6">${p}</li>`
            ).join('')}
          </ul>
        </div>
        <button aria-label="閉じる" style="position:absolute;top:12px;right:12px;
          background:none;border:none;cursor:pointer;color:var(--text-muted);
          font-size:16px;line-height:1;padding:4px 6px;border-radius:4px"
          id="ba-intro-close">✕</button>
      </div>`;

    // パネル内の最初の要素として挿入
    const firstChild = panelEl.querySelector('.panel-header');
    if (firstChild?.nextSibling) {
      panelEl.insertBefore(banner, firstChild.nextSibling);
    } else {
      panelEl.prepend(banner);
    }

    banner.querySelector('#ba-intro-close')?.addEventListener('click', () => {
      banner.style.transition = 'opacity .2s,max-height .3s';
      banner.style.opacity    = '0';
      banner.style.maxHeight  = '0';
      setTimeout(() => banner.remove(), 300);
      _markPanelSeen(feature.panelKey);
    });
  }

  // ─────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────
  window.BA.whatsNew = {
    init() {
      // [A] スポットライト: ログイン後すぐに発火
      _queueSpotlights();

      // [B] パネルイントロ: 各パネルを初めて開いたとき
      document.addEventListener('ba:panel-show', ({ detail }) => {
        const panelKey = detail?.panelKey;
        if (!panelKey) return;

        const seenPanels = _loadSeenPanels();
        if (seenPanels.has(panelKey)) return;

        const feature = FEATURES.find(f => f.panelKey === panelKey);
        if (!feature?.intro) return;

        const panelEl = document.getElementById(`panel-${panelKey}`);
        if (!panelEl) return;

        _markPanelSeen(panelKey);
        _showPanelIntro(feature, panelEl);
      });
    },

    // デバッグ用
    reset() {
      try {
        localStorage.removeItem(SEEN_KEY);
        localStorage.removeItem(PANEL_KEY);
      } catch {}
    },
  };

})();
