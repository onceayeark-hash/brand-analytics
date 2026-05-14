/**
 * BRAND ANALYTICS — monitor.js
 * 作成者向け監視モジュール
 *
 * ・グローバルJSエラーを自動キャッチ
 * ・外部サービス（Supabase / Google / eBay API）の死活確認
 * ・エラーを Supabase error_logs テーブルに保存
 * ・同一エラーが閾値（5件/1時間）を超えたら Edge Function 経由でメール通知
 *
 * 新しい外部サービスを追加するときは SERVICES 配列に追記すること
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─── 設定 ───────────────────────────────────
  const ALERT_THRESHOLD  = 5;
  const ALERT_WINDOW_MS  = 60 * 60 * 1000; // 1時間

  // 外部サービス一覧（新サービス追加時はここに追記）
  const SERVICES = [
    {
      key:       'supabase',
      label:     'Supabase',
      statusUrl: 'https://status.supabase.com',
      checkUrl:  () => `${window.BA_CONFIG?.SUPABASE_URL || ''}/auth/v1/health`,
    },
    {
      key:       'ebay_api',
      label:     'eBay API',
      statusUrl: 'https://developer.ebay.com/support',
      skipCheck: true, // 認証なしでは叩けないためステータスページ確認のみ
    },
    {
      key:       'google_auth',
      label:     'Google OAuth',
      statusUrl: 'https://status.cloud.google.com',
      skipCheck: true,
    },
  ];

  // ─── プライベート変数 ─────────────────────────
  const _errorCounts = {}; // { errorCode: [timestamp, ...] }
  let   _supabase    = null;

  function _getSupabase() {
    if (_supabase) return _supabase;
    _supabase = window._supabaseClient || null;
    return _supabase;
  }

  // ─── Supabase への保存 ────────────────────────

  async function _saveLog(entry) {
    try {
      const sb = _getSupabase();
      if (!sb) return;
      await sb.from('error_logs').insert({
        service:    (entry.service    || 'frontend').slice(0, 50),
        error_code: (entry.errorCode  || 'UNKNOWN').slice(0, 50),
        message:    (entry.message    || '').slice(0, 500),
        stack:      (entry.stack      || '').slice(0, 1000),
        url:        window.location.href.slice(0, 200),
        user_agent: navigator.userAgent.slice(0, 200),
      });
    } catch {
      // ログ保存失敗は無視（無限ループ防止）
    }
  }

  // ─── 閾値チェック → メール通知 ──────────────────

  function _pruneOld(errorCode) {
    const now = Date.now();
    _errorCounts[errorCode] = (_errorCounts[errorCode] || [])
      .filter(t => now - t < ALERT_WINDOW_MS);
  }

  async function _checkThreshold(errorCode) {
    _pruneOld(errorCode);
    _errorCounts[errorCode].push(Date.now());
    if (_errorCounts[errorCode].length === ALERT_THRESHOLD) {
      await _sendAdminAlert(errorCode, _errorCounts[errorCode].length);
    }
  }

  async function _sendAdminAlert(errorCode, count) {
    try {
      const cfg  = window.BA_CONFIG || {};
      const base = cfg.SUPABASE_EDGE_FUNCTION_URL
                || (cfg.SUPABASE_URL ? `${cfg.SUPABASE_URL}/functions/v1` : '');
      if (!base) return;

      await fetch(`${base}/notify-admin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorCode,
          count,
          url:  window.location.href,
          time: new Date().toISOString(),
        }),
      });
    } catch {
      // 通知失敗は無視
    }
  }

  // ─── 公開ログ関数 ──────────────────────────────

  function _log(errorCode, message, extra = {}) {
    _saveLog({ errorCode, message, ...extra });
    _checkThreshold(errorCode);
  }

  // ─── グローバルJSエラーキャッチ ──────────────────

  window.addEventListener('error', (e) => {
    _log('JS_UNHANDLED', e.message || 'Unknown JS error', {
      service: 'frontend',
      stack:   e.error?.stack || '',
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason) || 'Unhandled Promise rejection';
    _log('JS_UNHANDLED_PROMISE', msg, {
      service: 'frontend',
      stack:   e.reason?.stack || '',
    });
  });

  // ─── サービス死活確認 ─────────────────────────

  async function _checkService(svc) {
    if (svc.skipCheck) {
      return { key: svc.key, label: svc.label, status: 'unknown', statusUrl: svc.statusUrl };
    }
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res   = await fetch(svc.checkUrl(), { signal: ctrl.signal });
      clearTimeout(timer);
      return { key: svc.key, label: svc.label, status: res.ok ? 'ok' : 'degraded', statusUrl: svc.statusUrl };
    } catch {
      return { key: svc.key, label: svc.label, status: 'down', statusUrl: svc.statusUrl };
    }
  }

  async function checkAllServices() {
    const results = await Promise.allSettled(SERVICES.map(_checkService));
    const resolved = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'unknown' });

    // セラー向けバナーに結果を渡す
    BA.statusBanner?.updateFromServices?.(resolved);

    return resolved;
  }

  // ─── 定期チェック（5分ごと）────────────────────

  let _periodicTimer = null;

  function _startPeriodicCheck() {
    if (_periodicTimer) return; // 二重起動防止
    // 初回は30秒後（起動直後の帯域を避ける）
    _periodicTimer = setTimeout(function _tick() {
      checkAllServices();
      _periodicTimer = setTimeout(_tick, 5 * 60 * 1000);
    }, 30 * 1000);
  }

  // ─── 公開API ──────────────────────────────────

  window.BA.monitor = {

    // エラーを手動記録（各モジュールから呼ぶ）
    log: _log,

    // 全サービスの死活チェック（+ バナー自動更新）
    checkAllServices,

    // 新サービス追加（新コンテンツ導入時に呼ぶ）
    addService(svcConfig) {
      SERVICES.push(svcConfig);
    },

    // Supabaseクライアントを注入（auth.js 初期化後に呼ぶ）
    setSupabase(sb) {
      _supabase = sb;
    },

    // 定期チェック開始（app 初期化完了後に呼ぶ）
    startPeriodicCheck: _startPeriodicCheck,
  };

  // DOMContentLoaded 後に定期チェックを自動開始
  document.addEventListener('DOMContentLoaded', _startPeriodicCheck);

})();
