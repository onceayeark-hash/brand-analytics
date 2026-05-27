/**
 * BRAND ANALYTICS — claude.js
 * Claude API 統合基盤（Supabase Edge Function プロキシ経由）
 *
 * ・Anthropic API への直接呼び出しはしない
 * ・call-claude Edge Function を Supabase JWT 認証で呼び出す
 * ・B層（ebay_rules 取得）・C層（web_search）は Edge Function 側で処理
 * ・月間使用量を localStorage で管理（tier 別上限）
 * ・リトライ: 最大2回・指数バックオフ（コスト高のため控えめ）
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 定数
  // ─────────────────────────────────────
  const USAGE_KEY_PREFIX = 'ba_claude_usage_';

  const MONTHLY_LIMITS = {
    free:      0,
    connected: 50,
    premium:   Infinity,
  };

  const RETRY_CONFIG = {
    maxAttempts: 2,
    backoffMs:   [2000, 4000],
    timeoutMs:   30000,   // 30秒（web_search を含む応答時間を考慮）
  };

  // ─────────────────────────────────────
  // 月間使用量管理
  // ─────────────────────────────────────

  function _usageKey() {
    const now = new Date();
    return `${USAGE_KEY_PREFIX}${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function _getUsageCount() {
    try {
      const raw = localStorage.getItem(_usageKey());
      return raw ? (parseInt(raw, 10) || 0) : 0;
    } catch {
      return 0;
    }
  }

  function _incrementUsage() {
    try {
      localStorage.setItem(_usageKey(), String(_getUsageCount() + 1));
    } catch { /* noop */ }
  }

  function _getLimit() {
    const tier = BA.auth?.getTier?.() ?? 'free';
    return MONTHLY_LIMITS[tier] ?? 0;
  }

  // ─────────────────────────────────────
  // Edge Function 呼び出し準備
  // ─────────────────────────────────────

  function _getEdgeFunctionBase() {
    const cfg = window.BA_CONFIG || {};
    const supabaseUrl = cfg.SUPABASE_URL || '';
    return cfg.SUPABASE_EDGE_FUNCTION_URL
        || (supabaseUrl ? `${supabaseUrl}/functions/v1` : '');
  }

  async function _getJwt() {
    const supabase = BA.auth?.getSupabase?.();
    if (!supabase) throw new Error('[claude] Supabase 未接続');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('[claude] セッション切れ');
    return session.access_token;
  }

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────
  // コア呼び出し（リトライ付き）
  // ─────────────────────────────────────

  async function _callWithRetry(payload) {
    const base = _getEdgeFunctionBase();
    if (!base) {
      throw new Error('[claude] Edge Function URL が未設定です（config.local.js を確認してください）');
    }

    const jwt = await _getJwt();
    const url = `${base}/call-claude`;
    let lastError;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), RETRY_CONFIG.timeoutMs);

      try {
        const res = await fetch(url, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          body:   JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error(`[claude] レスポンスパースエラー (HTTP ${res.status})`);
        }

        if (!res.ok) {
          const isRetryable = res.status === 429 || res.status >= 500;
          if (isRetryable && attempt < RETRY_CONFIG.maxAttempts) {
            const delay = RETRY_CONFIG.backoffMs[attempt - 1] ?? 4000;
            console.warn(`[claude] リトライ ${attempt}/${RETRY_CONFIG.maxAttempts} (${res.status})`);
            lastError = new Error(data?.error || `HTTP ${res.status}`);
            await _sleep(delay);
            continue;
          }
          throw new Error(data?.error || `[claude] HTTP ${res.status}`);
        }

        return data; // { text: string, sources: string[] }

      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('[claude] タイムアウト（30秒）—しばらく時間をおいて再試行してください');
        }
        if (attempt < RETRY_CONFIG.maxAttempts) {
          lastError = err;
          await _sleep(RETRY_CONFIG.backoffMs[attempt - 1] ?? 4000);
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error('[claude] 不明なエラーが発生しました');
  }

  // ─────────────────────────────────────
  // 使用量UI更新
  // ─────────────────────────────────────
  function _updateUsageUI() {
    const el = document.getElementById('claude-usage-display');
    if (!el) return;
    const { count, limit } = BA.claude.getUsage();
    el.textContent = `AI: ${count} / ${limit === Infinity ? '∞' : limit} 回`;
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const claude = {

    init() {
      _updateUsageUI();
    },

    /**
     * Claude API を呼び出す
     *
     * @param {string} feature     - 機能識別子
     *   'health'   - アカウント健全性予測
     *   'offer'    - ベストオファー判定
     *   'title'    - Cassini最適タイトル生成
     *   'reply'    - バイヤー返信文案生成
     *   'sourcing' - 仕入れリスクスコア
     * @param {string} userContent - Claudeに送るメッセージ
     * @param {Object} [options]
     * @param {Object} [options.context] - 追加コンテキスト（指標値・商品情報等）JSON形式
     * @returns {Promise<{ text: string, sources: string[] }>}
     */
    async call(feature, userContent, options = {}) {
      if (!this.canCall()) {
        const usage = this.getUsage();
        const msg = usage.limit === 0
          ? 'AI機能はeBay連携後に利用できます（設定 → eBay接続管理）'
          : `今月のAI利用上限（${usage.limit}回）に達しました`;
        throw new Error(msg);
      }

      const payload = {
        feature,
        userContent,
        context: options.context ?? {},
      };

      const result = await _callWithRetry(payload);
      _incrementUsage();
      _updateUsageUI();
      return result;
    },

    /**
     * 今月の使用量を返す
     * @returns {{ count: number, limit: number, month: string }}
     */
    getUsage() {
      const key   = _usageKey();
      const month = key.replace(USAGE_KEY_PREFIX, '').replace('_', '-');
      return {
        count: _getUsageCount(),
        limit: _getLimit(),
        month,
      };
    },

    /**
     * 今月まだ呼び出し可能かどうか
     * @returns {boolean}
     */
    canCall() {
      const { count, limit } = this.getUsage();
      return count < limit;
    },
  };

  window.BA.claude = claude;

})();
