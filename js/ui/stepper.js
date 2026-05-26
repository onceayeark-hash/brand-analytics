/**
 * BRAND ANALYTICS — stepper.js
 * カスタム数値ステッパー（± ボタン）
 *
 * MutationObserver でDOMへの追加を監視し、
 * input[type=number] を自動的にカスタムステッパーに変換する。
 * 既存のJSファイルへの変更は不要。
 *
 * 変換前: <input type="number" ...>
 * 変換後:
 *   <div class="stepper-wrap">
 *     <button class="stepper-btn stepper-dec">−</button>
 *     <input type="number" ...>
 *     <button class="stepper-btn stepper-inc">+</button>
 *   </div>
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // ステッパーへの変換
  // ─────────────────────────────────────
  function _enhance(input) {
    if (input.dataset.stepperDone) return;
    input.dataset.stepperDone = '1';

    const step = parseFloat(input.step) || 1;
    const min  = input.min !== '' ? parseFloat(input.min)  : -Infinity;
    const max  = input.max !== '' ? parseFloat(input.max)  :  Infinity;

    const parent = input.parentElement;

    const wrap = document.createElement('div');
    wrap.className = 'stepper-wrap';

    const dec = document.createElement('button');
    dec.type        = 'button';
    dec.className   = 'stepper-btn stepper-dec';
    dec.textContent = '−';
    dec.setAttribute('aria-label', '減らす');
    dec.setAttribute('tabindex', '-1');

    const inc = document.createElement('button');
    inc.type        = 'button';
    inc.className   = 'stepper-btn stepper-inc';
    inc.textContent = '+';
    inc.setAttribute('aria-label', '増やす');
    inc.setAttribute('tabindex', '-1');

    parent.insertBefore(wrap, input);
    wrap.appendChild(dec);
    wrap.appendChild(input);
    wrap.appendChild(inc);

    function _clamp(v) {
      return Math.min(max, Math.max(min, v));
    }

    function _step(delta) {
      const current = parseFloat(input.value) || 0;
      const next    = _clamp(Math.round((current + delta * step) * 1e10) / 1e10);
      input.value   = next;
      input.dispatchEvent(new Event('input',  { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      _updateState();
    }

    // 長押し: 400ms 後に 80ms 間隔で連続増減
    let _pressTimer    = null;
    let _pressInterval = null;

    function _startPress(delta) {
      _step(delta);
      _pressTimer = setTimeout(() => {
        _pressInterval = setInterval(() => _step(delta), 80);
      }, 400);
    }

    function _endPress() {
      clearTimeout(_pressTimer);
      clearInterval(_pressInterval);
    }

    dec.addEventListener('mousedown',  () => _startPress(-1));
    inc.addEventListener('mousedown',  () => _startPress(1));
    dec.addEventListener('touchstart', e  => { e.preventDefault(); _startPress(-1); }, { passive: false });
    inc.addEventListener('touchstart', e  => { e.preventDefault(); _startPress(1);  }, { passive: false });

    ['mouseup', 'mouseleave'].forEach(ev => {
      dec.addEventListener(ev, _endPress);
      inc.addEventListener(ev, _endPress);
    });
    ['touchend', 'touchcancel'].forEach(ev => {
      dec.addEventListener(ev, _endPress);
      inc.addEventListener(ev, _endPress);
    });

    function _updateState() {
      const v       = parseFloat(input.value);
      dec.disabled  = !isNaN(v) && v <= min;
      inc.disabled  = !isNaN(v) && v >= max;
    }

    input.addEventListener('input', _updateState);
    _updateState();
  }

  // ─────────────────────────────────────
  // DOM監視
  // ─────────────────────────────────────
  function _scanAndEnhance(root) {
    root.querySelectorAll('input[type="number"]:not([data-stepper-done])').forEach(_enhance);
  }

  const _observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'INPUT' && node.type === 'number' && !node.dataset.stepperDone) {
          _enhance(node);
        } else {
          _scanAndEnhance(node);
        }
      }
    }
  });

  // ─────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────
  window.BA.stepper = {
    init() {
      _scanAndEnhance(document.body);
      _observer.observe(document.body, { childList: true, subtree: true });
    },
  };

})();
