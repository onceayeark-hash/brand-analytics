// @not-security-critical （grep確認済み・認証情報/トークン/APIキーを扱わない・2026-06-25判断）
/**
 * BRAND ANALYTICS — listing-quality.js
 * リスティング品質スコア・2026年新要件チェッカー・VeROリスクスキャン
 *
 * ・入力: タイトル / 画像枚数 / 説明文 / ブランド名 / 価格 / Item Specifics
 * ・出力: 品質スコア(0-100) / 要件チェックリスト / 改善提案 / VeROリスク
 * ・オートコンプリート: 大文字小文字・スペース有無・カタカナ全て対応 + localStorage 履歴
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─── 文字列正規化（大小・スペース無視検索用）──────────

  function _norm(str) {
    return (str || '').toLowerCase().replace(/[\s　・\-&']/g, '');
  }

  // ─── ファジーマッチ（スペルミス対応）──────────────────
  // クエリの各文字が対象文字列に順番通り含まれるか（サブシーケンス判定）
  // 4文字以上で有効。70%以上の文字が連続マッチしたものを優先

  function _fuzzyScore(str, query) {
    if (query.length < 4) return 0; // 短いクエリは誤検知防止
    let si = 0, matched = 0, consecutive = 0, maxConsec = 0;
    for (let qi = 0; qi < query.length; qi++) {
      const found = str.indexOf(query[qi], si);
      if (found === -1) { consecutive = 0; continue; }
      matched++;
      consecutive = (found === si) ? consecutive + 1 : 1;
      if (consecutive > maxConsec) maxConsec = consecutive;
      si = found + 1;
    }
    // 70%以上の文字が見つかり、かつ3文字以上連続している場合にスコアを返す
    const ratio = matched / query.length;
    return (ratio >= 0.70 && maxConsec >= 3) ? ratio : 0;
  }

  // ─── VeRO ブランドリスト（主要ブランド・カタカナ読み付き）──

  const VERO_BRANDS = [
    // ラグジュアリーファッション
    { en: 'Louis Vuitton',     ja: ['ルイヴィトン', 'ルイ・ヴィトン', 'LV'] },
    { en: 'Chanel',            ja: ['シャネル'] },
    { en: 'Gucci',             ja: ['グッチ'] },
    { en: 'Hermès',            ja: ['エルメス'] },
    { en: 'Prada',             ja: ['プラダ'] },
    { en: 'Burberry',          ja: ['バーバリー'] },
    { en: 'Versace',           ja: ['ヴェルサーチ', 'ベルサーチ'] },
    { en: 'Balenciaga',        ja: ['バレンシアガ'] },
    { en: 'Givenchy',          ja: ['ジバンシー', 'ジバンシィ'] },
    { en: 'Saint Laurent',     ja: ['サンローラン', 'YSL'] },
    { en: 'Bottega Veneta',    ja: ['ボッテガヴェネタ', 'ボッテガ'] },
    { en: 'Fendi',             ja: ['フェンディ'] },
    { en: 'Celine',            ja: ['セリーヌ'] },
    { en: 'Loewe',             ja: ['ロエベ'] },
    { en: 'Valentino',         ja: ['ヴァレンティノ'] },
    { en: 'Miu Miu',           ja: ['ミュウミュウ'] },
    { en: 'Dior',              ja: ['ディオール', 'クリスチャンディオール'] },
    { en: 'Balmain',           ja: ['バルマン'] },
    { en: 'Alexander McQueen', ja: ['アレキサンダーマックイーン'] },
    { en: 'Vivienne Westwood', ja: ['ヴィヴィアンウエストウッド'] },
    { en: 'Stella McCartney',  ja: ['ステラマッカートニー'] },
    { en: 'Kenzo',             ja: ['ケンゾー'] },
    { en: 'Lanvin',            ja: ['ランバン'] },
    { en: 'Marni',             ja: ['マルニ'] },
    { en: 'Off-White',         ja: ['オフホワイト'] },
    { en: 'Maison Margiela',   ja: ['メゾンマルジェラ', 'マルジェラ'] },
    { en: 'Acne Studios',      ja: ['アクネ', 'アクネストゥディオズ'] },
    { en: 'Rick Owens',        ja: ['リックオウエンス'] },
    { en: 'Comme des Garcons', ja: ['コムデギャルソン'] },
    { en: 'Yohji Yamamoto',    ja: ['ヨウジヤマモト', '山本耀司'] },
    { en: 'Issey Miyake',      ja: ['イッセイミヤケ', '三宅一生'] },

    // 時計・宝飾
    { en: 'Rolex',             ja: ['ロレックス'] },
    { en: 'Omega',             ja: ['オメガ'] },
    { en: 'Cartier',           ja: ['カルティエ'] },
    { en: 'Patek Philippe',    ja: ['パテックフィリップ', 'パテック'] },
    { en: 'Audemars Piguet',   ja: ['オーデマピゲ', 'AP'] },
    { en: 'IWC',               ja: ['アイダブリューシー'] },
    { en: 'Breitling',         ja: ['ブライトリング'] },
    { en: 'TAG Heuer',         ja: ['タグホイヤー'] },
    { en: 'Tiffany & Co.',     ja: ['ティファニー'] },
    { en: 'Bulgari',           ja: ['ブルガリ'] },
    { en: 'Chopard',           ja: ['ショパール'] },
    { en: 'Van Cleef & Arpels',ja: ['ヴァンクリーフ', 'バンクリーフ'] },
    { en: 'Hublot',            ja: ['ウブロ'] },
    { en: 'Jaeger-LeCoultre',  ja: ['ジャガールクルト'] },
    { en: 'Swatch',            ja: ['スウォッチ'] },
    { en: 'Seiko',             ja: ['セイコー'] },
    { en: 'Casio',             ja: ['カシオ'] },

    // スポーツ・アパレル
    { en: 'Nike',              ja: ['ナイキ'] },
    { en: 'Adidas',            ja: ['アディダス'] },
    { en: 'Supreme',           ja: ['シュプリーム'] },
    { en: 'Stone Island',      ja: ['ストーンアイランド'] },
    { en: 'The North Face',    ja: ['ノースフェイス'] },
    { en: 'Arcteryx',          ja: ['アークテリクス'] },
    { en: 'Patagonia',         ja: ['パタゴニア'] },
    { en: 'Canada Goose',      ja: ['カナダグース'] },
    { en: 'Moncler',           ja: ['モンクレール'] },
    { en: 'Puma',              ja: ['プーマ'] },
    { en: 'New Balance',       ja: ['ニューバランス'] },
    { en: 'Converse',          ja: ['コンバース'] },
    { en: 'Vans',              ja: ['バンズ'] },
    { en: 'Air Jordan',        ja: ['エアジョーダン', 'ジョーダン'] },
    { en: 'Yeezy',             ja: ['イージー'] },
    { en: 'Levis',             ja: ['リーバイス'] },
    { en: 'Ralph Lauren',      ja: ['ラルフローレン'] },
    { en: 'Tommy Hilfiger',    ja: ['トミーヒルフィガー'] },
    { en: 'Calvin Klein',      ja: ['カルバンクライン', 'CK'] },
    { en: 'Hugo Boss',         ja: ['ヒューゴボス'] },
    { en: 'Lacoste',           ja: ['ラコステ'] },
    { en: 'Fred Perry',        ja: ['フレッドペリー'] },
    { en: 'A Bathing Ape',     ja: ['ベイシングエイプ', 'BAPE', 'エイプ'] },

    // 電子機器
    { en: 'Apple',             ja: ['アップル'] },
    { en: 'Samsung',           ja: ['サムスン'] },
    { en: 'Sony',              ja: ['ソニー'] },
    { en: 'Microsoft',         ja: ['マイクロソフト'] },
    { en: 'Nintendo',          ja: ['ニンテンドー', '任天堂'] },
    { en: 'Dyson',             ja: ['ダイソン'] },
    { en: 'Bose',              ja: ['ボーズ'] },
    { en: 'Bang & Olufsen',    ja: ['バング&オルフセン', 'B&O'] },
    { en: 'Beats',             ja: ['ビーツ'] },
    { en: 'Canon',             ja: ['キヤノン', 'キャノン'] },
    { en: 'Nikon',             ja: ['ニコン'] },
    { en: 'Leica',             ja: ['ライカ'] },
    { en: 'GoPro',             ja: ['ゴープロ'] },
    { en: 'DJI',               ja: ['ディージェイアイ'] },

    // 自動車
    { en: 'Ferrari',           ja: ['フェラーリ'] },
    { en: 'Porsche',           ja: ['ポルシェ'] },
    { en: 'Lamborghini',       ja: ['ランボルギーニ'] },

    // コスメ・香水
    { en: 'MAC Cosmetics',     ja: ['マック', 'マックコスメ'] },
    { en: 'Charlotte Tilbury', ja: ['シャーロットティルベリー'] },
    { en: 'NARS',              ja: ['ナーズ'] },
    { en: 'La Mer',            ja: ['ラメール'] },
    { en: 'SK-II',             ja: ['エスケーツー', 'SKII'] },
    { en: 'Jo Malone',         ja: ['ジョーマローン'] },
    { en: 'Creed',             ja: ['クリード'] },
    { en: 'Tom Ford',          ja: ['トムフォード'] },
  ];

  // ─── オートコンプリート ─────────────────────────────

  const HISTORY_KEY = 'ba_brand_history';

  function _getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }

  function _addHistory(brandEn) {
    const h = _getHistory().filter(b => b !== brandEn);
    h.unshift(brandEn);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20))); } catch {}
  }

  function _searchBrands(query) {
    if (!query || query.length < 2) return [];
    const q       = _norm(query);
    const history = _getHistory();

    // 完全部分一致（高優先）
    const exact = VERO_BRANDS.filter(b =>
      _norm(b.en).includes(q) || b.ja.some(j => _norm(j).includes(q))
    ).map(b => b.en);

    // ファジーマッチ（スペルミス対応・完全一致で見つからなかった場合に補完）
    const fuzzy = VERO_BRANDS
      .map(b => ({
        en:    b.en,
        score: Math.max(
          _fuzzyScore(_norm(b.en), q),
          ...b.ja.map(j => _fuzzyScore(_norm(j), q))
        ),
      }))
      .filter(b => b.score > 0 && !exact.includes(b.en))
      .sort((a, b) => b.score - a.score)
      .map(b => b.en);

    const all = [...new Set([...exact, ...fuzzy])];

    return [...new Set([
      ...all.filter(m => history.includes(m)),  // 履歴優先
      ...all.filter(m => !history.includes(m)),
    ])].slice(0, 8);
  }

  // ─── 品質スコア計算 ───────────────────────────────

  function _calcScore(data) {
    const scores      = {};
    const issues      = [];
    const suggestions = [];
    const brandNorm   = _norm(data.brand);

    // ── タイトル（25点）──────────────────────────────
    // 文字数 20点 / 単語数 3点 / キーワード前配置 2点
    const titleLen  = (data.title || '').length;
    const words     = (data.title || '').trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    let titleScore  = 0;

    if (titleLen >= 75 && titleLen <= 80)      { titleScore += 20; }
    else if (titleLen >= 65 && titleLen < 75)  { titleScore += 14; suggestions.push('タイトルを75〜80文字にするとスコアが上がります（現在: ' + titleLen + '文字）'); }
    else if (titleLen >= 55)                   { titleScore += 9;  suggestions.push('タイトルを75〜80文字に伸ばしてください（現在: ' + titleLen + '文字）'); }
    else if (titleLen >= 40)                   { titleScore += 5;  issues.push('タイトルが短すぎます（推奨: 75〜80文字、現在: ' + titleLen + '文字）'); }
    else if (titleLen > 80)                    { titleScore += 12; issues.push('タイトルが80文字を超えています（上限80文字）'); }
    else                                       { titleScore += Math.max(0, Math.round(titleLen / 40 * 5)); issues.push('タイトルが短すぎます（推奨: 75〜80文字）'); }

    if (wordCount >= 15 && wordCount <= 18)    { titleScore += 3; }
    else if (wordCount >= 12)                  { titleScore += 1; suggestions.push('タイトルの単語数を15〜18語にすると最適です（現在: ' + wordCount + '語）'); }
    else if (wordCount > 0)                    { suggestions.push('単語数が少なすぎます（推奨: 15〜18語、現在: ' + wordCount + '語）'); }

    // キーワード前配置: ブランド名が最初の3単語以内にあるか
    if (brandNorm && titleLen > 0) {
      const firstWords = _norm(words.slice(0, 3).join(' '));
      if (firstWords.includes(brandNorm)) { titleScore += 2; }
      else { suggestions.push('ブランド名をタイトル先頭（最初の3単語以内）に配置すると検索評価が上がります'); }
    } else {
      titleScore += 2;
    }

    scores.title = Math.min(titleScore, 25);

    // ── 画像（25点）──────────────────────────────────
    // 枚数 18点 / 1600px+ 4点 / 全角度 3点
    const imgCount = Number(data.imageCount) || 0;
    let imgScore   = 0;

    if      (imgCount >= 24) imgScore += 18;
    else if (imgCount >= 20) imgScore += 16;
    else if (imgCount >= 16) imgScore += 14;
    else if (imgCount >= 12) imgScore += 12;
    else if (imgCount >= 8)  imgScore += 8;
    else if (imgCount >= 4)  imgScore += 4;
    else if (imgCount >= 1)  imgScore += 2;
    else                     issues.push('画像が設定されていません');

    if (imgCount > 0 && imgCount < 12) issues.push(`画像をあと${12 - imgCount}枚追加してください（推奨: 12〜24枚）`);

    if (data.hasHighRes)    { imgScore += 4; }
    else if (imgCount > 0)  { suggestions.push('1600px以上の高解像度画像を使用するとスコアが上がります'); }

    if (data.hasAllAngles)  { imgScore += 3; }
    else if (imgCount > 0)  { suggestions.push('正面・背面・側面・内側・細部など全角度の撮影を推奨します'); }

    scores.images = Math.min(imgScore, 25);

    // ── 説明文（20点）────────────────────────────────
    // 文字数（200-800）12点 / 構造化 4点 / モバイル最適化 4点
    const descLen = Number(data.descLength) || 0;
    let descScore = 0;

    if      (descLen >= 200 && descLen <= 800) { descScore += 12; }
    else if (descLen > 800)                    { descScore += 8;  suggestions.push('説明文は800文字以内に収めることを推奨します（モバイル最適化）'); }
    else if (descLen >= 100)                   { descScore += 6;  suggestions.push('説明文を200〜800文字に調整してください（現在: ' + descLen + '文字）'); }
    else if (descLen > 0)                      { descScore += 3;  issues.push('説明文が短すぎます（推奨: 200〜800文字）'); }
    else                                       { issues.push('説明文が入力されていません'); }

    if (data.isStructured)       { descScore += 4; }
    else if (descLen > 0)        { suggestions.push('見出し・箇条書きで構造化するとバイヤーに読みやすくなります'); }

    if (data.isMobileOptimized)  { descScore += 4; }
    else if (descLen > 0)        { suggestions.push('1段落3行以内に収めるとモバイルでの可読性が上がります'); }

    scores.description = Math.min(descScore, 20);

    // ── Item Specifics（20点）─────────────────────────
    // 完了率95%以上が満点。総項目数が不明な場合は件数ベース
    const specFilled = Number(data.specCount)  || 0;
    const specTotal  = Number(data.specTotal)  || 0;

    if (specTotal > 0) {
      const pct = specFilled / specTotal;
      if      (pct >= 0.95) { scores.specifics = 20; }
      else if (pct >= 0.85) { scores.specifics = 15; suggestions.push(`Item Specifics完了率を95%以上にしてください（現在: ${Math.round(pct * 100)}%）`); }
      else if (pct >= 0.70) { scores.specifics = 10; issues.push(`Item Specifics完了率が低すぎます（現在: ${Math.round(pct * 100)}%、推奨: 95%以上）`); }
      else if (pct >= 0.50) { scores.specifics = 5;  issues.push('Item Specificsの多くが未入力です'); }
      else                  { scores.specifics = 0;  issues.push('Item Specificsがほとんど未入力です（2026年から必須強化）'); }
    } else {
      // 総数不明：件数ベースで評価
      if      (specFilled >= 15) { scores.specifics = 20; }
      else if (specFilled >= 10) { scores.specifics = 15; suggestions.push('Item Specificsを15項目以上入力することを推奨します（カテゴリ総数を入力すると%で評価できます）'); }
      else if (specFilled >= 6)  { scores.specifics = 10; issues.push('Item Specificsが不足しています（推奨: 15項目以上）'); }
      else if (specFilled >= 1)  { scores.specifics = 5;  issues.push('Item Specificsが大幅に不足しています'); }
      else                       { scores.specifics = 0;  issues.push('Item Specificsが設定されていません（2026年から必須強化）'); }
    }

    // ── VeROリスク（10点）────────────────────────────
    // 非該当: 10点 / 正規認定ディーラー: 8点 / 未証明: 2点
    const isVero = !!brandNorm && VERO_BRANDS.some(b =>
      _norm(b.en) === brandNorm || b.ja.some(j => _norm(j) === brandNorm) ||
      _norm(b.en).includes(brandNorm) || b.ja.some(j => _norm(j).includes(brandNorm))
    );

    if (!brandNorm) {
      scores.vero = 10;
    } else if (isVero) {
      if (data.isAuthorizedDealer) {
        scores.vero = 8;
        suggestions.push(`「${data.brand}」はVeRO登録ブランドです。正規認定ディーラー証明書を出品に必ず添付してください`);
      } else {
        scores.vero = 2;
        issues.push(`「${data.brand}」はVeRO登録ブランドです。正規品の証明（領収書・正規店証明書）を準備してください`);
      }
    } else {
      scores.vero = 10;
    }

    const total = Object.values(scores).reduce((s, v) => s + v, 0);
    return { total, scores, issues, suggestions };
  }

  // ─── 2026年新要件チェック ──────────────────────────

  function _check2026(data) {
    const brandNorm = _norm(data.brand);
    const isVero = !!brandNorm && VERO_BRANDS.some(b =>
      _norm(b.en).includes(brandNorm) || b.ja.some(j => _norm(j).includes(brandNorm))
    );

    return [
      {
        label: 'Item Specifics 必須項目充足',
        desc:  '2026年よりカテゴリ別の必須項目が大幅強化。未入力では出品不可になる可能性があります。',
        pass:  Number(data.specCount) >= 8,
        level: 'critical',
      },
      {
        label: '商品識別子の設定（UPC / EAN / ISBN）',
        desc:  '2026年より新品カテゴリでの商品識別子入力が必須化予定。',
        pass:  !!data.hasIdentifier,
        level: 'critical',
      },
      {
        label: '高解像度画像（推奨: 8枚以上、最低4枚）',
        desc:  '2026年よりカテゴリによっては最低4枚が必須化予定。',
        pass:  Number(data.imageCount) >= 4,
        level: 'critical',
      },
      {
        label: 'タイトルに主要キーワードが含まれている',
        desc:  'ブランド・商品名・状態（New/Used）・型番をタイトルに含めることが推奨されます。',
        pass:  (data.title || '').length >= 40,
        level: 'warning',
      },
      {
        label: '30日以上の返品ポリシーが設定されている',
        desc:  '30日以上の返品ポリシーが競争力と検索順位に影響します。',
        pass:  !!data.hasReturnPolicy,
        level: 'warning',
      },
      {
        label: '商品状態の詳細説明あり',
        desc:  '中古品の場合、状態の詳細説明が義務化される方向です（傷・汚れの開示）。',
        pass:  !!data.conditionDesc,
        level: 'warning',
      },
      {
        label: 'GPSR対応済み（EU向け出品）',
        desc:  '2024年12月施行のEU一般製品安全規則(GPSR)対応。製造者情報・安全警告が必要です。',
        pass:  !!data.gpsrCompliant,
        level: 'info',
      },
      {
        label: '正規品証明の準備（$500以上のVeROブランド品）',
        desc:  '$500超のブランド品は真贋鑑定サービスが必須になる場合があります。領収書・証明書を準備してください。',
        pass:  !(data.price >= 500 && isVero),
        level: 'critical',
      },
    ];
  }

  // ─── UI: オートコンプリート ─────────────────────────

  function _attachAutocomplete(input, onSelect) {
    let dropdown = null;

    function _showDropdown(items) {
      _hideDropdown();
      if (!items.length) return;

      dropdown = document.createElement('div');
      dropdown.style.cssText =
        'position:absolute;left:0;right:0;top:100%;z-index:200;' +
        'background:var(--navy-800);border:1px solid var(--border);border-top:none;' +
        'border-radius:0 0 6px 6px;overflow:hidden;box-shadow:var(--shadow-card)';

      items.forEach((brand, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.textContent = brand;
        const isHistory = _getHistory().includes(brand);
        item.style.cssText =
          'display:flex;align-items:center;width:100%;text-align:left;padding:9px 14px;' +
          'background:none;border:none;border-bottom:1px solid var(--border);' +
          `color:var(--text-secondary);font-family:var(--font-sans);font-size:13px;cursor:pointer;gap:8px`;
        if (isHistory) {
          item.innerHTML = `<span style="font-size:10px;color:var(--text-muted)">履歴</span>${brand}`;
        }
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--gold-hover)'; item.style.color = 'var(--text-primary)'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'none'; item.style.color = 'var(--text-secondary)'; });
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          input.value = brand;
          _addHistory(brand);
          onSelect(brand);
          _hideDropdown();
        });
        dropdown.appendChild(item);
      });

      input.parentElement.style.position = 'relative';
      input.parentElement.appendChild(dropdown);
    }

    function _hideDropdown() {
      if (dropdown) { dropdown.remove(); dropdown = null; }
    }

    input.addEventListener('input', () => {
      _showDropdown(_searchBrands(input.value));
    });
    input.addEventListener('focus', () => {
      if (input.value.length >= 2) _showDropdown(_searchBrands(input.value));
    });
    input.addEventListener('blur', () => {
      setTimeout(_hideDropdown, 150);
    });
    input.addEventListener('keydown', (e) => {
      if (!dropdown) return;
      const items = [...dropdown.querySelectorAll('button')];
      const focused = dropdown.querySelector('button:focus');
      const idx = items.indexOf(focused);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] || items[0])?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (items[idx - 1] || items[items.length - 1])?.focus(); }
      else if (e.key === 'Escape') { _hideDropdown(); }
    });
  }

  // ─── UI: スコアリング ──────────────────────────────

  function _scoreColor(score) {
    if (score >= 80) return 'var(--green)';
    if (score >= 55) return 'var(--yellow)';
    return 'var(--red)';
  }

  function _scoreLabel(score) {
    if (score >= 80) return '高品質';
    if (score >= 55) return '標準';
    return '要改善';
  }

  function _renderScoreRing(score) {
    const color = _scoreColor(score);
    const dash  = Math.round((score / 100) * 283);
    return `
      <div style="position:relative;width:110px;height:110px;flex-shrink:0">
        <svg width="110" height="110" viewBox="0 0 110 110" style="transform:rotate(-90deg)">
          <circle cx="55" cy="55" r="45" fill="none" stroke="var(--navy-600)" stroke-width="8"/>
          <circle cx="55" cy="55" r="45" fill="none" stroke="${color}" stroke-width="8"
            stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="${283 - dash}"
            style="transition:stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <span style="font-family:var(--font-sans);font-size:26px;font-weight:600;color:${color};line-height:1;font-variant-numeric:tabular-nums">${score}</span>
          <span style="font-size:11px;color:var(--text-muted);margin-top:2px">${_scoreLabel(score)}</span>
        </div>
      </div>`;
  }

  function _renderSubScores(scores) {
    const labels = { title: 'タイトル', images: '画像', description: '説明文', specifics: 'Item Specifics', vero: 'VeROリスク' };
    const maxes  = { title: 25, images: 25, description: 20, specifics: 20, vero: 10 };
    return Object.entries(scores).map(([key, val]) => {
      const pct   = Math.round((val / maxes[key]) * 100);
      const color = _scoreColor(pct);
      return `
        <div style="margin-bottom:var(--space-2)">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-1)">
            <span style="font-size:13px;color:var(--text-secondary)">${labels[key]}</span>
            <span style="font-size:13px;font-weight:600;color:${color};font-variant-numeric:tabular-nums">${val}/${maxes[key]}</span>
          </div>
          <div class="meter"><div class="meter-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
    }).join('');
  }

  // ─── UI: 2026年チェックリスト ──────────────────────

  function _renderChecklist(checks) {
    const icon  = { critical: '⚠', warning: '○', info: 'ℹ' };
    const color = { critical: 'var(--red)', warning: 'var(--yellow)', info: 'var(--blue)' };
    return checks.map(c => `
      <div style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-3) 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;flex-shrink:0;margin-top:1px;color:${c.pass ? 'var(--green)' : color[c.level]}">${c.pass ? '✓' : icon[c.level]}</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:${c.pass ? 'var(--green)' : color[c.level]}">${c.label}</div>
          ${!c.pass ? `<div class="note" style="margin-top:var(--space-1)">${c.desc}</div>` : ''}
        </div>
      </div>`).join('');
  }

  // ─── メイン描画 ───────────────────────────────────

  function _render(root) {
    root.innerHTML = `
      <div class="grid-12">

        <!-- 左: 入力フォーム（6span） -->
        <div class="col col-6">
        <div class="card card--form">
          <div class="card-title">リスティング情報を入力</div>

          <div class="input-group" style="margin-bottom:var(--space-4)">
            <label class="input-label">タイトル（英語）</label>
            <input type="text" id="lq-title" class="input"
              placeholder="例: Louis Vuitton Neverfull MM Monogram Tote Bag Used Authentic">
            <div class="note" style="display:flex;justify-content:space-between;margin-top:var(--space-1);font-variant-numeric:tabular-nums">
              <span><span id="lq-title-count">0</span>/80文字（推奨: 75〜80）</span>
              <span><span id="lq-word-count">0</span>語（推奨: 15〜18語）</span>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div class="input-group">
              <label class="input-label">ブランド名</label>
              <div style="position:relative">
                <input type="text" id="lq-brand" class="input"
                  placeholder="ルイヴィトン / Lou / LV"
                  autocomplete="off">
              </div>
              <div class="note" style="margin-top:var(--space-1)">
                大文字小文字・スペース不問・カタカナ可・スペルミスOK
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">販売価格（USD）</label>
              <input type="number" id="lq-price" class="input" placeholder="0.00" min="0" step="0.01">
            </div>
          </div>

          <!-- 画像 -->
          <div class="input-group" style="margin-bottom:var(--space-1)">
            <label class="input-label">画像枚数（最大24枚）</label>
            <input type="number" id="lq-images" class="input" placeholder="0" min="0" max="24">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:var(--space-4)">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-highres" style="accent-color:var(--gold-400)">
              1600px以上の高解像度
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-angles" style="accent-color:var(--gold-400)">
              全角度撮影済み
            </label>
          </div>

          <!-- Item Specifics -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div class="input-group">
              <label class="input-label">Item Specifics 入力数</label>
              <input type="number" id="lq-specs" class="input" placeholder="0" min="0">
            </div>
            <div class="input-group">
              <label class="input-label">カテゴリ総項目数（任意）</label>
              <input type="number" id="lq-specs-total" class="input" placeholder="入力で%計算">
              <div class="note" style="margin-top:var(--space-1)">入力すると完了率95%で評価</div>
            </div>
          </div>

          <!-- 説明文 -->
          <div class="input-group" style="margin-bottom:var(--space-1)">
            <label class="input-label">説明文の文字数（推奨: 200〜800）</label>
            <input type="number" id="lq-desc" class="input" placeholder="0" min="0">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:var(--space-4)">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-structured" style="accent-color:var(--gold-400)">
              構造化済み（見出し・箇条書き）
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-mobile" style="accent-color:var(--gold-400)">
              モバイル最適化（短段落）
            </label>
          </div>

          <!-- VeRO・その他 -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:var(--space-5)">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-authorized" style="accent-color:var(--gold-400)">
              正規認定ディーラー
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-identifier" style="accent-color:var(--gold-400)">
              商品識別子あり（UPC/EAN）
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-return" style="accent-color:var(--gold-400)">
              30日返品ポリシーあり
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-condition" style="accent-color:var(--gold-400)">
              状態詳細説明あり
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:13px;color:var(--text-secondary)">
              <input type="checkbox" id="lq-gpsr" style="accent-color:var(--gold-400)">
              GPSR対応済み（EU向け）
            </label>
          </div>

          <button class="btn btn-primary" id="lq-check">品質をチェック</button>
        </div>
        </div>

        <!-- 右: 結果（6span） -->
        <div class="col col-6">
        <div id="lq-result">
          <div class="card" style="display:flex;align-items:center;justify-content:center;min-height:400px">
            <div class="note" style="text-align:center;line-height:1.8;text-wrap:balance">
              左のフォームに入力して「品質をチェック」を押してください
            </div>
          </div>
        </div>
        </div>

      </div>
    `;

    // タイトル文字数・単語数カウント
    const titleInput = root.querySelector('#lq-title');
    const titleCount = root.querySelector('#lq-title-count');
    const wordCount  = root.querySelector('#lq-word-count');
    titleInput.addEventListener('input', () => {
      const len   = titleInput.value.length;
      const words = titleInput.value.trim().split(/\s+/).filter(Boolean).length;
      titleCount.textContent = len;
      wordCount.textContent  = words;
      titleCount.style.color = (len >= 75 && len <= 80) ? 'var(--green)' : (len > 80 ? 'var(--red)' : 'var(--text-muted)');
      wordCount.style.color  = (words >= 15 && words <= 18) ? 'var(--green)' : 'var(--text-muted)';
    });

    // ブランド名オートコンプリート
    _attachAutocomplete(root.querySelector('#lq-brand'), () => {});

    // チェック実行
    root.querySelector('#lq-check').addEventListener('click', () => {
      const data = {
        title:              titleInput.value.trim(),
        brand:              root.querySelector('#lq-brand').value.trim(),
        imageCount:         root.querySelector('#lq-images').value,
        hasHighRes:         root.querySelector('#lq-highres').checked,
        hasAllAngles:       root.querySelector('#lq-angles').checked,
        descLength:         root.querySelector('#lq-desc').value,
        isStructured:       root.querySelector('#lq-structured').checked,
        isMobileOptimized:  root.querySelector('#lq-mobile').checked,
        specCount:          root.querySelector('#lq-specs').value,
        specTotal:          root.querySelector('#lq-specs-total').value,
        price:              Number(root.querySelector('#lq-price').value) || 0,
        isAuthorizedDealer: root.querySelector('#lq-authorized').checked,
        hasIdentifier:      root.querySelector('#lq-identifier').checked,
        hasReturnPolicy:    root.querySelector('#lq-return').checked,
        conditionDesc:      root.querySelector('#lq-condition').checked,
        gpsrCompliant:      root.querySelector('#lq-gpsr').checked,
      };

      const { total, scores, issues, suggestions } = _calcScore(data);
      const checks    = _check2026(data);
      const passCount = checks.filter(c => c.pass).length;

      root.querySelector('#lq-result').innerHTML = `
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card-title">品質スコア</div>
          <div style="display:flex;align-items:center;gap:var(--space-5);margin-bottom:${(issues.length || suggestions.length) ? 'var(--space-4)' : '0'}">
            ${_renderScoreRing(total)}
            <div style="flex:1">${_renderSubScores(scores)}</div>
          </div>
          ${issues.map(i => `
            <div style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-2) 0;border-top:1px solid var(--border);font-size:13px">
              <span style="color:var(--red);flex-shrink:0">✗</span>
              <span style="color:var(--text-secondary);text-wrap:balance">${i}</span>
            </div>`).join('')}
          ${suggestions.map(s => `
            <div style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-2) 0;border-top:1px solid var(--border);font-size:13px">
              <span style="color:var(--yellow);flex-shrink:0">→</span>
              <span style="color:var(--text-secondary);text-wrap:balance">${s}</span>
            </div>`).join('')}
          ${!issues.length && !suggestions.length ? `
            <div style="color:var(--green);font-size:13px;text-align:center;padding:var(--space-2) 0;border-top:1px solid var(--border)">
              すべての品質要件を満たしています ✓
            </div>` : ''}
        </div>

        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:var(--space-2)">
            <div class="card-title" style="margin:0">2026年 eBay 新要件チェック</div>
            <span class="tag ${passCount === checks.length ? 'go' : 'caution'}" style="font-variant-numeric:tabular-nums">${passCount}/${checks.length} クリア</span>
          </div>
          <div style="margin-top:var(--space-2)">${_renderChecklist(checks)}</div>
        </div>
      `;
    });
  }

  // ─── 公開API ─────────────────────────────────────

  window.BA.listingQuality = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'listing-quality') return;
        const root = document.getElementById('listing-quality-root');
        if (root) _render(root);
      });
    },
    // auto-listing.js からリアルタイムスコアリングに使用
    score(data) {
      const result = _calcScore(data);
      return { ...result, checks: _check2026(data) };
    },
    // ブランドオートコンプリートを外部フォームにアタッチ
    attachAutocomplete(inputEl, onSelect) {
      _attachAutocomplete(inputEl, onSelect || (() => {}));
    },
  };

})();
