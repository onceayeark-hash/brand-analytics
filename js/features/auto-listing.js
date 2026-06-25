// @not-security-critical （2026-06-26・DeepL APIキーのlocalStorage読み取り/送信コードを撤去しClaude APIに置換済み）
/**
 * BRAND ANALYTICS — auto-listing.js
 * 自動出品フォーム + リアルタイムリスティング品質スコア統合（STAGE2 MVP）
 *
 * - 引用元URL（eBay / ヤフオク / 楽天）→ サイト自動判別 → フィールド補完
 * - Claude API: 日本語タイトル → 英語タイトル生成（Edge Function 経由・DeepLは廃止済み）
 * - ドラッグ&ドロップ画像（最大12枚・並び替え）
 * - BA.listingQuality.score() をリアルタイム呼び出し（入力内容から自動判定）
 * - $500境界ルール自動適用
 * - 下書き保存（Supabase draft_listings テーブル）
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─── 定数 ─────────────────────────────────────────
  const MAX_IMAGES       = 24;
  const SCORE_DEBOUNCE   = 600;
  const FVF_DEFAULT      = 0.1325;
  const PAYONEER_RATE    = 0.02;
  const AUTH_SERVICE_JPY = 1500;
  const BOUNDARY_USD     = 500;

  const SITE_META = {
    ebay:    { label: 'eBay',    color: '#e53238' },
    yahoo:   { label: 'ヤフオク', color: '#e60026' },
    rakuten: { label: '楽天市場', color: '#bf0000' },
    other:   { label: 'その他',  color: 'var(--text-muted)' },
  };

  // ─── モジュール状態 ───────────────────────────────
  let _state = _defaultState();

  function _defaultState() {
    return {
      draftId:            null,
      sourceUrl:          '',
      sourceSite:         '',
      titleJa:            '',
      titleEn:            '',
      categoryId:         '',
      categoryName:       '',
      sku:                '',
      images:             [],
      dragIdx:            null,
      condition:          'New',
      brand:              '',
      weightG:            null,
      upc:                '',
      isAuthorizedDealer: false,
      gpsrCompliant:      false,
      hasReturnPolicy:    true,
      costJpy:            null,
      priceUsd:           null,
      targetMargin:       25,
      bestOffer:          false,
      bestOfferMin:       null,
      isPrivate:          false,
      descEn:             '',
      conditionDesc:      '',
      qualityScore:       0,
    };
  }

  function _genSku() {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    return `BA-${ymd}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── 引用元URL判別 ────────────────────────────────
  function _detectSite(url) {
    if (/ebay\.com/i.test(url))                     return 'ebay';
    if (/yahoo\.co\.jp|auctions\.yahoo/i.test(url)) return 'yahoo';
    if (/rakuten\.co\.jp/i.test(url))               return 'rakuten';
    return 'other';
  }

  function _parseEbayItemId(url) {
    const m = url.match(/\/itm\/(?:[^/?]+\/)?(\d{10,13})/);
    return m ? m[1] : null;
  }

  // ─── 送料ポリシー自動選択 ─────────────────────────
  function _shippingLabel(g) {
    if (!g || g <= 0) return '（重量を入力すると自動選択）';
    if (g <= 100)  return '0〜0.1kg ポリシー';
    if (g <= 300)  return '0.1〜0.3kg ポリシー';
    if (g <= 400)  return '0.3〜0.4kg ポリシー';
    if (g <= 500)  return '0.4〜0.5kg ポリシー';
    if (g <= 700)  return '0.5〜0.7kg ポリシー';
    if (g <= 1000) return '0.7〜1.0kg ポリシー';
    return '1.0kg超（要個別確認）';
  }

  // ─── 価格計算 ─────────────────────────────────────
  function _getFx() {
    try {
      return (typeof window.BA.profit?.getRate === 'function')
        ? (window.BA.profit.getRate() || 150) : 150;
    } catch { return 150; }
  }

  function _calcRecommendedPrice() {
    const cost = _state.costJpy || 0;
    if (!cost) return 0;
    const fx        = _getFx();
    const margin    = (_state.targetMargin || 25) / 100;
    const costUsd   = cost / fx;
    const deduction = FVF_DEFAULT + PAYONEER_RATE + margin;
    return deduction >= 1 ? 0 : costUsd / (1 - deduction);
  }

  function _calcProfit(priceUsd) {
    if (!priceUsd || priceUsd <= 0) return null;
    const fx       = _getFx();
    const cost     = _state.costJpy || 0;
    const above500 = priceUsd >= BOUNDARY_USD;
    const netUsd   = priceUsd - (priceUsd * FVF_DEFAULT) - (priceUsd * PAYONEER_RATE);
    return Math.round(netUsd * fx) - cost - (above500 ? AUTH_SERVICE_JPY : 0);
  }

  // ─── スコアデータ自動導出 ─────────────────────────
  function _buildScoreData() {
    const desc  = _state.descEn || '';
    const plain = desc.replace(/<[^>]+>/g, '').trim();

    const isStructured     = /<(h[2-6]|ul|ol|li)\b/i.test(desc);
    const paras            = desc.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const isMobileOptimized = paras.length === 0 ||
      paras.every(p => p.replace(/<[^>]+>/g, '').length <= 150);

    return {
      title:              _state.titleEn,
      brand:              _state.brand,
      imageCount:         _state.images.length,
      hasHighRes:         _state.images.length >= 4,
      hasAllAngles:       _state.images.length >= 6,
      descLength:         plain.length,
      isStructured,
      isMobileOptimized,
      specCount:          0,
      specTotal:          20,
      price:              _state.priceUsd || 0,
      isAuthorizedDealer: _state.isAuthorizedDealer,
      hasIdentifier:      !!(_state.upc && _state.upc.trim()),
      hasReturnPolicy:    _state.hasReturnPolicy,
      conditionDesc:      (_state.conditionDesc || '').trim().length >= 10,
      gpsrCompliant:      _state.gpsrCompliant,
    };
  }

  // ─── デバウンス ───────────────────────────────────
  function _debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  const _debouncedScore = _debounce((root) => {
    if (!window.BA.listingQuality?.score) return;
    const result = window.BA.listingQuality.score(_buildScoreData());
    _state.qualityScore = result.total;
    _renderScore(root, result);
  }, SCORE_DEBOUNCE);

  // ─── 画像サムネイル生成 ───────────────────────────
  async function _toThumb(file) {
    return new Promise(resolve => {
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const MAX = 300;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width  * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve({ name: file.name, size: file.size, thumb: c.toDataURL('image/jpeg', 0.75), blobUrl });
      };
      img.onerror = () => resolve({ name: file.name, size: file.size, thumb: '', blobUrl });
      img.src = blobUrl;
    });
  }

  async function _addFiles(fileList, root) {
    const slots = MAX_IMAGES - _state.images.length;
    if (slots <= 0) return;
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/')).slice(0, slots);
    const res = await Promise.allSettled(files.map(f => _toThumb(f)));
    res.forEach(r => { if (r.status === 'fulfilled') _state.images.push(r.value); });
    _renderImageGrid(root);
    _debouncedScore(root);
  }

  // ─── タイトル翻訳（Claude API） ───────────────────
  async function _translate(text) {
    const result = await BA.claude.call(
      'title',
      `次の日本語の商品タイトルを、eBayの検索アルゴリズム（Cassini）に適した英語の商品タイトルに翻訳してください。\n` +
      `80文字以内・キーワードの自然な配置を意識し、翻訳結果のタイトル文字列のみを返してください（説明・前置き不要）。\n\n` +
      `日本語タイトル: ${text}`
    );
    return (result.text || '').trim().replace(/^["「]|["」]$/g, '');
  }

  // ─── 下書き保存 ───────────────────────────────────
  async function _saveDraft() {
    const sb = window.BA.auth?.getSupabase?.();
    if (!sb) { window.BA.notify?.toast('Supabase未接続', 'error'); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { window.BA.notify?.toast('ログインが必要です', 'error'); return; }

    const payload = {
      user_id:        user.id,
      title_ja:       _state.titleJa,
      title_en:       _state.titleEn,
      source_url:     _state.sourceUrl,
      source_site:    _state.sourceSite,
      category_id:    _state.categoryId,
      sku:            _state.sku,
      brand:          _state.brand,
      condition:      _state.condition,
      weight_g:       _state.weightG,
      images_json:    _state.images.map(i => ({ name: i.name, size: i.size, thumb: i.thumb })),
      price_usd:      _state.priceUsd,
      cost_jpy:       _state.costJpy,
      target_margin:  _state.targetMargin,
      desc_en:        _state.descEn,
      condition_desc: _state.conditionDesc,
      settings_json: {
        bestOffer:          _state.bestOffer,
        bestOfferMin:       _state.bestOfferMin,
        isPrivate:          _state.isPrivate,
        upc:                _state.upc,
        isAuthorizedDealer: _state.isAuthorizedDealer,
        gpsrCompliant:      _state.gpsrCompliant,
        hasReturnPolicy:    _state.hasReturnPolicy,
      },
      quality_score:  _state.qualityScore,
      updated_at:     new Date().toISOString(),
    };

    const ops = _state.draftId
      ? [sb.from('draft_listings').update(payload).eq('id', _state.draftId)]
      : [sb.from('draft_listings').insert(payload).select('id').single()];

    const [res] = await Promise.allSettled(ops);
    if (res.status === 'fulfilled' && !res.value.error) {
      if (!_state.draftId) _state.draftId = res.value.data?.id ?? null;
      window.BA.notify?.toast('下書きを保存しました', 'success');
    } else {
      const msg = res.status === 'rejected' ? res.reason.message : res.value.error.message;
      window.BA.notify?.toast(`保存失敗: ${msg}`, 'error');
    }
  }

  // ─── スコア表示 ───────────────────────────────────
  function _renderScore(root, result) {
    const el = root.querySelector('#al-score-panel');
    if (!el) return;
    const { total, scores, issues, suggestions, checks } = result;
    const passCount = (checks || []).filter(c => c.pass).length;
    const color = total >= 80 ? 'var(--green)' : total >= 55 ? 'var(--yellow)' : 'var(--red)';
    const circ  = Math.round(2 * Math.PI * 26);

    const SUB_LABELS = { title: 'タイトル', images: '画像', description: '説明文', specs: 'スペック', trust: '信頼性' };
    const SUB_MAX    = { title: 25, images: 25, description: 20, specs: 20, trust: 10 };

    const subRows = Object.entries(scores || {}).map(([k, v]) => {
      const max = SUB_MAX[k] || 20;
      const pct = Math.round((v / max) * 100);
      const bc  = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <span style="width:52px;font-size:11px;color:var(--text-muted);flex-shrink:0">${SUB_LABELS[k]||k}</span>
        <div style="flex:1;height:4px;background:var(--border);border-radius:2px">
          <div style="width:${pct}%;height:100%;background:${bc};border-radius:2px;transition:width .4s"></div>
        </div>
        <span style="width:32px;text-align:right;font-family:var(--font-mono);font-size:11px;color:${bc}">${v}/${max}</span>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
        <div style="position:relative;width:64px;height:64px;flex-shrink:0">
          <svg viewBox="0 0 64 64" style="width:64px;height:64px;transform:rotate(-90deg)">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" stroke-width="6"/>
            <circle cx="32" cy="32" r="26" fill="none" stroke="${color}" stroke-width="6"
              stroke-dasharray="${circ}" stroke-dashoffset="${Math.round(circ*(1-total/100))}"
              style="transition:stroke-dashoffset .5s"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
            font-family:var(--font-mono);font-size:18px;font-weight:700;color:${color}">${total}</div>
        </div>
        <div style="flex:1">${subRows}</div>
      </div>
      ${issues.map(i => `
        <div style="display:flex;gap:7px;padding:5px 0;border-top:1px solid var(--border);font-size:11px">
          <span style="color:var(--red);flex-shrink:0">✗</span>
          <span style="color:var(--text-secondary)">${i}</span>
        </div>`).join('')}
      ${suggestions.map(s => `
        <div style="display:flex;gap:7px;padding:5px 0;border-top:1px solid var(--border);font-size:11px">
          <span style="color:var(--yellow);flex-shrink:0">→</span>
          <span style="color:var(--text-secondary)">${s}</span>
        </div>`).join('')}
      ${!issues.length && !suggestions.length && total > 0 ? `
        <div style="color:var(--green);font-size:11px;text-align:center;padding:7px 0;border-top:1px solid var(--border)">
          すべての品質要件を満たしています ✓
        </div>` : ''}
      ${checks?.length ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:11px;font-weight:600;color:var(--text-primary)">2026年新要件</span>
            <span style="font-family:var(--font-mono);font-size:10px;color:${passCount===checks.length?'var(--green)':'var(--yellow)'}">${passCount}/${checks.length}</span>
          </div>
          ${checks.map(c => `
            <div style="display:flex;gap:5px;padding:3px 0;font-size:11px;color:var(--text-secondary)">
              <span style="color:${c.pass?'var(--green)':'var(--red)'};flex-shrink:0">${c.pass?'✓':'✗'}</span>
              <span>${c.label}</span>
            </div>`).join('')}
        </div>` : ''}`;
  }

  // ─── 画像グリッド描画 ────────────────────────────
  function _renderImageGrid(root) {
    const grid = root.querySelector('#al-image-grid');
    if (!grid) return;
    const thumbs = _state.images.map((img, i) => `
      <div class="al-thumb" draggable="true" data-idx="${i}"
        style="position:relative;cursor:grab;border:2px solid var(--border);border-radius:6px;
          overflow:hidden;aspect-ratio:1/1;background:var(--bg-card)">
        <img src="${_esc(img.thumb || img.blobUrl)}" alt="${_esc(img.name)}"
          style="width:100%;height:100%;object-fit:cover;pointer-events:none">
        <button type="button" data-rm="${i}"
          style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;
            background:rgba(0,0,0,.75);border:none;color:#fff;font-size:11px;cursor:pointer;
            display:flex;align-items:center;justify-content:center;line-height:1">×</button>
        ${i===0?'<div style="position:absolute;bottom:0;left:0;right:0;background:var(--gold-400);color:#000;font-size:9px;text-align:center;padding:1px 0;font-weight:700;letter-spacing:.5px">MAIN</div>':''}
      </div>`).join('');

    const addBtn = _state.images.length < MAX_IMAGES ? `
      <label style="display:flex;flex-direction:column;align-items:center;justify-content:center;
        aspect-ratio:1/1;border:2px dashed var(--border);border-radius:6px;cursor:pointer;
        color:var(--text-muted);font-size:11px;gap:3px;transition:border-color .2s" id="al-add-label">
        <span style="font-size:20px;line-height:1">+</span>追加
        <input type="file" accept="image/*" multiple hidden id="al-add-input">
      </label>` : '';

    grid.innerHTML = thumbs + addBtn;
  }

  // ─── 価格サマリー更新 ─────────────────────────────
  function _updatePriceSummary(root) {
    const summary = root.querySelector('#al-price-summary');
    const notice  = root.querySelector('#al-boundary-notice');
    if (!summary) return;

    const price = _state.priceUsd;
    const cost  = _state.costJpy;

    if (!price && cost) {
      const rec = _calcRecommendedPrice();
      summary.innerHTML = rec > 0
        ? `<span style="color:var(--text-muted)">推奨販売価格（利益率${_state.targetMargin}%）:</span>
           <span style="font-family:var(--font-mono);color:var(--gold-400);font-weight:700">$${rec.toFixed(2)}</span>
           <span style="color:var(--text-muted);font-size:11px">（手入力で上書き可）</span>`
        : `<span style="color:var(--text-muted)">仕入価格・利益率を設定してください</span>`;
      if (notice) notice.textContent = '';
      return;
    }

    if (!price) {
      summary.innerHTML = `<span style="color:var(--text-muted)">価格・利益を入力すると計算結果が表示されます</span>`;
      if (notice) notice.textContent = '';
      return;
    }

    const profit   = _calcProfit(price);
    const above500 = price >= BOUNDARY_USD;
    const pc       = profit !== null ? (profit > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)';

    summary.innerHTML = `
      <span style="color:var(--text-muted)">eBay手数料 ${(FVF_DEFAULT*100).toFixed(2)}%:</span>
      <span style="font-family:var(--font-mono)">-$${(price*FVF_DEFAULT).toFixed(2)}</span>
      <span style="color:var(--text-muted)">Payoneer 2%:</span>
      <span style="font-family:var(--font-mono)">-$${(price*PAYONEER_RATE).toFixed(2)}</span>
      ${above500?`<span style="color:var(--text-muted)">真贋サービス:</span><span style="font-family:var(--font-mono)">-¥${AUTH_SERVICE_JPY.toLocaleString()}</span>`:''}
      <span style="color:var(--text-muted)">推定利益:</span>
      <span style="font-family:var(--font-mono);font-weight:700;color:${pc}">${profit!==null?'¥'+profit.toLocaleString():'—'}</span>`;

    if (notice) {
      notice.textContent = above500
        ? `$500以上: 国際送料・関税 = $0（バイヤー負担）/ 真贋サービス送料 ¥${AUTH_SERVICE_JPY.toLocaleString()} 自動適用`
        : '$500未満: 送料・関税は別途出品設定で指定してください';
      notice.style.color = above500 ? 'var(--yellow)' : 'var(--text-muted)';
    }
  }

  // ─── 説明文ヒント更新 ────────────────────────────
  function _updateDescHints(root, desc) {
    const plain = desc.replace(/<[^>]+>/g, '');
    const lenEl = root.querySelector('#al-desc-len');
    if (lenEl) lenEl.textContent = `${plain.length}文字`;

    const isStructured = /<(h[2-6]|ul|ol|li)\b/i.test(desc);
    const paras = desc.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const isMobile = paras.length === 0 || paras.every(p => p.replace(/<[^>]+>/g,'').length <= 150);

    const sh = root.querySelector('#al-structured-hint');
    if (sh) sh.innerHTML = isStructured
      ? '<span style="color:var(--green)">構造化 ✓</span>'
      : '<span style="color:var(--text-muted)">構造化なし（H2/UL/LI使用でスコアアップ）</span>';

    const mh = root.querySelector('#al-mobile-hint');
    if (mh) mh.innerHTML = isMobile
      ? '<span style="color:var(--green)">モバイル最適化 ✓</span>'
      : '<span style="color:var(--yellow)">段落が長め（1段落150文字以内推奨）</span>';
  }

  // ─── メインHTML描画 ───────────────────────────────
  function _render(root) {
    if (!_state.sku) _state.sku = _genSku();

    root.innerHTML = `
    <style>
      #auto-listing-root .al-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #auto-listing-root .al-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
      #auto-listing-root .al-lbl{display:block;font-size:11px;font-weight:600;color:var(--text-muted);
        letter-spacing:.04em;text-transform:uppercase;margin-bottom:5px}
      #auto-listing-root .al-crow{display:flex;gap:20px;flex-wrap:wrap}
      #auto-listing-root .al-clbl{display:flex;align-items:center;gap:7px;cursor:pointer;
        font-size:13px;color:var(--text-secondary)}
      @media(max-width:720px){
        #auto-listing-root .al-main{grid-template-columns:1fr!important}
        #auto-listing-root .al-g2,
        #auto-listing-root .al-g3{grid-template-columns:1fr!important}
        #auto-listing-root .al-sticky{position:static!important}
      }
    </style>

    <div class="al-main" style="display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start">

      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- S1: 引用元 & 基本情報 -->
        <div class="card">
          <div class="card-title">① 引用元 &amp; 基本情報</div>

          <div style="margin-bottom:12px">
            <label class="al-lbl">引用元URL（eBay / ヤフオク / 楽天）</label>
            <div style="display:flex;gap:8px">
              <input id="al-source-url" type="url" class="form-input" placeholder="https://..." value="${_esc(_state.sourceUrl)}" style="flex:1">
              <div id="al-site-badge" style="display:flex;align-items:center;padding:0 10px;border-radius:4px;
                font-size:11px;font-weight:700;background:var(--bg-input);min-width:64px;
                justify-content:center;color:var(--text-muted);white-space:nowrap">未入力</div>
            </div>
            <div id="al-source-hint" style="font-size:11px;color:var(--text-muted);margin-top:4px"></div>
          </div>

          <div style="margin-bottom:12px">
            <label class="al-lbl">商品タイトル（日本語）</label>
            <input id="al-title-ja" type="text" class="form-input" maxlength="100"
              placeholder="例: ナイキ エアフォース1 ホワイト 28cm 新品タグ付き" value="${_esc(_state.titleJa)}">
          </div>

          <div style="margin-bottom:12px">
            <label class="al-lbl">
              英語タイトル <span style="color:var(--red);text-transform:none;font-weight:400">必須</span>
              &nbsp;<span id="al-title-en-count" style="font-family:var(--font-mono);color:var(--text-muted);font-weight:400">${_state.titleEn.length}/80</span>
            </label>
            <div style="display:flex;gap:8px">
              <input id="al-title-en" type="text" class="form-input" maxlength="80" style="flex:1"
                placeholder="例: Nike Air Force 1 White Men US10 New with Tags Japan"
                value="${_esc(_state.titleEn)}">
              <button id="al-translate-btn" type="button" class="btn-secondary"
                style="white-space:nowrap;padding:0 12px">翻訳</button>
            </div>
            <div id="al-translate-status" style="font-size:11px;color:var(--text-muted);margin-top:4px"></div>
          </div>

          <div class="al-g2">
            <div>
              <label class="al-lbl">カテゴリー</label>
              <div style="display:flex;gap:6px">
                <input id="al-category-name" type="text" class="form-input"
                  placeholder="例: T-Shirts" value="${_esc(_state.categoryName)}" style="flex:1">
                <input id="al-category-id" type="text" class="form-input"
                  placeholder="ID" value="${_esc(_state.categoryId)}"
                  style="width:68px;font-family:var(--font-mono);font-size:12px">
              </div>
            </div>
            <div>
              <label class="al-lbl">SKU</label>
              <input id="al-sku" type="text" class="form-input" value="${_esc(_state.sku)}">
            </div>
          </div>
        </div>

        <!-- S2: 画像 -->
        <div class="card">
          <div class="card-title">② 画像
            <span style="font-weight:400;font-size:11px;color:var(--text-muted)">
              最大${MAX_IMAGES}枚・ドラッグで並び替え・先頭がメイン画像
            </span>
          </div>
          <div id="al-drop-zone" style="border:2px dashed var(--border);border-radius:8px;padding:28px;
            text-align:center;color:var(--text-muted);font-size:12px;margin-bottom:12px;
            cursor:pointer;transition:border-color .2s,background .2s">
            ここにドラッグ&amp;ドロップ、またはクリックして追加
            <input id="al-drop-input" type="file" accept="image/*" multiple hidden>
          </div>
          <div id="al-image-grid"
            style="display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px"></div>
        </div>

        <!-- S3: 商品詳細 -->
        <div class="card">
          <div class="card-title">③ 商品詳細</div>
          <div class="al-g2" style="margin-bottom:12px">
            <div>
              <label class="al-lbl">状態</label>
              <select id="al-condition" class="form-input">
                <option value="New"${_state.condition==='New'?' selected':''}>New（新品）</option>
                <option value="New with tags"${_state.condition==='New with tags'?' selected':''}>New with tags</option>
                <option value="New without tags"${_state.condition==='New without tags'?' selected':''}>New without tags</option>
                <option value="Used"${_state.condition==='Used'?' selected':''}>Used（中古）</option>
                <option value="Refurbished"${_state.condition==='Refurbished'?' selected':''}>Refurbished</option>
              </select>
            </div>
            <div>
              <label class="al-lbl">ブランド</label>
              <input id="al-brand" type="text" class="form-input"
                placeholder="例: Nike" value="${_esc(_state.brand)}" autocomplete="off">
            </div>
          </div>
          <div class="al-g2" style="margin-bottom:12px">
            <div>
              <label class="al-lbl">商品重量（g）</label>
              <input id="al-weight" type="number" class="form-input"
                placeholder="例: 350" min="1" value="${_state.weightG||''}">
              <div id="al-shipping-policy"
                style="font-size:11px;color:var(--gold-400);margin-top:4px">${_shippingLabel(_state.weightG)}</div>
            </div>
            <div>
              <label class="al-lbl">UPC / EAN</label>
              <input id="al-upc" type="text" class="form-input"
                placeholder="例: 0123456789012 / Does not apply"
                value="${_esc(_state.upc)}">
            </div>
          </div>
          <div class="al-crow">
            <label class="al-clbl">
              <input id="al-authorized" type="checkbox"${_state.isAuthorizedDealer?' checked':''}
                style="accent-color:var(--gold-400)">
              正規認定ディーラー
            </label>
            <label class="al-clbl">
              <input id="al-gpsr" type="checkbox"${_state.gpsrCompliant?' checked':''}
                style="accent-color:var(--gold-400)">
              GPSR対応済み（EU向け）
            </label>
            <label class="al-clbl">
              <input id="al-return-policy" type="checkbox"${_state.hasReturnPolicy?' checked':''}
                style="accent-color:var(--gold-400)">
              30日返品ポリシーあり
            </label>
          </div>
        </div>

        <!-- S4: 価格計算 -->
        <div class="card">
          <div class="card-title">④ 価格計算</div>
          <div class="al-g3" style="margin-bottom:12px">
            <div>
              <label class="al-lbl">仕入価格（円）</label>
              <input id="al-cost-jpy" type="number" class="form-input"
                placeholder="例: 8000" min="0" value="${_state.costJpy||''}">
            </div>
            <div>
              <label class="al-lbl">目標利益率（%）</label>
              <input id="al-margin" type="number" class="form-input"
                value="${_state.targetMargin}" min="0" max="90">
            </div>
            <div>
              <label class="al-lbl">販売価格（USD）</label>
              <input id="al-price-usd" type="number" class="form-input"
                placeholder="自動計算 or 手動" min="0" step="0.01"
                value="${_state.priceUsd||''}">
            </div>
          </div>
          <div id="al-price-summary"
            style="background:var(--bg-input);border-radius:6px;padding:11px 14px;
              font-size:12px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
            <span style="color:var(--text-muted)">価格・利益を入力すると計算結果が表示されます</span>
          </div>
          <div id="al-boundary-notice" style="margin-top:7px;font-size:11px"></div>
        </div>

        <!-- S5: 説明文 -->
        <div class="card">
          <div class="card-title">⑤ 説明文
            <span style="font-weight:400;font-size:11px;color:var(--text-muted)">英語・必須</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            <button type="button" class="al-fmt btn-secondary" data-tag="h2"
              style="padding:3px 8px;font-size:11px">H2</button>
            <button type="button" class="al-fmt btn-secondary" data-tag="ul"
              style="padding:3px 8px;font-size:11px">UL</button>
            <button type="button" class="al-fmt btn-secondary" data-tag="li"
              style="padding:3px 8px;font-size:11px">LI</button>
            <button type="button" class="al-fmt btn-secondary" data-tag="p"
              style="padding:3px 8px;font-size:11px">P</button>
            <button type="button" id="al-tmpl-btn" class="btn-secondary"
              style="padding:3px 8px;font-size:11px;margin-left:8px">テンプレ挿入</button>
          </div>
          <textarea id="al-desc-en" class="form-input" rows="9"
            placeholder="英語説明文（HTML可）&#10;例: &lt;h2&gt;Product Description&lt;/h2&gt;&lt;p&gt;...&lt;/p&gt;"
            style="font-family:var(--font-mono);font-size:12px;resize:vertical">${_esc(_state.descEn)}</textarea>
          <div style="display:flex;gap:14px;font-size:11px;color:var(--text-muted);margin-top:4px;flex-wrap:wrap">
            <span id="al-desc-len">${_state.descEn.replace(/<[^>]+>/g,'').length}文字</span>
            <span id="al-structured-hint"></span>
            <span id="al-mobile-hint"></span>
          </div>

          <div style="margin-top:12px">
            <label class="al-lbl">Condition Description（状態説明）</label>
            <textarea id="al-condition-desc" class="form-input" rows="3"
              placeholder="例: Brand new with original tags. No flaws, scratches, or signs of use."
              style="font-size:12px;resize:vertical">${_esc(_state.conditionDesc)}</textarea>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
              10文字以上でスコアに加算（現在:
              <span id="al-cd-len">${_state.conditionDesc.length}</span>文字）
            </div>
          </div>
        </div>

        <!-- S6: 出品設定 -->
        <div class="card">
          <div class="card-title">⑥ 出品設定</div>
          <div class="al-crow" style="margin-bottom:12px">
            <label class="al-clbl">
              <input id="al-best-offer" type="checkbox"${_state.bestOffer?' checked':''}
                style="accent-color:var(--gold-400)">
              ベスト・オファー受付
            </label>
            <label class="al-clbl">
              <input id="al-private" type="checkbox"${_state.isPrivate?' checked':''}
                style="accent-color:var(--gold-400)">
              プライベート出品
            </label>
          </div>
          <div id="al-best-offer-row" style="${_state.bestOffer?'':'display:none'}">
            <label class="al-lbl">自動承認最低価格（USD）</label>
            <input id="al-best-offer-min" type="number" class="form-input"
              placeholder="例: 40" min="0" step="0.01"
              value="${_state.bestOfferMin||''}" style="max-width:160px">
          </div>
        </div>

        <!-- アクション -->
        <div style="display:flex;gap:12px;justify-content:flex-end;padding-bottom:32px">
          <button id="al-reset-btn" type="button" class="btn btn-danger">リセット</button>
          <button id="al-save-btn" type="button" class="btn-primary">下書き保存</button>
          <button type="button" class="btn-primary" disabled
            style="opacity:.4;cursor:not-allowed"
            title="eBay Selling API接続後に有効化（STAGE2）">eBay出品</button>
        </div>
      </div>

      <!-- 右カラム: リアルタイム品質スコア -->
      <div class="al-sticky" style="position:sticky;top:16px">
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">リスティング品質スコア</div>
          <div id="al-score-panel" style="min-height:80px">
            <div style="color:var(--text-muted);font-size:12px;text-align:center;padding:28px 0">
              入力すると自動でスコアが更新されます
            </div>
          </div>
        </div>
      </div>
    </div>`;

    _renderImageGrid(root);
    _bindEvents(root);
    if (_state.descEn) _updateDescHints(root, _state.descEn);

    if (window.BA.listingQuality?.attachAutocomplete) {
      window.BA.listingQuality.attachAutocomplete(
        root.querySelector('#al-brand'),
        (val) => { _state.brand = val; _debouncedScore(root); }
      );
    }
  }

  // ─── イベントバインド ─────────────────────────────
  function _bindEvents(root) {
    // 引用元URL
    root.querySelector('#al-source-url').addEventListener('input', e => {
      _state.sourceUrl = e.target.value.trim();
      const site = _state.sourceUrl ? _detectSite(_state.sourceUrl) : '';
      _state.sourceSite = site;
      const badge = root.querySelector('#al-site-badge');
      const hint  = root.querySelector('#al-source-hint');
      if (site && SITE_META[site]) {
        badge.innerHTML = `<span style="color:${SITE_META[site].color};font-weight:700">${SITE_META[site].label}</span>`;
        hint.textContent = site === 'ebay'
          ? (() => { const id = _parseEbayItemId(_state.sourceUrl); return id ? `eBayアイテムID検出: ${id}` : 'URLを確認しました（アイテムIDを手動確認してください）'; })()
          : `${SITE_META[site].label}のURLを確認しました。商品情報を手動でコピーしてください。`;
      } else {
        badge.textContent = '未入力';
        hint.textContent  = '';
      }
    });

    root.querySelector('#al-title-ja').addEventListener('input', e => { _state.titleJa = e.target.value; });

    root.querySelector('#al-title-en').addEventListener('input', e => {
      _state.titleEn = e.target.value;
      const cnt = e.target.value.length;
      const el  = root.querySelector('#al-title-en-count');
      el.textContent = `${cnt}/80`;
      el.style.color = cnt >= 75 && cnt <= 80 ? 'var(--green)' : cnt > 80 ? 'var(--red)' : 'var(--text-muted)';
      _debouncedScore(root);
    });

    root.querySelector('#al-translate-btn').addEventListener('click', async () => {
      const text    = _state.titleJa.trim();
      const statusEl = root.querySelector('#al-translate-status');
      if (!text) { statusEl.textContent = '日本語タイトルを入力してください'; return; }
      const btn = root.querySelector('#al-translate-btn');
      btn.disabled = true; btn.textContent = '翻訳中...'; statusEl.textContent = '';
      try {
        const result = await _translate(text);
        _state.titleEn = result.slice(0, 80);
        const enEl = root.querySelector('#al-title-en');
        enEl.value = _state.titleEn;
        enEl.dispatchEvent(new Event('input'));
      } catch (err) {
        statusEl.textContent = `翻訳失敗: ${err.message}`;
      } finally {
        btn.disabled = false; btn.textContent = '翻訳';
      }
    });

    root.querySelector('#al-category-name').addEventListener('input', e => { _state.categoryName = e.target.value; });
    root.querySelector('#al-category-id').addEventListener('input', e => { _state.categoryId = e.target.value; });
    root.querySelector('#al-sku').addEventListener('input', e => { _state.sku = e.target.value; });

    // 画像ドロップゾーン
    const dropZone  = root.querySelector('#al-drop-zone');
    const dropInput = root.querySelector('#al-drop-input');
    dropZone.addEventListener('click', e => { if (!e.target.closest('#al-image-grid')) dropInput.click(); });
    dropInput.addEventListener('change', e => { _addFiles(e.target.files, root); e.target.value = ''; });
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--gold-400)';
      dropZone.style.background  = 'var(--gold-hover)';
    });
    ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, () => {
      dropZone.style.borderColor = '';
      dropZone.style.background  = '';
    }));
    dropZone.addEventListener('drop', e => { e.preventDefault(); _addFiles(e.dataTransfer.files, root); });

    // 画像グリッド（イベント委任）
    const grid = root.querySelector('#al-image-grid');
    grid.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) {
        const idx = parseInt(rm.dataset.rm, 10);
        URL.revokeObjectURL(_state.images[idx]?.blobUrl);
        _state.images.splice(idx, 1);
        _renderImageGrid(root);
        _debouncedScore(root);
        return;
      }
      if (e.target.closest('#al-add-label')) root.querySelector('#al-add-input')?.click();
    });
    grid.addEventListener('change', e => {
      if (e.target.id === 'al-add-input') { _addFiles(e.target.files, root); e.target.value = ''; }
    });
    grid.addEventListener('dragstart', e => {
      const t = e.target.closest('.al-thumb');
      if (!t) return;
      _state.dragIdx = parseInt(t.dataset.idx, 10);
      e.dataTransfer.effectAllowed = 'move';
    });
    grid.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    grid.addEventListener('drop', e => {
      e.preventDefault();
      const t = e.target.closest('.al-thumb');
      if (!t || _state.dragIdx === null) return;
      const over = parseInt(t.dataset.idx, 10);
      if (over !== _state.dragIdx) {
        const moved = _state.images.splice(_state.dragIdx, 1)[0];
        _state.images.splice(over, 0, moved);
        _renderImageGrid(root);
        _debouncedScore(root);
      }
      _state.dragIdx = null;
    });
    grid.addEventListener('dragend', () => { _state.dragIdx = null; });

    // 商品詳細
    root.querySelector('#al-condition').addEventListener('change', e => { _state.condition = e.target.value; _debouncedScore(root); });
    root.querySelector('#al-brand').addEventListener('input', e => { _state.brand = e.target.value; _debouncedScore(root); });
    root.querySelector('#al-weight').addEventListener('input', e => {
      _state.weightG = parseInt(e.target.value, 10) || null;
      root.querySelector('#al-shipping-policy').textContent = _shippingLabel(_state.weightG);
    });
    root.querySelector('#al-upc').addEventListener('input', e => { _state.upc = e.target.value; _debouncedScore(root); });
    root.querySelector('#al-authorized').addEventListener('change', e => { _state.isAuthorizedDealer = e.target.checked; _debouncedScore(root); });
    root.querySelector('#al-gpsr').addEventListener('change', e => { _state.gpsrCompliant = e.target.checked; _debouncedScore(root); });
    root.querySelector('#al-return-policy').addEventListener('change', e => { _state.hasReturnPolicy = e.target.checked; _debouncedScore(root); });

    // 価格計算
    root.querySelector('#al-cost-jpy').addEventListener('input', e => {
      _state.costJpy = parseInt(e.target.value, 10) || null;
      _updatePriceSummary(root); _debouncedScore(root);
    });
    root.querySelector('#al-margin').addEventListener('input', e => {
      _state.targetMargin = parseFloat(e.target.value) || 25;
      _updatePriceSummary(root);
    });
    root.querySelector('#al-price-usd').addEventListener('input', e => {
      _state.priceUsd = parseFloat(e.target.value) || null;
      _updatePriceSummary(root); _debouncedScore(root);
    });

    // 説明文フォーマットボタン
    root.querySelectorAll('.al-fmt').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (!tag) return;
        const ta  = root.querySelector('#al-desc-en');
        const s   = ta.selectionStart;
        const e2  = ta.selectionEnd;
        const sel = ta.value.slice(s, e2);
        const ins = sel ? `<${tag}>${sel}</${tag}>` : `<${tag}></${tag}>`;
        ta.value  = ta.value.slice(0, s) + ins + ta.value.slice(e2);
        ta.selectionStart = ta.selectionEnd = s + ins.length;
        ta.dispatchEvent(new Event('input'));
        ta.focus();
      });
    });

    root.querySelector('#al-tmpl-btn').addEventListener('click', () => {
      const ta = root.querySelector('#al-desc-en');
      if (ta.value.trim()) return;
      ta.value = '<h2>Product Description</h2>\n<p>This item is in excellent condition with no signs of use.</p>\n\n<h2>Shipping</h2>\n<p>Ships from Japan via DHL Express. Dispatched within 1-2 business days.</p>\n\n<h2>Returns</h2>\n<p>30-day returns accepted. Item must be returned in original condition.</p>\n\n<h2>Payment</h2>\n<p>We accept Managed Payments only.</p>';
      ta.dispatchEvent(new Event('input'));
    });

    root.querySelector('#al-desc-en').addEventListener('input', e => {
      _state.descEn = e.target.value;
      _updateDescHints(root, _state.descEn);
      _debouncedScore(root);
    });

    root.querySelector('#al-condition-desc').addEventListener('input', e => {
      _state.conditionDesc = e.target.value;
      const el = root.querySelector('#al-cd-len');
      if (el) el.textContent = e.target.value.length;
      _debouncedScore(root);
    });

    // 出品設定
    root.querySelector('#al-best-offer').addEventListener('change', e => {
      _state.bestOffer = e.target.checked;
      root.querySelector('#al-best-offer-row').style.display = e.target.checked ? '' : 'none';
    });
    root.querySelector('#al-best-offer-min').addEventListener('input', e => {
      _state.bestOfferMin = parseFloat(e.target.value) || null;
    });
    root.querySelector('#al-private').addEventListener('change', e => { _state.isPrivate = e.target.checked; });

    // アクション
    root.querySelector('#al-save-btn').addEventListener('click', async () => {
      const btn = root.querySelector('#al-save-btn');
      btn.disabled = true; btn.textContent = '保存中...';
      try { await _saveDraft(); } finally { btn.disabled = false; btn.textContent = '下書き保存'; }
    });

    root.querySelector('#al-reset-btn').addEventListener('click', () => {
      if (!confirm('入力内容をリセットしますか？')) return;
      _state.images.forEach(i => URL.revokeObjectURL(i.blobUrl));
      _state = _defaultState();
      _state.sku = _genSku();
      _render(root);
    });
  }

  // ─── 公開API ─────────────────────────────────────
  window.BA.autoListing = {
    init() {
      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'auto-listing') return;
        const root = document.getElementById('auto-listing-root');
        if (root && !root.dataset.initialized) {
          root.dataset.initialized = '1';
          _render(root);
        }
      });
    },
  };

})();
