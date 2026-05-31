/**
 * BRAND ANALYTICS — sound.js
 * Web Audio API による効果音モジュール（外部ファイル不要）
 *
 * - Web Audio APIでサイン波を合成（mp3・OGG不使用）
 * - ba_settings.sound_enabled が false のときは無音
 * - ba:ebay-connected イベントで成功チャイムを自動発火
 * - BA.sound.playSuccess() で任意のタイミングに発火可能
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  let _ctx = null;

  function _getCtx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    }
    // ブラウザのautoplay制限でsuspendedになった場合はresume
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  }

  function _isEnabled() {
    try {
      const raw = localStorage.getItem('ba_settings');
      if (!raw) return true;
      const data = JSON.parse(raw);
      return data.sound_enabled !== false;
    } catch {
      return true;
    }
  }

  // 成功チャイム: A5(880Hz) → C6(1047Hz) の上昇2音
  // 短く・明るく・うるさくない（最大音量0.18）
  function _playSuccess() {
    if (!_isEnabled()) return;
    const ctx = _getCtx();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      [
        { freq: 880,  start: 0,    dur: 0.12 },
        { freq: 1047, start: 0.14, dur: 0.22 },
      ].forEach(({ freq, start, dur }) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + start);
        gain.gain.setValueAtTime(0,    t + start);
        gain.gain.linearRampToValueAtTime(0.18, t + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t  + start + dur + 0.05);
      });
    } catch (err) {
      console.debug('[sound] 再生失敗:', err);
    }
  }

  window.BA.sound = {
    init() {
      document.addEventListener('ba:ebay-connected', () => _playSuccess());
    },
    playSuccess() { _playSuccess(); },
  };

})();
