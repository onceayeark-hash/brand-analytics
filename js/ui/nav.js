/**
 * BRAND ANALYTICS — nav.js
 * ナビゲーション・パネル切替・tier 制御モジュール
 *
 * ・サイドバーの nav-item クリックでパネルを切り替える
 * ・tier に応じて locked クラスを付与/除去する
 * ・data-tier="connected" 時は全 CONNECTED パネルが解放される
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 定数
  // ─────────────────────────────────────

  // nav-item の data-panel → panel ID / breadcrumb タイトル
  const PANEL_META = {
    profit:     { panelId: 'panel-profit',     title: '利益計算機',      requires: 'free' },
    sourcing:   { panelId: 'panel-sourcing',   title: '仕入れメーター',  requires: 'free' },
    dashboard:  { panelId: 'panel-dashboard',  title: 'ダッシュボード',  requires: 'connected' },
    health:     { panelId: 'panel-health',     title: '健全性スコア',    requires: 'connected' },
    finance:    { panelId: 'panel-finance',    title: 'ファイナンス',    requires: 'connected' },
    protection: { panelId: 'panel-protection', title: 'アカウント保護',  requires: 'connected' },
    settings:   { panelId: 'panel-settings',   title: '設定',           requires: 'free' },
    connect:    { panelId: 'panel-connect',    title: 'eBay 連携',      requires: 'free' },
  };

  // tier の強さ（数値が大きいほど上位）
  const TIER_LEVEL = { free: 0, connected: 1, premium: 2 };

  // ─────────────────────────────────────
  // プライベート変数
  // ─────────────────────────────────────
  let _currentPanel = 'profit';
  let _currentTier  = 'free';

  // ─────────────────────────────────────
  // 内部ユーティリティ
  // ─────────────────────────────────────

  /** tier レベルの比較: currentTier が required を満たすか */
  function _hasTierAccess(required) {
    return TIER_LEVEL[_currentTier] >= TIER_LEVEL[required];
  }

  /** ブレッドクラム更新 */
  function _updateBreadcrumb(panelKey) {
    const el = document.getElementById('current-page-title');
    if (!el) return;
    const meta = PANEL_META[panelKey];
    // i18n キーがあれば使用、なければ PANEL_META のタイトルをそのまま使う
    const t = BA.i18n?.t(`nav.${panelKey}`);
    el.textContent = (t && t !== `nav.${panelKey}`) ? t : (meta?.title ?? panelKey);
  }

  /** nav-item のアクティブ状態を更新 */
  function _updateNavActiveState(panelKey) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.panel === panelKey);
    });
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const nav = {

    /** 初期化 */
    init() {
      // nav-item クリックイベントを一括登録
      document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
        item.addEventListener('click', () => {
          const panelKey = item.dataset.panel;
          this.showPanel(panelKey);
        });
      });

      // 言語切り替えイベント受信
      document.addEventListener('ba:lang-change', () => {
        _updateBreadcrumb(_currentPanel);
      });

      // 初期状態を反映
      this.setTier(_currentTier);
      this.showPanel(_currentPanel);
      console.debug('[nav] 初期化完了');
    },

    /**
     * 指定パネルを表示する
     * @param {string} panelKey - PANEL_META のキー
     */
    showPanel(panelKey) {
      const meta = PANEL_META[panelKey];
      if (!meta) { console.warn('[nav] 不明なパネル:', panelKey); return; }

      // tier アクセス確認
      if (!_hasTierAccess(meta.requires)) {
        // アクセス不可: eBay 連携画面を表示
        this.showPanel('connect');
        return;
      }

      // 全パネルを非表示
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

      // 対象パネルを表示
      const panel = document.getElementById(meta.panelId);
      if (panel) {
        panel.classList.add('active');
      } else {
        console.warn('[nav] パネル要素が見つかりません:', meta.panelId);
      }

      _currentPanel = panelKey;
      _updateNavActiveState(panelKey);
      _updateBreadcrumb(panelKey);

      // パネル初期化イベントを発火（各 feature.js が受信して遅延レンダリング）
      document.dispatchEvent(new CustomEvent('ba:panel-show', { detail: { panelKey } }));
    },

    /**
     * tier を更新して UI に反映する
     * auth.js から呼ばれる
     * @param {'free'|'connected'|'premium'} tier
     */
    setTier(tier) {
      if (!TIER_LEVEL.hasOwnProperty(tier)) {
        console.warn('[nav] 不明な tier:', tier);
        return;
      }
      _currentTier = tier;

      // data-tier 属性で CSS が locked/unlocked を自動制御
      document.documentElement.setAttribute('data-tier', tier);

      // locked クラスを tier に応じて更新
      document.querySelectorAll('.nav-item[data-requires]').forEach(item => {
        const required = item.dataset.requires ?? 'free';
        if (_hasTierAccess(required)) {
          item.classList.remove('locked');
          item.removeAttribute('disabled');
        } else {
          item.classList.add('locked');
          item.setAttribute('disabled', '');
        }
      });

      // free tier で CONNECTED パネルを表示中なら profit にリダイレクト
      if (!_hasTierAccess(PANEL_META[_currentPanel]?.requires ?? 'free')) {
        this.showPanel('profit');
      }

      console.debug('[nav] tier 設定:', tier);
    },

    /** 現在表示中のパネルキーを返す */
    getCurrentPanel() { return _currentPanel; },

    /** 現在の tier を返す */
    getCurrentTier() { return _currentTier; },
  };

  window.BA.nav = nav;

})();
