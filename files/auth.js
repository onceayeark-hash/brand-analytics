/**
 * BRAND ANALYTICS — auth.js
 * Supabase Auth + eBay OAuth 2.0 認証モジュール
 *
 * ・Supabase Auth でユーザー管理
 * ・eBay OAuth 2.0 でトークン取得（ユーザーが各自のアカウントで認証）
 * ・access_token + refresh_token を AES-GCM 256bit で暗号化して Supabase に保存
 * ・セッションキー: メモリのみ、タブ終了時に破棄
 * ・tier（free / connected / premium）を nav.js に通知
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 設定（環境変数から読み込む）
  // ─────────────────────────────────────

  // ⚠️ ハードコード禁止。Electron 環境では window.BA_CONFIG から注入する。
  // 開発時は index.html より前に <script> で BA_CONFIG をセットすること。
  function _getConfig() {
    const cfg = window.BA_CONFIG || {};
    return {
      supabaseUrl:  cfg.SUPABASE_URL  || '',
      supabaseKey:  cfg.SUPABASE_ANON_KEY || '',
      ebayClientId: cfg.EBAY_CLIENT_ID || '',
      ebayRedirectUri: cfg.EBAY_REDIRECT_URI || window.location.origin + '/callback',
      ebayScope: [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.finances',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.account',
      ].join(' '),
    };
  }

  // ─────────────────────────────────────
  // プライベート変数
  // ─────────────────────────────────────
  let _supabase   = null;   // Supabase クライアント
  let _user       = null;   // Supabase ユーザーオブジェクト
  let _tier       = 'free'; // 'free' | 'connected' | 'premium'
  let _ebayTokens = null;   // { accessToken, refreshToken, expiresAt }（復号済み）

  // ─────────────────────────────────────
  // Supabase クライアント初期化
  // ─────────────────────────────────────
  function _initSupabase() {
    const cfg = _getConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      console.warn('[auth] Supabase 設定未完了 — BA_CONFIG を設定してください');
      return null;
    }
    // Supabase JS SDK がロード済みの場合のみ初期化
    if (typeof window.supabase?.createClient === 'function') {
      return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    }
    console.warn('[auth] @supabase/supabase-js が読み込まれていません');
    return null;
  }

  // ─────────────────────────────────────
  // 内部ユーティリティ
  // ─────────────────────────────────────

  /** tier を更新して DOM・nav.js に通知する */
  function _setTier(tier) {
    _tier = tier;
    document.documentElement.setAttribute('data-tier', tier);
    BA.nav?.setTier?.(tier);

    // tier バッジ更新
    const badge = document.getElementById('tier-badge');
    if (badge) {
      badge.className = `tier-badge ${tier}`;
      badge.textContent = BA.i18n?.t(`tier.${tier}`) ?? tier.toUpperCase();
    }

    console.debug('[auth] tier:', tier);
  }

  /** eBay 接続ステータスUI を更新する */
  function _updateEbayStatusUI(status) {
    // status: 'connected' | 'disconnected' | 'expired' | 'error'
    const dot  = document.getElementById('ebay-status-dot');
    const text = document.getElementById('ebay-status-text');
    if (!dot || !text) return;

    dot.className = `status-dot ${status === 'connected' ? 'connected' : status === 'error' || status === 'expired' ? 'error' : ''}`;
    text.textContent = BA.i18n?.t(`status.${status}`) ?? status;
  }

  /** アラート発火（notify.js 経由） */
  function _fireAlert(type, detail = {}) {
    BA.notify?.alert?.(type, detail);
  }

  // ─────────────────────────────────────
  // eBay OAuth ヘルパー
  // ─────────────────────────────────────

  /** eBay の OAuth 認証 URL を生成する */
  function _buildEbayAuthUrl() {
    const cfg  = _getConfig();
    const state = _generateState();
    sessionStorage.setItem('ba_oauth_state', state);

    const params = new URLSearchParams({
      client_id:     cfg.ebayClientId,
      redirect_uri:  cfg.ebayRedirectUri,
      response_type: 'code',
      scope:         cfg.ebayScope,
      state,
    });

    return `https://auth.ebay.com/oauth2/authorize?${params}`;
  }

  /** CSRF 対策: ランダムな state 文字列を生成 */
  function _generateState() {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  /** eBay トークンを暗号化して Supabase に保存する */
  async function _saveEbayTokens(tokens) {
    if (!_supabase || !_user) throw new Error('[auth] Supabase 未接続');

    const encrypted = await BA.crypto.encrypt(JSON.stringify(tokens));

    const { error } = await _supabase
      .from('ebay_tokens')
      .upsert({
        user_id:    _user.id,
        token_data: encrypted,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw new Error(`[auth] トークン保存失敗: ${error.message}`);
    _ebayTokens = tokens;
    console.debug('[auth] eBay トークン保存完了');
  }

  /** Supabase から eBay トークンを取得・復号する */
  async function _loadEbayTokens() {
    if (!_supabase || !_user) return null;

    const { data, error } = await _supabase
      .from('ebay_tokens')
      .select('token_data')
      .eq('user_id', _user.id)
      .single();

    if (error || !data) return null;

    try {
      const decrypted = await BA.crypto.decrypt(data.token_data);
      return JSON.parse(decrypted);
    } catch {
      console.warn('[auth] トークン復号失敗 — 再認証が必要です');
      return null;
    }
  }

  /** アクセストークンが期限切れか確認し、必要であればリフレッシュする */
  async function _ensureValidToken() {
    if (!_ebayTokens) return null;

    const bufferMs = 5 * 60 * 1000; // 5分前にリフレッシュ
    if (_ebayTokens.expiresAt - Date.now() > bufferMs) {
      return _ebayTokens.accessToken;
    }

    // リフレッシュが必要
    console.debug('[auth] アクセストークン期限切れ — リフレッシュ中...');
    try {
      const cfg = _getConfig();
      const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // ⚠️ Client Secret は本番では Supabase Edge Function 経由で処理する
          // ここでは開発用として直接送信（Electron 環境での利用を想定）
        },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: _ebayTokens.refreshToken,
          scope:         cfg.ebayScope,
        }),
      });

      if (!response.ok) throw new Error(`リフレッシュ失敗: ${response.status}`);

      const data = await response.json();
      const newTokens = {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token || _ebayTokens.refreshToken,
        expiresAt:    Date.now() + data.expires_in * 1000,
      };

      await _saveEbayTokens(newTokens);
      return newTokens.accessToken;

    } catch (err) {
      console.error('[auth] トークンリフレッシュ失敗:', err);
      _fireAlert('OAUTH_EXPIRED');
      _updateEbayStatusUI('expired');
      _setTier('free');
      _ebayTokens = null;
      return null;
    }
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const auth = {

    /**
     * 初期化：Supabase セッション確認 → eBay トークン復元 → tier 設定
     */
    async init() {
      _supabase = _initSupabase();

      if (!_supabase) {
        // Supabase 未設定: 開発モードとして free tier で動作
        console.warn('[auth] Supabase 未設定 — FREE tier で動作します');
        _setTier('free');
        _updateEbayStatusUI('disconnected');
        return;
      }

      try {
        // Supabase セッション確認
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
          _setTier('free');
          _updateEbayStatusUI('disconnected');
          return;
        }

        _user = session.user;
        console.debug('[auth] Supabase セッション確認済み:', _user.id);

        // eBay トークン復元
        const tokens = await _loadEbayTokens();
        if (tokens) {
          _ebayTokens = tokens;

          // トークンの有効期限確認
          if (Date.now() > tokens.expiresAt) {
            const refreshed = await _ensureValidToken();
            if (!refreshed) return; // リフレッシュ失敗 → free tier
          }

          // user_settings から tier を確認
          const { data: settings } = await _supabase
            .from('user_settings')
            .select('access_tier')
            .eq('user_id', _user.id)
            .single();

          const tier = settings?.access_tier ?? 'connected';
          _setTier(tier);
          _updateEbayStatusUI('connected');

        } else {
          _setTier('free');
          _updateEbayStatusUI('disconnected');
        }

        // Supabase 認証状態変更リスナー
        _supabase.auth.onAuthStateChange((_event, session) => {
          _user = session?.user ?? null;
          if (!_user) {
            _setTier('free');
            _updateEbayStatusUI('disconnected');
            BA.cache?.clear?.();
          }
        });

      } catch (err) {
        console.error('[auth] 初期化エラー:', err);
        _fireAlert('SUPABASE_ERROR');
        _setTier('free');
        _updateEbayStatusUI('error');
      }
    },

    /**
     * eBay OAuth 認証を開始する
     * ユーザーを eBay 認証ページにリダイレクト（またはポップアップ）
     */
    connectEbay() {
      const url = _buildEbayAuthUrl();
      // Electron 環境ではポップアップ、ブラウザ環境ではリダイレクト
      window.location.href = url;
    },

    /**
     * OAuth コールバック処理（/callback ページから呼ぶ）
     * @param {string} code  - eBay から返された認証コード
     * @param {string} state - CSRF 検証用
     */
    async handleOAuthCallback(code, state) {
      // CSRF 検証
      const savedState = sessionStorage.getItem('ba_oauth_state');
      sessionStorage.removeItem('ba_oauth_state');

      if (state !== savedState) {
        throw new Error('[auth] OAuth state 不一致 — CSRF の可能性があります');
      }

      // ⚠️ 認証コードのトークン交換は Supabase Edge Function 経由で行う
      // （Client Secret をフロントエンドに置かないため）
      const response = await BA.api.request('/api/ebay/token', {
        method: 'POST',
        body: { code, redirectUri: _getConfig().ebayRedirectUri },
      });

      const tokens = {
        accessToken:  response.access_token,
        refreshToken: response.refresh_token,
        expiresAt:    Date.now() + response.expires_in * 1000,
      };

      await _saveEbayTokens(tokens);
      _setTier('connected');
      _updateEbayStatusUI('connected');
      BA.notify?.toast?.('eBay アカウントを連携しました', 'success');
    },

    /**
     * eBay 連携を解除する
     */
    async disconnectEbay() {
      if (!_supabase || !_user) return;

      await _supabase.from('ebay_tokens').delete().eq('user_id', _user.id);
      _ebayTokens = null;
      BA.crypto?.destroy?.();

      _setTier('free');
      _updateEbayStatusUI('disconnected');
      BA.cache?.clear?.();
      BA.notify?.toast?.('eBay 連携を解除しました', 'info');
    },

    /**
     * 有効なアクセストークンを取得する（期限切れなら自動リフレッシュ）
     * @returns {Promise<string|null>}
     */
    async getAccessToken() {
      return _ensureValidToken();
    },

    /**
     * 現在の tier を返す
     * @returns {'free'|'connected'|'premium'}
     */
    getTier() { return _tier; },

    /**
     * Supabase ユーザーを返す
     * @returns {Object|null}
     */
    getUser() { return _user; },

    /**
     * eBay に接続済みかどうか
     * @returns {boolean}
     */
    isEbayConnected() { return _ebayTokens !== null; },

    /**
     * ログアウト（Supabase + eBay セッション破棄）
     */
    async signOut() {
      await this.disconnectEbay();
      if (_supabase) await _supabase.auth.signOut();
      BA.crypto?.destroy?.();
      BA.cache?.clear?.();
      _user = null;
      _setTier('free');
      console.debug('[auth] サインアウト完了');
    },
  };

  window.BA.auth = auth;

  // ─────────────────────────────────────
  // eBay 連携ボタン クリックイベント
  // ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-ebay-oauth');
    if (btn) {
      btn.addEventListener('click', () => BA.auth.connectEbay());
    }
  });

})();
