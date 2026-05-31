/**
 * BRAND ANALYTICS — tour.js
 * 初回ログイン時のプロダクトツアー
 *
 * - 4パネルフレーム方式でスポットライトを実現（z-index上書きなし）
 * - 対象要素をゴールドボーダーでハイライト
 * - 吹き出しカードに「次へ」「戻る」「スキップ」を配置
 * - localStorage 'ba_tour_done' が設定されているユーザーには表示しない
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const DONE_KEY  = 'ba_tour_done';
  const PAD       = 10;   // スポットライト周囲の余白 (px)
  const CARD_W    = 300;  // ツールチップカード幅 (px)
  const CARD_W_LG = 380;  // センターカード幅 (px)
  const GAP       = 16;   // スポットライトとカードの距離 (px)
  const Z         = 9000; // ベースz-index

  // ─────────────────────────────────────
  // ツアーステップ定義
  // ─────────────────────────────────────
  const STEPS = [
    {
      target:    null,
      placement: 'center',
      title:     'BRAND ANALYTICSへようこそ',
      body:      `
        eBay Seller Hubには表示されない数字を主役にした、<br>日本人セラー向け収益管理ツールです。
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;font-size:13px">
          <div><span style="color:rgba(200,146,78,1);font-weight:700">① 利益計算機</span>
            <span style="color:#9a9a9a"> — 粗利・ROI・PPDを瞬時に計算</span></div>
          <div><span style="color:rgba(200,146,78,1);font-weight:700">② 仕入れメーター</span>
            <span style="color:#9a9a9a"> — GO / NO-GOを自動判定</span></div>
          <div><span style="color:rgba(200,146,78,1);font-weight:700">③ eBay連携</span>
            <span style="color:#9a9a9a"> — アカウント指標をリアルタイム取得</span></div>
        </div>`,
    },
    {
      target:    '#nav-profit',
      placement: 'right',
      title:     '利益計算機',
      body:      '販売価格・仕入れ原価を入力するだけで粗利・ROI・PPDを瞬時に計算します。<strong style="color:rgba(200,146,78,1)">無料機能</strong>なのでeBay連携前でもすぐ使えます。',
    },
    {
      target:    '#nav-sourcing',
      placement: 'right',
      title:     '仕入れメーター',
      body:      '粗利率・競合増加率・成約率を入力すると、この商品を仕入れるべきか <strong style="color:#4ece8a">GO</strong> / <strong style="color:#e85454">NO-GO</strong> で判定します。',
    },
    {
      target:    '#nav-transactions',
      placement: 'right',
      title:     '取引記録',
      body:      '実取引データを記録するたびにeBay手数料率の推定精度が上がります。<strong style="color:rgba(200,146,78,1)">5件入力</strong>でフォールバック値から実績値に切り替わります。',
    },
    {
      target:    '#btn-connect-header',
      placement: 'bottom',
      title:     'eBay連携で全機能解放',
      body:      'eBayアカウントを連携すると、ダッシュボード・ファイナンス・アカウント保護などの機能が解放されます。連携はいつでも行えます。',
    },
  ];

  // ─────────────────────────────────────
  // 状態管理
  // ─────────────────────────────────────
  let _step     = 0;
  let _els      = null;
  let _onResize = null;

  // ─────────────────────────────────────
  // DOM構築
  // ─────────────────────────────────────
  function _createEls() {
    const frameBase = {
      position: 'fixed',
      zIndex:   `${Z}`,
      background: 'rgba(0,0,0,0.62)',
      pointerEvents: 'all',
      transition: 'top .25s ease, left .25s ease, width .25s ease, height .25s ease',
    };

    const frames = {};
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const el = document.createElement('div');
      el.className = `tour-frame tour-frame-${side}`;
      Object.assign(el.style, frameBase);
      document.body.appendChild(el);
      frames[side] = el;
    }

    // ゴールドリング（スポットライト枠）
    const ring = document.createElement('div');
    ring.id = 'tour-ring';
    Object.assign(ring.style, {
      position:   'fixed',
      zIndex:     `${Z + 1}`,
      background: 'transparent',
      borderRadius: '10px',
      border:     '2px solid rgba(200,146,78,0.75)',
      boxShadow:  '0 0 0 4px rgba(200,146,78,0.10), 0 0 24px rgba(200,146,78,0.22)',
      pointerEvents: 'none',
      transition: 'top .25s ease, left .25s ease, width .25s ease, height .25s ease',
      display:    'none',
    });
    document.body.appendChild(ring);

    // スポットライト上の透明クリックブロッカー（対象要素の誤操作防止）
    const spotBlocker = document.createElement('div');
    spotBlocker.id = 'tour-spot-blocker';
    Object.assign(spotBlocker.style, {
      position: 'fixed',
      zIndex:   `${Z + 2}`,
      background: 'transparent',
      pointerEvents: 'all',
    });
    document.body.appendChild(spotBlocker);

    // ツールチップカード
    const card = document.createElement('div');
    card.id = 'tour-card';
    Object.assign(card.style, {
      position:  'fixed',
      zIndex:    `${Z + 3}`,
      background: 'var(--bg-card, #292b2d)',
      border:    '1px solid rgba(200,146,78,0.28)',
      borderRadius: '12px',
      padding:   '20px 22px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
      fontFamily: 'var(--font-sans, "BIZ UDPGothic", sans-serif)',
      pointerEvents: 'all',
      transition: 'opacity .2s ease',
    });
    document.body.appendChild(card);

    _els = { ...frames, ring, spotBlocker, card };
  }

  // ─────────────────────────────────────
  // カード内容を描画
  // ─────────────────────────────────────
  function _renderCard() {
    const step   = STEPS[_step];
    const total  = STEPS.length;
    const isLast = _step === total - 1;

    const dots = Array.from({ length: total }, (_, i) =>
      `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;flex-shrink:0;
        background:${i === _step ? 'rgba(200,146,78,1)' : 'rgba(200,146,78,0.2)'};
        transition:background .2s"></span>`
    ).join('');

    _els.card.innerHTML = `
      <div style="font-family:var(--font-mono,'IBM Plex Mono',monospace);font-size:11px;
        color:rgba(200,146,78,0.9);letter-spacing:.08em;text-transform:uppercase;
        margin-bottom:10px;line-height:1">
        ${step.title}
      </div>
      <div style="font-size:13px;color:var(--text-secondary,#9a9a9a);line-height:1.75;
        margin-bottom:18px">
        ${step.body}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">${dots}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap;flex-shrink:0">
          <button id="tour-skip-btn"
            style="font-family:inherit;font-size:12px;color:var(--text-muted,#606368);
              background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:4px">
            スキップ
          </button>
          ${_step > 0
            ? `<button id="tour-prev-btn" class="btn btn-secondary"
                style="padding:0 14px;min-height:36px;font-size:13px">← 戻る</button>`
            : ''}
          <button id="tour-next-btn" class="btn btn-primary"
            style="padding:0 16px;min-height:36px;font-size:13px">
            ${isLast ? 'さっそく使う' : '次へ →'}
          </button>
        </div>
      </div>
    `;

    _els.card.querySelector('#tour-skip-btn').addEventListener('click', _done);
    _els.card.querySelector('#tour-prev-btn')?.addEventListener('click', _prev);
    _els.card.querySelector('#tour-next-btn').addEventListener('click', isLast ? _done : _next);
  }

  // ─────────────────────────────────────
  // 要素の位置を更新
  // ─────────────────────────────────────
  function _positionEls() {
    if (!_els) return;

    const step = STEPS[_step];
    const W    = window.innerWidth;
    const H    = window.innerHeight;

    // ── センターモーダル（target なし）────────────────────
    if (!step.target) {
      const cw = Math.min(CARD_W_LG, W - 32);
      const ch = _els.card.offsetHeight || 220;
      const ct = Math.max(8, (H - ch) / 2);
      const cl = Math.max(8, (W - cw) / 2);

      Object.assign(_els.top.style,    { top:'0', left:'0', width:`${W}px`, height:`${H}px` });
      Object.assign(_els.bottom.style, { top:'0', left:'0', width:'0', height:'0' });
      Object.assign(_els.left.style,   { top:'0', left:'0', width:'0', height:'0' });
      Object.assign(_els.right.style,  { top:'0', left:'0', width:'0', height:'0' });

      _els.ring.style.display       = 'none';
      _els.spotBlocker.style.width  = '0';
      _els.spotBlocker.style.height = '0';

      Object.assign(_els.card.style, {
        width:   `${cw}px`,
        left:    `${cl}px`,
        top:     `${ct}px`,
        opacity: '1',
      });
      return;
    }

    // ── スポットライトモード ──────────────────────────────
    const target = document.querySelector(step.target);
    if (!target) return;

    const r  = target.getBoundingClientRect();
    const p  = PAD;
    const sx = Math.max(0, r.left - p);
    const sy = Math.max(0, r.top  - p);
    const sw = r.width  + p * 2;
    const sh = r.height + p * 2;

    // 4パネル
    Object.assign(_els.top.style,    { top:'0',           left:'0',           width:`${W}px`,        height:`${sy}px`       });
    Object.assign(_els.bottom.style, { top:`${sy+sh}px`,  left:'0',           width:`${W}px`,        height:`${H-sy-sh}px`  });
    Object.assign(_els.left.style,   { top:`${sy}px`,      left:'0',          width:`${sx}px`,        height:`${sh}px`       });
    Object.assign(_els.right.style,  { top:`${sy}px`,      left:`${sx+sw}px`, width:`${W-sx-sw}px`,   height:`${sh}px`       });

    // ゴールドリング
    Object.assign(_els.ring.style, {
      display: 'block',
      top:    `${sy}px`,
      left:   `${sx}px`,
      width:  `${sw}px`,
      height: `${sh}px`,
    });

    // スポットブロッカー
    Object.assign(_els.spotBlocker.style, {
      top:    `${sy}px`,
      left:   `${sx}px`,
      width:  `${sw}px`,
      height: `${sh}px`,
    });

    // ツールチップカードの位置
    const ch    = _els.card.offsetHeight || 160;
    let tTop, tLeft;

    if (step.placement === 'right') {
      tLeft = sx + sw + GAP;
      tTop  = sy + (sh - ch) / 2;
    } else if (step.placement === 'bottom') {
      tLeft = sx + sw / 2 - CARD_W / 2;
      tTop  = sy + sh + GAP;
    } else if (step.placement === 'top') {
      tLeft = sx + sw / 2 - CARD_W / 2;
      tTop  = sy - ch - GAP;
    } else { // left
      tLeft = sx - CARD_W - GAP;
      tTop  = sy + (sh - ch) / 2;
    }

    tLeft = Math.max(8, Math.min(tLeft, W - CARD_W - 8));
    tTop  = Math.max(8, Math.min(tTop,  H - ch    - 8));

    Object.assign(_els.card.style, {
      width:   `${CARD_W}px`,
      left:    `${tLeft}px`,
      top:     `${tTop}px`,
      opacity: '1',
    });
  }

  // ─────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────
  function _render() {
    if (!_els) return;
    _els.card.style.opacity = '0';
    _renderCard();
    requestAnimationFrame(() => requestAnimationFrame(_positionEls));
  }

  function _next() {
    if (_step < STEPS.length - 1) { _step++; _render(); }
  }

  function _prev() {
    if (_step > 0) { _step--; _render(); }
  }

  // ─────────────────────────────────────
  // 開始・終了
  // ─────────────────────────────────────
  function _show() {
    if (localStorage.getItem(DONE_KEY)) return;
    if (!BA.auth?.getUser?.()) return;

    _step = 0;
    _createEls();
    _render();

    _onResize = () => _positionEls();
    window.addEventListener('resize', _onResize);
  }

  function _done() {
    try { localStorage.setItem(DONE_KEY, '1'); } catch {}
    _cleanup();
  }

  function _cleanup() {
    if (_onResize) {
      window.removeEventListener('resize', _onResize);
      _onResize = null;
    }
    if (!_els) return;
    for (const el of Object.values(_els)) el?.remove();
    _els = null;
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  window.BA.tour = {
    init()  { _show(); },
    reset() { try { localStorage.removeItem(DONE_KEY); } catch {} },
  };

})();
