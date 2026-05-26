/**
 * BRAND ANALYTICS — nav.js
 * ナビゲーション・パネル切替・tier 制御モジュール
 *
 * 全パネルは tier に関わらず表示可能。
 * NO DATA / 実データの描画判断は各 feature.js が行う。
 * locked クラスは視覚的ヒントのみ（ナビゲーションは妨げない）。
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  const PANEL_META = {
    profit:           { panelId: 'panel-profit',           title: '利益計算機'              },
    sourcing:         { panelId: 'panel-sourcing',         title: '仕入れメーター'          },
    'listing-quality':{ panelId: 'panel-listing-quality',  title: 'リスティング品質'        },
    transactions:     { panelId: 'panel-transactions',     title: '取引記録'                },
    dashboard:        { panelId: 'panel-dashboard',        title: 'ダッシュボード'          },
    health:     { panelId: 'panel-health',     title: 'アカウントパフォーマンス' },
    finance:    { panelId: 'panel-finance',    title: 'ファイナンス'            },
    protection: { panelId: 'panel-protection', title: 'アカウント保護'          },
    settings:   { panelId: 'panel-settings',   title: '設定'                   },
    connect:    { panelId: 'panel-connect',    title: 'eBay 連携'              },
    admin:      { panelId: 'panel-admin',      title: '管理者パネル'            },
  };

  const TIER_LEVEL = { free: 0, connected: 1, premium: 2 };

  let _currentPanel = 'profit';
  let _currentTier  = 'free';

  function _updateBreadcrumb(panelKey) {
    const el = document.getElementById('current-page-title');
    if (!el) return;
    const meta = PANEL_META[panelKey];
    const t = BA.i18n?.t(`nav.${panelKey}`);
    el.textContent = (t && t !== `nav.${panelKey}`) ? t : (meta?.title ?? panelKey);
  }

  function _updateNavActiveState(panelKey) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.panel === panelKey);
    });
  }

  const nav = {

    init() {
      document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
        item.addEventListener('click', () => {
          this.showPanel(item.dataset.panel);
        });
      });

      document.addEventListener('ba:lang-change', () => {
        _updateBreadcrumb(_currentPanel);
      });

      this.setTier(_currentTier);
      this.showPanel(_currentPanel);
    },

    showPanel(panelKey) {
      const meta = PANEL_META[panelKey];
      if (!meta) { console.warn('[nav] 不明なパネル:', panelKey); return; }

      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

      const panel = document.getElementById(meta.panelId);
      if (panel) {
        panel.classList.add('active');
      } else {
        console.warn('[nav] パネル要素が見つかりません:', meta.panelId);
      }

      _currentPanel = panelKey;
      _updateNavActiveState(panelKey);
      _updateBreadcrumb(panelKey);

      document.dispatchEvent(new CustomEvent('ba:panel-show', { detail: { panelKey } }));
    },

    setTier(tier) {
      if (!TIER_LEVEL.hasOwnProperty(tier)) {
        console.warn('[nav] 不明な tier:', tier);
        return;
      }
      _currentTier = tier;
      document.documentElement.setAttribute('data-tier', tier);

      // locked クラスは視覚ヒントのみ（connected 以上で解除）
      document.querySelectorAll('.nav-item[data-requires]').forEach(item => {
        const required = item.dataset.requires ?? 'free';
        item.classList.toggle('locked', TIER_LEVEL[tier] < TIER_LEVEL[required]);
      });
    },

    getCurrentPanel() { return _currentPanel; },
    getCurrentTier()  { return _currentTier;  },
  };

  window.BA.nav = nav;

})();
