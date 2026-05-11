/**
 * BRAND ANALYTICS — notify.js
 * アラート通知・トースト表示モジュール
 *
 * ・BA.notify.toast(msg, type)  — 画面下部にトースト表示（自動消滅）
 * ・BA.notify.alert(type, detail) — アラート11種を通知
 * ・サイドバーの alert-badge に件数を表示
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // アラート設定
  // ─────────────────────────────────────
  const ALERT_CONFIG = {
    DEFECT_WARNING:       { severity: 'warning', panel: 'health',     badge: 'health-alert-count' },
    LATESHIP_WARNING:     { severity: 'warning', panel: 'health',     badge: 'health-alert-count' },
    TRACKING_WARNING:     { severity: 'warning', panel: 'health',     badge: 'health-alert-count' },
    INAD_WARNING:         { severity: 'warning', panel: 'health',     badge: 'health-alert-count' },
    VIOLATION_UNRESOLVED: { severity: 'error',   panel: 'protection', badge: 'protection-alert-count' },
    CASE_OPENED:          { severity: 'error',   panel: 'protection', badge: 'protection-alert-count' },
    OAUTH_EXPIRED:        { severity: 'error',   panel: null,         badge: null },
    OAUTH_DISCONNECTED:   { severity: 'error',   panel: null,         badge: null },
    EBAY_API_DOWN:        { severity: 'warning', panel: null,         badge: null },
    DATA_STALE:           { severity: 'warning', panel: null,         badge: null },
    SUPABASE_ERROR:       { severity: 'error',   panel: null,         badge: null },
  };

  // ─────────────────────────────────────
  // プライベート変数
  // ─────────────────────────────────────
  let _toastContainer = null;
  const _badgeCounts = {}; // badgeId → number

  // ─────────────────────────────────────
  // 内部ユーティリティ
  // ─────────────────────────────────────

  /** badge の表示件数を更新する */
  function _updateBadge(badgeId, delta = 1) {
    if (!badgeId) return;
    _badgeCounts[badgeId] = (_badgeCounts[badgeId] ?? 0) + delta;
    const el = document.getElementById(badgeId);
    if (!el) return;
    const count = _badgeCounts[badgeId];
    el.textContent = count > 99 ? '99+' : String(count);
    el.style.display = count > 0 ? 'inline-block' : 'none';
  }

  /** トースト要素を生成して追加する */
  function _appendToast(message, type, durationMs) {
    if (!_toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    _toastContainer.appendChild(toast);

    // 自動消滅
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, durationMs);
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const notify = {

    /** 初期化 */
    init() {
      _toastContainer = document.getElementById('toast-container');
      console.debug('[notify] 初期化完了');
    },

    /**
     * トースト通知を表示する（自動消滅）
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} [type='info']
     * @param {number} [durationMs=3500]
     */
    toast(message, type = 'info', durationMs = 3500) {
      _appendToast(message, type, durationMs);
    },

    /**
     * アラート11種を発火する
     * @param {string} alertType - ALERT_CONFIG のキー
     * @param {Object} [detail={}] - 追加情報（メッセージに付与）
     */
    alert(alertType, detail = {}) {
      const config = ALERT_CONFIG[alertType];
      if (!config) {
        console.warn('[notify] 不明なアラートタイプ:', alertType);
        return;
      }

      // i18n からメッセージ取得
      const message = BA.i18n?.t(`alert.${alertType}`) ?? alertType;
      const fullMessage = detail.info ? `${message}（${detail.info}）` : message;

      // トーストで通知
      this.toast(fullMessage, config.severity === 'error' ? 'error' : 'warning', 5000);

      // サイドバーバッジ更新
      _updateBadge(config.badge);

      // カスタムイベント発火（protection.js 等が受信してリストに追加）
      document.dispatchEvent(new CustomEvent('ba:alert', {
        detail: { type: alertType, severity: config.severity, message: fullMessage, timestamp: Date.now(), ...detail }
      }));

      console.warn('[notify] アラート発火:', alertType, fullMessage);
    },

    /**
     * 指定バッジのカウントをリセットする（パネルを開いた時等）
     * @param {string} badgeId
     */
    clearBadge(badgeId) {
      _badgeCounts[badgeId] = 0;
      const el = document.getElementById(badgeId);
      if (el) el.style.display = 'none';
    },

    /** 全バッジをリセットする */
    clearAllBadges() {
      Object.keys(_badgeCounts).forEach(id => this.clearBadge(id));
    },
  };

  window.BA.notify = notify;

})();
