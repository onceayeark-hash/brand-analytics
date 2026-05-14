/**
 * BRAND ANALYTICS — status-banner.js
 * セラー向けサービス状態バナー（全ユーザー表示・技術詳細なし）
 *
 * ・自動検知: monitor.js の checkAllServices() 結果を受け取る
 * ・4種別: service_down / ebay_down / token_expired / tool_error
 * ・復旧時は自動消去
 * ・管理者による手動上書き対応
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const BANNERS = {
    service_down: {
      message: '現在サービスに障害が発生しています。復旧作業中です。ご迷惑をおかけします。',
    },
    ebay_down: {
      message: 'eBayとの接続に問題があります。eBay側の障害の可能性があります。',
      linkText: 'eBayステータスを確認 →',
      linkUrl:  'https://developer.ebay.com/support',
    },
    token_expired: {
      message: 'eBay連携の再認証が必要です。',
      actionText:  '再連携する →',
      actionPanel: 'connect',
    },
    tool_error: {
      message: '一部機能に問題が発生しています。復旧まで今しばらくお待ちください。',
    },
  };

  // 手動上書き中は自動検知による変更をブロック
  let _active     = null;
  let _manualLock = false;

  function _el() { return document.getElementById('status-banner'); }

  function show(type, force) {
    if (_manualLock && !force) return;
    const def = BANNERS[type];
    if (!def) return;

    _active = type;

    let extra = '';
    if (def.linkText && def.linkUrl) {
      extra = `<a href="${def.linkUrl}" target="_blank" rel="noopener"
        style="color:var(--text-secondary);text-decoration:underline;margin-left:14px;font-size:inherit"
        >${def.linkText}</a>`;
    } else if (def.actionText) {
      extra = `<button
        onclick="BA.nav?.showPanel?.('${def.actionPanel}')"
        style="background:none;border:none;color:var(--text-secondary);text-decoration:underline;
               cursor:pointer;margin-left:14px;font-size:inherit;font-family:inherit;padding:0"
        >${def.actionText}</button>`;
    }

    const el = _el();
    if (!el) return;
    el.innerHTML =
      `<span style="width:5px;height:5px;border-radius:50%;background:var(--yellow);` +
      `display:inline-block;flex-shrink:0;margin-right:10px"></span>` +
      def.message + extra;
    el.style.display = 'flex';
    document.documentElement.style.setProperty('--banner-h', '38px');

    document.dispatchEvent(new CustomEvent('ba:banner-change', { detail: { type } }));
  }

  function hide(force) {
    if (_manualLock && !force) return;
    _active = null;
    const el = _el();
    if (el) el.style.display = 'none';
    document.documentElement.style.setProperty('--banner-h', '0px');

    document.dispatchEvent(new CustomEvent('ba:banner-change', { detail: { type: null } }));
  }

  // monitor.js のサービス結果を受け取り自動判定
  function updateFromServices(results) {
    if (_manualLock) return;

    const supabase = results.find(r => r.key === 'supabase');

    if (supabase?.status === 'down' || supabase?.status === 'degraded') {
      show('service_down');
      return;
    }

    // token_expired / tool_error は別トリガー管理（自動では消さない）
    if (_active === 'token_expired' || _active === 'tool_error') return;

    hide();
  }

  // 管理者が手動でバナーを設定／解除
  function setManual(type) {
    _manualLock = true;
    if (type) {
      show(type, true);
    } else {
      hide(true);
    }
  }

  function clearManual() {
    _manualLock = false;
    BA.monitor?.checkAllServices?.().then(updateFromServices).catch(() => {});
  }

  function getActive()    { return _active; }
  function isManualLock() { return _manualLock; }

  // eBay トークン期限切れイベントでバナー表示
  document.addEventListener('ba:ebay-token-expired', () => show('token_expired'));

  window.BA.statusBanner = {
    show,
    hide,
    updateFromServices,
    setManual,
    clearManual,
    getActive,
    isManualLock,
    BANNERS,
  };

})();
