/**
 * BRAND ANALYTICS — api.js
 * eBay API クライアント
 *
 * ・最大3回リトライ・指数バックオフ（1→2→4秒）
 * ・タイムアウト: 10秒（AbortController使用）
 * ・並列処理: Promise.allSettled() 統一（Promise.all() 禁止）
 * ・eBay API ベースURL・エンドポイントを管理
 * ・認証トークンは auth.js から取得
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 定数
  // ─────────────────────────────────────
  const RETRY_CONFIG = {
    maxAttempts: 3,
    backoffMs:   [1000, 2000, 4000], // 指数バックオフ
    timeoutMs:   10000,               // 10秒
  };

  // eBay API エンドポイント
  const EBAY_API = {
    BASE:                'https://api.ebay.com',
    SELL_ANALYTICS:      '/sell/analytics/v1',
    SELL_FINANCES:       '/sell/finances/v1',
    SELL_FULFILLMENT:    '/sell/fulfillment/v1',
    SELL_ACCOUNT:        '/sell/account/v1',
    DEVELOPER_ANALYTICS: '/developer/analytics/v1',
  };

  // ─────────────────────────────────────
  // 内部ユーティリティ
  // ─────────────────────────────────────

  /** 指定ミリ秒待機する（バックオフ用） */
  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** eBay API エラーレスポンスを正規化する */
  function _normalizeError(status, body) {
    // eBay API エラー標準フォーマット
    const msg = body?.errors?.[0]?.message
             || body?.error_description
             || body?.message
             || `HTTP ${status}`;
    return new Error(`[api] eBay API Error (${status}): ${msg}`);
  }

  /** リトライすべきステータスコードか判定 */
  function _isRetryable(status) {
    return status === 429  // Rate limit
        || status === 500  // Internal server error
        || status === 502  // Bad gateway
        || status === 503  // Service unavailable
        || status === 504; // Gateway timeout
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const api = {

    /**
     * 汎用 HTTP リクエスト（リトライ・タイムアウト付き）
     *
     * @param {string} url     - 完全なURL
     * @param {Object} options - fetch options + retry/timeout 設定
     * @param {string} [options.method='GET']
     * @param {Object} [options.headers={}]
     * @param {*}      [options.body]          - JSON は自動シリアライズ
     * @param {boolean}[options.skipRetry=false]
     * @returns {Promise<*>} - レスポンス JSON
     */
    async request(url, options = {}) {
      const {
        method = 'GET',
        headers = {},
        body,
        skipRetry = false,
      } = options;

      const maxAttempts = skipRetry ? 1 : RETRY_CONFIG.maxAttempts;

      let lastError;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // AbortController でタイムアウト制御
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeoutMs);

        try {
          const fetchOptions = {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            signal: controller.signal,
          };

          if (body !== undefined) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
          }

          const response = await fetch(url, fetchOptions);
          clearTimeout(timeoutId);

          // レスポンス本文をパース
          let data;
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }

          // HTTP エラー処理
          if (!response.ok) {
            // リトライ可能なエラーの場合
            if (_isRetryable(response.status) && attempt < maxAttempts) {
              const delay = RETRY_CONFIG.backoffMs[attempt - 1] ?? 4000;
              console.warn(`[api] リトライ ${attempt}/${maxAttempts} (${response.status}) → ${delay}ms 後`);
              lastError = _normalizeError(response.status, data);
              await _sleep(delay);
              continue;
            }
            throw _normalizeError(response.status, data);
          }

          return data;

        } catch (err) {
          clearTimeout(timeoutId);

          // タイムアウトの場合
          if (err.name === 'AbortError') {
            lastError = new Error(`[api] タイムアウト (${RETRY_CONFIG.timeoutMs}ms): ${url}`);
            if (attempt < maxAttempts) {
              const delay = RETRY_CONFIG.backoffMs[attempt - 1] ?? 4000;
              console.warn(`[api] タイムアウト リトライ ${attempt}/${maxAttempts} → ${delay}ms 後`);
              await _sleep(delay);
              continue;
            }
            throw lastError;
          }

          // ネットワークエラー（リトライ対象）
          if (err.message?.includes('[api]')) throw err; // 既に正規化済み
          lastError = new Error(`[api] ネットワークエラー: ${err.message}`);

          if (attempt < maxAttempts) {
            const delay = RETRY_CONFIG.backoffMs[attempt - 1] ?? 4000;
            console.warn(`[api] ネットワークエラー リトライ ${attempt}/${maxAttempts} → ${delay}ms 後`);
            await _sleep(delay);
            continue;
          }

          throw lastError;
        }
      }

      throw lastError;
    },

    /**
     * eBay API GET リクエスト（認証トークン自動付与）
     *
     * @param {string} endpoint - '/sell/analytics/v1/seller_standards_profile' 等
     * @param {Object} [params] - クエリパラメータ
     * @returns {Promise<*>}
     */
    async get(endpoint, params = {}) {
      const token = await BA.auth?.getAccessToken?.();
      if (!token) throw new Error('[api] アクセストークンが取得できません。eBay 認証が必要です。');

      const url = new URL(EBAY_API.BASE + endpoint);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

      return this.request(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    },

    /**
     * eBay API POST リクエスト（認証トークン自動付与）
     *
     * @param {string} endpoint
     * @param {Object} body
     * @returns {Promise<*>}
     */
    async post(endpoint, body = {}) {
      const token = await BA.auth?.getAccessToken?.();
      if (!token) throw new Error('[api] アクセストークンが取得できません。eBay 認証が必要です。');

      return this.request(EBAY_API.BASE + endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body,
      });
    },

    // ─────────────────────────────────────
    // eBay 個別 API ラッパー
    // ─────────────────────────────────────

    /**
     * 健全性スコア用: セラーパフォーマンス指標を取得
     * GET /sell/analytics/v1/seller_standards_profile
     */
    async getSellerStandardsProfile() {
      const cacheKey = 'health_standards';
      const cached = BA.cache?.get(cacheKey);
      if (cached && !cached.isStale) return cached.value;

      const data = await this.get(`${EBAY_API.SELL_ANALYTICS}/seller_standards_profile`);
      BA.cache?.set(cacheKey, data);
      return data;
    },

    /**
     * ファイナンス用: 取引サマリーを取得
     * GET /sell/finances/v1/transaction?transactionType=SALE
     */
    async getTransactions(params = {}) {
      const cacheKey = `finance_transactions_${JSON.stringify(params)}`;
      const cached = BA.cache?.get(cacheKey);
      if (cached && !cached.isStale) return cached.value;

      const data = await this.get(`${EBAY_API.SELL_FINANCES}/transaction`, {
        transactionType: 'SALE',
        ...params,
      });
      BA.cache?.set(cacheKey, data);
      return data;
    },

    /**
     * アカウント保護用: ケース一覧を取得
     * GET /sell/fulfillment/v1/payment_dispute
     */
    async getPaymentDisputes(params = {}) {
      const cacheKey = `protection_disputes_${JSON.stringify(params)}`;
      const cached = BA.cache?.get(cacheKey);
      if (cached && !cached.isStale) return cached.value;

      const data = await this.get(`${EBAY_API.SELL_FULFILLMENT}/payment_dispute`, params);
      BA.cache?.set(cacheKey, data);
      return data;
    },

    /**
     * 複数 API を並列取得する（Promise.allSettled 統一）
     * 一部が失敗してもキャッシュ値を返す
     *
     * @param {Array<{key: string, fn: Function}>} tasks
     * @returns {Promise<Object>} - { key: { value, error, isStale } }
     */
    async fetchAll(tasks) {
      const results = await Promise.allSettled(tasks.map(t => t.fn()));

      const output = {};
      tasks.forEach((task, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          output[task.key] = { value: result.value, error: null, isStale: false };
        } else {
          // 失敗時: キャッシュのフォールバックを試みる
          const cached = BA.cache?.get(task.key);
          if (cached) {
            console.warn(`[api] fetchAll: ${task.key} 取得失敗 → キャッシュ使用:`, result.reason);
            output[task.key] = { value: cached.value, error: result.reason, isStale: true };
          } else {
            output[task.key] = { value: null, error: result.reason, isStale: false };
          }
        }
      });

      return output;
    },

    // ─────────────────────────────────────
    // 為替レート取得（外部 API）
    // ─────────────────────────────────────

    /**
     * USD/JPY 為替レートを取得する
     * キャッシュ TTL: 1時間
     * @returns {Promise<number>} - 1 USD = X JPY
     */
    async getExchangeRate() {
      const cacheKey = 'exchange_rate_usdjpy';
      const cached = BA.cache?.get(cacheKey);
      if (cached && !cached.isStale) return cached.value;

      try {
        const cfg = window.BA_CONFIG || {};
        const supabaseUrl = cfg.SUPABASE_URL || '';
        const edgeBase = cfg.SUPABASE_EDGE_FUNCTION_URL
                      || (supabaseUrl ? `${supabaseUrl}/functions/v1` : '');
        if (!edgeBase) throw new Error('Supabase URL 未設定');

        // Edge Function 経由でサーバーサイド取得（CORS 回避）
        const data = await this.request(
          `${edgeBase}/exchange-rate`,
          { skipRetry: false }
        );
        const rate = data?.rate;
        if (!rate || typeof rate !== 'number') throw new Error('JPY レートが取得できません');
        BA.cache?.set(cacheKey, rate);
        return rate;
      } catch (err) {
        console.warn('[api] 為替レート取得失敗 → 固定値 150 を使用:', err.message);
        return 150; // フォールバック固定値
      }
    },
  };

  window.BA.api = api;

})();
