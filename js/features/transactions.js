// @not-security-critical （grep確認済み・認証情報/トークン/APIキーを扱わない・2026-06-25判断）
/**
 * BRAND ANALYTICS — transactions.js
 * 取引記録入力 + 学習型手数料計算エンジン（FREE 機能）
 *
 * - FeeEngine: 取引記録から手数料率を移動平均で学習
 * - TransactionStore: Supabase への保存・読み込み（未認証時はメモリのみ）
 * - TransactionUI: 入力フォーム + 取引一覧 + 学習ステータス表示
 *
 * フォールバック（記録5件未満）:
 *   eBay成約手数料 15%  / Promoted 2% / Payoneer 2% / 真贋サービス ¥1,500
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // 定数
  // ─────────────────────────────────────
  const DEFAULTS = {
    ebayFeeRate:     0.15,
    promotedRate:    0.02,
    payoneerRate:    0.02,
    authServiceJpy:  1500,
    minRecords:      5,
    movingAvgWindow: 20,
    threshold500:    500,
  };

  // ─────────────────────────────────────
  // 学習エンジン
  // ─────────────────────────────────────
  const FeeEngine = {
    /**
     * @param {Array} records - transaction_logs の配列
     * @returns {{ ebayFeeRate, promotedRate, payoneerRate, authServiceJpy, recordCount, isFallback }}
     */
    compute(records) {
      const count = records?.length ?? 0;

      if (count < DEFAULTS.minRecords) {
        return {
          ebayFeeRate:    DEFAULTS.ebayFeeRate,
          promotedRate:   DEFAULTS.promotedRate,
          payoneerRate:   DEFAULTS.payoneerRate,
          authServiceJpy: DEFAULTS.authServiceJpy,
          recordCount:    count,
          isFallback:     true,
        };
      }

      const recent = records.slice(-DEFAULTS.movingAvgWindow);

      const avg = (arr) => arr.length > 0
        ? arr.reduce((a, b) => a + b, 0) / arr.length
        : null;

      // eBay手数料率
      const ebayRates = recent
        .filter(r => r.sale_price_usd > 0 && r.ebay_fee_usd > 0)
        .map(r => r.ebay_fee_usd / r.sale_price_usd);
      const ebayFeeRate = avg(ebayRates) ?? DEFAULTS.ebayFeeRate;

      // Promoted率
      const promoRates = recent
        .filter(r => r.sale_price_usd > 0 && r.promoted_fee_usd > 0)
        .map(r => r.promoted_fee_usd / r.sale_price_usd);
      const promotedRate = avg(promoRates) ?? DEFAULTS.promotedRate;

      // Payoneer手数料率
      const payRates = recent
        .filter(r => r.sale_price_usd > 0 && r.payoneer_fee_usd > 0)
        .map(r => r.payoneer_fee_usd / r.sale_price_usd);
      const payoneerRate = avg(payRates) ?? DEFAULTS.payoneerRate;

      // 真贋サービス送料: 中央値（含める設定の$500以上取引のみ）
      const authAmounts = recent
        .filter(r =>
          r.sale_price_usd >= DEFAULTS.threshold500 &&
          r.auth_service_incl &&
          r.auth_service_jpy > 0
        )
        .map(r => r.auth_service_jpy)
        .sort((a, b) => a - b);
      const authServiceJpy = authAmounts.length > 0
        ? authAmounts[Math.floor(authAmounts.length / 2)]
        : DEFAULTS.authServiceJpy;

      return {
        ebayFeeRate,
        promotedRate,
        payoneerRate,
        authServiceJpy,
        recordCount: count,
        isFallback:  false,
      };
    },
  };

  // ─────────────────────────────────────
  // ストア（Supabase CRUD）
  // ─────────────────────────────────────
  let _records = [];
  let _learned  = null;

  const TransactionStore = {
    async add(record) {
      const user     = BA.auth?.getUser?.();
      const supabase = BA.auth?.getSupabase?.();

      if (!user || !supabase) {
        _records = [
          { ...record, id: crypto.randomUUID(), created_at: new Date().toISOString() },
          ..._records,
        ];
        _learned = FeeEngine.compute(_records);
        return { local: true };
      }

      const { data, error } = await supabase
        .from('transaction_logs')
        .insert({ ...record, user_id: user.id })
        .select()
        .single();

      if (error) {
        if (error.message?.includes('schema cache') || error.code === '42P01' || error.message?.includes('relation')) {
          throw new Error('データベーステーブルが未作成です。管理者に連絡してください（schema_stage1_learning.sql を適用してください）。');
        }
        throw error;
      }

      _records = [data, ..._records];
      _learned  = FeeEngine.compute(_records);
      return data;
    },

    async list() {
      const user     = BA.auth?.getUser?.();
      const supabase = BA.auth?.getSupabase?.();

      if (!user || !supabase) {
        _learned = FeeEngine.compute(_records);
        return _records;
      }

      const { data, error } = await supabase
        .from('transaction_logs')
        .select('*')
        .order('traded_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[transactions] list error:', error);
        _learned = FeeEngine.compute(_records);
        return _records;
      }

      _records = data ?? [];
      _learned  = FeeEngine.compute(_records);
      return _records;
    },

    async syncFromEbay() {
      const user     = BA.auth?.getUser?.();
      const supabase = BA.auth?.getSupabase?.();
      if (!user || !supabase) throw new Error('ログインが必要です');

      // eBay Finances API から取引一覧を取得
      const res = await BA.api.getTransactions();
      const transactions = res?.transactions ?? [];

      // SALE タイプのみ対象
      const sales = transactions.filter(t => t.transactionType === 'SALE');
      if (sales.length === 0) return { added: 0, skipped: 0 };

      // 既存レコードの取引日一覧を取得（重複チェック用）
      const { data: existing } = await supabase
        .from('transaction_logs')
        .select('traded_at, sale_price_usd')
        .eq('user_id', user.id);

      const existingKeys = new Set(
        (existing ?? []).map(r => `${r.traded_at}_${parseFloat(r.sale_price_usd).toFixed(2)}`)
      );

      let added = 0;
      let skipped = 0;

      for (const t of sales) {
        // eBay API レスポンスのマッピング
        // amount.value = 純受取額（手数料引き後）
        // totalFeeAmount.value = 手数料合計
        const netAmount   = parseFloat(t.amount?.value ?? 0);
        const totalFee    = parseFloat(t.totalFeeAmount?.value ?? 0);
        const grossPrice  = netAmount + totalFee; // 販売価格（概算）

        // 手数料内訳
        const fees = t.marketplaceFees ?? [];
        const ebayFee = fees
          .filter(f => f.feeType === 'FINAL_VALUE_FEE' ||
                       f.feeType === 'FINAL_VALUE_FEE_FIXED_PER_ORDER')
          .reduce((s, f) => s + parseFloat(f.amount?.value ?? 0), 0);
        const adFee = fees
          .filter(f => f.feeType === 'AD_FEE')
          .reduce((s, f) => s + parseFloat(f.amount?.value ?? 0), 0);

        // 取引日（YYYY-MM-DD）
        const tradedAt = t.transactionDate
          ? t.transactionDate.slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        // 重複チェック
        const key = `${tradedAt}_${grossPrice.toFixed(2)}`;
        if (existingKeys.has(key)) { skipped++; continue; }

        // Supabase に保存
        const { error } = await supabase
          .from('transaction_logs')
          .insert({
            user_id:           user.id,
            sale_price_usd:    grossPrice,
            ebay_fee_usd:      ebayFee,
            promoted_fee_usd:  adFee,
            payoneer_fee_usd:  0,   // Finances APIでは取得不可・手動補完
            auth_service_jpy:  0,
            auth_service_incl: false,
            cost_price_jpy:    0,   // 仕入原価は自動取得不可
            received_jpy:      0,
            exchange_rate:     null,
            traded_at:         tradedAt,
          });

        if (!error) {
          existingKeys.add(key);
          added++;
        }
      }

      // メモリ上のレコードを再取得
      await this.list();
      return { added, skipped };
    },

    getLearned() {
      if (!_learned) _learned = FeeEngine.compute(_records);
      return _learned;
    },
  };

  // ─────────────────────────────────────
  // UI ヘルパー
  // ─────────────────────────────────────
  function _fmtRate(r) {
    return `${(r * 100).toFixed(2)}%`;
  }

  function _renderStatusBanner(learned) {
    if (learned.isFallback) {
      const remaining = DEFAULTS.minRecords - learned.recordCount;
      return `
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--yellow);
          background:var(--yellow-dim);border:1px solid rgba(245,200,66,.22);
          border-radius:4px;padding:8px 12px;margin-bottom:16px">
          ⚠ ${learned.recordCount}件学習済み — あと${remaining}件でフォールバック解除（現在はデフォルト値を使用）
        </div>`;
    }
    return `
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--green);
        background:var(--green-dim);border:1px solid rgba(78,206,138,.22);
        border-radius:4px;padding:8px 12px;margin-bottom:16px">
        ✓ ${learned.recordCount}件の実績データから手数料率を自動推定中
      </div>`;
  }

  function _renderLearnedRates(learned) {
    const tag = learned.isFallback ? 'フォールバック' : '実績平均';
    const col = learned.isFallback ? 'var(--text-muted)' : 'var(--gold-400)';
    const items = [
      { label: 'eBay成約手数料',  val: _fmtRate(learned.ebayFeeRate) },
      { label: 'Promoted率',      val: _fmtRate(learned.promotedRate) },
      { label: 'Payoneer手数料',  val: _fmtRate(learned.payoneerRate) },
      { label: '真贋サービス送料', val: `¥${learned.authServiceJpy.toLocaleString()}` },
    ];
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        ${items.map(({ label, val }) => `
          <div class="card" style="text-align:center;padding:12px 8px">
            <div class="card-title" style="font-size:9px">${label}</div>
            <div style="font-family:var(--font-mono);font-size:1.15rem;color:${col};margin:4px 0">${val}</div>
            <div style="font-size:9px;color:var(--text-muted)">${tag}</div>
          </div>`).join('')}
      </div>`;
  }

  function _renderForm() {
    const today = new Date().toISOString().slice(0, 10);
    return `
      <div class="card">
        <div class="card-title">取引記録を追加</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="input-group">
            <label class="input-label" for="tx-price">販売価格</label>
            <div class="input-wrap">
              <div class="input-prefix">$</div>
              <input class="input" id="tx-price" type="number" min="0" step="0.01" placeholder="0.00">
            </div>
          </div>
          <div class="input-group">
            <label class="input-label" for="tx-date">取引日</label>
            <input class="input" id="tx-date" type="date" value="${today}">
          </div>
        </div>

        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
          background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;
          padding:8px 12px;margin-bottom:12px">
          ※ 手数料（任意）を入力すると学習精度が向上します。未入力の項目はデフォルト値を使用します。
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="input-group">
            <label class="input-label" for="tx-ebay-fee">eBay成約手数料 <span style="color:var(--text-muted);font-size:9px">（任意）</span></label>
            <div class="input-wrap">
              <div class="input-prefix">$</div>
              <input class="input" id="tx-ebay-fee" type="number" min="0" step="0.01" placeholder="0.00">
            </div>
            <div id="tx-ebay-ref" style="font-size:10px;color:var(--text-muted);margin-top:2px">参考（15.0%）: —</div>
          </div>
          <div class="input-group">
            <label class="input-label" for="tx-promoted-fee">Promoted <span style="color:var(--text-muted);font-size:9px">（任意）</span></label>
            <div class="input-wrap">
              <div class="input-prefix">$</div>
              <input class="input" id="tx-promoted-fee" type="number" min="0" step="0.01" placeholder="0.00">
            </div>
            <div id="tx-promoted-ref" style="font-size:10px;color:var(--text-muted);margin-top:2px">参考（2.0%）: —</div>
          </div>
          <div class="input-group">
            <label class="input-label" for="tx-payoneer-fee">Payoneer手数料 <span style="color:var(--text-muted);font-size:9px">（任意）</span></label>
            <div class="input-wrap">
              <div class="input-prefix">$</div>
              <input class="input" id="tx-payoneer-fee" type="number" min="0" step="0.01" placeholder="0.00">
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="input-group">
            <label class="input-label" for="tx-cost">仕入れ原価 <span style="color:var(--text-muted);font-size:9px">（任意）</span></label>
            <div class="input-wrap">
              <div class="input-prefix">¥</div>
              <input class="input" id="tx-cost" type="number" min="0" step="1" placeholder="0">
            </div>
          </div>
          <div class="input-group">
            <label class="input-label" for="tx-received">円受取額 <span style="color:var(--text-muted);font-size:9px">（任意・為替乖離計算用）</span></label>
            <div class="input-wrap">
              <div class="input-prefix">¥</div>
              <input class="input" id="tx-received" type="number" min="0" step="1" placeholder="0">
            </div>
          </div>
        </div>

        <!-- $500以上のみ: 真贋サービス -->
        <div id="tx-auth-section" style="display:none;background:var(--bg-elevated);
          border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px">
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--gold-500);
            letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">
            $500以上 — 真贋サービス（国内送料）
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="input-group">
              <label class="input-label" for="tx-auth-jpy">送料</label>
              <div class="input-wrap">
                <div class="input-prefix">¥</div>
                <input class="input" id="tx-auth-jpy" type="number" min="0" step="1" value="1500">
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">利益計算に含める</label>
              <div style="display:flex;gap:16px;align-items:center;min-height:44px">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                  <input type="radio" name="tx-auth-incl" id="tx-auth-incl-yes" value="true" checked
                    style="accent-color:var(--gold-400);width:16px;height:16px">
                  含める
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                  <input type="radio" name="tx-auth-incl" id="tx-auth-incl-no" value="false"
                    style="accent-color:var(--gold-400);width:16px;height:16px">
                  含めない
                </label>
              </div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px">
                販管費として計上する場合は「含めない」
              </div>
            </div>
          </div>
        </div>

        <div id="tx-form-msg" style="display:none;font-size:12px;margin-bottom:8px"></div>

        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-primary" id="tx-submit">記録を追加</button>
        </div>
      </div>`;
  }

  function _renderList(records) {
    if (records.length === 0) {
      return `
        <div class="card" style="text-align:center;padding:32px;color:var(--text-muted);
          font-family:var(--font-mono);font-size:11px">
          取引記録がありません。最初の取引を追加してください。
        </div>`;
    }

    const rows = records.slice(0, 20).map(r => {
      const price = parseFloat(r.sale_price_usd);
      const ebayRate = price > 0 && r.ebay_fee_usd > 0
        ? `${((r.ebay_fee_usd / price) * 100).toFixed(1)}%` : '—';
      const promoRate = price > 0 && r.promoted_fee_usd > 0
        ? `${((r.promoted_fee_usd / price) * 100).toFixed(1)}%` : '—';
      const authCell = price >= DEFAULTS.threshold500
        ? `¥${(r.auth_service_jpy ?? 0).toLocaleString()}${r.auth_service_incl ? '' : ' (除外)'}`
        : '—';
      return `
        <tr>
          <td style="font-family:var(--font-mono)">${r.traded_at}</td>
          <td style="font-family:var(--font-mono);text-align:right">$${price.toFixed(2)}</td>
          <td style="font-family:var(--font-mono);text-align:right">${ebayRate}</td>
          <td style="font-family:var(--font-mono);text-align:right">${promoRate}</td>
          <td style="font-family:var(--font-mono);text-align:right">${authCell}</td>
        </tr>`;
    }).join('');

    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin:0">取引記録（最新20件）</div>
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">
            全${records.length}件
          </span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>取引日</th>
              <th style="text-align:right">販売価格</th>
              <th style="text-align:right">eBay手数料率</th>
              <th style="text-align:right">Promoted率</th>
              <th style="text-align:right">真贋送料</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ─────────────────────────────────────
  // メインレンダー
  // ─────────────────────────────────────

  const _HINT_KEY_TX = 'ba_hint_transactions';

  function _tutorialBanner() {
    try { if (localStorage.getItem(_HINT_KEY_TX)) return ''; } catch {}
    return `
      <div id="tx-tut-banner" style="display:flex;align-items:flex-start;gap:12px;
        padding:12px 16px;background:rgba(232,140,60,.08);
        border:1px solid rgba(232,140,60,.2);border-radius:8px;margin-bottom:16px">
        <span style="font-size:16px;color:var(--brand);flex-shrink:0;line-height:1.5">＋</span>
        <div style="flex:1;font-size:13px;color:var(--text-secondary);line-height:1.7">
          <strong style="color:var(--text-primary)">取引記録の使い方</strong><br>
          販売ごとの手数料・仕入原価・実受取額を記録すると、eBay手数料率が自動で推定されます。
          5件入力するとフォールバック解除・実績手数料率が確定します（目安：1件約30秒）。
        </div>
        <button id="tx-tut-close" aria-label="閉じる"
          style="background:none;border:none;cursor:pointer;color:var(--text-muted);
            font-size:18px;padding:0 0 0 8px;line-height:1;flex-shrink:0">×</button>
      </div>`;
  }

  function _render(root) {
    const learned = TransactionStore.getLearned();
    root.innerHTML = `
      <div id="tx-sync-bar" style="display:flex;align-items:center;gap:12px;
        padding:10px 16px;background:var(--surface-2);
        border:1px solid var(--border);border-radius:8px;margin-bottom:16px">
        <div style="flex:1;font-size:12px;color:var(--text-secondary)">
          <span id="tx-sync-status">eBay取引データを自動取得できます</span>
        </div>
        <button class="btn btn-secondary" id="tx-sync-btn" style="font-size:11px;padding:6px 12px">
          ↓ eBayと同期
        </button>
      </div>
      ${_tutorialBanner()}
      ${_renderStatusBanner(learned)}
      ${_renderLearnedRates(learned)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
        <div>${_renderForm()}</div>
        <div>${_renderList(_records)}</div>
      </div>`;

    root.querySelector('#tx-tut-close')?.addEventListener('click', () => {
      try { localStorage.setItem(_HINT_KEY_TX, '1'); } catch {}
      root.querySelector('#tx-tut-banner')?.remove();
    });

    _bindFormEvents(root);
  }

  function _bindFormEvents(root) {
    const priceEl  = root.querySelector('#tx-price');
    const authSec  = root.querySelector('#tx-auth-section');
    const ebayRef  = root.querySelector('#tx-ebay-ref');
    const promoRef = root.querySelector('#tx-promoted-ref');

    priceEl?.addEventListener('input', () => {
      const price = parseFloat(priceEl.value) || 0;
      if (authSec)  authSec.style.display  = price >= DEFAULTS.threshold500 ? 'block' : 'none';
      if (ebayRef)  ebayRef.textContent  = price > 0 ? `参考（15.0%）: $${(price * DEFAULTS.ebayFeeRate).toFixed(2)}`  : '参考（15.0%）: —';
      if (promoRef) promoRef.textContent = price > 0 ? `参考（2.0%）: $${(price * DEFAULTS.promotedRate).toFixed(2)}` : '参考（2.0%）: —';
    });

    root.querySelector('#tx-submit')?.addEventListener('click', async () => {
      const price       = parseFloat(root.querySelector('#tx-price')?.value)        || 0;
      const date        = root.querySelector('#tx-date')?.value;
      const ebayFee     = parseFloat(root.querySelector('#tx-ebay-fee')?.value)     || 0;
      const promotedFee = parseFloat(root.querySelector('#tx-promoted-fee')?.value) || 0;
      const payoneerFee = parseFloat(root.querySelector('#tx-payoneer-fee')?.value) || 0;
      const costJpy     = parseInt(root.querySelector('#tx-cost')?.value)            || 0;
      const receivedJpy = parseInt(root.querySelector('#tx-received')?.value)        || 0;

      const above500 = price >= DEFAULTS.threshold500;
      const authJpy  = above500 ? (parseInt(root.querySelector('#tx-auth-jpy')?.value) || DEFAULTS.authServiceJpy) : 0;
      const authIncl = above500 ? (root.querySelector('#tx-auth-incl-yes')?.checked ?? true) : false;

      const msgEl = root.querySelector('#tx-form-msg');

      if (!price || !date) {
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.color   = 'var(--red)';
          msgEl.textContent   = '販売価格と取引日は必須です。';
        }
        return;
      }

      if (msgEl) msgEl.style.display = 'none';

      const btn = root.querySelector('#tx-submit');
      if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }

      let exchangeRate = null;
      try { exchangeRate = await BA.api?.getExchangeRate?.() ?? null; } catch { /* フォールバック: null保存 */ }

      try {
        await TransactionStore.add({
          sale_price_usd:    price,
          ebay_fee_usd:      ebayFee,
          promoted_fee_usd:  promotedFee,
          payoneer_fee_usd:  payoneerFee,
          auth_service_jpy:  authJpy,
          auth_service_incl: authIncl,
          cost_price_jpy:    costJpy,
          received_jpy:      receivedJpy,
          exchange_rate:     exchangeRate,
          traded_at:         date,
        });

        document.dispatchEvent(new CustomEvent('ba:transaction-added'));
        BA.notify?.toast?.('取引記録を追加しました', 'success');
        _render(root);

      } catch (err) {
        console.error('[transactions] add error:', err);
        BA.notify?.toast?.('保存に失敗しました: ' + (err.message ?? err), 'error');
        if (btn) { btn.disabled = false; btn.textContent = '記録を追加'; }
      }
    });

    // eBay同期ボタン
    root.querySelector('#tx-sync-btn')?.addEventListener('click', async () => {
      const btn    = root.querySelector('#tx-sync-btn');
      const status = root.querySelector('#tx-sync-status');
      if (btn) { btn.disabled = true; btn.textContent = '同期中...'; }
      try {
        const result = await TransactionStore.syncFromEbay();
        if (status) {
          status.textContent =
            `同期完了：${result.added}件追加・${result.skipped}件スキップ（重複）`;
          status.style.color = 'var(--green)';
        }
        BA.notify?.toast?.(`${result.added}件の取引を取得しました`, 'success');
        _render(root); // 一覧を再描画
      } catch (err) {
        if (status) {
          status.textContent = '同期失敗：' + (err.message ?? '不明なエラー');
          status.style.color = 'var(--red)';
        }
        BA.notify?.toast?.('同期に失敗しました: ' + (err.message ?? err), 'error');
        if (btn) { btn.disabled = false; btn.textContent = '↓ eBayと同期'; }
      }
    });
  }

  // ─────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────
  const transactions = {
    async init() {
      try {
        await TransactionStore.list();
      } catch (err) {
        console.error('[transactions] init error:', err);
      }

      document.addEventListener('ba:panel-show', ({ detail }) => {
        if (detail.panelKey !== 'transactions') return;
        const root = document.getElementById('transactions-root');
        if (root) _render(root);
      });
    },

    /** profit.js が手数料のデフォルト値として参照する */
    getLearned() {
      return TransactionStore.getLearned();
    },

    /** dashboard.js が今月集計のために参照する */
    async list() {
      return TransactionStore.list();
    },

    /** finance.js が集計に使うキャッシュ済みレコードを同期取得する */
    getRecords() {
      return _records;
    },
  };

  window.BA.transactions = transactions;

})();
