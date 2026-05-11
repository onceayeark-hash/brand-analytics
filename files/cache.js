/**
 * BRAND ANALYTICS — cache.js
 * Supabase キャッシュ読み書き・鮮度管理モジュール
 *
 * ・インメモリキャッシュ（ページ内のみ）とsessionStorageを2層で使用
 * ・鮮度切れ判定: TTL を超えたキャッシュは stale と見なす
 * ・stale 時は古いデータを表示しつつ #stale-warning を表示する
 * ・Supabase からの取得ロジックは api.js 側で行い、結果をここに set する
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // TTL 設定（秒）
  // ─────────────────────────────────────
  const TTL = {
    health:     300,   //  5分: 健全性スコア
    finance:    600,   // 10分: ファイナンスデータ
    alerts:     120,   //  2分: アラート
    protection: 300,   //  5分: アカウント保護
    dashboard:  300,   //  5分: ダッシュボード概況
    exchange:   3600,  //  1時間: 為替レート
    default:    300,   //  5分: その他
  };

  // ─────────────────────────────────────
  // プライベート変数
  // ─────────────────────────────────────
  const _mem = new Map(); // インメモリキャッシュ: key → { value, timestamp }
  const STORAGE_PREFIX = 'ba_cache_';

  // ─────────────────────────────────────
  // 内部ユーティリティ
  // ─────────────────────────────────────

  function _getTTL(key) {
    // キー名にTTLカテゴリが含まれるか確認
    for (const [cat, ttl] of Object.entries(TTL)) {
      if (key.includes(cat)) return ttl;
    }
    return TTL.default;
  }

  function _isExpired(timestamp, ttlSec) {
    return (Date.now() - timestamp) > ttlSec * 1000;
  }

  /** sessionStorage への保存（失敗しても続行） */
  function _saveToSession(key, entry) {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // sessionStorage が full の場合はメモリのみで続行
    }
  }

  /** sessionStorage からの読み込み */
  function _loadFromSession(key) {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** stale-warning UI の表示・非表示 */
  function _updateStaleWarningUI(staleHours) {
    const el = document.getElementById('stale-warning');
    if (!el) return;
    if (staleHours !== null) {
      document.getElementById('stale-hours').textContent = staleHours.toFixed(1);
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  }

  // stale データが存在するかを管理するセット
  const _staleKeys = new Set();

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const cache = {

    /** 初期化：sessionStorage から既存キャッシュをメモリに復元 */
    init() {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const storageKey = sessionStorage.key(i);
          if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
          const key = storageKey.slice(STORAGE_PREFIX.length);
          const entry = _loadFromSession(key);
          if (entry) _mem.set(key, entry);
        }
        console.debug('[cache] 復元完了:', _mem.size, '件');
      } catch {
        console.debug('[cache] sessionStorage 復元スキップ');
      }
    },

    /**
     * キャッシュにデータをセットする
     * @param {string} key    - キャッシュキー
     * @param {*}      value  - 保存するデータ（JSON シリアライズ可能なもの）
     */
    set(key, value) {
      const entry = { value, timestamp: Date.now() };
      _mem.set(key, entry);
      _saveToSession(key, entry);

      // stale リストから除去（新鮮なデータが来たので）
      _staleKeys.delete(key);
      if (_staleKeys.size === 0) _updateStaleWarningUI(null);

      console.debug('[cache] set:', key);
    },

    /**
     * キャッシュからデータを取得する
     * @param {string} key
     * @returns {{ value: *, isStale: boolean } | null}
     *          - null: キャッシュなし
     *          - isStale: true の場合は古いデータ
     */
    get(key) {
      let entry = _mem.get(key);

      // メモリになければ sessionStorage から復元を試みる
      if (!entry) {
        entry = _loadFromSession(key);
        if (entry) _mem.set(key, entry);
      }

      if (!entry) return null;

      const ttl = _getTTL(key);
      const isStale = _isExpired(entry.timestamp, ttl);

      if (isStale) {
        // stale 時: #stale-warning を表示
        const staleHours = (Date.now() - entry.timestamp) / 3600000;
        _staleKeys.add(key);
        _updateStaleWarningUI(staleHours);
      }

      return { value: entry.value, isStale };
    },

    /**
     * キャッシュが存在し、かつ有効期限内かどうか
     * @param {string} key
     * @returns {boolean}
     */
    isValid(key) {
      const result = this.get(key);
      return result !== null && !result.isStale;
    },

    /**
     * キャッシュが stale（期限切れだが値は存在）かどうか
     * @param {string} key
     * @returns {boolean}
     */
    isStale(key) {
      const result = this.get(key);
      return result !== null && result.isStale;
    },

    /**
     * 特定キーのキャッシュを削除する
     * @param {string} key
     */
    invalidate(key) {
      _mem.delete(key);
      try { sessionStorage.removeItem(STORAGE_PREFIX + key); } catch { /* noop */ }
      _staleKeys.delete(key);
      if (_staleKeys.size === 0) _updateStaleWarningUI(null);
      console.debug('[cache] invalidate:', key);
    },

    /**
     * 全キャッシュをクリアする（ログアウト時等）
     */
    clear() {
      _mem.clear();
      _staleKeys.clear();
      try {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
        }
        keys.forEach(k => sessionStorage.removeItem(k));
      } catch { /* noop */ }
      _updateStaleWarningUI(null);
      console.debug('[cache] 全クリア完了');
    },

    /**
     * キャッシュのタイムスタンプを返す（デバッグ用）
     * @param {string} key
     * @returns {Date|null}
     */
    getTimestamp(key) {
      const entry = _mem.get(key) || _loadFromSession(key);
      return entry ? new Date(entry.timestamp) : null;
    },

    /**
     * キャッシュの残り有効時間（秒）を返す
     * @param {string} key
     * @returns {number} - 負の値の場合は期限切れ
     */
    getRemainingTTL(key) {
      const entry = _mem.get(key) || _loadFromSession(key);
      if (!entry) return -1;
      const ttl = _getTTL(key);
      return ttl - (Date.now() - entry.timestamp) / 1000;
    },
  };

  window.BA.cache = cache;

})();
