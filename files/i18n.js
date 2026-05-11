/**
 * BRAND ANALYTICS — i18n.js
 * 日英ローカライズモジュール
 *
 * ・BA.i18n.t('key') でテキスト取得
 * ・BA.i18n.setLang('ja'|'en') で言語切替
 * ・デフォルト: 日本語
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 翻訳辞書
  // ─────────────────────────────────────
  const DICT = {
    ja: {
      // ── ナビゲーション ──
      'nav.profit':      '利益計算機',
      'nav.sourcing':    '仕入れメーター',
      'nav.dashboard':   'ダッシュボード',
      'nav.health':      '健全性スコア',
      'nav.finance':     'ファイナンス',
      'nav.protection':  'アカウント保護',
      'nav.settings':    '設定',

      // ── 接続状態 ──
      'status.connected':    'eBay 接続中',
      'status.disconnected': '未接続',
      'status.expired':      '認証期限切れ',
      'status.error':        '接続エラー',

      // ── Tier バッジ ──
      'tier.free':      'FREE',
      'tier.connected': 'CONNECTED',
      'tier.premium':   'PREMIUM',

      // ── フォールバック警告 ──
      'stale.warning': '%s 時間前のデータを表示中（最新データ取得失敗）',

      // ── 利益計算機 ──
      'profit.selling_price':   '販売価格',
      'profit.cost':            '仕入れ原価',
      'profit.ebay_fee':        'eBay 手数料',
      'profit.promoted':        'Promoted Listings',
      'profit.payoneer':        'Payoneer 手数料',
      'profit.shipping':        '送料',
      'profit.customs':         '関税',
      'profit.auth_service':    '真贋サービス（国内送料）',
      'profit.gross_profit':    '粗利益',
      'profit.profit_rate':     '粗利率',
      'profit.plan':            '出品プラン',
      'profit.category':        'カテゴリ',
      'profit.shipping_mode.manual':  '手動入力',
      'profit.shipping_mode.fixed':   '固定 $35',
      'profit.shipping_mode.buyer':   'バイヤー負担',
      'profit.customs_mode.manual':   '手動入力',
      'profit.customs_mode.zero':     '$0（バイヤー負担）',
      'profit.above_500':       '$500 以上（真贋サービス対象）',
      'profit.below_500':       '$500 未満',
      'profit.disclaimer':      'シミュレーション値・実際の損益は取引記録による',

      // ── 仕入れメーター ──
      'sourcing.title':           '仕入れメーター',
      'sourcing.go':              'GO（仕入れ推奨）',
      'sourcing.no_go':           'NO-GO（見送り推奨）',
      'sourcing.caution':         '要検討',
      'sourcing.sell_rate':       '成約率',
      'sourcing.competitors':     '競合出品数増加率',
      'sourcing.profit_rate':     '目標利益率',
      'sourcing.terapeak_manual': '成約率を手動入力',
      'sourcing.disclaimer':      '暫定デフォルト値・実績に応じて変更推奨',

      // ── 健全性スコア ──
      'health.score':          '健全性スコア',
      'health.rank':           'ランク',
      'health.defect':         '取引不良率',
      'health.cases':          '未解決ケース率',
      'health.late_ship':      '遅延発送率',
      'health.tracking':       '追跡情報提供率',
      'health.inad':           'INAD クレーム率',
      'health.disclaimer':     'eBay 公式基準を参考にした独自計算',
      'health.rank.s':         'S（優秀）',
      'health.rank.a':         'A（良好）',
      'health.rank.b':         'B（普通）',
      'health.rank.c':         'C（要改善）',
      'health.rank.d':         'D（警戒）',

      // ── アラート ──
      'alert.DEFECT_WARNING':       '取引不良率が警告水準に達しています',
      'alert.LATESHIP_WARNING':     '遅延発送率が警告水準に達しています',
      'alert.TRACKING_WARNING':     '追跡情報提供率が低下しています',
      'alert.INAD_WARNING':         'INAD クレーム率が上昇しています',
      'alert.VIOLATION_UNRESOLVED': '未解決の違反があります',
      'alert.CASE_OPENED':          '新しいケースが開設されました',
      'alert.OAUTH_EXPIRED':        'eBay 認証の有効期限が切れています',
      'alert.OAUTH_DISCONNECTED':   'eBay との接続が切断されています',
      'alert.EBAY_API_DOWN':        'eBay API に障害が発生しています',
      'alert.DATA_STALE':           'データの更新に失敗しました',
      'alert.SUPABASE_ERROR':       'データベース接続エラーが発生しました',

      // ── eBay 連携 ──
      'connect.title':        'eBay アカウントを連携する',
      'connect.desc':         'eBay OAuth 認証を行うと、健全性スコア・ファイナンスレポート・アカウント保護機能が利用できます。',
      'connect.btn':          'eBay で認証する',
      'connect.security':     '認証情報は AES-GCM 256bit で暗号化保存されます',
      'connect.disconnect':   'eBay 連携を解除',

      // ── 共通 ──
      'common.save':      '保存',
      'common.cancel':    'キャンセル',
      'common.close':     '閉じる',
      'common.loading':   '読み込み中...',
      'common.error':     'エラーが発生しました',
      'common.retry':     '再試行',
      'common.no_data':   'データがありません',
      'common.updated':   '更新しました',
      'common.required':  '必須項目です',
    },

    en: {
      // ── ナビゲーション ──
      'nav.profit':      'Profit Calculator',
      'nav.sourcing':    'Sourcing Meter',
      'nav.dashboard':   'Dashboard',
      'nav.health':      'Health Score',
      'nav.finance':     'Finance',
      'nav.protection':  'Account Protection',
      'nav.settings':    'Settings',

      // ── 接続状態 ──
      'status.connected':    'eBay Connected',
      'status.disconnected': 'Not Connected',
      'status.expired':      'Auth Expired',
      'status.error':        'Connection Error',

      // ── Tier バッジ ──
      'tier.free':      'FREE',
      'tier.connected': 'CONNECTED',
      'tier.premium':   'PREMIUM',

      // ── フォールバック警告 ──
      'stale.warning': 'Showing data from %s hours ago (latest fetch failed)',

      // ── 利益計算機 ──
      'profit.selling_price':   'Selling Price',
      'profit.cost':            'Purchase Cost',
      'profit.ebay_fee':        'eBay Fee',
      'profit.promoted':        'Promoted Listings',
      'profit.payoneer':        'Payoneer Fee',
      'profit.shipping':        'Shipping',
      'profit.customs':         'Customs',
      'profit.auth_service':    'Auth Service (Domestic Shipping)',
      'profit.gross_profit':    'Gross Profit',
      'profit.profit_rate':     'Profit Margin',
      'profit.plan':            'Listing Plan',
      'profit.category':        'Category',
      'profit.shipping_mode.manual': 'Manual',
      'profit.shipping_mode.fixed':  'Fixed $35',
      'profit.shipping_mode.buyer':  'Buyer Pays',
      'profit.customs_mode.manual':  'Manual',
      'profit.customs_mode.zero':    '$0 (Buyer Pays)',
      'profit.above_500':       '$500+ (Auth Service Required)',
      'profit.below_500':       'Under $500',
      'profit.disclaimer':      'Simulation only — actual P&L based on transaction records',

      // ── 仕入れメーター ──
      'sourcing.title':           'Sourcing Meter',
      'sourcing.go':              'GO (Recommended)',
      'sourcing.no_go':           'NO-GO (Pass)',
      'sourcing.caution':         'Caution',
      'sourcing.sell_rate':       'Sell-Through Rate',
      'sourcing.competitors':     'Competitor Growth Rate',
      'sourcing.profit_rate':     'Target Margin',
      'sourcing.terapeak_manual': 'Enter sell-through rate manually',
      'sourcing.disclaimer':      'Default values — adjust based on your actual results',

      // ── 健全性スコア ──
      'health.score':      'Health Score',
      'health.rank':       'Rank',
      'health.defect':     'Defect Rate',
      'health.cases':      'Cases Closed Without Resolution',
      'health.late_ship':  'Late Shipment Rate',
      'health.tracking':   'Tracking Uploaded Rate',
      'health.inad':       'INAD Rate',
      'health.disclaimer': 'Proprietary score based on eBay official standards',
      'health.rank.s':     'S (Excellent)',
      'health.rank.a':     'A (Good)',
      'health.rank.b':     'B (Average)',
      'health.rank.c':     'C (Needs Improvement)',
      'health.rank.d':     'D (Critical)',

      // ── アラート ──
      'alert.DEFECT_WARNING':       'Defect rate has reached warning level',
      'alert.LATESHIP_WARNING':     'Late shipment rate has reached warning level',
      'alert.TRACKING_WARNING':     'Tracking upload rate is declining',
      'alert.INAD_WARNING':         'INAD claim rate is increasing',
      'alert.VIOLATION_UNRESOLVED': 'You have unresolved violations',
      'alert.CASE_OPENED':          'A new case has been opened',
      'alert.OAUTH_EXPIRED':        'eBay authentication has expired',
      'alert.OAUTH_DISCONNECTED':   'eBay connection has been disconnected',
      'alert.EBAY_API_DOWN':        'eBay API is experiencing issues',
      'alert.DATA_STALE':           'Failed to update data',
      'alert.SUPABASE_ERROR':       'Database connection error occurred',

      // ── eBay 連携 ──
      'connect.title':        'Connect Your eBay Account',
      'connect.desc':         'Connect via eBay OAuth to unlock Health Score, Finance Reports, and Account Protection.',
      'connect.btn':          'Authenticate with eBay',
      'connect.security':     'Credentials are encrypted with AES-GCM 256bit',
      'connect.disconnect':   'Disconnect eBay',

      // ── 共通 ──
      'common.save':      'Save',
      'common.cancel':    'Cancel',
      'common.close':     'Close',
      'common.loading':   'Loading...',
      'common.error':     'An error occurred',
      'common.retry':     'Retry',
      'common.no_data':   'No data available',
      'common.updated':   'Updated',
      'common.required':  'This field is required',
    },
  };

  // ─────────────────────────────────────
  // プライベート変数
  // ─────────────────────────────────────
  let _lang = 'ja'; // デフォルト言語

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────
  const i18n = {

    /** 初期化：ブラウザ言語 or localStorageから言語を取得 */
    init() {
      const saved = localStorage.getItem('ba_lang');
      if (saved && DICT[saved]) {
        _lang = saved;
      } else {
        // ブラウザ言語が英語なら英語、それ以外は日本語
        _lang = navigator.language?.startsWith('en') ? 'en' : 'ja';
      }
      console.debug('[i18n] 言語設定:', _lang);
    },

    /**
     * キーに対応するテキストを取得する
     * @param {string} key - 翻訳キー（例: 'nav.profit'）
     * @param {Object} [vars] - プレースホルダー置換（例: { '%s': '3' }）
     * @returns {string}
     */
    t(key, vars) {
      const dict = DICT[_lang] || DICT['ja'];
      let text = dict[key] ?? DICT['ja'][key] ?? key; // フォールバック: ja → キーをそのまま

      // プレースホルダー置換（%s サポート）
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replaceAll(k, String(v));
        });
      }

      return text;
    },

    /**
     * 言語を切り替える
     * @param {'ja'|'en'} lang
     */
    setLang(lang) {
      if (!DICT[lang]) { console.warn('[i18n] 未対応言語:', lang); return; }
      _lang = lang;
      localStorage.setItem('ba_lang', lang);
      // カスタムイベントを発火（nav.js 等が受信して再レンダリング）
      document.dispatchEvent(new CustomEvent('ba:lang-change', { detail: { lang } }));
      console.debug('[i18n] 言語切替:', lang);
    },

    /** 現在の言語を返す */
    getLang() { return _lang; },

    /** 利用可能な言語一覧 */
    getAvailableLangs() { return Object.keys(DICT); },
  };

  window.BA.i18n = i18n;

})();
