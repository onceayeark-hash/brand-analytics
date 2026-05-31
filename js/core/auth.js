/**
 * BRAND ANALYTICS — auth.js
 * Supabase Auth + eBay OAuth 2.0 認証モジュール
 *
 * ・Supabase Auth でユーザー管理（email/password）
 * ・eBay OAuth 2.0 でトークン取得（Supabase Edge Function 経由）
 * ・access_token + refresh_token を AES-GCM 256bit で暗号化して Supabase に保存
 * ・セッションキー: メモリのみ、タブ終了時に破棄
 * ・tier（free / connected / premium）を nav.js に通知
 * ・Client Secret (EBAY_CERT_ID) はフロントエンドに置かず Edge Function のみで使用
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  function _getConfig() {
    const cfg = window.BA_CONFIG || {};
    const supabaseUrl = cfg.SUPABASE_URL || '';
    return {
      supabaseUrl,
      supabaseKey:     cfg.SUPABASE_ANON_KEY || '',
      ebayClientId:    cfg.EBAY_CLIENT_ID || 'StayGold-BRANDANA-PRD-7183f64d5-3fad581c',
      // #1 修正: フォールバックRuNameを有効なvplsttzsに変更（kdbpfuxは廃棄済み）
      ebayRedirectUri: cfg.EBAY_REDIRECT_URI || 'StayGold_-StayGold-BRANDA-vplsttzs',
      ebayScope: [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.finances',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.account',
      ].join(' '),
      edgeFunctionBase: cfg.SUPABASE_EDGE_FUNCTION_URL
                     || (supabaseUrl ? `${supabaseUrl}/functions/v1` : ''),
    };
  }

  let _supabase   = null;
  let _user       = null;
  let _tier       = 'free';
  let _ebayTokens = null;

  function _initSupabase() {
    const cfg = _getConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      console.warn('[auth] Supabase 設定未完了 — config.local.js を確認してください');
      return null;
    }
    if (typeof window.supabase?.createClient !== 'function') {
      console.warn('[auth] @supabase/supabase-js が読み込まれていません');
      return null;
    }
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  }

  function _setTier(tier) {
    _tier = tier;
    document.documentElement.setAttribute('data-tier', tier);
    BA.nav?.setTier?.(tier);
    const badge = document.getElementById('tier-badge');
    if (badge) {
      badge.className = `tier-badge ${tier}`;
      badge.textContent = BA.i18n?.t(`tier.${tier}`) ?? tier.toUpperCase();
    }
  }

  function _updateEbayStatusUI(status) {
    const dot  = document.getElementById('ebay-status-dot');
    const text = document.getElementById('ebay-status-text');
    if (!dot || !text) return;
    const isConnected = status === 'connected';
    const isError     = status === 'error' || status === 'expired';
    dot.className = `status-dot${isConnected ? ' connected' : isError ? ' error' : ''}`;
    text.textContent = BA.i18n?.t(`status.${status}`) ?? status;
  }

  function _fireAlert(type, detail = {}) {
    BA.notify?.alert?.(type, detail);
  }

  function _showAuthOverlay(view = 'signin') {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    overlay.removeAttribute('hidden');
    document.getElementById('auth-view-signin')?.toggleAttribute('hidden', view !== 'signin');
    document.getElementById('auth-view-signup')?.toggleAttribute('hidden', view !== 'signup');
    document.getElementById('auth-view-reset')?.toggleAttribute('hidden',  view !== 'reset');
    document.getElementById('auth-view-new-password')?.toggleAttribute('hidden', view !== 'new-password');
    const firstInput = overlay.querySelector(':not([hidden]) .auth-input');
    setTimeout(() => firstInput?.focus(), 100);
  }

  function _hideAuthOverlay() {
    document.getElementById('auth-overlay')?.setAttribute('hidden', '');
    document.dispatchEvent(new CustomEvent('ba:auth-state-change'));
  }

  function _setAuthMessage(id, msg, show = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.toggleAttribute('hidden', !show);
  }

  function _setBtnLoading(id, loading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  function _buildEbayAuthUrl() {
    const cfg   = _getConfig();
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

  function _generateState() {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function _saveEbayTokens(tokens) {
    if (!_supabase || !_user) throw new Error('[auth] Supabase 未接続');
    const encrypted = await BA.crypto.encrypt(JSON.stringify(tokens));
    const { error } = await _supabase
      .from('ebay_tokens')
      .upsert(
        { user_id: _user.id, token_data: encrypted, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) throw new Error(`[auth] トークン保存失敗: ${error.message}`);
    _ebayTokens = tokens;
  }

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

  async function _ensureValidToken() {
    if (!_ebayTokens) return null;
    const bufferMs = 5 * 60 * 1000;
    if (_ebayTokens.expiresAt - Date.now() > bufferMs) {
      return _ebayTokens.accessToken;
    }
    console.debug('[auth] アクセストークン期限切れ — Edge Function でリフレッシュ中...');
    try {
      if (!_supabase || !_user) throw new Error('Supabase 未接続');
      const { data: { session } } = await _supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error('Supabase セッション切れ');
      const cfg = _getConfig();
      if (!cfg.edgeFunctionBase) throw new Error('edgeFunctionBase が未設定');
      const response = await fetch(`${cfg.edgeFunctionBase}/ebay-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          type:         'refresh_token',
          refreshToken: _ebayTokens.refreshToken,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`リフレッシュ失敗 (${response.status}): ${err.error || ''}`);
      }
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
      // #2 #3 修正: リフレッシュ失敗時はUIとtierをexpired状態に固定し、
      // 後続のuser_settings読み込みで'connected'に上書きされないようreturnで抜ける
      _updateEbayStatusUI('expired');
      _setTier('free');
      _ebayTokens = null;
      return null;
    }
  }

  const auth = {

    async init() {
      _supabase = _initSupabase();
      if (!_supabase) {
        _setTier('free');
        _updateEbayStatusUI('disconnected');
        _showAuthOverlay();
        return;
      }
      _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          _showAuthOverlay('new-password');
          return;
        }
        _user = session?.user ?? null;
        if (!_user) {
          _setTier('free');
          _updateEbayStatusUI('disconnected');
          BA.cache?.clear?.();
          _showAuthOverlay();
        } else {
          _hideAuthOverlay();
        }
      });

      try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
          _setTier('free');
          _updateEbayStatusUI('disconnected');
          _showAuthOverlay();
          return;
        }
        _user = session.user;
        _hideAuthOverlay();

        const tokens = await _loadEbayTokens();
        if (tokens) {
          _ebayTokens = tokens;
          if (Date.now() > tokens.expiresAt) {
            // #2 #3 修正: リフレッシュ失敗時はnullが返る。
            // nullの場合はuser_settings読み込みをスキップしてfree/disconnectedを維持する
            const validToken = await _ensureValidToken();
            if (!validToken) return;
          }
          const { data: settings } = await _supabase
            .from('user_settings')
            .select('access_tier')
            .eq('user_id', _user.id)
            .single();
          _setTier(settings?.access_tier ?? 'connected');
          _updateEbayStatusUI('connected');
        } else {
          _setTier('free');
          _updateEbayStatusUI('disconnected');
        }

      } catch (err) {
        console.error('[auth] 初期化エラー:', err);
        _fireAlert('SUPABASE_ERROR');
        _setTier('free');
        _updateEbayStatusUI('error');
        _showAuthOverlay();
      }
    },

    async signIn(email, password) {
      if (!_supabase) throw new Error('[auth] Supabase 未設定');
      const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      _user = data.user;
      _setTier('free');
      _updateEbayStatusUI('disconnected');
      _hideAuthOverlay();
      const tokens = await _loadEbayTokens();
      if (tokens) {
        _ebayTokens = tokens;
        const { data: settings } = await _supabase
          .from('user_settings')
          .select('access_tier')
          .eq('user_id', _user.id)
          .single();
        _setTier(settings?.access_tier ?? 'connected');
        _updateEbayStatusUI('connected');
      }
    },

    async signUp(email, password) {
      if (!_supabase) throw new Error('[auth] Supabase 未設定');
      const { data, error } = await _supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        _user = data.user;
        _setTier('free');
        _hideAuthOverlay();
        return { needsConfirmation: false };
      }
      return { needsConfirmation: true };
    },

    async signInWithGoogle() {
      if (!_supabase) throw new Error('[auth] Supabase 未設定');
      // #6 修正: hash(#)も除去してredirectToにfragmentが残らないようにする
      const cleanUrl = window.location.href.split('?')[0].split('#')[0];
      const { error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: cleanUrl,
        },
      });
      if (error) throw error;
    },

    connectEbay() {
      if (!_user) {
        _showAuthOverlay('signin');
        BA.notify?.toast?.('先にサインインしてください', 'info');
        return;
      }
      window.location.href = _buildEbayAuthUrl();
    },

    async handleOAuthCallback(code, state) {
      const savedState = sessionStorage.getItem('ba_oauth_state');
      sessionStorage.removeItem('ba_oauth_state');
      if (state !== savedState) {
        throw new Error('[auth] OAuth state 不一致 — CSRF の可能性があります');
      }
      if (!_supabase || !_user) {
        throw new Error('[auth] Supabase 未接続またはサインイン未完了');
      }
      const { data: { session } } = await _supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error('[auth] セッショントークンが取得できません');
      const cfg = _getConfig();
      if (!cfg.edgeFunctionBase) {
        throw new Error('[auth] edgeFunctionBase 未設定 — config.local.js を確認してください');
      }
      const response = await fetch(`${cfg.edgeFunctionBase}/ebay-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          type:        'authorization_code',
          code,
          redirectUri: cfg.ebayRedirectUri,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`[auth] トークン交換失敗 (${response.status}): ${err.error || ''}`);
      }
      const data = await response.json();
      const tokens = {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token,
        expiresAt:    Date.now() + data.expires_in * 1000,
      };
      await _saveEbayTokens(tokens);
      _setTier('connected');
      _updateEbayStatusUI('connected');
      BA.notify?.toast?.('eBay アカウントを連携しました', 'success');
      document.dispatchEvent(new CustomEvent('ba:ebay-connected'));
    },

    async updatePassword(newPassword) {
      if (!_supabase) throw new Error('[auth] Supabase 未設定');
      const { error } = await _supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    async resetPassword(email) {
      if (!_supabase) throw new Error('[auth] Supabase 未設定');
      // #6 と同様にhashも除去
      const cleanUrl = window.location.href.split('?')[0].split('#')[0];
      const { error } = await _supabase.auth.resetPasswordForEmail(email, {
        redirectTo: cleanUrl,
      });
      if (error) throw error;
    },

    async disconnectEbay() {
      if (!_supabase || !_user) return;
      // #4 修正: DELETEのエラーを補足。失敗時はトースト表示せずにエラーログを残す
      const { error } = await _supabase
        .from('ebay_tokens')
        .delete()
        .eq('user_id', _user.id);
      if (error) {
        console.error('[auth] eBayトークン削除失敗:', error.message);
        BA.notify?.toast?.('eBay 連携解除に失敗しました。再度お試しください。', 'error');
        return;
      }
      _ebayTokens = null;
      BA.crypto?.destroy?.();
      _setTier('free');
      _updateEbayStatusUI('disconnected');
      BA.cache?.clear?.();
      BA.notify?.toast?.('eBay 連携を解除しました', 'info');
    },

    async getAccessToken() { return _ensureValidToken(); },

    getTier()         { return _tier; },
    getUser()         { return _user; },
    getSupabase()     { return _supabase; },
    isEbayConnected() { return _ebayTokens !== null; },

    async signOut() {
      // #5 修正: disconnectEbay()内でBA.crypto.destroy()が呼ばれるため、
      // signOut()側の重複呼び出しを除去
      await this.disconnectEbay();
      if (_supabase) await _supabase.auth.signOut();
      BA.cache?.clear?.();
      _user = null;
      _setTier('free');
      _showAuthOverlay();
    },
  };

  window.BA.auth = auth;

  document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('btn-signin')?.addEventListener('click', async () => {
      const email    = document.getElementById('auth-email')?.value?.trim();
      const password = document.getElementById('auth-password')?.value;
      _setAuthMessage('auth-error', '', false);
      if (!email || !password) {
        _setAuthMessage('auth-error', 'メールアドレスとパスワードを入力してください');
        return;
      }
      _setBtnLoading('btn-signin', true);
      try {
        await auth.signIn(email, password);
      } catch (err) {
        _setAuthMessage('auth-error', _translateAuthError(err.message));
      } finally {
        _setBtnLoading('btn-signin', false);
      }
    });

    document.getElementById('btn-signup')?.addEventListener('click', async () => {
      const email    = document.getElementById('signup-email')?.value?.trim();
      const password = document.getElementById('signup-password')?.value;
      _setAuthMessage('signup-error',   '', false);
      _setAuthMessage('signup-success', '', false);
      if (!email || !password) {
        _setAuthMessage('signup-error', 'メールアドレスとパスワードを入力してください');
        return;
      }
      if (password.length < 8) {
        _setAuthMessage('signup-error', 'パスワードは8文字以上で入力してください');
        return;
      }
      _setBtnLoading('btn-signup', true);
      try {
        const { needsConfirmation } = await auth.signUp(email, password);
        if (needsConfirmation) {
          _setAuthMessage('signup-success',
            '確認メールを送信しました。メール内のリンクをクリックしてサインインしてください。', true);
        }
      } catch (err) {
        _setAuthMessage('signup-error', _translateAuthError(err.message));
      } finally {
        _setBtnLoading('btn-signup', false);
      }
    });

    document.getElementById('btn-google-auth')?.addEventListener('click', async () => {
      _setBtnLoading('btn-google-auth', true);
      try {
        await auth.signInWithGoogle();
      } catch (err) {
        _setAuthMessage('auth-error', 'Googleサインインに失敗しました。再度お試しください。');
        _setBtnLoading('btn-google-auth', false);
      }
    });

    document.getElementById('btn-ebay-oauth')?.addEventListener('click', () => auth.connectEbay());

    document.getElementById('btn-to-signup')?.addEventListener('click', () => _showAuthOverlay('signup'));
    document.getElementById('btn-to-signin')?.addEventListener('click', () => _showAuthOverlay('signin'));
    document.getElementById('btn-to-reset')?.addEventListener('click', () => _showAuthOverlay('reset'));
    document.getElementById('btn-reset-to-signin')?.addEventListener('click', () => _showAuthOverlay('signin'));

    document.getElementById('btn-reset-send')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email')?.value?.trim();
      _setAuthMessage('reset-error',   '', false);
      _setAuthMessage('reset-success', '', false);
      if (!email) {
        _setAuthMessage('reset-error', 'メールアドレスを入力してください');
        return;
      }
      _setBtnLoading('btn-reset-send', true);
      try {
        await auth.resetPassword(email);
        _setAuthMessage('reset-success',
          'リセット用のメールを送信しました。メール内のリンクからパスワードを変更してください。', true);
      } catch (err) {
        _setAuthMessage('reset-error', _translateAuthError(err.message));
      } finally {
        _setBtnLoading('btn-reset-send', false);
      }
    });

    document.getElementById('reset-email')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-reset-send')?.click();
    });

    document.getElementById('btn-update-password')?.addEventListener('click', async () => {
      const newPassword     = document.getElementById('new-password-input')?.value;
      const confirmPassword = document.getElementById('new-password-confirm')?.value;
      _setAuthMessage('new-password-error',   '', false);
      _setAuthMessage('new-password-success', '', false);
      if (!newPassword || !confirmPassword) {
        _setAuthMessage('new-password-error', '新しいパスワードを入力してください');
        return;
      }
      if (newPassword.length < 8) {
        _setAuthMessage('new-password-error', 'パスワードは8文字以上で入力してください');
        return;
      }
      if (newPassword !== confirmPassword) {
        _setAuthMessage('new-password-error', 'パスワードが一致しません');
        return;
      }
      _setBtnLoading('btn-update-password', true);
      try {
        await auth.updatePassword(newPassword);
        _setAuthMessage('new-password-success', 'パスワードを更新しました', true);
        setTimeout(() => _showAuthOverlay('signin'), 1500);
      } catch (err) {
        _setAuthMessage('new-password-error', _translateAuthError(err.message));
      } finally {
        _setBtnLoading('btn-update-password', false);
      }
    });

    document.getElementById('new-password-confirm')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-update-password')?.click();
    });

    document.getElementById('btn-signout')?.addEventListener('click', async () => {
      await auth.signOut();
    });

    document.getElementById('btn-skip-free')?.addEventListener('click', () => {
      _hideAuthOverlay();
      _setTier('free');
      _updateEbayStatusUI('disconnected');
    });

    document.getElementById('auth-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-signin')?.click();
    });
    document.getElementById('signup-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-signup')?.click();
    });
  });

  function _translateAuthError(msg) {
    if (!msg) return '不明なエラーが発生しました';
    if (msg.includes('Invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません';
    if (msg.includes('Email not confirmed'))       return 'メールアドレスの確認が完了していません。確認メールをご確認ください';
    if (msg.includes('User already registered'))   return 'このメールアドレスはすでに登録されています';
    if (msg.includes('Password should be'))        return 'パスワードは8文字以上で入力してください';
    if (msg.includes('rate limit'))                return 'しばらく時間をおいてから再度お試しください';
    return msg;
  }

})();
