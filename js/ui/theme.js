/**
 * BRAND ANALYTICS — theme.js
 * ダーク / ライト テーマ切り替え
 *
 * - デフォルト: dark
 * - 設定は localStorage 'ba_theme' に保存
 * - <html> に data-theme="light" を付け外しするだけ
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const KEY     = 'ba_theme';
  const DEFAULT = 'light';

  function _get() {
    try { return localStorage.getItem(KEY) || DEFAULT; } catch { return DEFAULT; }
  }

  function _apply(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem(KEY, theme); } catch {}
  }

  function toggle() {
    _apply(_get() === 'dark' ? 'light' : 'dark');
  }

  function init() {
    _apply(_get());
    document.getElementById('btn-theme-toggle')
      ?.addEventListener('click', toggle);
  }

  window.BA.theme = {
    init,
    toggle,
    getTheme: _get,
  };

})();
